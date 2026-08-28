// ============================================================
// AUTH SERVICE — port native dari src/services/authService.ts (webview).
// Sesi disimpan di AsyncStorage (SecureStore lebih aman tapi py batas
// ukuran ~2KB per key & tidak cocok utk daftar akun majemuk yang bisa
// tumbuh - AsyncStorage dipilih sama seperti localStorage di web krn
// data ini bukan rahasia super-sensitif, cuma token sesi yang expire).
// ============================================================
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getActiveDemoAccount, exitDemoMode as clearDemoSession } from "./demoService";

export type RoleName =
  | "Admin IT"
  | "Supervisor"
  | "Admin TU (SD)"
  | "Admin Media (SD)"
  | "Admin TU (TK & Playground)"
  | "Admin Media (TK & Playground)"
  | "Keuangan"
  | "Orang Tua"
  | "Guru"
  | "Guru Kelas"
  | "Pegawai";

export interface SavedAccount {
  id: string;
  username: string;
  role: RoleName;
  fullName: string;
  avatarInitials: string;
  avatarUrl: string | null;
  token: string;
}

export interface ActiveSession {
  accountId: string;
  role: RoleName;
  username: string;
  fullName: string;
  avatarInitials: string;
  avatarUrl: string | null;
  loginAt: string;
}

const KEYS = {
  activeSession: "alikhlas86_active_session",
  savedAccounts: "alikhlas86_saved_accounts",
  activeAccountId: "alikhlas86_active_account_id",
} as const;

// Cache di memori supaya kode yang butuh baca SINKRON (mis. getActiveToken
// dipanggil di tengah fetch) tetap bisa jalan - AsyncStorage 100% async,
// beda dari localStorage. State ini diisi ulang tiap kali ada operasi
// tulis, dan WAJIB dimuat sekali di awal (lihat loadAuthState/App.tsx)
// sebelum layar manapun bergantung padanya.
let cachedAccounts: SavedAccount[] = [];
let cachedSession: ActiveSession | null = null;
let loaded = false;

export async function loadAuthState(): Promise<void> {
  const [accountsRaw, sessionRaw] = await Promise.all([
    AsyncStorage.getItem(KEYS.savedAccounts),
    AsyncStorage.getItem(KEYS.activeSession),
  ]);
  try { cachedAccounts = accountsRaw ? JSON.parse(accountsRaw) : []; } catch { cachedAccounts = []; }
  try { cachedSession = sessionRaw ? JSON.parse(sessionRaw) : null; } catch { cachedSession = null; }
  loaded = true;
}

function assertLoaded() {
  if (!loaded) throw new Error("authService belum di-load - panggil loadAuthState() dulu sebelum app dirender.");
}

async function persistAccounts() {
  await AsyncStorage.setItem(KEYS.savedAccounts, JSON.stringify(cachedAccounts));
}

function upsertSavedAccount(account: SavedAccount) {
  const idx = cachedAccounts.findIndex((a) => a.id === account.id);
  if (idx >= 0) cachedAccounts[idx] = account;
  else cachedAccounts.push(account);
}

export async function addLinkedAccount(account: SavedAccount): Promise<void> {
  assertLoaded();
  upsertSavedAccount(account);
  await persistAccounts();
}

export async function saveSession(account: SavedAccount): Promise<ActiveSession> {
  assertLoaded();
  upsertSavedAccount(account);
  await persistAccounts();

  const session: ActiveSession = {
    accountId: account.id,
    role: account.role,
    username: account.username,
    fullName: account.fullName,
    avatarInitials: account.avatarInitials,
    avatarUrl: account.avatarUrl,
    loginAt: new Date().toISOString(),
  };
  cachedSession = session;
  await AsyncStorage.setItem(KEYS.activeSession, JSON.stringify(session));
  await AsyncStorage.setItem(KEYS.activeAccountId, account.id);
  return session;
}

// Versi "asli" (bukan demo-aware) - lihat catatan lengkap di authService.ts
// webview (App.tsx) kenapa 2 versi ini dipisah.
export function getRealActiveSession(): ActiveSession | null {
  assertLoaded();
  return cachedSession;
}

export function getRealActiveToken(): string | null {
  assertLoaded();
  if (!cachedSession) return null;
  return cachedAccounts.find((a) => a.id === cachedSession!.accountId)?.token ?? null;
}

export function getActiveSession(): ActiveSession | null {
  const demo = getActiveDemoAccount();
  if (demo) {
    return {
      accountId: demo.id,
      role: demo.role as RoleName,
      username: demo.username,
      fullName: demo.fullName,
      avatarInitials: demo.avatarInitials,
      avatarUrl: demo.avatarUrl,
      loginAt: new Date().toISOString(),
    };
  }
  return getRealActiveSession();
}

export function getActiveToken(): string | null {
  const demo = getActiveDemoAccount();
  if (demo) return demo.token;
  return getRealActiveToken();
}

export function getSavedAccounts(): SavedAccount[] {
  assertLoaded();
  return cachedAccounts;
}

export async function switchAccount(accountId: string): Promise<ActiveSession | null> {
  assertLoaded();
  const saved = cachedAccounts.find((a) => a.id === accountId);
  if (!saved) return null;
  const session: ActiveSession = {
    accountId: saved.id,
    role: saved.role,
    username: saved.username,
    fullName: saved.fullName,
    avatarInitials: saved.avatarInitials,
    avatarUrl: saved.avatarUrl,
    loginAt: new Date().toISOString(),
  };
  cachedSession = session;
  await AsyncStorage.setItem(KEYS.activeSession, JSON.stringify(session));
  await AsyncStorage.setItem(KEYS.activeAccountId, saved.id);
  return session;
}

export async function updateAccountAvatar(accountId: string, avatarUrl: string | null): Promise<void> {
  assertLoaded();
  const idx = cachedAccounts.findIndex((a) => a.id === accountId);
  if (idx >= 0) {
    cachedAccounts[idx] = { ...cachedAccounts[idx], avatarUrl };
    await persistAccounts();
  }
  if (cachedSession && cachedSession.accountId === accountId) {
    cachedSession = { ...cachedSession, avatarUrl };
    await AsyncStorage.setItem(KEYS.activeSession, JSON.stringify(cachedSession));
  }
}

export async function removeAccount(accountId: string): Promise<void> {
  assertLoaded();
  cachedAccounts = cachedAccounts.filter((a) => a.id !== accountId);
  await persistAccounts();
  if (cachedSession?.accountId === accountId) {
    cachedSession = null;
    await AsyncStorage.removeItem(KEYS.activeSession);
    await AsyncStorage.removeItem(KEYS.activeAccountId);
  }
}

// Kalau demo aktif, cuma keluar dari demo (bukan logout akun asli) - ini
// JUGA yang bikin token demo kedaluwarsa (8 jam) otomatis "turun" balik
// ke akun asli lewat jalur 401 (lihat api.ts), bukan efek samping
// disengaja tapi konsekuensi alami desain ini. Sama persis pola webview.
export async function logout(): Promise<void> {
  if (getActiveDemoAccount()) {
    await clearDemoSession();
    return;
  }
  assertLoaded();
  cachedSession = null;
  await AsyncStorage.removeItem(KEYS.activeSession);
  await AsyncStorage.removeItem(KEYS.activeAccountId);
  // Saved accounts persist utk re-login cepat gaya Instagram.
}

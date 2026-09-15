// ============================================================
// AUTH SERVICE — port native dari src/services/authService.ts (webview).
// Sesi disimpan di AsyncStorage (SecureStore lebih aman tapi py batas
// ukuran ~2KB per key & tidak cocok utk daftar akun majemuk yang bisa
// tumbuh - AsyncStorage dipilih sama seperti localStorage di web krn
// data ini bukan rahasia super-sensitif, cuma token sesi yang expire).
// ============================================================
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { getActiveDemoAccount, exitDemoMode as clearDemoSession } from "./demoService";

// Pub-sub sesi (2026-09-04) - lihat catatan lengkap di webview authService.ts.
type Listener = () => void;
const sessionListeners = new Set<Listener>();
function notifySessionListeners(): void {
  sessionListeners.forEach((fn) => fn());
}
export function useSessionRefreshTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    sessionListeners.add(listener);
    return () => { sessionListeners.delete(listener); };
  }, []);
  return tick;
}

export type RoleName =
  | "Admin IT"
  | "Supervisor"
  // Kepala Sekolah (2026-09-04) SENGAJA TIDAK ADA lagi - bukan role,
  // sekarang FLAG (isKepalaSekolah) di atas role dasar apa pun - lihat
  // SavedAccount/ActiveSession di bawah.
  | "Keuangan"
  | "Orang Tua"
  | "Guru"
  // Guru Kelas (2026-09-04, Fase 3) JUGA SENGAJA TIDAK ADA lagi - sama
  // seperti Kepala Sekolah, sekarang FLAG (isWaliKelas) di bawah.
  | "Pegawai"
  // legacy names (backward compat) - admin_tu_sd/tk & admin_media_sd/tk
  // DIGABUNG jadi generik (2026-09-14, Sistem Katalog), katalog dari data
  // (user_capabilities.catalog_id), bukan lagi bagian nama role. Nilai di
  // bawah DIBIARKAN aman utk perbandingan lama yg mungkin masih nyangkut,
  // tapi TIDAK PERNAH lagi dikirim backend - nilai baru selalu "Admin
  // TU"/"Admin Media" polos.
  | "Admin TU (SD)"
  | "Admin Media (SD)"
  | "Admin TU (TK & Playground)"
  | "Admin Media (TK & Playground)"
  | "Admin TU"
  | "Admin Media";

export interface SavedAccount {
  id: string;
  username: string;
  role: RoleName;
  fullName: string;
  avatarInitials: string;
  avatarUrl: string | null;
  token: string;
  isKepalaSekolah?: boolean;
  // Manajemen Pengguna multi-flag (2026-09-04) - lihat catatan lengkap di
  // webview authService.ts.
  capabilities?: string[];
  // Guru Kelas (2026-09-04, Fase 3) - FLAG tambahan di atas role dasar
  // 'Guru', lihat catatan lengkap di webview authService.ts.
  isWaliKelas?: boolean;
  // Role Definitions (2026-09-15) - detail PER-KATALOG dari capabilities di
  // atas, lihat catatan lengkap di webview authService.ts.
  catalogRoles?: { roleType: string; catalogId: number }[];
}

export interface ActiveSession {
  accountId: string;
  role: RoleName;
  username: string;
  fullName: string;
  avatarInitials: string;
  avatarUrl: string | null;
  loginAt: string;
  isKepalaSekolah?: boolean;
  capabilities?: string[];
  isWaliKelas?: boolean;
  catalogRoles?: { roleType: string; catalogId: number }[];
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

// Admin IT SENGAJA TIDAK "selamat" dari app DITUTUP TOTAL (proses dimatikan
// OS lalu dibuka lagi) - beda dari role lain yg tetap persisten. Dicek di
// SINI (bukan pakai flag terpisah spt sessionStorage di web) krn
// loadAuthState() ini SENDIRI cuma dipanggil SEKALI per app.tsx mount, dan
// App.tsx cuma remount kalau JS engine benar2 dimulai ulang dari nol
// (kill+buka lagi) - sekadar minimize/background (tanpa dimatikan OS)
// TIDAK memicu remount App.tsx sama sekali, jadi otomatis "selamat" spt
// yang diinginkan (persis semantik sessionStorage utk kebutuhan ini).
// Selalu balikin state FINAL yang benar (accounts + session) baik ada
// Admin IT yang perlu dibersihkan maupun tidak - pemanggil (loadAuthState)
// tinggal pakai apa adanya, tidak perlu logic tambahan apa pun lagi.
async function purgeAdminItOnColdStart(
  accounts: SavedAccount[],
  session: ActiveSession | null
): Promise<{ accounts: SavedAccount[]; session: ActiveSession | null }> {
  const withoutAdminIt = accounts.filter((a) => a.role !== "Admin IT");
  if (withoutAdminIt.length === accounts.length) {
    return { accounts, session }; // tidak ada Admin IT tersimpan, tidak ada yg berubah
  }

  await AsyncStorage.setItem(KEYS.savedAccounts, JSON.stringify(withoutAdminIt));

  if (session?.role !== "Admin IT") {
    return { accounts: withoutAdminIt, session }; // Admin IT tersimpan tapi bukan yg aktif - sesi aktif tidak diganggu
  }

  // Admin IT SEDANG aktif pas app terakhir ditutup - gaya Instagram (sama
  // pola dgn handleLogout di RootNavigator.tsx): pindah ke akun lain kalau
  // masih ada, kalau tidak ada sama sekali balik ke layar login.
  if (withoutAdminIt.length > 0) {
    const next = withoutAdminIt[0];
    const newSession: ActiveSession = {
      accountId: next.id, role: next.role, username: next.username,
      fullName: next.fullName, avatarInitials: next.avatarInitials,
      avatarUrl: next.avatarUrl, loginAt: new Date().toISOString(),
      isKepalaSekolah: next.isKepalaSekolah,
      capabilities: next.capabilities,
      isWaliKelas: next.isWaliKelas,
      catalogRoles: next.catalogRoles,
    };
    await AsyncStorage.setItem(KEYS.activeSession, JSON.stringify(newSession));
    await AsyncStorage.setItem(KEYS.activeAccountId, next.id);
    return { accounts: withoutAdminIt, session: newSession };
  }

  await AsyncStorage.removeItem(KEYS.activeSession);
  await AsyncStorage.removeItem(KEYS.activeAccountId);
  return { accounts: withoutAdminIt, session: null };
}

export async function loadAuthState(): Promise<void> {
  const [accountsRaw, sessionRaw] = await Promise.all([
    AsyncStorage.getItem(KEYS.savedAccounts),
    AsyncStorage.getItem(KEYS.activeSession),
  ]);
  let accounts: SavedAccount[] = [];
  let session: ActiveSession | null = null;
  try { accounts = accountsRaw ? JSON.parse(accountsRaw) : []; } catch { accounts = []; }
  try { session = sessionRaw ? JSON.parse(sessionRaw) : null; } catch { session = null; }

  const result = accounts.some((a) => a.role === "Admin IT")
    ? await purgeAdminItOnColdStart(accounts, session)
    : { accounts, session };

  cachedAccounts = result.accounts;
  cachedSession = result.session;
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
    isKepalaSekolah: account.isKepalaSekolah,
    capabilities: account.capabilities,
    isWaliKelas: account.isWaliKelas,
    catalogRoles: account.catalogRoles,
  };
  cachedSession = session;
  await AsyncStorage.setItem(KEYS.activeSession, JSON.stringify(session));
  await AsyncStorage.setItem(KEYS.activeAccountId, account.id);
  return session;
}

// BUG NYATA ditemukan 2026-09-04 - lihat catatan lengkap di webview
// authService.ts. Versi native: cachedSession/cachedAccounts di memori
// JUGA ditulis ulang (bukan cuma AsyncStorage) - state di memori itu yang
// dibaca getActiveSession()/getRealActiveSession() sinkron, kalau cuma
// AsyncStorage yang diupdate tapi cache memori tidak, perubahan tidak
// pernah kelihatan sampai app di-restart total (loadAuthState() cuma
// jalan sekali per app start).
export async function refreshActiveSessionCapabilities(fresh: {
  role: RoleName;
  fullName: string;
  avatarInitials: string;
  avatarUrl: string | null;
  isKepalaSekolah?: boolean;
  capabilities?: string[];
  isWaliKelas?: boolean;
  catalogRoles?: { roleType: string; catalogId: number }[];
}): Promise<ActiveSession | null> {
  assertLoaded();
  if (!cachedSession) return null;

  const merged: ActiveSession = { ...cachedSession, ...fresh };
  cachedSession = merged;
  await AsyncStorage.setItem(KEYS.activeSession, JSON.stringify(merged));

  const idx = cachedAccounts.findIndex((a) => a.id === merged.accountId);
  if (idx >= 0) {
    cachedAccounts[idx] = { ...cachedAccounts[idx], ...fresh };
    await persistAccounts();
  }

  notifySessionListeners();
  return merged;
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
      isKepalaSekolah: demo.isKepalaSekolah,
      capabilities: demo.capabilities,
      isWaliKelas: demo.isWaliKelas,
      catalogRoles: demo.catalogRoles,
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
    isKepalaSekolah: saved.isKepalaSekolah,
    capabilities: saved.capabilities,
    isWaliKelas: saved.isWaliKelas,
    catalogRoles: saved.catalogRoles,
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

export async function updateAccountFullName(accountId: string, fullName: string): Promise<void> {
  assertLoaded();
  const idx = cachedAccounts.findIndex((a) => a.id === accountId);
  if (idx >= 0) {
    cachedAccounts[idx] = { ...cachedAccounts[idx], fullName };
    await persistAccounts();
  }
  if (cachedSession && cachedSession.accountId === accountId) {
    cachedSession = { ...cachedSession, fullName };
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

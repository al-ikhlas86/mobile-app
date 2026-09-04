// ============================================================
// MODE DEMO — port native dari src/services/demoService.ts (webview).
// Lihat catatan isolasi lengkap di sana (riwayat kegagalan 2026-08-06,
// kenapa file ini SENGAJA tidak mengimpor apa pun dari authService.ts).
// Storage key TERPISAH TOTAL dari alikhlas86_saved_accounts.
// ============================================================
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

// Duplikat kecil dari api.ts (bukan diimpor - api.ts mengimpor dari
// authService.ts, jadi kalau file ini ikut mengimpor dari salah satunya
// bisa membentuk impor melingkar. Lihat catatan isolasi di demoService.ts
// versi webview utk alasan lengkap).
const API_URL: string =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ||
  process.env.EXPO_PUBLIC_API_URL ||
  "https://alikhlas86.duckdns.org/mobile-api";

export interface DemoAccountShape {
  id: string;
  username: string;
  role: string;
  fullName: string;
  avatarInitials: string;
  avatarUrl: string | null;
  token: string;
  isKepalaSekolah?: boolean;
}

export interface DemoRoleOption {
  role: string;
  label: string;
}

interface StoredDemoSession {
  account: DemoAccountShape;
  startedAt: string;
  expiresAt: string;
}

const DEMO_KEY = "alikhlas86_demo_session";
const DEMO_TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

// AsyncStorage 100% async, sama spt authService.ts native - cache di
// memori WAJIB dimuat sekali (loadDemoState(), dipanggil bareng
// loadAuthState() di App.tsx) sebelum getActiveDemoAccount() dipakai.
let cachedDemo: StoredDemoSession | null = null;
let loaded = false;

export async function loadDemoState(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(DEMO_KEY);
    const parsed = raw ? (JSON.parse(raw) as StoredDemoSession) : null;
    if (parsed && new Date(parsed.expiresAt).getTime() <= Date.now()) {
      await AsyncStorage.removeItem(DEMO_KEY);
      cachedDemo = null;
    } else {
      cachedDemo = parsed;
    }
  } catch {
    cachedDemo = null;
  }
  loaded = true;
}

export function getActiveDemoAccount(): DemoAccountShape | null {
  if (!loaded) return null; // belum dimuat = anggap tidak ada demo aktif (aman, fallback ke akun asli)
  if (cachedDemo && new Date(cachedDemo.expiresAt).getTime() <= Date.now()) {
    cachedDemo = null;
    AsyncStorage.removeItem(DEMO_KEY).catch(() => {});
    return null;
  }
  return cachedDemo?.account ?? null;
}

export function isDemoActive(): boolean {
  return getActiveDemoAccount() !== null;
}

export async function exitDemoMode(): Promise<void> {
  cachedDemo = null;
  await AsyncStorage.removeItem(DEMO_KEY);
}

const DEMO_ROLE_MAP: Record<string, string> = {
  admin_it: "Admin IT",
  supervisor: "Supervisor",
  admin_tu_sd: "Admin TU (SD)",
  admin_media_sd: "Admin Media (SD)",
  admin_tu_tk: "Admin TU (TK & Playground)",
  admin_media_tk: "Admin Media (TK & Playground)",
  // kepala_sekolah_sd/tk DIHAPUS 2026-09-04 - bukan role lagi, lihat
  // authService.ts RoleName.
  keuangan: "Keuangan",
  orang_tua: "Orang Tua",
  guru: "Guru",
  guru_kelas: "Guru Kelas",
  pegawai: "Pegawai",
};

function demoInitials(fullName: string): string {
  return fullName.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

export async function fetchDemoRoles(token: string): Promise<DemoRoleOption[]> {
  const res = await fetch(`${API_URL}/api/demo/roles`, { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json();
  if (!res.ok || !body.success) return [];
  return body.roles as DemoRoleOption[];
}

export async function startDemoSession(
  role: string,
  authTokenForRequest: string
): Promise<{ success: true; account: DemoAccountShape } | { success: false; message: string }> {
  try {
    const res = await fetch(`${API_URL}/api/demo/start`, {
      method: "POST",
      headers: { Authorization: `Bearer ${authTokenForRequest}`, "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const body = await res.json();
    if (!res.ok || !body.success) {
      return { success: false, message: body.message || "Gagal memulai Mode Demo." };
    }
    const account: DemoAccountShape = {
      id: `USR${body.user.id}`,
      username: body.user.username,
      role: DEMO_ROLE_MAP[body.user.role] ?? body.user.role,
      fullName: body.user.full_name,
      avatarInitials: demoInitials(body.user.full_name),
      avatarUrl: null,
      token: body.token,
      isKepalaSekolah: Number(body.user.is_kepala_sekolah) === 1,
    };
    const session: StoredDemoSession = {
      account,
      startedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + DEMO_TOKEN_TTL_MS).toISOString(),
    };
    cachedDemo = session;
    await AsyncStorage.setItem(DEMO_KEY, JSON.stringify(session));
    return { success: true, account };
  } catch {
    return { success: false, message: "Tidak dapat menghubungi server." };
  }
}

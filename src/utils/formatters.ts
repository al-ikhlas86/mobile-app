/**
 * Tanggal HARI INI dalam zona waktu LOKAL perangkat, format YYYY-MM-DD.
 * SENGAJA bukan `new Date().toISOString().slice(0,10)` - itu bug nyata
 * (ditemukan 2026-08-25 dari laporan user, sama persis di webview):
 * toISOString() SELALU konversi ke UTC dulu, jadi dini hari WIB (UTC+7,
 * jam 00:00-06:59) masih terhitung TANGGAL KEMARIN di UTC - user WIB yang
 * buka app jam 2 pagi bakal lihat tanggal kemarin sbg "hari ini".
 * getFullYear/getMonth/getDate DI BAWAH ini semua method LOKAL (bukan
 * UTC), jadi selalu cocok dgn kalender HP penggunanya sendiri.
 */
export function getTodayLocal(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Sebagian screen key yang ditulis backend (notifications.action_screen,
// dan pesan push FCM) masih pakai nama layar versi WEBVIEW (router custom
// sendiri, py "presensi-anak" sbg layar terpisah) - di native, layar itu
// TIDAK terdaftar sbg Tab/Stack screen sendiri (Orang Tua diarahkan ke tab
// "presensi" yang sudah otomatis render tampilan anak utk role itu). Tanpa
// alias ini, tap notifikasi/tap item di daftar Notifikasi silently no-op
// krn React Navigation tidak kenal nama layarnya sama sekali.
// Alias ini HANYA benar utk sesi role "Orang Tua" (tab "presensi" otomatis
// menampilkan tampilan anak utk role itu). Utk role lain (guru/pegawai yang
// juga orang tua murid - kategori "Anak Saya") tab "presensi" adalah presensi
// DIRI SENDIRI, jadi "presensi-anak" harus tetap ke Stack "presensi-anak".
const SCREEN_ALIASES: Record<string, string> = {
  "presensi-anak": "presensi",
};

export function resolveNavScreen(screen: string, role?: string | null): string {
  if (screen === "presensi-anak" && role !== "Orang Tua") return screen;
  return SCREEN_ALIASES[screen] ?? screen;
}

/**
 * Tujuan ketukan notifikasi. Notifikasi sisi anak (sumber "anak" = milik akun Orang Tua tertaut, digabung ke lonceng staf)
 * harus membuka layar ANAK: di sesi staf "akademik" adalah menu mengajar, dan berita yang diterbitkan untuk unit anak
 * hanya terlihat oleh akun Orang Tua itu (sebagaiOrtu = layar berita memakai token akun Orang Tua).
 */
export function tujuanNotifikasi(n: { sumber?: "anak"; action_screen: string | null; action_params: Record<string, unknown> | null }): { screen: string | null; params?: Record<string, unknown> } {
  const anak = n.sumber === "anak";
  const screen = anak && (n.action_screen === "akademik" || n.action_screen === "tugas-anak") ? "akademik-anak" : n.action_screen;
  let params = n.action_params ?? undefined;
  if (anak && screen === "berita-acara-viewer") params = { ...(params ?? {}), sebagaiOrtu: true };
  return { screen, params };
}

// Layar yang hanya bermakna bagi akun STAF (tujuan notifikasi persetujuan izin, aduan masuk, presensi diri, jadwal kerja).
// Push tidak membawa penerima; bila yang aktif akun Orang Tua (Tampilan Orang Tua) padahal push itu milik akun staf
// tertaut, layar ini tidak boleh dibuka dengan token Orang Tua (hasilnya 403/kosong) - pindah dulu ke akun staf.
const LAYAR_STAF = new Set(["persetujuan-izin", "persetujuan-izin-guru", "aduan-masuk", "jadwal-kerja", "presensi"]);
export function layarMilikStaf(screen: string): boolean {
  return LAYAR_STAF.has(screen);
}

// Sebagian screen key yang ditulis backend (notifications.action_screen,
// dan pesan push FCM) masih pakai nama layar versi WEBVIEW (router custom
// sendiri, py "presensi-anak" sbg layar terpisah) - di native, layar itu
// TIDAK terdaftar sbg Tab/Stack screen sendiri (Orang Tua diarahkan ke tab
// "presensi" yang sudah otomatis render tampilan anak utk role itu). Tanpa
// alias ini, tap notifikasi/tap item di daftar Notifikasi silently no-op
// krn React Navigation tidak kenal nama layarnya sama sekali.
const SCREEN_ALIASES: Record<string, string> = {
  "presensi-anak": "presensi",
};

export function resolveNavScreen(screen: string): string {
  return SCREEN_ALIASES[screen] ?? screen;
}

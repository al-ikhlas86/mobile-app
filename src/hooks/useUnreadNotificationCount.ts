import { useEffect, useState } from "react";
import { AppState } from "react-native";
import * as Notifications from "expo-notifications";
import { api } from "../services/api";

// Badge angka notifikasi (2026-08-31, spt WA/Line) - dipoll tiap 15 detik,
// sama cadence-nya dgn NotificationsContext versi webview. Dipakai utk (1)
// badge di ikon tab Notifikasi (MainTabs.tsx), (2) badge di ikon aplikasi
// sendiri di homescreen HP lewat expo-notifications (Notifications.
// setBadgeCountAsync) - iOS selalu didukung, Android tergantung launcher
// (Samsung/Pixel/dst umumnya sudah, sebagian kecil launcher lama tidak -
// aman diabaikan kalau launcher tidak dukung, bukan error).
const POLL_INTERVAL_MS = 15000;

// Mitigasi best-effort (2026-09-05, W3B) - laporan user: badge ikon app
// kadang balik ke 0 begitu app dibuka walau belum ada yang dibaca. Diaudit
// TIDAK ADA kode di app ini yang pernah reset badge ke 0 secara sengaja -
// satu-satunya titik set badge (di bawah) SELALU pakai angka ASLI dari
// server, dan hitungannya sendiri granular benar (1 notifikasi dibaca =
// -1, bukan bulk-zero, lihat routes/notifications.js). Kesimpulan: ini
// KEMUNGKINAN BESAR perilaku launcher Android/MIUI di luar kendali kode
// (badge dibersihkan visual oleh OS saat ikon disentuh, independen dari
// nilai terakhir yang di-set) - BUKAN jaminan fix total, tapi begitu app
// kembali ke foreground, badge langsung di-reassert SEGERA (bukan
// menunggu tick 15 detik berikutnya) supaya kalaupun sempat kebersihkan
// visual oleh OS, pulih dalam hitungan detik.
export function useUnreadNotificationCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const res = await api.notificationsUnreadCount();
      if (cancelled) return;
      if (res.success) {
        setCount(res.count);
        Notifications.setBadgeCountAsync(res.count).catch(() => {});
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") poll();
    });
    return () => { cancelled = true; clearInterval(interval); appStateSub.remove(); };
  }, []);

  return count;
}

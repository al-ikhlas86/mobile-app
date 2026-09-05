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

// Mitigasi (2026-09-05, W3B + susulan) - laporan user, direproduksi ULANG
// di HP asli setelah fix pertama: buka app (badge MASIH ada di homescreen,
// belum dibaca apa-apa), TUTUP app - badge ikut hilang dari homescreen
// walau belum pernah membaca 1 pun notifikasi. Diaudit ULANG: TIDAK ADA
// kode di app ini yang reset badge ke 0 - server-side count-nya sendiri
// tetap benar (dikonfirmasi via layar Notifikasi in-app TETAP tampilkan
// titik belum-dibaca). Kesimpulan diperkuat: ini MIUI/launcher Android
// yang MENGANGGAP "app dibuka = user sudah lihat" & membersihkan badge-nya
// SENDIRI di level OS begitu app di-foreground-kan - TIDAK PEDULI nilai
// yang di-set lewat API, dan fix pertama (re-assert SEGERA saat 'active')
// TERNYATA kalah waktu vs pembersihan MIUI itu sendiri (sama2 terjadi pas
// app baru dibuka, race yang tidak selalu menang).
//
// Perkuat dgn 3 titik re-assert (bukan cuma 1): (1) segera saat 'active'
// [sudah ada], (2) SEKALI LAGI ~1.2 detik setelah 'active' - menembak
// SETELAH kemungkinan pembersihan MIUI selesai, bukan bersamaan, (3) saat
// app baru mau ke 'background' - ini titik BARU yang paling penting utk
// skenario "buka lalu langsung tutup tanpa baca": begitu user menutup app,
// badge di-set ULANG ke nilai yg BENAR SEBELUM app kehilangan foreground -
// jadi APAPUN yang MIUI lakukan saat app dibuka, nilai TERAKHIR yang
// "menempel" di homescreen adalah nilai benar dari titik (3) ini.
// TETAP bukan jaminan 100% (perilaku launcher pihak ketiga, di luar
// kendali kode), tapi menutup celah race yang ditemukan di fix pertama.
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
    let delayedTimer: ReturnType<typeof setTimeout> | null = null;
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        poll();
        delayedTimer = setTimeout(poll, 1200);
      } else if (state === "background") {
        if (delayedTimer) clearTimeout(delayedTimer);
        poll();
      }
    });
    return () => {
      cancelled = true;
      clearInterval(interval);
      if (delayedTimer) clearTimeout(delayedTimer);
      appStateSub.remove();
    };
  }, []);

  return count;
}

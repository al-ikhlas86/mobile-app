import { useEffect, useState } from "react";
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
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return count;
}

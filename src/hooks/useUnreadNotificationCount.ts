import { useEffect, useState } from "react";
import { AppState } from "react-native";
import * as Notifications from "expo-notifications";
import { api } from "../services/api";
import { getLinkedParentAccount } from "../services/authService";

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
/**
 * `akademik` (2026-09-24, Poin 3 Fase 2, diminta eksplisit user: "icon
 * angka notifikasi" di menu tugas/materi) - dari `byType` yang backend
 * SUDAH sertakan di respons `/api/notifications/unread-count` (aditif,
 * `count`/total tidak berubah). Digabung ke hook YANG SAMA (bukan hook
 * poll terpisah) supaya tidak dobel panggilan API tiap 15 detik - HANYA 1
 * pemanggil (DashboardLayout.tsx) jadi aman diubah bentuk return-nya.
 * `raport` (2026-10-02): notifikasi `type === "raport"` (nilai diterbitkan, actionScreen "nilai-anak") -
 * lencana kartu "Nilai Anak" orang tua; TERPISAH dari `akademik` (Nilai punya menu sendiri, bukan tab Akademik).
 *
 * Satu orang = satu akun: sesi STAF (guru/pegawai) yang punya akun Orang Tua tertaut (nomor HP sama) ikut menghitung
 * lencana akun Orang Tua itu - `total` = hitungan staf + hitungan orang tua (sama dgn daftar Notifikasi yang
 * digabung). `akademik`/`raport` tetap milik akun SESI AKTIF (di sesi staf = menu mengajar), sedangkan sisi anak
 * dipisah ke `akademikAnak`/`raportAnak` (kartu "Akademik Anak"/"Nilai Anak" di kategori Anak Saya) - agar tugas/nilai
 * anak tidak nyasar ke lencana kartu "Akademik" guru. Di sesi Orang Tua kedua field anak = 0 (tak ada akun tertaut).
 */
export interface UnreadNotificationCount {
  total: number;
  akademik: number;
  raport: number;
  akademikAnak: number;
  raportAnak: number;
}

export function useUnreadNotificationCount(): UnreadNotificationCount {
  const [state, setState] = useState<UnreadNotificationCount>({ total: 0, akademik: 0, raport: 0, akademikAnak: 0, raportAnak: 0 });

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const res = await api.notificationsUnreadCount();
      // Akun Orang Tua tertaut (bila ada) dihitung terpisah; gagal di sisi anak TIDAK boleh menggagalkan hitungan utama.
      const resAnak = getLinkedParentAccount() ? await api.notificationsUnreadCount(true).catch(() => null) : null;
      if (cancelled) return;
      if (res.success) {
        const anak = resAnak?.success ? resAnak : null;
        const total = res.count + (anak?.count ?? 0);
        setState({
          total,
          akademik: (res.byType?.tugas_baru ?? 0) + (res.byType?.materi_baru ?? 0),
          raport: res.byType?.raport ?? 0,
          akademikAnak: (anak?.byType?.tugas_baru ?? 0) + (anak?.byType?.materi_baru ?? 0),
          raportAnak: anak?.byType?.raport ?? 0,
        });
        Notifications.setBadgeCountAsync(total).catch(() => {});
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

  return state;
}

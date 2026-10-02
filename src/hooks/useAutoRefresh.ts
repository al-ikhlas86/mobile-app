import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useIsFocused } from "@react-navigation/native";

/**
 * Segarkan data layar secara otomatis (2026-10-02) - port dari hooks/useAutoRefresh.ts webview. Dibuat setelah laporan:
 * presensi wajah (kiosk/HP lain) sudah tercatat di server tetapi layar Presensi/Beranda baru berubah setelah ditarik
 * manual. Penyebabnya: layar tab-root (Beranda, Presensi, dst) TETAP ter-mount saat berpindah tab (bottom-tabs tidak
 * unmount), sehingga data hanya dimuat sekali. Hook ini memanggil `muat` saat:
 *   (a) layar KEMBALI FOKUS (useIsFocused) - segera,
 *   (b) aplikasi kembali aktif dari background (AppState "active") - segera, selama layar masih fokus,
 *   (c) setiap `intervalMs` selama aplikasi aktif DAN layar fokus (layar tab yang tidak fokus tidak polling).
 * Pemuatan pertama saat layar baru dibuat TIDAK dipicu hook ini - layar tetap memuat sendiri (dengan spinner) lewat
 * useEffect-nya, supaya tidak ada pemanggilan ganda. `muat` harus melakukan penyegaran SENYAP (tanpa spinner penuh)
 * supaya tampilan tidak berkedip. Pemanggilan otomatis yang bertabrakan dengan yang sedang berjalan dilewati.
 */
export function useAutoRefresh(muat: () => void | Promise<void>, intervalMs = 20000) {
  const fokus = useIsFocused();
  const muatRef = useRef(muat);
  muatRef.current = muat;
  const sedangJalan = useRef(false);
  const fokusSebelumnya = useRef(fokus);

  // Jalankan `muat` tanpa menumpuk dan tanpa melempar galat (jaringan putus tidak boleh memunculkan unhandled rejection).
  const jalankan = useRef(async () => {
    if (sedangJalan.current) return;
    sedangJalan.current = true;
    try {
      await muatRef.current();
    } catch {
      // penyegaran senyap - kegagalan jaringan diabaikan, percobaan berikut menyusul
    } finally {
      sedangJalan.current = false;
    }
  }).current;

  // (a) segera saat layar KEMBALI fokus (bukan saat pertama kali mount).
  useEffect(() => {
    if (fokus && !fokusSebelumnya.current) void jalankan();
    fokusSebelumnya.current = fokus;
  }, [fokus, jalankan]);

  // (b) + (c) hanya selama layar fokus.
  useEffect(() => {
    if (!fokus) return;
    const timer = setInterval(() => {
      if (AppState.currentState === "active") void jalankan();
    }, intervalMs);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void jalankan();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [fokus, intervalMs, jalankan]);
}

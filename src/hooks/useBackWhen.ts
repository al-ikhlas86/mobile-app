import { useEffect } from "react";
import { BackHandler } from "react-native";

// Tombol kembali fisik Android - dipasang LOKAL di komponen yang punya
// "view" internal (bukan layar navigasi sungguhan) yang bisa terbuka, mis.
// showAllMenu di tiap dashboard (Beranda -> Semua Menu). BackHandler RN
// memanggil listener dari yang PALING BARU didaftarkan lebih dulu (LIFO) -
// jadi selama `active` true, listener ini otomatis didaftarkan DAN
// mengonsumsi event SEBELUM sampai ke listener global di RootNavigator
// (yang kalau tidak ditangani di sini, langsung menutup app - dilaporkan
// user 2026-08-28: dari "Semua Menu" pencet kembali fisik = app tertutup,
// padahal harusnya balik ke Beranda dulu). Saat `active` false, listener
// dilepas otomatis (effect cleanup) - kembali ke perilaku normal.
export function useBackWhen(active: boolean, onBack: () => void) {
  useEffect(() => {
    if (!active) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}

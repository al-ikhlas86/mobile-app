import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../services/api";
import { useAutoRefresh } from "./useAutoRefresh";

// Apakah fitur Nilai Raport sudah dinyalakan (saklar Admin IT)? Dipakai shell Akademik
// untuk menyembunyikan tab "Nilai" selama fitur belum diumumkan. Admin IT tetap melihat
// (bisaMengatur) supaya bisa mencoba sebelum dinyalakan utk semua orang.
// Dimuat saat mount, lalu disegarkan otomatis (layar kembali fokus / app kembali aktif / tiap 60 dtk) lewat
// useAutoRefresh - saklar yang dinyalakan Admin IT jadi terlihat tanpa harus tutup-buka app.
// Gagal memuat (jaringan putus/401/galat server) -> nilai TERAKHIR dipertahankan (awalnya false = aman, tab
// tidak muncul); kegagalan sesaat tidak boleh menyembunyikan menu yang sudah tampil.
export function useRaportAktif(): boolean {
  const [tampil, setTampil] = useState(false);
  const batal = useRef(false);
  const muat = useCallback(async () => {
    try {
      const res: any = await api.raportStatus();
      if (!batal.current && res?.success) setTampil(Boolean(res.data.aktif || res.data.bisaMengatur));
    } catch { /* diam: pertahankan nilai terakhir */ }
  }, []);
  useEffect(() => {
    batal.current = false;
    void muat();
    return () => { batal.current = true; };
  }, [muat]);
  useAutoRefresh(muat, 60000);
  return tampil;
}

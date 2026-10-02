import { useEffect, useState } from "react";
import { api } from "../services/api";

// Apakah fitur Nilai Raport sudah dinyalakan (saklar Admin IT)? Dipakai shell Akademik
// untuk menyembunyikan tab "Nilai" selama fitur belum diumumkan. Admin IT tetap melihat
// (bisaMengatur) supaya bisa mencoba sebelum dinyalakan utk semua orang.
// Gagal memuat -> dianggap tidak aktif (aman: tab tidak muncul), tanpa mengganggu layar lain.
export function useRaportAktif(): boolean {
  const [tampil, setTampil] = useState(false);
  useEffect(() => {
    let batal = false;
    api.raportStatus().then((res: any) => {
      if (!batal && res?.success) setTampil(Boolean(res.data.aktif || res.data.bisaMengatur));
    }).catch(() => { /* diam: tab tetap tersembunyi */ });
    return () => { batal = true; };
  }, []);
  return tampil;
}

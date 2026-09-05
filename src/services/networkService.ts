// ============================================================
// NETWORK SERVICE (2026-09-05, W4E) - reload gambar otomatis begitu
// koneksi online kembali. Laporan user: login sambil offline, lalu
// koneksi tersambung lagi - gambar berita tidak pernah muncul sampai app
// ditutup paksa & dibuka ulang (beda dari Instagram yang otomatis reload).
//
// RN <Image> TIDAK otomatis retry kalau request gagal & `uri` propnya
// tidak berubah - solusi termurah (bukan retry-logic manual per-Image):
// broadcast "generasi" baru tiap kali TERDETEKSI transisi offline->online,
// komponen yang menampilkan gambar tinggal tempel generasi itu ke `key`
// elemen <Image> - key berubah = React unmount+mount ulang dari nol =
// attempt request baru, otomatis pulih dari state gagal manapun tanpa
// perlu tahu ATAU melacak gambar mana saja yang gagal.
//
// Pola pub-sub SENGAJA duplikat kecil (bukan impor dari authService.ts/
// viewingYearService.ts) - modul ini murni soal state jaringan, isolasi
// yang sama dipakai modul-modul lain di sesi ini.
import { useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";

let wasOffline = false;
let generation = 0;

type Listener = () => void;
const listeners = new Set<Listener>();
function notify(): void {
  listeners.forEach((fn) => fn());
}

NetInfo.addEventListener((state) => {
  const isOnline = state.isConnected === true && state.isInternetReachable !== false;
  if (!isOnline) {
    wasOffline = true;
    return;
  }
  if (wasOffline) {
    wasOffline = false;
    generation += 1;
    notify();
  }
});

/** Dipakai layar/komponen yang menampilkan gambar dari jaringan (berita
 * acara dkk) - tempel hasilnya ke `key` elemen <Image> supaya remount
 * paksa begitu koneksi pulih. */
export function useImageReloadGeneration(): number {
  const [gen, setGen] = useState(generation);
  useEffect(() => {
    const listener = () => setGen(generation);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  return gen;
}

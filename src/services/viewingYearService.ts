// ============================================================
// VIEWING YEAR SERVICE — port native dari services/viewingYearService.ts
// (webview). "Tahun ajaran yang SEDANG DILIHAT" (2026-09-04, Fase 4).
// BUKAN bagian authService.ts SENGAJA - ini bukan properti akun, murni
// preferensi tampilan SESI BERJALAN (in-memory saja, TIDAK AsyncStorage -
// "reset tiap login" diminta eksplisit). Pola isolasi yang sama sengaja
// dipakai demoService.ts vs authService.ts (lihat komentarnya soal
// circular-import) - modul ini punya pub-sub SENDIRI, BUKAN impor dari
// authService.ts, walau bentuknya mirip (duplikasi ~10 baris < resiko impor
// melingkar).
// ============================================================
import { useEffect, useState } from "react";

export interface TahunAjaranOption {
  id: number;
  nama: string;
  isActive: boolean;
}

let current: TahunAjaranOption | null = null; // null = ikut tahun aktif (default)

type Listener = () => void;
const listeners = new Set<Listener>();
function notify(): void {
  listeners.forEach((fn) => fn());
}

/** Dipakai komponen (GuruDashboard dkk TIDAK perlu ini - mereka sudah reaktif
 * lewat useSessionRefreshTick krn ganti tahun memicu refresh sesi juga),
 * dipakai layar/komponen yang menampilkan LANGSUNG "tahun mana yang sedang
 * dilihat" (mis. badge di DashboardLayout, popup switcher itu sendiri). */
export function useViewingYearTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  return tick;
}

export function getViewingYear(): TahunAjaranOption | null {
  return current;
}

export function setViewingYear(year: TahunAjaranOption | null): void {
  current = year;
  notify();
}

/** Dipanggil saat login/switchAccount/app-start - "reset ke tahun aktif
 * tiap login" (permintaan eksplisit user). */
export function resetViewingYear(): void {
  setViewingYear(null);
}

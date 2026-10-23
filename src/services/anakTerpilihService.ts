// ============================================================
// ANAK TERPILIH — anak yang sedang dipilih orang tua (ChildSwitcher / parameter notifikasi studentCacheId).
// Dulu tiap layar anak (Presensi, Akademik, Nilai, Aduan, Wajah, Beranda) memilih "anak pertama" sendiri-sendiri, jadi
// pilihan di Beranda/ketukan notifikasi untuk anak ke-2 tidak terbawa dan layar menampilkan/mengirim data anak lain.
// Disimpan di memori, DIKUNCI ke akun yang sedang aktif: ganti akun otomatis membuat pilihan lama tak berlaku
// (tidak ada state akun lama yang bocor), tanpa perlu hook reset di tiap titik ganti akun.
// ============================================================
import { useEffect, useState } from "react";
import { getActiveSession } from "./authService";

let terpilih: { accountId: string; id: number } | null = null;
const listeners = new Set<() => void>();

export function getAnakTerpilih(): number | null {
  const akun = getActiveSession()?.accountId;
  return terpilih && akun && terpilih.accountId === akun ? terpilih.id : null;
}

export function setAnakTerpilih(id: number | null | undefined): void {
  const akun = getActiveSession()?.accountId;
  if (!akun || typeof id !== "number" || !Number.isFinite(id)) return;
  if (terpilih && terpilih.accountId === akun && terpilih.id === id) return;
  terpilih = { accountId: akun, id };
  listeners.forEach((fn) => fn());
}

/** Anak yang dipakai layar: pilihan global bila ada di daftar, lalu pilihan layar saat ini, lalu anak pertama. */
export function pilihAnak(daftar: { id: number }[], saatIni: number | null): number | null {
  const g = getAnakTerpilih();
  if (g !== null && daftar.some((c) => c.id === g)) return g;
  if (saatIni !== null && daftar.some((c) => c.id === saatIni)) return saatIni;
  return daftar[0]?.id ?? null;
}

/** Nilai terkini anak terpilih (re-render saat berubah dari layar lain / notifikasi). */
export function useAnakTerpilih(): number | null {
  const [, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick((t) => t + 1);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);
  return getAnakTerpilih();
}

/** Dipakai pintu navigasi: params berisi studentCacheId (notifikasi/menu) -> jadikan anak terpilih untuk layar tujuan. */
export function tangkapAnakDariParams(params?: Record<string, unknown> | null): void {
  const v = params?.studentCacheId;
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  if (typeof n === "number" && Number.isFinite(n) && n > 0) setAnakTerpilih(n);
}

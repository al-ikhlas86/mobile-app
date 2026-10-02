// Util Nilai Raport sisi klien (2026-10-02). Rumus di sini SAMA dengan
// backend/src/services/raportLogika.js - dipakai hanya utk tampilan instan saat
// mengetik; angka resmi tetap dari server (dikembalikan tiap kali menyimpan).

export interface KomponenNilai { kode: string; nama: string; bobot: number }

export const LABEL_SEMESTER: Record<string, string> = { ganjil: "Ganjil", genap: "Genap" };

export const LABEL_GRADE: Record<string, string> = {
  sangat_baik: "Sangat Baik", baik: "Baik", cukup: "Cukup", perlu_bimbingan: "Perlu Bimbingan",
};

/** Teks isian -> angka. '' = kosong (hapus). Mengembalikan ok:false bila bukan angka 0-100. */
export function parseNilaiInput(teks: string): { ok: boolean; nilai: number | null } {
  const t = teks.trim().replace(",", ".");
  if (t === "") return { ok: true, nilai: null };
  if (!/^\d{1,3}(\.\d{1,4})?$/.test(t)) return { ok: false, nilai: null };
  const n = Number(t);
  if (n < 0 || n > 100) return { ok: false, nilai: null };
  return { ok: true, nilai: Math.round(n * 100) / 100 };
}

/** Rata-rata berbobot; null bila ada komponen yang belum terisi. */
export function hitungNilaiAkhir(komponen: KomponenNilai[], nilai: Record<string, number | null>): number | null {
  let jumlah = 0;
  let bobot = 0;
  for (const k of komponen) {
    const v = nilai[k.kode];
    if (v === null || v === undefined) return null;
    jumlah += v * k.bobot;
    bobot += k.bobot;
  }
  return bobot > 0 ? Math.round((jumlah / bobot) * 100) / 100 : null;
}

export function predikatDari(n: number | null): "A" | "B" | "C" | "D" | null {
  if (n === null) return null;
  if (n >= 90) return "A";
  if (n >= 80) return "B";
  if (n >= 70) return "C";
  return "D";
}

/** 85 -> "85", 86.5 -> "86,5", 86.63 -> "86,63", null -> "-" */
export function formatNilai(n: number | null | undefined): string {
  if (n === null || n === undefined) return "-";
  return String(Math.round(n * 100) / 100).replace(".", ",");
}

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** 'YYYY-MM-DD HH:MM:SS' (jam dinding WIB dari server) -> '20 Des 2026, 07.00'. Tanpa konversi zona waktu. */
export function formatWaktuDb(s: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(s ?? "");
  if (!m) return "";
  return `${Number(m[3])} ${BULAN[Number(m[2]) - 1]} ${m[1]}, ${m[4]}.${m[5]}`;
}

/** Nilai default isian datetime-local: besok pukul 07:00 (waktu perangkat). */
export function defaultJadwalTerbit(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(7, 0, 0, 0);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function warnaPredikat(p: string | null): string {
  switch (p) {
    case "A": return "text-green-700 dark:text-green-400";
    case "B": return "text-blue-700 dark:text-blue-400";
    case "C": return "text-amber-700 dark:text-amber-400";
    case "D": return "text-red-700 dark:text-red-400";
    default: return "text-muted-foreground";
  }
}

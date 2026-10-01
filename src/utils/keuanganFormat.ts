// Format tampilan data keuangan (rincian biaya orang tua, slip gaji pegawai).
// Port dari webview (src/utils/keuanganFormat.ts) - JANGAN diubah sepihak.

export function formatRupiah(n: number | null | undefined): string {
  const v = Math.round(Number(n ?? 0));
  const negatif = v < 0;
  // Intl di Hermes belum selalu lengkap untuk id-ID - format manual titik ribuan.
  const teks = Math.abs(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negatif ? "-" : ""}Rp ${teks}`;
}

const BULAN_SINGKAT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const BULAN_PANJANG = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

// "2026-10-05" -> "5 Okt 2026" (diparse manual, tanpa zona waktu).
export function formatTanggal(iso: string | null | undefined): string {
  if (!iso) return "-";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} ${BULAN_SINGKAT[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

export function formatWaktuPerbarui(ts: string | null | undefined): string {
  if (!ts) return "-";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "-";
  const jam = `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
  return `${d.getDate()} ${BULAN_SINGKAT[d.getMonth()]} ${jam}`;
}

// "2026-09" -> "September 2026"
export function formatPeriodeBulan(key: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})$/.exec(key ?? "");
  if (!m) return key ?? "-";
  return `${BULAN_PANJANG[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

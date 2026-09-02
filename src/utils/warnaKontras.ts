/**
 * Menyesuaikan warna DATA (bukan warna tema) supaya tetap terbaca di atas
 * latar tema yang sedang aktif.
 *
 * Latar belakang (dilaporkan user 2026-09-02): warna agenda di kalender
 * dipilih sendiri oleh Admin TU di WebArsipData - jadi bisa warna apa saja,
 * termasuk warna gelap seperti #198754 yang nyaris lenyap di atas latar
 * HITAM mode gelap. Warna tema sendiri sudah aman (dikalibrasi per tema di
 * ThemeContext), tapi warna yang datang dari DATA tidak pernah tahu tema
 * pemakainya.
 *
 * Yang TIDAK dilakukan di sini: mengganti warna itu jadi warna tema. Warna
 * pilihan Admin TU tetap dihormati (hijau tetap hijau, merah tetap merah) -
 * yang diubah cuma terang/gelapnya secukupnya sampai kontrasnya cukup.
 * Aturan "jangan hardcode hex warna tema di luar ThemeContext" tetap utuh:
 * file ini tidak mengenal satu pun warna tema, cuma putih & hitam sbg
 * kutub pencampur.
 */

type Rgb = [number, number, number];

function hexKeRgb(hex: string): Rgb | null {
  const bersih = hex.trim().replace(/^#/, "");
  const penuh = bersih.length === 3 ? bersih.replace(/./g, (c) => c + c) : bersih;
  if (!/^[0-9a-fA-F]{6}$/.test(penuh)) return null;
  return [
    parseInt(penuh.slice(0, 2), 16),
    parseInt(penuh.slice(2, 4), 16),
    parseInt(penuh.slice(4, 6), 16),
  ];
}

function rgbKeHex([r, g, b]: Rgb): string {
  const dua = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");
  return `#${dua(r)}${dua(g)}${dua(b)}`;
}

/** Luminansi relatif WCAG (0 = hitam pekat, 1 = putih). */
function luminansi([r, g, b]: Rgb): number {
  const kanal = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * kanal[0] + 0.7152 * kanal[1] + 0.0722 * kanal[2];
}

function campur([r, g, b]: Rgb, kutub: Rgb, rasio: number): Rgb {
  return [
    r + (kutub[0] - r) * rasio,
    g + (kutub[1] - g) * rasio,
    b + (kutub[2] - b) * rasio,
  ];
}

const PUTIH: Rgb = [255, 255, 255];
const HITAM: Rgb = [0, 0, 0];

/** Dipakai kalau agenda belum punya warna sama sekali (amber netral). */
export const WARNA_AGENDA_DEFAULT = "#f59e0b";

/**
 * Kembalikan versi $hex yang cukup kontras terhadap latar tema aktif.
 * Di tema gelap warna yang terlalu gelap dicerahkan; di tema terang warna
 * yang terlalu terang digelapkan. Warna yang sudah aman dikembalikan apa
 * adanya.
 */
export function warnaKontras(hex: string | null | undefined, isDark: boolean): string {
  const rgb = hexKeRgb(hex || WARNA_AGENDA_DEFAULT) ?? hexKeRgb(WARNA_AGENDA_DEFAULT)!;

  // Ambang dipilih supaya warna khas sekolah lolos tanpa diubah di tema
  // yang memang cocok, dan benar-benar diangkat di tema yang bertabrakan:
  // hijau #198754 (luminansi ~0.21) aman di tema terang, dicerahkan di
  // tema gelap.
  const ambang = isDark ? 0.4 : 0.55;
  const kutub = isDark ? PUTIH : HITAM;
  const terlaluMirip = isDark ? luminansi(rgb) < ambang : luminansi(rgb) > ambang;
  if (!terlaluMirip) return rgbKeHex(rgb);

  // Naikkan bertahap, bukan sekali lompat - supaya warna aslinya berubah
  // sesedikit mungkin sampai batas terbaca terlampaui.
  let hasil = rgb;
  for (let i = 0; i < 10; i++) {
    hasil = campur(hasil, kutub, 0.15);
    const l = luminansi(hasil);
    if (isDark ? l >= ambang : l <= ambang) break;
  }
  return rgbKeHex(hasil);
}

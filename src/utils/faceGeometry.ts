// Penilaian posisi wajah terhadap lingkaran pendaftaran (gaya cincin). SALINAN IDENTIK ada di Mobile-App/src/utils/faceGeometry.ts: jaga keduanya sejajar.
//
// Mengapa dipetakan: server mengirim pusat dan lebar wajah sebagai pecahan dari FRAME (foto yang dianalisis), sedangkan pengguna melihat lingkaran di atas
// PRATINJAU yang dipotong (object-cover). Frame 4:3 di kotak potret terpotong di kiri/kanan, jadi "pusat frame" bukan "pusat lingkaran". Koordinat wajah diubah
// dulu ke koordinat kotak tampilan, baru dibandingkan dengan lingkaran yang digambar. Besar simpangan dari pusat tidak bergantung cermin (flip di sekitar pusat),
// hanya kata petunjuk kiri/kanan yang bergantung (`arahHorizontal`).

export const LINGKAR_CY = 0.46; // pusat lingkaran (pecahan tinggi kotak)
export const LINGKAR_R = 0.36;  // jari-jari (pecahan sisi terpendek kotak)

// Ambang klien SENGAJA sedikit lebih ketat dari server (POSE_*_MAKS 20/25/30): bila klien bilang pas, server pasti menerima.
const POSE_YAW_MAKS = 16;
const POSE_PITCH_MAKS = 20;
const POSE_ROLL_MAKS = 25;
const YAW_LAMA_MAKS = 12;     // cadangan bila server belum mengirim pose
const SIMPANGAN_MAKS = 0.35;  // pusat wajah maksimal sejauh ini dari pusat lingkaran (kelipatan jari-jari)
const LEBAR_MIN = 0.55;       // lebar wajah / diameter lingkaran
const LEBAR_MAKS = 0.95;
const BLUR_MIN = 30;          // = MIN_LAPLACIAN_VAR server
const TERANG_MIN = 45;        // server menolak < 40

export interface AnalisisWajah {
  face_size?: number | null;   // lebar wajah (px, frame yang dianalisis)
  blur?: number | null;
  brightness?: number | null;
  yaw?: number | null;         // yaw lama (rasio 5 titik), hanya cadangan
  pose_yaw?: number | null;
  pose_pitch?: number | null;
  pose_roll?: number | null;
  cx?: number | null;          // pusat wajah (0..1 dari frame)
  cy?: number | null;
  w?: number | null;           // lebar wajah (0..1 dari lebar frame)
}

export interface Ukuran { w: number; h: number }

export interface OpsiPenilaian {
  /** Pratinjau dicerminkan (kamera depan di web). */
  cermin: boolean;
  /** Boleh menyebut "kiri/kanan" pada petunjuk geser (hanya bila arah cermin pasti diketahui). */
  arahHorizontal: boolean;
  /** Pratinjau memotong frame (object-cover). false = letterbox (object-contain). */
  potong?: boolean;
}

export interface Hasil {
  /** null = posisi pas. */
  petunjuk: string | null;
  /** Posisi wajah di kotak tampilan (untuk uji/diagnosis). */
  wajah: { x: number; y: number; lebar: number } | null;
}

export function lingkaran(box: Ukuran): { cx: number; cy: number; r: number } {
  return { cx: box.w / 2, cy: box.h * LINGKAR_CY, r: Math.max(10, Math.min(box.w, box.h) * LINGKAR_R) };
}

/** Pusat (x, y) dan lebar wajah dalam koordinat kotak tampilan; null bila server belum mengirim posisi. */
export function wajahDiKotak(a: AnalisisWajah, frame: Ukuran, box: Ukuran, opsi: Pick<OpsiPenilaian, "cermin" | "potong">): { x: number; y: number; lebar: number } | null {
  if (a.cx == null || a.cy == null || a.w == null || frame.w <= 0 || frame.h <= 0 || box.w <= 0 || box.h <= 0) return null;
  const potong = opsi.potong ?? true;
  const skala = potong ? Math.max(box.w / frame.w, box.h / frame.h) : Math.min(box.w / frame.w, box.h / frame.h);
  let x = box.w / 2 + (a.cx - 0.5) * frame.w * skala;
  const y = box.h / 2 + (a.cy - 0.5) * frame.h * skala;
  if (opsi.cermin) x = box.w - x;
  return { x, y, lebar: a.w * frame.w * skala };
}

/** Satu petunjuk terpenting (ukuran, letak, hadap, tajam, terang) atau null bila pas. */
export function nilaiPosisi(a: AnalisisWajah, frame: Ukuran, box: Ukuran, opsi: OpsiPenilaian): Hasil {
  const lk = lingkaran(box);
  const wajah = wajahDiKotak(a, frame, box, opsi);

  if (wajah) {
    const rasio = wajah.lebar / (lk.r * 2);
    if (rasio < LEBAR_MIN) return { petunjuk: "Dekatkan wajah", wajah };
    if (rasio > LEBAR_MAKS) return { petunjuk: "Mundur sedikit", wajah };
    const dx = wajah.x - lk.cx;
    const dy = wajah.y - lk.cy;
    if (Math.hypot(dx, dy) > SIMPANGAN_MAKS * lk.r) {
      // Dominan vertikal -> naik/turun; selainnya geser samping (kata kiri/kanan hanya bila arah cermin pasti).
      if (Math.abs(dy) >= Math.abs(dx)) return { petunjuk: dy > 0 ? "Naikkan wajah sedikit" : "Turunkan wajah sedikit", wajah };
      if (!opsi.arahHorizontal) return { petunjuk: "Pusatkan wajah di dalam lingkaran", wajah };
      return { petunjuk: dx > 0 ? "Geser sedikit ke kiri" : "Geser sedikit ke kanan", wajah };
    }
  } else if ((a.face_size ?? 0) > 0 && (a.face_size ?? 0) < 120) {
    return { petunjuk: "Dekatkan wajah", wajah };
  }

  if (a.pose_yaw != null && a.pose_pitch != null) {
    if (Math.abs(a.pose_yaw) > POSE_YAW_MAKS) return { petunjuk: "Hadap lurus ke kamera", wajah };
    if (Math.abs(a.pose_pitch) > POSE_PITCH_MAKS) return { petunjuk: "Jangan mendongak atau menunduk", wajah };
    if (a.pose_roll != null && Math.abs(a.pose_roll) > POSE_ROLL_MAKS) return { petunjuk: "Tegakkan kepala", wajah };
  } else if (a.yaw != null && Math.abs(a.yaw) > YAW_LAMA_MAKS) {
    return { petunjuk: "Hadap lurus ke kamera", wajah };
  }

  if (a.brightness != null && a.brightness < TERANG_MIN) return { petunjuk: "Cari tempat yang lebih terang", wajah };
  if (a.blur != null && a.blur < BLUR_MIN) return { petunjuk: "Diam sebentar", wajah };
  return { petunjuk: null, wajah };
}

/**
 * Penahan posisi yang tidak mudah buyar: waktu "pas" bertambah selagi pas dan hanya BERKURANG pelan saat satu pembacaan meleset
 * (bukan langsung nol), supaya cincin tidak melompat-lompat karena satu frame buruk. Foto diambil setelah pas cukup lama DAN
 * sekurangnya `pembacaanMin` pembacaan baik.
 */
export class PenahanPosisi {
  private msPas = 0;
  private baik = 0;
  private terakhir = 0;
  constructor(private readonly tahanMs: number, private readonly pembacaanMin = 2, private readonly peluruhanMs = 450) {}

  reset(): void { this.msPas = 0; this.baik = 0; this.terakhir = 0; }

  /** Catat satu pembacaan; mengembalikan { isi (0..1), siap }. */
  catat(pas: boolean, sekarang: number): { isi: number; siap: boolean } {
    const dt = this.terakhir === 0 ? 0 : Math.min(sekarang - this.terakhir, 1200);
    this.terakhir = sekarang;
    if (pas) {
      this.msPas += Math.max(dt, 200);
      this.baik += 1;
    } else {
      this.msPas = Math.max(0, this.msPas - this.peluruhanMs);
      this.baik = Math.max(0, this.baik - 1);
    }
    const isi = Math.min(1, this.msPas / this.tahanMs);
    return { isi, siap: this.msPas >= this.tahanMs && this.baik >= this.pembacaanMin };
  }
}

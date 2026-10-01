// Geometri bingkai oval + siku untuk area kamera w x h (px) - port dari webview
// (src/utils/layoutHooks.ts::geometriOval). Oval ~ proporsi wajah (rx/ry = 0.77),
// diisi sebesar mungkin tetapi tetap menyisakan ruang di tepi, sehingga overlay
// selalu proporsional berapa pun sisa tinggi layar yang tersedia.
export function geometriOval(w: number, h: number) {
  const m = Math.min(w, h);
  const ry = Math.min(h * 0.36, (w * 0.36) / 0.77);
  return { cx: w / 2, cy: h * 0.46, rx: ry * 0.77, ry, pad: m * 0.05, panjang: m * 0.12 };
}

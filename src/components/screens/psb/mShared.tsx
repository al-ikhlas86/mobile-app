import React from "react";
import { View, Text, TextInput, type TextInputProps } from "react-native";
import { useThemeColors } from "../../../context/ThemeContext";

// Tipe dan alat bantu bersama layar PSB Online (staf) di aplikasi HP. Bentuk data mengikuti routes/psbAdmin.js (sama dengan versi web).
export interface Res<T = unknown> { success: boolean; data?: T; message?: string; code?: string; rincian?: Record<string, string> }
export interface Katalog { id: number; kode: string; nama: string; kelola: boolean }
export interface Izin { semua: boolean; katalog: Katalog[]; kontak: string; emailTerpasang: boolean; templateFormulir: { kunci: string; label: string; untuk?: string[] }[] }
export type StatusPendaftar = "menunggu_bayar" | "menunggu_formulir" | "baru" | "diverifikasi" | "ditolak" | "diterima" | "cadangan" | "mundur";
export type StatusGelombang = "draft" | "belum_buka" | "terbuka" | "penuh" | "ditutup";
export interface GelombangRingkas {
  id: number; catalogId: number; katalog?: { kode: string; nama: string }; nama: string; tahunAjaran: string; deskripsi: string | null;
  tanggalBuka: string; tanggalTutup: string; kuota: number | null; biaya: number; instruksiBayar: string | null; terbit: boolean; akses: "publik" | "privat"; jenis: "siswa" | "guru" | "pegawai"; ditutupManual: boolean; goPublik: boolean; daftarOnline: boolean; tautan?: string;
  status: StatusGelombang; hitung: Partial<Record<StatusPendaftar, number>>; jumlahAktif: number; bisaKelola: boolean;
}
export interface FieldForm { id?: number; kunci: string; label: string; tipe: string; wajib: boolean; sistem: boolean; opsi: string[] | null; bantuan: string | null; bagian: string | null }
export interface GelombangDetail extends GelombangRingkas { fields: FieldForm[] }

export const LABEL_STATUS: Record<StatusPendaftar, string> = { menunggu_bayar: "Belum bayar", menunggu_formulir: "Sudah bayar, formulir belum diisi", baru: "Valid (baru)", diverifikasi: "Diverifikasi", cadangan: "Cadangan", diterima: "Diterima", ditolak: "Ditolak", mundur: "Mundur" };
export const LABEL_GELOMBANG: Record<StatusGelombang, string> = { draft: "Draf (belum terbit)", belum_buka: "Belum dibuka", terbuka: "Terbuka", penuh: "Kuota penuh", ditutup: "Ditutup (arsip)" };
export const TIPE_LABEL: Record<string, string> = { teks: "Teks pendek", teks_panjang: "Teks panjang", angka: "Angka", tanggal: "Tanggal", email: "Email", telepon: "Nomor HP", pilihan: "Pilihan", ya_tidak: "Ya / Tidak", persetujuan: "Persetujuan (wajib dicentang)", berkas: "Berkas (foto/PDF)" };
export const JENIS_JADWAL: Record<string, string> = { tes: "Tes", wawancara: "Wawancara", observasi: "Observasi", daftar_ulang: "Daftar ulang", lainnya: "Lainnya" };
export const TARGET_PENGUMUMAN: Record<string, string> = { semua: "Semua pendaftar", diverifikasi: "Yang diverifikasi", diterima: "Yang diterima", cadangan: "Yang cadangan", ditolak: "Yang tidak diterima" };

export const LABEL_JENIS: Record<string, string> = { siswa: "Siswa baru", guru: "Guru", pegawai: "Pegawai" };
export const rupiah = (n: number) => `Rp ${Number(n).toLocaleString("id-ID")}`;
export const waktuLengkap = (v: string) => new Date(v).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
export const tanggalPendek = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
export const adaPendaftar = (g: GelombangRingkas) => Object.values(g.hitung).some((n) => (n ?? 0) > 0);

const WARNA: Record<string, [string, string]> = {
  menunggu_bayar: ["#fef3c7", "#78350f"], menunggu_formulir: ["#dbeafe", "#1e3a8a"],
  baru: ["#e5e7eb", "#1f2937"], diverifikasi: ["#dbeafe", "#1e3a8a"], cadangan: ["#fef3c7", "#78350f"], diterima: ["#dcfce7", "#166534"], ditolak: ["#fee2e2", "#991b1b"], mundur: ["#e5e7eb", "#4b5563"],
  terbuka: ["#dcfce7", "#166534"], draft: ["#e5e7eb", "#4b5563"], belum_buka: ["#dbeafe", "#1e3a8a"], penuh: ["#fef3c7", "#78350f"], ditutup: ["#e5e7eb", "#4b5563"], lunas: ["#dcfce7", "#166534"], belum: ["#fef3c7", "#78350f"], batal: ["#e5e7eb", "#4b5563"],
};
/** Lencana berteks (warna hanya pelengkap). */
export function Lencana({ jenis, teks }: { jenis: string; teks: string }) {
  const [bg, fg] = WARNA[jenis] ?? WARNA.baru;
  return <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: "flex-start" }}><Text style={{ color: fg, fontSize: 12, fontWeight: "600" }}>{teks}</Text></View>;
}

export function Isian({ label, bantuan, galat, children }: { label: string; bantuan?: string | null; galat?: string; children: React.ReactNode }) {
  return (
    <View className="gap-1">
      <Text className="text-sm font-semibold text-foreground">{label}</Text>
      {bantuan ? <Text className="text-xs text-muted-foreground">{bantuan}</Text> : null}
      {children}
      {galat ? <Text className="text-xs text-red-600">{galat}</Text> : null}
    </View>
  );
}

export function Kolom(props: TextInputProps) {
  const colors = useThemeColors();
  return <TextInput placeholderTextColor={colors.mutedForeground} {...props} className={`bg-input-background border border-border rounded-lg px-3 py-2 text-sm text-foreground ${props.multiline ? "min-h-[80px]" : ""}`} style={props.multiline ? { textAlignVertical: "top" } : undefined} />;
}

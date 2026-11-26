import React, { useState } from "react";
import { View, Text } from "react-native";
import { Button } from "../../ui/Button";
import { SimplePicker } from "../../ui/SimplePicker";
import { api } from "../../../services/api";
import { Isian, Kolom, LABEL_JENIS, type GelombangDetail, type GelombangRingkas, type Izin, type Res } from "./mShared";

// Formulir gelombang di HP: buat baru (pilih katalog, formulir awal atau salin), atau ubah (awal terisi). Pemeriksaan sesungguhnya ada di server (psbCore.bersihkanGelombang).
export function FormGelombang({ izin, daftarGelombang, awal, onBatal, onSelesai }: { izin?: Izin; daftarGelombang?: GelombangRingkas[]; awal?: GelombangDetail; onBatal: () => void; onSelesai: (id: number) => void }) {
  const katalog = izin?.katalog.filter((k) => k.kelola) ?? [];
  const t = new Date(); const a = t.getMonth() >= 6 ? t.getFullYear() : t.getFullYear() - 1;
  const [catalogId, setCatalogId] = useState(String(katalog[0]?.id ?? ""));
  const [jenis, setJenis] = useState<"siswa" | "guru" | "pegawai">("siswa");
  const [template, setTemplate] = useState("dasar");
  const [salinDari, setSalinDari] = useState("");
  const [f, setF] = useState(() => (awal
    ? { nama: awal.nama, tahunAjaran: awal.tahunAjaran, tanggalBuka: awal.tanggalBuka, tanggalTutup: awal.tanggalTutup, kuota: awal.kuota ? String(awal.kuota) : "", biaya: String(awal.biaya), deskripsi: awal.deskripsi ?? "", instruksiBayar: awal.instruksiBayar ?? "", akses: awal.akses as string }
    : { nama: "", tahunAjaran: `${a}/${a + 1}`, tanggalBuka: "", tanggalTutup: "", kuota: "", biaya: "0", deskripsi: "", instruksiBayar: "", akses: "publik" }));
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const sumberSalin = (daftarGelombang ?? []).filter((g) => String(g.catalogId) === catalogId && g.jenis === jenis);
  const templatCocok = (izin?.templateFormulir ?? [{ kunci: "dasar", label: "Formulir dasar (ringkas)", untuk: ["siswa"] }]).filter((t) => !t.untuk || t.untuk.includes(jenis));

  const simpan = async () => {
    setGalat("");
    if (!awal && !catalogId) { setGalat("Pilih katalog."); return; }
    setSibuk(true);
    const badan = { ...f, kuota: f.kuota.trim() === "" ? null : Number(f.kuota), biaya: f.biaya.trim() === "" ? 0 : Number(f.biaya) };
    const res = (awal ? await api.psbGelombangUbah(awal.id, badan) : await api.psbGelombangBuat({ ...badan, catalogId: Number(catalogId), jenis, ...(template === "salin" ? { salinDariId: Number(salinDari) || null } : { template }) })) as Res<{ id: number }>;
    setSibuk(false);
    if (!res.success) { setGalat(res.message || "Gagal menyimpan."); return; }
    onSelesai(awal ? awal.id : res.data!.id);
  };
  return (
    <View className="gap-3">
      <Text className="font-semibold text-sm text-foreground">{awal ? "Ubah gelombang" : "Gelombang baru"}</Text>
      {!awal ? (
        <>
          <Isian label="Katalog"><SimplePicker value={catalogId} options={katalog.map((k) => ({ value: String(k.id), label: `${k.nama} (${k.kode})` }))} onChange={(v) => { setCatalogId(v); setSalinDari(""); }} placeholder="Pilih katalog" /></Isian>
          <Isian label="Jenis pendaftaran" bantuan="Siswa baru, atau lowongan guru/pegawai. Tidak bisa diubah setelah dibuat.">
            <SimplePicker value={jenis} options={(["siswa", "guru", "pegawai"] as const).map((j) => ({ value: j, label: LABEL_JENIS[j] }))} onChange={(v) => { const j = v as "siswa" | "guru" | "pegawai"; setJenis(j); setTemplate(j === "siswa" ? "dasar" : j); setSalinDari(""); }} placeholder="Pilih jenis" />
          </Isian>
          <Isian label="Formulir awal" bantuan="Pilih formulir siap pakai, atau salin dari gelombang sebelumnya.">
            <SimplePicker value={template} options={[...templatCocok.map((x) => ({ value: x.kunci, label: x.label })), ...(sumberSalin.length ? [{ value: "salin", label: "Salin dari gelombang lain" }] : [])]} onChange={setTemplate} placeholder="Pilih formulir" />
          </Isian>
          {template === "salin" ? <Isian label="Salin dari gelombang"><SimplePicker value={salinDari} options={sumberSalin.map((g) => ({ value: String(g.id), label: `${g.nama} (${g.tahunAjaran})` }))} onChange={setSalinDari} placeholder="Pilih gelombang" /></Isian> : null}
        </>
      ) : null}
      <Isian label="Nama gelombang"><Kolom value={f.nama} onChangeText={(v) => set("nama", v)} maxLength={120} placeholder="mis. Gelombang 1" /></Isian>
      <Isian label="Tahun ajaran" bantuan="Format 2026/2027."><Kolom value={f.tahunAjaran} onChangeText={(v) => set("tahunAjaran", v)} maxLength={9} /></Isian>
      <Isian label="Tanggal buka" bantuan="Format TTTT-BB-HH, mis. 2027-01-15."><Kolom value={f.tanggalBuka} onChangeText={(v) => set("tanggalBuka", v)} maxLength={10} keyboardType="numbers-and-punctuation" /></Isian>
      <Isian label="Tanggal tutup"><Kolom value={f.tanggalTutup} onChangeText={(v) => set("tanggalTutup", v)} maxLength={10} keyboardType="numbers-and-punctuation" /></Isian>
      <Isian label="Kuota pendaftar" bantuan="Kosongkan bila tanpa batas."><Kolom value={f.kuota} onChangeText={(v) => set("kuota", v.replace(/\D/g, ""))} keyboardType="number-pad" /></Isian>
      <Isian label="Biaya pendaftaran (Rp)" bantuan="0 = gratis: formulir langsung terbuka tanpa tagihan."><Kolom value={f.biaya} onChangeText={(v) => set("biaya", v.replace(/\D/g, ""))} keyboardType="number-pad" /></Isian>
      <Isian label="Siapa yang bisa mendaftar" bantuan="Privat: tidak tampil di daftar publik, hanya lewat tautan khusus.">
        <SimplePicker value={f.akses} options={[{ value: "publik", label: "Publik (tampil di halaman pendaftaran)" }, { value: "privat", label: "Privat (hanya lewat tautan khusus)" }]} onChange={(v) => set("akses", v)} placeholder="Pilih" />
      </Isian>
      <Isian label="Deskripsi"><Kolom value={f.deskripsi} onChangeText={(v) => set("deskripsi", v)} multiline maxLength={2000} /></Isian>
      <Isian label="Petunjuk pembayaran" bantuan="Bisa diisi nanti."><Kolom value={f.instruksiBayar} onChangeText={(v) => set("instruksiBayar", v)} multiline maxLength={1000} /></Isian>
      {galat ? <Text className="text-sm text-red-600">{galat}</Text> : null}
      <View className="flex-row gap-2"><Button size="sm" variant="primary" disabled={sibuk} loading={sibuk} onPress={() => void simpan()}>Simpan</Button><Button size="sm" variant="outline" disabled={sibuk} onPress={onBatal}>Batal</Button></View>
    </View>
  );
}

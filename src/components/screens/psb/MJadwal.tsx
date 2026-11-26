import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Alert, Pressable, ActivityIndicator } from "react-native";
import { Plus, Trash2, Users, Check } from "lucide-react-native";
import { Button } from "../../ui/Button";
import { SimplePicker } from "../../ui/SimplePicker";
import { api } from "../../../services/api";
import { useThemeColors } from "../../../context/ThemeContext";
import { KirimEmail, type RingkasanEmail } from "./MKirimEmail";
import { Isian, Kolom, JENIS_JADWAL, LABEL_STATUS, waktuLengkap, type GelombangDetail, type Res, type StatusPendaftar } from "./mShared";

// Tab Jadwal (HP): daftar, buat, hapus, dan atur peserta. Tanggal TTTT-BB-HH dan jam JJ:MM (zona waktu perangkat).
interface Jadwal { id: number; judul: string; jenis: string; mulai: string; selesai: string | null; lokasi: string | null; catatan: string | null; kuota: number | null; peserta: number; email: RingkasanEmail }
interface Peserta { id: number; nomor: string; nama: string; status: StatusPendaftar }
const RE_TGL = /^\d{4}-\d{2}-\d{2}$/; const RE_JAM = /^\d{2}:\d{2}$/;
const gabung = (t: string, j: string) => (RE_TGL.test(t) && RE_JAM.test(j) ? new Date(`${t}T${j}:00`) : null);

export function TabJadwal({ g }: { g: GelombangDetail }) {
  const [daftar, setDaftar] = useState<Jadwal[] | null>(null);
  const [galat, setGalat] = useState("");
  const [baru, setBaru] = useState(false);
  const [peserta, setPeserta] = useState<Jadwal | null>(null);

  const muat = useCallback(async () => {
    const res = (await api.psbJadwalList(g.id)) as Res<Jadwal[]>;
    if (res.success && res.data) setDaftar(res.data); else setGalat(res.message || "Gagal memuat jadwal.");
  }, [g.id]);
  useEffect(() => { void muat(); }, [muat]);

  if (peserta) return <PanelPeserta g={g} j={peserta} onTutup={() => { setPeserta(null); void muat(); }} />;
  if (baru) return <FormJadwal g={g} onBatal={() => setBaru(false)} onSelesai={() => { setBaru(false); void muat(); }} />;
  const hapus = (j: Jadwal) => Alert.alert("Hapus jadwal", `Hapus "${j.judul}"? Penetapan pesertanya ikut terhapus.`, [
    { text: "Batal", style: "cancel" },
    { text: "Hapus", style: "destructive", onPress: async () => { const res = (await api.psbJadwalHapus(j.id)) as Res; if (!res.success) Alert.alert("Gagal", res.message || "Gagal menghapus."); void muat(); } },
  ]);
  return (
    <View className="gap-3">
      {g.bisaKelola ? <View className="flex-row"><Button size="sm" variant="primary" onPress={() => setBaru(true)}><Plus size={14} color="#fff" /> Jadwal baru</Button></View> : null}
      {galat ? <Text className="text-sm text-red-600">{galat}</Text> : null}
      {!daftar && !galat ? <ActivityIndicator /> : null}
      {daftar?.length === 0 ? <Text className="text-sm text-muted-foreground">Belum ada jadwal.</Text> : null}
      {daftar?.map((j) => (
        <View key={j.id} className="rounded-xl border border-border p-3 gap-1">
          <Text className="text-sm font-semibold text-foreground">{j.judul} <Text className="text-xs font-normal text-muted-foreground">({JENIS_JADWAL[j.jenis] ?? j.jenis})</Text></Text>
          <Text className="text-xs text-muted-foreground">{waktuLengkap(j.mulai)}{j.selesai ? ` – ${waktuLengkap(j.selesai)}` : ""}{j.lokasi ? ` · ${j.lokasi}` : ""}</Text>
          <Text className="text-xs text-muted-foreground">{j.peserta} peserta{j.kuota ? ` / kuota ${j.kuota}` : ""}</Text>
          {j.catatan ? <Text className="text-xs text-muted-foreground">{j.catatan}</Text> : null}
          <KirimEmail jenis="jadwal" id={j.id} email={j.email} bolehKirim={g.bisaKelola && j.peserta > 0} alasanNonaktif={j.peserta === 0 ? "Tambahkan peserta dulu" : undefined} onSelesai={() => void muat()} />
          <View className="flex-row gap-2 mt-1"><Button size="sm" variant="outline" onPress={() => setPeserta(j)}><Users size={14} /> Peserta</Button>{g.bisaKelola ? <Button size="sm" variant="outline" onPress={() => hapus(j)}><Trash2 size={14} /> Hapus</Button> : null}</View>
        </View>
      ))}
    </View>
  );
}

function FormJadwal({ g, onBatal, onSelesai }: { g: GelombangDetail; onBatal: () => void; onSelesai: () => void }) {
  const [f, setF] = useState({ judul: "", jenis: "tes", tgl: "", jam: "08:00", jamSelesai: "", lokasi: "", catatan: "", kuota: "" });
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const simpan = async () => {
    setGalat("");
    const mulai = gabung(f.tgl, f.jam);
    if (!mulai) { setGalat("Isi tanggal (TTTT-BB-HH) dan jam mulai (JJ:MM) dengan benar."); return; }
    const selesai = f.jamSelesai ? gabung(f.tgl, f.jamSelesai) : null;
    if (f.jamSelesai && !selesai) { setGalat("Jam selesai harus berformat JJ:MM."); return; }
    setSibuk(true);
    const res = (await api.psbJadwalBuat(g.id, { judul: f.judul, jenis: f.jenis, mulai: mulai.toISOString(), selesai: selesai?.toISOString() ?? null, lokasi: f.lokasi, catatan: f.catatan, kuota: f.kuota ? Number(f.kuota) : null })) as Res;
    setSibuk(false);
    if (!res.success) { setGalat(res.message || "Gagal menyimpan."); return; }
    onSelesai();
  };
  return (
    <View className="gap-3">
      <Text className="font-semibold text-sm text-foreground">Jadwal baru</Text>
      <Isian label="Judul"><Kolom value={f.judul} onChangeText={(v) => set("judul", v)} maxLength={160} placeholder="mis. Tes membaca dan berhitung" /></Isian>
      <Isian label="Jenis"><SimplePicker value={f.jenis} options={Object.entries(JENIS_JADWAL).map(([value, label]) => ({ value, label }))} onChange={(v) => set("jenis", v)} /></Isian>
      <Isian label="Tanggal" bantuan="Format TTTT-BB-HH."><Kolom value={f.tgl} onChangeText={(v) => set("tgl", v)} maxLength={10} keyboardType="numbers-and-punctuation" /></Isian>
      <Isian label="Jam mulai (JJ:MM)"><Kolom value={f.jam} onChangeText={(v) => set("jam", v)} maxLength={5} keyboardType="numbers-and-punctuation" /></Isian>
      <Isian label="Jam selesai (opsional)"><Kolom value={f.jamSelesai} onChangeText={(v) => set("jamSelesai", v)} maxLength={5} keyboardType="numbers-and-punctuation" /></Isian>
      <Isian label="Lokasi"><Kolom value={f.lokasi} onChangeText={(v) => set("lokasi", v)} maxLength={160} /></Isian>
      <Isian label="Kuota peserta (opsional)"><Kolom value={f.kuota} onChangeText={(v) => set("kuota", v.replace(/\D/g, ""))} keyboardType="number-pad" /></Isian>
      <Isian label="Catatan untuk peserta"><Kolom value={f.catatan} onChangeText={(v) => set("catatan", v)} multiline maxLength={300} /></Isian>
      {galat ? <Text className="text-sm text-red-600">{galat}</Text> : null}
      <View className="flex-row gap-2"><Button size="sm" variant="primary" disabled={sibuk} loading={sibuk} onPress={() => void simpan()}>Simpan</Button><Button size="sm" variant="outline" disabled={sibuk} onPress={onBatal}>Batal</Button></View>
    </View>
  );
}

function PanelPeserta({ g, j, onTutup }: { g: GelombangDetail; j: Jadwal; onTutup: () => void }) {
  const colors = useThemeColors();
  const [peserta, setPeserta] = useState<Peserta[] | null>(null);
  const [calon, setCalon] = useState<Peserta[]>([]);
  const [pilih, setPilih] = useState<number[]>([]);
  const [q, setQ] = useState("");
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const muat = useCallback(async () => {
    const res = (await api.psbPeserta(j.id)) as Res<Peserta[]>;
    if (res.success && res.data) setPeserta(res.data); else setGalat(res.message || "Gagal memuat peserta.");
  }, [j.id]);
  useEffect(() => { void muat(); }, [muat]);
  useEffect(() => {
    if (!g.bisaKelola) return undefined;
    let batal = false;
    const t = setTimeout(async () => {
      // Daftar pendaftar berhalaman 30: muat semua halaman (maks. 10) agar "Pilih semua" benar-benar semua.
      const semua: Peserta[] = [];
      for (let h = 1; h <= 10; h += 1) {
        const res = (await api.psbPendaftarList(g.id, { q: q.trim() || undefined, halaman: h })) as Res<Peserta[]> & { totalHalaman?: number };
        if (batal) return;
        if (!res.success || !res.data) break;
        semua.push(...res.data);
        if (h >= (res.totalHalaman ?? 1)) break;
      }
      setCalon(semua.filter((c) => !["ditolak", "mundur", "menunggu_bayar"].includes(c.status)));
    }, 300);
    return () => { batal = true; clearTimeout(t); };
  }, [g.id, g.bisaKelola, q]);
  const sudah = new Set((peserta ?? []).map((p) => p.id));
  const tersedia = calon.filter((c) => !sudah.has(c.id));
  const semuaTerpilih = tersedia.length > 0 && tersedia.every((c) => pilih.includes(c.id));
  const tambah = async () => {
    setGalat(""); setSibuk(true);
    let res: Res = { success: true };
    for (let i = 0; i < pilih.length && res.success; i += 200) res = (await api.psbPesertaTambah(j.id, pilih.slice(i, i + 200))) as Res;
    setSibuk(false);
    if (!res.success) { setGalat(res.message || "Gagal menambah peserta."); return; }
    const n = pilih.length;
    setPilih([]); void muat();
    // Orang tua baru tahu jadwalnya kalau diberi kabar: tawarkan langsung kirim email ke peserta yang belum menerimanya.
    Alert.alert("Kirim email jadwal?", `${n} peserta ditambahkan. Kirim email jadwal "${j.judul}" ke mereka sekarang? Orang tua baru tahu jadwal tes lewat email ini. Bisa juga dikirim nanti dari daftar jadwal.`, [
      { text: "Nanti", style: "cancel" },
      { text: "Kirim sekarang", onPress: async () => {
        const k = (await api.psbJadwalKirim(j.id, false)) as Res<{ antrian: number }>;
        Alert.alert(k.success ? "Email" : "Gagal", k.success ? (k.data?.antrian ? `Mengirim email ke ${k.data.antrian} penerima. Status terkirim tampil di daftar jadwal.` : "Tidak ada penerima baru dengan email.") : (k.message || "Gagal mengirim email."));
      } },
    ]);
  };
  const lepas = async (p: Peserta) => { const res = (await api.psbPesertaHapus(j.id, p.id)) as Res; if (!res.success) Alert.alert("Gagal", res.message || "Gagal."); void muat(); };
  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between gap-2"><Text className="font-semibold text-sm text-foreground flex-1">Peserta: {j.judul}</Text><Button size="sm" variant="outline" onPress={onTutup}>Tutup</Button></View>
      {!peserta ? <ActivityIndicator /> : null}
      {peserta?.length === 0 ? <Text className="text-sm text-muted-foreground">Belum ada peserta.</Text> : null}
      {peserta?.map((p) => (
        <View key={p.id} className="flex-row items-center justify-between gap-2 py-1.5 border-b border-border">
          <Text className="text-sm text-foreground flex-1">{p.nama} <Text className="text-xs text-muted-foreground">{p.nomor} · {LABEL_STATUS[p.status]}</Text></Text>
          {g.bisaKelola ? <Button size="sm" variant="outline" onPress={() => void lepas(p)} accessibilityLabel={`Keluarkan ${p.nama}`}><Trash2 size={14} color={colors.primary} /></Button> : null}
        </View>
      ))}
      {g.bisaKelola ? (
        <View className="gap-2 border-t border-border pt-3">
          <Text className="text-sm font-semibold text-foreground">Tambah peserta</Text>
          <Kolom value={q} onChangeText={setQ} placeholder="Cari pendaftar..." maxLength={60} />
          {tersedia.length > 0 ? (
            <Pressable onPress={() => setPilih(semuaTerpilih ? [] : tersedia.map((c) => c.id))} accessibilityRole="checkbox" accessibilityState={{ checked: semuaTerpilih }} className="flex-row items-center gap-2 py-1.5">
              <View style={{ borderColor: semuaTerpilih ? colors.primary : colors.mutedForeground, backgroundColor: semuaTerpilih ? colors.primary : "transparent" }} className="w-5 h-5 rounded border-2 items-center justify-center">{semuaTerpilih ? <Check size={12} color="#fff" /> : null}</View>
              <Text className="text-sm font-semibold text-foreground">Pilih semua ({tersedia.length})</Text>
            </Pressable>
          ) : peserta ? <Text className="text-xs text-muted-foreground">Tidak ada pendaftar lain yang bisa ditambahkan (hanya yang sudah membayar dan belum ditolak/mundur).</Text> : null}
          {tersedia.map((c) => (
            <Pressable key={c.id} onPress={() => setPilih((s) => (s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id]))} accessibilityRole="checkbox" accessibilityState={{ checked: pilih.includes(c.id) }} className="flex-row items-center gap-2 py-1.5">
              <View style={{ borderColor: pilih.includes(c.id) ? colors.primary : colors.mutedForeground, backgroundColor: pilih.includes(c.id) ? colors.primary : "transparent" }} className="w-5 h-5 rounded border-2 items-center justify-center">{pilih.includes(c.id) ? <Check size={12} color="#fff" /> : null}</View>
              <Text className="text-sm text-foreground flex-1">{c.nama} <Text className="text-xs text-muted-foreground">{c.nomor} · {LABEL_STATUS[c.status]}</Text></Text>
            </Pressable>
          ))}
          {galat ? <Text className="text-sm text-red-600">{galat}</Text> : null}
          <View className="flex-row"><Button size="sm" variant="primary" disabled={sibuk || pilih.length === 0} loading={sibuk} onPress={() => void tambah()}>{`Tambahkan${pilih.length ? ` (${pilih.length})` : ""}`}</Button></View>
        </View>
      ) : null}
    </View>
  );
}

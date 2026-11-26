import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Alert, ActivityIndicator, Switch } from "react-native";
import { Plus, Trash2 } from "lucide-react-native";
import { Button } from "../../ui/Button";
import { SimplePicker } from "../../ui/SimplePicker";
import { api } from "../../../services/api";
import { KirimEmail, type RingkasanEmail } from "./MKirimEmail";
import { Isian, Kolom, Lencana, TARGET_PENGUMUMAN, waktuLengkap, type GelombangDetail, type Res } from "./mShared";

// Tab Pengumuman (HP): tampil di halaman status orang tua (nomor + kode akses) sesuai sasaran status. Draf tidak tampil.
interface Pengumuman { id: number; judul: string; isi: string; target: string; terbitPada: string | null; email: RingkasanEmail }
interface Template { id: number; nama: string; judul: string; isi: string }

export function TabPengumuman({ g }: { g: GelombangDetail }) {
  const [daftar, setDaftar] = useState<Pengumuman[] | null>(null);
  const [galat, setGalat] = useState("");
  const [form, setForm] = useState<{ judul: string; isi: string; target: string; terbit: boolean } | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [namaTemplate, setNamaTemplate] = useState<string | null>(null);

  const muatTemplate = useCallback(async () => {
    const res = (await api.psbTemplateList(g.catalogId)) as Res<Template[]>;
    if (res.success && res.data) setTemplates(res.data);
  }, [g.catalogId]);
  const muat = useCallback(async () => {
    const res = (await api.psbPengumumanList(g.id)) as Res<Pengumuman[]>;
    if (res.success && res.data) setDaftar(res.data); else setGalat(res.message || "Gagal memuat pengumuman.");
  }, [g.id]);
  useEffect(() => { void muat(); void muatTemplate(); }, [muat, muatTemplate]);

  const simpan = async () => {
    if (!form) return;
    setGalat(""); setSibuk(true);
    const res = (await api.psbPengumumanBuat(g.id, form)) as Res;
    setSibuk(false);
    if (!res.success) { setGalat(res.message || "Gagal menyimpan."); return; }
    setForm(null); void muat();
  };
  const simpanTemplate = async () => {
    if (!form || namaTemplate === null) return;
    setSibuk(true);
    const res = (await api.psbTemplateBuat({ catalogId: g.catalogId, nama: namaTemplate, judul: form.judul, isi: form.isi })) as Res;
    setSibuk(false);
    if (!res.success) { Alert.alert("Gagal", res.message || "Gagal menyimpan template."); return; }
    setNamaTemplate(null); void muatTemplate();
  };
  const hapusTemplate = (t: Template) => Alert.alert("Hapus template", `Hapus template "${t.nama}"? Pengumuman yang sudah dibuat tidak terpengaruh.`, [
    { text: "Batal", style: "cancel" },
    { text: "Hapus", style: "destructive", onPress: async () => { const res = (await api.psbTemplateHapus(t.id)) as Res; if (!res.success) Alert.alert("Gagal", res.message || "Gagal menghapus."); void muatTemplate(); } },
  ]);
  const hapus = (p: Pengumuman) => Alert.alert("Hapus pengumuman", `Hapus "${p.judul}"?`, [
    { text: "Batal", style: "cancel" },
    { text: "Hapus", style: "destructive", onPress: async () => { const res = (await api.psbPengumumanHapus(p.id)) as Res; if (!res.success) Alert.alert("Gagal", res.message || "Gagal menghapus."); void muat(); } },
  ]);

  if (form) {
    return (
      <View className="gap-3">
        <Text className="font-semibold text-sm text-foreground">Pengumuman baru</Text>
        {templates.length > 0 ? <Isian label="Pakai template" bantuan="Mengisi judul dan isi; masih bisa diubah."><SimplePicker value="" options={templates.map((t) => ({ value: String(t.id), label: t.nama }))} onChange={(v) => { const t = templates.find((x) => String(x.id) === v); if (t) setForm({ ...form, judul: t.judul, isi: t.isi }); }} placeholder="Pilih template..." /></Isian> : null}
        <Isian label="Judul"><Kolom value={form.judul} onChangeText={(v) => setForm({ ...form, judul: v })} maxLength={160} /></Isian>
        <Isian label="Isi"><Kolom value={form.isi} onChangeText={(v) => setForm({ ...form, isi: v })} multiline maxLength={4000} /></Isian>
        <Isian label="Sasaran" bantuan="Tampil hanya bagi pendaftar dengan status yang dipilih."><SimplePicker value={form.target} options={Object.entries(TARGET_PENGUMUMAN).map(([value, label]) => ({ value, label }))} onChange={(v) => setForm({ ...form, target: v })} /></Isian>
        <View className="flex-row items-center justify-between"><Text className="text-sm text-foreground flex-1">Terbitkan sekarang (mati = simpan sebagai draf)</Text><Switch value={form.terbit} onValueChange={(v) => setForm({ ...form, terbit: v })} /></View>
        {galat ? <Text className="text-sm text-red-600">{galat}</Text> : null}
        {namaTemplate !== null ? (
          <View className="gap-2"><Isian label="Nama template"><Kolom value={namaTemplate} onChangeText={setNamaTemplate} maxLength={80} /></Isian>
            <View className="flex-row gap-2"><Button size="sm" variant="primary" disabled={sibuk || !namaTemplate.trim()} onPress={() => void simpanTemplate()}>Simpan template</Button><Button size="sm" variant="outline" onPress={() => setNamaTemplate(null)}>Batal</Button></View></View>
        ) : null}
        <View className="flex-row flex-wrap gap-2"><Button size="sm" variant="primary" disabled={sibuk} loading={sibuk} onPress={() => void simpan()}>Simpan</Button><Button size="sm" variant="outline" disabled={sibuk || !form.judul.trim() || !form.isi.trim()} onPress={() => setNamaTemplate(form.judul.slice(0, 60))}>Simpan sebagai template</Button><Button size="sm" variant="outline" disabled={sibuk} onPress={() => { setForm(null); setGalat(""); }}>Batal</Button></View>
      </View>
    );
  }
  return (
    <View className="gap-3">
      <Text className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">Pengumuman memberi kabar ke pendaftar sesuai sasarannya (tampil di halaman pendaftaran dan bisa dikirim lewat email). Untuk menentukan diterima, cadangan, atau ditolak, ubah status di tab Pendaftar (buka pendaftar lalu tekan Jadikan ...); sasaran pengumuman mengikuti status itu.</Text>
      {g.bisaKelola ? <View className="flex-row"><Button size="sm" variant="primary" onPress={() => setForm({ judul: "", isi: "", target: "semua", terbit: true })}><Plus size={14} color="#fff" /> Pengumuman baru</Button></View> : null}
      {galat ? <Text className="text-sm text-red-600">{galat}</Text> : null}
      {!daftar && !galat ? <ActivityIndicator /> : null}
      {g.bisaKelola && templates.length > 0 ? (
        <View className="gap-1"><Text className="text-sm font-semibold text-foreground">Template tersimpan ({templates.length})</Text>
          {templates.map((t) => <View key={t.id} className="flex-row items-center justify-between gap-2"><Text className="text-sm text-foreground flex-1">{t.nama}</Text><Button size="sm" variant="outline" onPress={() => hapusTemplate(t)}><Trash2 size={14} /> Hapus</Button></View>)}
        </View>
      ) : null}
      {daftar?.length === 0 ? <Text className="text-sm text-muted-foreground">Belum ada pengumuman.</Text> : null}
      {daftar?.map((p) => (
        <View key={p.id} className="rounded-xl border border-border p-3 gap-1">
          <View className="flex-row items-start justify-between gap-2"><Text className="text-sm font-semibold text-foreground flex-1">{p.judul}</Text><View className="gap-1 items-end"><Lencana jenis={p.terbitPada ? "terbuka" : "draft"} teks={p.terbitPada ? "Terbit" : "Draf"} /><Lencana jenis="baru" teks={TARGET_PENGUMUMAN[p.target] ?? p.target} /></View></View>
          {p.terbitPada ? <Text className="text-xs text-muted-foreground">Terbit {waktuLengkap(p.terbitPada)}</Text> : null}
          <Text className="text-sm text-foreground">{p.isi}</Text>
          <KirimEmail jenis="pengumuman" id={p.id} email={p.email} bolehKirim={g.bisaKelola && Boolean(p.terbitPada)} alasanNonaktif={p.terbitPada ? undefined : "Terbitkan dulu (bukan draf)"} onSelesai={() => void muat()} />
          {g.bisaKelola ? <View className="flex-row mt-1"><Button size="sm" variant="outline" onPress={() => hapus(p)}><Trash2 size={14} /> Hapus</Button></View> : null}
        </View>
      ))}
    </View>
  );
}

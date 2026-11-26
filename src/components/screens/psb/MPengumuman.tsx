import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Alert, ActivityIndicator, Switch } from "react-native";
import { Plus, Trash2 } from "lucide-react-native";
import { Button } from "../../ui/Button";
import { SimplePicker } from "../../ui/SimplePicker";
import { api } from "../../../services/api";
import { Isian, Kolom, Lencana, TARGET_PENGUMUMAN, waktuLengkap, type GelombangDetail, type Res } from "./mShared";

// Tab Pengumuman (HP): tampil di halaman status orang tua (nomor + kode akses) sesuai sasaran status. Draf tidak tampil.
interface Pengumuman { id: number; judul: string; isi: string; target: string; terbitPada: string | null }

export function TabPengumuman({ g }: { g: GelombangDetail }) {
  const [daftar, setDaftar] = useState<Pengumuman[] | null>(null);
  const [galat, setGalat] = useState("");
  const [form, setForm] = useState<{ judul: string; isi: string; target: string; terbit: boolean } | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(async () => {
    const res = (await api.psbPengumumanList(g.id)) as Res<Pengumuman[]>;
    if (res.success && res.data) setDaftar(res.data); else setGalat(res.message || "Gagal memuat pengumuman.");
  }, [g.id]);
  useEffect(() => { void muat(); }, [muat]);

  const simpan = async () => {
    if (!form) return;
    setGalat(""); setSibuk(true);
    const res = (await api.psbPengumumanBuat(g.id, form)) as Res;
    setSibuk(false);
    if (!res.success) { setGalat(res.message || "Gagal menyimpan."); return; }
    setForm(null); void muat();
  };
  const hapus = (p: Pengumuman) => Alert.alert("Hapus pengumuman", `Hapus "${p.judul}"?`, [
    { text: "Batal", style: "cancel" },
    { text: "Hapus", style: "destructive", onPress: async () => { const res = (await api.psbPengumumanHapus(p.id)) as Res; if (!res.success) Alert.alert("Gagal", res.message || "Gagal menghapus."); void muat(); } },
  ]);

  if (form) {
    return (
      <View className="gap-3">
        <Text className="font-semibold text-sm text-foreground">Pengumuman baru</Text>
        <Isian label="Judul"><Kolom value={form.judul} onChangeText={(v) => setForm({ ...form, judul: v })} maxLength={160} /></Isian>
        <Isian label="Isi"><Kolom value={form.isi} onChangeText={(v) => setForm({ ...form, isi: v })} multiline maxLength={4000} /></Isian>
        <Isian label="Sasaran" bantuan="Tampil hanya bagi pendaftar dengan status yang dipilih."><SimplePicker value={form.target} options={Object.entries(TARGET_PENGUMUMAN).map(([value, label]) => ({ value, label }))} onChange={(v) => setForm({ ...form, target: v })} /></Isian>
        <View className="flex-row items-center justify-between"><Text className="text-sm text-foreground flex-1">Terbitkan sekarang (mati = simpan sebagai draf)</Text><Switch value={form.terbit} onValueChange={(v) => setForm({ ...form, terbit: v })} /></View>
        {galat ? <Text className="text-sm text-red-600">{galat}</Text> : null}
        <View className="flex-row gap-2"><Button size="sm" variant="primary" disabled={sibuk} loading={sibuk} onPress={() => void simpan()}>Simpan</Button><Button size="sm" variant="outline" disabled={sibuk} onPress={() => { setForm(null); setGalat(""); }}>Batal</Button></View>
      </View>
    );
  }
  return (
    <View className="gap-3">
      {g.bisaKelola ? <View className="flex-row"><Button size="sm" variant="primary" onPress={() => setForm({ judul: "", isi: "", target: "semua", terbit: true })}><Plus size={14} color="#fff" /> Pengumuman baru</Button></View> : null}
      {galat ? <Text className="text-sm text-red-600">{galat}</Text> : null}
      {!daftar && !galat ? <ActivityIndicator /> : null}
      {daftar?.length === 0 ? <Text className="text-sm text-muted-foreground">Belum ada pengumuman.</Text> : null}
      {daftar?.map((p) => (
        <View key={p.id} className="rounded-xl border border-border p-3 gap-1">
          <View className="flex-row items-start justify-between gap-2"><Text className="text-sm font-semibold text-foreground flex-1">{p.judul}</Text><View className="gap-1 items-end"><Lencana jenis={p.terbitPada ? "terbuka" : "draft"} teks={p.terbitPada ? "Terbit" : "Draf"} /><Lencana jenis="baru" teks={TARGET_PENGUMUMAN[p.target] ?? p.target} /></View></View>
          {p.terbitPada ? <Text className="text-xs text-muted-foreground">Terbit {waktuLengkap(p.terbitPada)}</Text> : null}
          <Text className="text-sm text-foreground">{p.isi}</Text>
          {g.bisaKelola ? <View className="flex-row mt-1"><Button size="sm" variant="outline" onPress={() => hapus(p)}><Trash2 size={14} /> Hapus</Button></View> : null}
        </View>
      ))}
    </View>
  );
}

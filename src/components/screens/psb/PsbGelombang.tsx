import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Alert, Pressable, Share } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, AlertTriangle } from "lucide-react-native";
import { Card } from "../../ui/Card";
import { Button } from "../../ui/Button";
import { api, API_URL } from "../../../services/api";
import { useThemeColors } from "../../../context/ThemeContext";
import { Lencana, LABEL_GELOMBANG, rupiah, type GelombangDetail, type Res } from "./mShared";
import { FormGelombang } from "./MFormGelombang";
import { TabPendaftar } from "./MPendaftar";
import { TabFormulir } from "./MFormulir";
import { TabJadwal } from "./MJadwal";
import { TabPengumuman } from "./MPengumuman";

// Detail satu gelombang di HP: tab Pendaftar, Formulir, Jadwal, Pengumuman, Pengaturan.
type Tab = "pendaftar" | "formulir" | "jadwal" | "pengumuman" | "pengaturan";
const TABS: { id: Tab; teks: string }[] = [{ id: "pendaftar", teks: "Pendaftar" }, { id: "formulir", teks: "Formulir" }, { id: "jadwal", teks: "Jadwal" }, { id: "pengumuman", teks: "Pengumuman" }, { id: "pengaturan", teks: "Pengaturan" }];

function TabPengaturan({ g, onChanged, onHapus }: { g: GelombangDetail; onChanged: () => void; onHapus: () => void }) {
  const [mengubah, setMengubah] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const tautan = `${API_URL}/api/public/psb/g/${g.id}`;
  const terbit = (nilai: boolean) => Alert.alert(nilai ? "Terbitkan gelombang" : "Tarik dari publik", nilai ? "Setelah GO PUBLIK dibuka, orang tua bisa mendaftar selama masa pendaftaran." : "Formulir publik tidak lagi tampil; data pendaftar tetap ada.", [
    { text: "Batal", style: "cancel" },
    { text: nilai ? "Terbitkan" : "Tarik", onPress: async () => { setSibuk(true); const res = (await api.psbGelombangTerbit(g.id, nilai)) as Res; setSibuk(false); if (!res.success) Alert.alert("Gagal", res.message || "Gagal."); onChanged(); } },
  ]);
  const hapus = () => Alert.alert("Hapus gelombang", `Hapus "${g.nama}" beserta formulirnya? Tidak bisa dibatalkan.`, [
    { text: "Batal", style: "cancel" },
    { text: "Hapus", style: "destructive", onPress: async () => { setSibuk(true); const res = (await api.psbGelombangHapus(g.id)) as Res; setSibuk(false); if (!res.success) Alert.alert("Gagal", res.message || "Gagal menghapus."); else onHapus(); } },
  ]);
  if (mengubah) return <FormGelombang awal={g} onBatal={() => setMengubah(false)} onSelesai={() => { setMengubah(false); onChanged(); }} />;
  return (
    <View className="gap-3">
      <View className="flex-row flex-wrap items-center gap-2"><Text className="text-sm font-semibold text-foreground">Status:</Text><Lencana jenis={g.status} teks={LABEL_GELOMBANG[g.status]} /><Lencana jenis={g.terbit ? "terbuka" : "draft"} teks={g.terbit ? "Diterbitkan" : "Belum diterbitkan"} /></View>
      {g.bisaKelola ? (
        <View className="flex-row flex-wrap gap-2">
          <Button size="sm" variant={g.terbit ? "outline" : "primary"} disabled={sibuk} onPress={() => terbit(!g.terbit)}>{g.terbit ? "Tarik dari publik" : "Terbitkan"}</Button>
          <Button size="sm" variant="outline" disabled={sibuk} onPress={() => setMengubah(true)}>Ubah data</Button>
          <Button size="sm" variant="outline" disabled={sibuk} onPress={hapus}>Hapus</Button>
        </View>
      ) : <Text className="text-xs text-muted-foreground">Anda hanya bisa melihat gelombang ini.</Text>}
      <Text className="text-sm text-foreground">Periode {g.tanggalBuka} s.d. {g.tanggalTutup} · Kuota {g.kuota ?? "tanpa batas"} · Biaya {g.biaya > 0 ? rupiah(g.biaya) : "gratis"}</Text>
      {g.deskripsi ? <Text className="text-sm text-muted-foreground">{g.deskripsi}</Text> : null}
      {g.instruksiBayar ? <Text className="text-sm text-foreground"><Text className="font-semibold">Petunjuk pembayaran: </Text>{g.instruksiBayar}</Text> : null}
      <View className="gap-1">
        <Text className="text-sm font-semibold text-foreground">Tautan formulir publik gelombang ini</Text>
        <Text selectable className="bg-muted rounded-lg px-2.5 py-2 text-xs text-foreground" style={{ fontFamily: "monospace" }}>{tautan}</Text>
        <View className="flex-row"><Button size="sm" variant="outline" onPress={() => void Share.share({ message: tautan })}>Bagikan tautan</Button></View>
        <Text className="text-xs text-muted-foreground">Bisa dipakai setelah gelombang terbit dan Admin IT menekan GO PUBLIK.</Text>
      </View>
    </View>
  );
}

export function PsbGelombang({ id, onKembali }: { id: number; onKembali: () => void }) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [g, setG] = useState<GelombangDetail | null>(null);
  const [galat, setGalat] = useState("");
  const [tab, setTab] = useState<Tab>("pendaftar");

  const muat = useCallback(async () => {
    setGalat("");
    const res = (await api.psbGelombang(id)) as Res<GelombangDetail>;
    if (res.success && res.data) setG(res.data); else setGalat(res.message || "Gagal memuat gelombang.");
  }, [id]);
  useEffect(() => { void muat(); }, [muat]);

  if (galat) {
    return (
      <View className="flex-1 bg-background px-4 py-8 gap-3">
        <View className="flex-row items-center gap-2"><AlertTriangle size={16} color="#dc2626" /><Text className="text-sm text-red-600 flex-1">{galat}</Text></View>
        <View className="flex-row gap-2"><Button size="sm" variant="outline" onPress={() => void muat()}>Coba lagi</Button><Button size="sm" variant="outline" onPress={onKembali}>Kembali</Button></View>
      </View>
    );
  }
  if (!g) return <View className="flex-1 bg-background items-center justify-center"><ActivityIndicator color={colors.primary} /></View>;

  return (
    <ScrollView className="flex-1 bg-background px-4 pt-4" contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 12 }} keyboardShouldPersistTaps="handled">
      <Pressable onPress={onKembali} accessibilityRole="button" className="flex-row items-center gap-1.5 self-start"><ArrowLeft size={14} color={colors.primary} /><Text className="text-sm font-medium text-primary">Semua gelombang</Text></Pressable>
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1"><Text className="text-lg font-semibold text-foreground">{g.nama}</Text><Text className="text-xs text-muted-foreground">{g.katalog?.nama} · Tahun ajaran {g.tahunAjaran}</Text></View>
        <Lencana jenis={g.status} teks={LABEL_GELOMBANG[g.status]} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }} accessibilityRole="tablist">
        {TABS.map((t) => (
          <Pressable key={t.id} onPress={() => setTab(t.id)} accessibilityRole="tab" accessibilityState={{ selected: tab === t.id }} className={`px-3 py-2 rounded-full border ${tab === t.id ? "bg-primary border-primary" : "border-border"}`}>
            <Text className={`text-sm font-medium ${tab === t.id ? "text-primary-foreground" : "text-foreground"}`}>{t.teks}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Card padding="lg">
        {tab === "pendaftar" ? <TabPendaftar g={g} onChanged={() => void muat()} /> : null}
        {tab === "formulir" ? <TabFormulir g={g} onChanged={() => void muat()} /> : null}
        {tab === "jadwal" ? <TabJadwal g={g} /> : null}
        {tab === "pengumuman" ? <TabPengumuman g={g} /> : null}
        {tab === "pengaturan" ? <TabPengaturan g={g} onChanged={() => void muat()} onHapus={onKembali} /> : null}
      </Card>
    </ScrollView>
  );
}

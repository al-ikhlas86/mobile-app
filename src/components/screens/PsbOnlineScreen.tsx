import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Alert, Pressable, Share } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GraduationCap, Plus, AlertTriangle, Globe, ChevronRight } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { api, API_URL } from "../../services/api";
import { useThemeColors } from "../../context/ThemeContext";
import { PsbGelombang } from "./psb/PsbGelombang";
import { FormGelombang } from "./psb/MFormGelombang";
import {
  Lencana, LABEL_GELOMBANG, LABEL_STATUS, rupiah, tanggalPendek, type GelombangRingkas, type Izin, type Res, type StatusPendaftar,
} from "./psb/mShared";

// PSB Online (staf) di HP: padanan layar web PsbOnlineScreen. Hak akses dijaga server per katalog.
const LINK_PUBLIK = `${API_URL}/api/public/psb`;

export function PsbOnlineScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [izin, setIzin] = useState<Izin | null>(null);
  const [daftar, setDaftar] = useState<GelombangRingkas[] | null>(null);
  const [galat, setGalat] = useState("");
  const [buka, setBuka] = useState<number | null>(null);
  const [membuat, setMembuat] = useState(false);
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(async () => {
    setGalat("");
    const [a, b] = await Promise.all([api.psbIzin() as Promise<Res<Izin>>, api.psbGelombangList() as Promise<Res<GelombangRingkas[]>>]);
    if (a.success && a.data) setIzin(a.data); else setGalat(a.message || "Gagal memuat izin PSB.");
    if (b.success && b.data) setDaftar(b.data); else if (a.success) setGalat(b.message || "Gagal memuat gelombang.");
  }, []);
  useEffect(() => { void muat(); }, [muat]);

  const goPublik = (aktif: boolean) => Alert.alert(
    aktif ? "GO PUBLIK" : "Tutup pendaftaran publik",
    aktif ? "Gelombang yang sudah diterbitkan dan masih dalam masa pendaftaran akan bisa didaftari SIAPA PUN lewat tautan publik. Pastikan formulir, biaya, dan petunjuk pembayaran sudah benar. Lanjutkan?" : "Halaman pendaftaran akan menampilkan 'belum dibuka'. Data pendaftar yang sudah masuk tetap aman.",
    [{ text: "Batal", style: "cancel" }, { text: aktif ? "GO PUBLIK" : "Tutup", style: aktif ? "default" : "destructive", onPress: async () => {
      setSibuk(true); const res = (await api.psbGoPublik(aktif)) as Res; setSibuk(false);
      if (!res.success) Alert.alert("Gagal", res.message || "Gagal mengubah pengaturan."); else void muat();
    } }],
  );

  if (galat && !izin) {
    return (
      <View className="flex-1 bg-background px-4 py-8 gap-3">
        <View className="flex-row items-center gap-2"><AlertTriangle size={16} color="#dc2626" /><Text className="text-sm text-red-600 flex-1">{galat}</Text></View>
        <View className="flex-row"><Button size="sm" variant="outline" onPress={() => void muat()}>Coba lagi</Button></View>
      </View>
    );
  }
  if (!izin || !daftar) return <View className="flex-1 bg-background items-center justify-center"><ActivityIndicator color={colors.primary} /></View>;
  if (buka !== null) return <PsbGelombang id={buka} onKembali={() => { setBuka(null); void muat(); }} />;

  const bisaBuat = izin.katalog.some((k) => k.kelola);
  return (
    <ScrollView className="flex-1 bg-background px-4 pt-5" contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 12 }} keyboardShouldPersistTaps="handled">
      {izin.bisaAturPublik ? (
        <Card padding="lg">
          <View className="flex-row items-start gap-3">
            <Globe size={20} color={colors.primary} />
            <View className="flex-1 gap-1">
              <Text className="font-semibold text-sm text-foreground">Pendaftaran publik</Text>
              <Lencana jenis={izin.publikAktif ? "terbuka" : "draft"} teks={izin.publikAktif ? "Terbuka untuk umum" : "Tertutup"} />
              <Text className="text-xs text-muted-foreground mt-1">{izin.publikAktif ? "Orang tua bisa mendaftar lewat tautan (hanya gelombang yang terbit dan masih dalam masa pendaftaran)." : "Selama tertutup, tautan publik hanya menampilkan 'belum dibuka'. Siapkan gelombang dulu, lalu tekan GO PUBLIK."}</Text>
              <Text selectable className="bg-muted rounded-lg px-2.5 py-2 text-xs text-foreground mt-1" style={{ fontFamily: "monospace" }}>{LINK_PUBLIK}</Text>
              <View className="flex-row flex-wrap gap-2 mt-2">
                <Button size="sm" variant={izin.publikAktif ? "outline" : "primary"} disabled={sibuk} onPress={() => goPublik(!izin.publikAktif)}>{izin.publikAktif ? "Tutup pendaftaran publik" : "GO PUBLIK"}</Button>
                <Button size="sm" variant="outline" onPress={() => void Share.share({ message: LINK_PUBLIK })}>Bagikan tautan</Button>
              </View>
            </View>
          </View>
        </Card>
      ) : null}

      {membuat ? (
        <Card padding="lg"><FormGelombang katalog={izin.katalog.filter((k) => k.kelola)} onBatal={() => setMembuat(false)} onSelesai={(id) => { setMembuat(false); setBuka(id); }} /></Card>
      ) : bisaBuat ? (
        <View className="flex-row"><Button size="sm" variant="primary" onPress={() => setMembuat(true)}><Plus size={14} color="#fff" /> Gelombang baru</Button></View>
      ) : null}

      {daftar.length === 0 && !membuat ? <Card padding="lg"><Text className="text-sm text-muted-foreground">Belum ada gelombang pendaftaran{bisaBuat ? ". Buat gelombang pertama untuk memulai." : "."}</Text></Card> : null}

      {daftar.map((g) => (
        <Pressable key={g.id} onPress={() => setBuka(g.id)} accessibilityRole="button" accessibilityLabel={`Buka ${g.nama}`}>
          <Card padding="lg">
            <View className="flex-row items-start justify-between gap-2">
              <View className="flex-1">
                <View className="flex-row items-center gap-2"><GraduationCap size={16} color={colors.primary} /><Text className="font-semibold text-sm text-foreground flex-1">{g.nama}</Text></View>
                <Text className="text-xs text-muted-foreground">{g.katalog?.nama} · {g.tahunAjaran} · {tanggalPendek(g.tanggalBuka)} s.d. {tanggalPendek(g.tanggalTutup)}</Text>
              </View>
              <View className="items-end gap-1"><Lencana jenis={g.status} teks={LABEL_GELOMBANG[g.status]} /><ChevronRight size={16} color={colors.mutedForeground} /></View>
            </View>
            <Text className="text-xs text-muted-foreground mt-2">
              Biaya {g.biaya > 0 ? rupiah(g.biaya) : "gratis"} · {g.jumlahAktif} pendaftar aktif{g.kuota ? ` dari kuota ${g.kuota}` : ""}
              {(Object.keys(LABEL_STATUS) as StatusPendaftar[]).filter((k) => g.hitung[k]).map((k) => ` · ${LABEL_STATUS[k]} ${g.hitung[k]}`).join("")}
            </Text>
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}

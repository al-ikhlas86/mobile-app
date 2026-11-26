import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Linking, Share, Alert, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Download, Share2, ExternalLink, AlertTriangle, Smartphone, BookOpen } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { api } from "../../services/api";
import { useThemeColors } from "../../context/ThemeContext";

// Menu Admin IT "Infrastruktur": panduan pemasangan + tautan unduh. Isi diambil dari endpoint PUBLIK /api/public/unduhan (satu sumber dengan halaman
// unduh yang bisa dibuka siapa pun tanpa login), jadi tidak ada salinan panduan yang bisa tertinggal. Tombol Unduh selalu mengarah ke rilis TERBARU
// (tautan GitHub releases/latest/download) dan membuka peramban yang langsung mengunduh. Padanan layar web InfrastrukturScreen.tsx.
interface AplikasiInfo {
  id: string; nama: string; untuk: string; persyaratan: string[]; langkah: string[]; catatan: string[]; berkas: string; versi: string | null; urlUnduh: string;
}
interface Data {
  halamanPublik: string;
  aplikasi: AplikasiInfo[];
  android: { nama: string; urlUnduh: string; urlWeb: string };
  pedoman: string[];
}

function Daftar({ judul, butir, bernomor = false, redup = false, terbuka = true }: { judul: string; butir: string[]; bernomor?: boolean; redup?: boolean; terbuka?: boolean }) {
  const [buka, setBuka] = useState(terbuka);
  return (
    <View className="mt-3">
      <Pressable onPress={() => setBuka(!buka)} accessibilityRole="button" accessibilityState={{ expanded: buka }}>
        <Text className="text-sm font-semibold text-foreground">{buka ? "▾" : "▸"} {judul}</Text>
      </Pressable>
      {buka ? (
        <View className="mt-1 gap-1">
          {butir.map((b, i) => (
            <Text key={i} className={`text-sm ${redup ? "text-muted-foreground" : "text-foreground"}`}>{bernomor ? `${i + 1}. ` : "• "}{b}</Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function InfrastrukturScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [data, setData] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");

  const muat = useCallback(async () => {
    setGalat("");
    const res = await api.publikUnduhan();
    if (res.success && res.data) setData(res.data as Data);
    else setGalat(res.message || "Gagal memuat panduan.");
  }, []);
  useEffect(() => { void muat(); }, [muat]);

  const buka = (url: string) => { Linking.openURL(url).catch(() => Alert.alert("Gagal", "Tidak bisa membuka tautan. Coba bagikan tautannya lalu buka di peramban.")); };
  const bagikan = async (url: string) => {
    try { await Share.share({ message: url }); } catch { Alert.alert("Gagal", "Tidak bisa membuka menu bagikan."); }
  };

  if (galat) {
    return (
      <View className="flex-1 bg-background px-4 py-8 gap-3">
        <View className="flex-row items-center gap-2"><AlertTriangle size={16} color="#dc2626" /><Text className="text-sm text-red-600 flex-1">{galat}</Text></View>
        <View className="flex-row"><Button size="sm" variant="outline" onPress={() => void muat()}>Coba lagi</Button></View>
      </View>
    );
  }
  if (!data) {
    return <View className="flex-1 bg-background items-center justify-center gap-2"><ActivityIndicator color={colors.primary} /><Text className="text-sm text-muted-foreground">Memuat panduan...</Text></View>;
  }

  return (
    <ScrollView className="flex-1 bg-background px-4 pt-5" contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 16 }}>
      <Card padding="lg">
        <View className="flex-row items-start gap-3">
          <BookOpen size={20} color={colors.primary} />
          <View className="flex-1">
            <Text className="font-semibold text-sm text-foreground">Halaman unduh publik (tanpa login)</Text>
            <Text className="text-xs text-muted-foreground mt-1">
              Bagikan atau buka tautan ini di PC yang akan dipasangi aplikasi. Siapa pun bisa membukanya tanpa login, tombol Unduh selalu memberi versi terbaru, dan Anda tidak perlu memperbarui tautan manual.
            </Text>
            <Text selectable className="bg-muted rounded-lg px-2.5 py-2 text-xs text-foreground mt-2" style={{ fontFamily: "monospace" }}>{data.halamanPublik}</Text>
            <View className="flex-row flex-wrap gap-2 mt-2">
              <Button size="sm" variant="primary" onPress={() => void bagikan(data.halamanPublik)}><Share2 size={14} color="#fff" /> Bagikan tautan</Button>
              <Button size="sm" variant="outline" onPress={() => buka(data.halamanPublik)}><ExternalLink size={14} color={colors.foreground} /> Buka halaman</Button>
            </View>
          </View>
        </View>
      </Card>

      {data.aplikasi.map((a) => (
        <Card key={a.id} padding="lg">
          <Text className="font-semibold text-sm text-foreground">{a.nama}</Text>
          <Text className="text-xs text-muted-foreground">{a.versi ? `Versi terbaru: v${a.versi}` : "Selalu versi terbaru"} · {a.berkas}</Text>
          <View className="flex-row flex-wrap gap-2 mt-2">
            <Button size="sm" variant="primary" onPress={() => buka(a.urlUnduh)}><Download size={14} color="#fff" /> Unduh</Button>
            <Button size="sm" variant="outline" onPress={() => void bagikan(a.urlUnduh)}><Share2 size={14} color={colors.foreground} /> Bagikan tautan</Button>
          </View>
          <Text className="text-sm text-foreground mt-2">{a.untuk}</Text>
          <Daftar judul="Persyaratan" butir={a.persyaratan} />
          <Daftar judul="Cara memasang" butir={a.langkah} bernomor />
          {a.catatan.length > 0 ? <Daftar judul="Catatan" butir={a.catatan} redup terbuka={false} /> : null}
        </Card>
      ))}

      <Card padding="lg">
        <View className="flex-row items-start gap-3">
          <Smartphone size={20} color={colors.primary} />
          <View className="flex-1">
            <Text className="font-semibold text-sm text-foreground">{data.android.nama}</Text>
            <Text className="text-xs text-muted-foreground">Untuk HP Android. Tanpa memasang aplikasi, layanan yang sama bisa dibuka di {data.android.urlWeb}</Text>
            <View className="flex-row mt-2"><Button size="sm" variant="primary" onPress={() => buka(data.android.urlUnduh)}><Download size={14} color="#fff" /> Unduh APK</Button></View>
          </View>
        </View>
      </Card>

      <Card padding="lg">
        <Text className="font-semibold text-sm text-foreground mb-2">Pedoman</Text>
        <View className="gap-1">{data.pedoman.map((p, i) => <Text key={i} className="text-sm text-foreground">• {p}</Text>)}</View>
      </Card>
    </ScrollView>
  );
}

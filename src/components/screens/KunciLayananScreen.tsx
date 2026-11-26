import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RefreshCw, AlertTriangle, KeyRound } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { api } from "../../services/api";
import { useThemeColors } from "../../context/ThemeContext";

// Pusat Kunci Layanan (Admin IT): padanan layar web KunciLayananScreen. Nilai rahasia tidak pernah dikirim server; hanya status, sidik jari
// pendek, hasil uji sambungan, tanggal kedaluwarsa, dan petunjuk rotasi.
interface KunciLayanan {
  id: string; nama: string; fungsi: string; sidikJari: string | null; kedaluwarsa: string | null;
  status: "sehat" | "terpasang" | "segera" | "bermasalah" | "lemah" | "tidak_dipasang"; detail: string; rotasi: string;
}

const LABEL: Record<KunciLayanan["status"], { teks: string; bg: string; fg: string }> = {
  sehat: { teks: "Sehat", bg: "#dcfce7", fg: "#166534" },
  terpasang: { teks: "Terpasang", bg: "#e5e7eb", fg: "#1f2937" },
  segera: { teks: "Perlu perhatian", bg: "#fef3c7", fg: "#78350f" },
  bermasalah: { teks: "Bermasalah", bg: "#fee2e2", fg: "#991b1b" },
  lemah: { teks: "Lemah", bg: "#fee2e2", fg: "#991b1b" },
  tidak_dipasang: { teks: "Belum dipasang", bg: "#e5e7eb", fg: "#4b5563" },
};
const tanggal = (iso: string) => new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

export function KunciLayananScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [data, setData] = useState<KunciLayanan[] | null>(null);
  const [galat, setGalat] = useState("");
  const [memuat, setMemuat] = useState(false);
  const [buka, setBuka] = useState<string | null>(null);

  const muat = useCallback(async (segarkan = false) => {
    setMemuat(true); setGalat("");
    const res = await api.adminKunciLayanan(segarkan);
    if (res.success && res.data) setData(res.data as KunciLayanan[]); else setGalat(res.message || "Gagal memuat kunci layanan.");
    setMemuat(false);
  }, []);
  useEffect(() => { void muat(); }, [muat]);

  const perlu = (data ?? []).filter((k) => ["bermasalah", "lemah", "segera"].includes(k.status)).length;

  return (
    <ScrollView className="flex-1 bg-background px-4 pt-5" contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 12 }}>
      <Card padding="lg">
        <View className="flex-row items-start gap-3">
          <KeyRound size={20} color={colors.primary} />
          <View className="flex-1">
            <Text className="text-sm text-foreground">Kunci dan token yang dipakai sistem. Nilainya tidak pernah ditampilkan; hanya status, sidik jari pendek, dan petunjuk rotasi.</Text>
            <View className="flex-row items-center gap-3 mt-3 flex-wrap">
              <Button size="sm" variant="outline" disabled={memuat} onPress={() => void muat(true)}><RefreshCw size={14} color={colors.foreground} /> Periksa ulang</Button>
              {data ? <Text className="text-xs font-medium text-foreground">{perlu > 0 ? `${perlu} kunci perlu perhatian` : "Semua kunci dalam kondisi baik"}</Text> : null}
            </View>
          </View>
        </View>
      </Card>

      {galat ? <View className="flex-row items-center gap-2"><AlertTriangle size={16} color="#dc2626" /><Text className="text-sm text-red-600 flex-1">{galat}</Text></View> : null}
      {!data && !galat ? <ActivityIndicator color={colors.primary} /> : null}

      {data?.map((k) => (
        <Card key={k.id} padding="lg">
          <View className="flex-row items-start justify-between gap-2">
            <View className="flex-1">
              <Text className="font-semibold text-sm text-foreground">{k.nama}</Text>
              <Text className="text-xs text-muted-foreground">{k.fungsi}</Text>
            </View>
            <View style={{ backgroundColor: LABEL[k.status].bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ color: LABEL[k.status].fg, fontSize: 12, fontWeight: "600" }}>{LABEL[k.status].teks}</Text>
            </View>
          </View>
          <Text className="text-sm text-foreground mt-2">{k.detail}</Text>
          {k.sidikJari ? <Text className="text-xs text-muted-foreground mt-2">Sidik jari: <Text style={{ fontFamily: "monospace" }} className="text-foreground">{k.sidikJari}</Text></Text> : null}
          {k.kedaluwarsa ? <Text className="text-xs text-muted-foreground">Kedaluwarsa: <Text className="text-foreground">{tanggal(k.kedaluwarsa)}</Text></Text> : null}
          <Text onPress={() => setBuka(buka === k.id ? null : k.id)} accessibilityRole="button" className="text-xs font-semibold text-primary mt-2">{buka === k.id ? "▾" : "▸"} Cara rotasi</Text>
          {buka === k.id ? <Text className="text-xs text-muted-foreground mt-1">{k.rotasi}</Text> : null}
        </Card>
      ))}
    </ScrollView>
  );
}

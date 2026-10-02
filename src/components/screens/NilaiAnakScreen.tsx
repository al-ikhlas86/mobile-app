import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertCircle } from "lucide-react-native";
import { ChildSwitcher } from "../ChildSwitcher";
import { SiswaNilaiScreen } from "./SiswaNilaiScreen";
import { api } from "../../services/api";
import { useThemeColors } from "../../context/ThemeContext";

interface ChildData { id: number; nama: string; kelas_nama: string | null }

// Layar "Nilai Anak" orang tua (2026-10-02) - jalan pintas dari beranda ke nilai anak, selain tab
// "Nilai" di dalam Akademik. Isinya sama (SiswaNilaiScreen), dibungkus pemilih anak.
export function NilaiAnakScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [children, setChildren] = useState<ChildData[]>([]);
  const [activeChildId, setActiveChildId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const res = await api.myChildren();
      if (res.success) {
        setChildren(res.data);
        setActiveChildId(res.data[0]?.id ?? null);
      } else {
        setError(res.message ?? "Gagal memuat data anak.");
      }
      setLoading(false);
    })();
  }, []);

  const child = children.find((c) => c.id === activeChildId) ?? null;
  if (loading) {
    return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator color={colors.primary} /></View>;
  }
  if (error || !child) {
    return (
      <View className="flex-1 items-center justify-center bg-background gap-3 px-8">
        <AlertCircle size={32} color={colors.mutedForeground} />
        <Text className="text-sm text-muted-foreground text-center">{error || "Belum ada data anak yang tertaut ke akun ini."}</Text>
      </View>
    );
  }
  return (
    <View className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 12 }}>
        <ChildSwitcher children={children} activeId={activeChildId} onChange={setActiveChildId} />
        <SiswaNilaiScreen studentCacheId={child.id} studentNama={child.nama} />
      </ScrollView>
    </View>
  );
}

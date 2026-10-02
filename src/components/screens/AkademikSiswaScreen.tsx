import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CalendarDays, BookOpen, ClipboardList, AlertCircle } from "lucide-react-native";
import { ChildSwitcher } from "../ChildSwitcher";
import { JadwalPelajaranScreen } from "./JadwalPelajaranScreen";
import { SiswaMateriScreen } from "./SiswaMateriScreen";
import { SiswaTugasScreen } from "./SiswaTugasScreen";
import { api } from "../../services/api";
import { useThemeColors } from "../../context/ThemeContext";

interface ChildData {
  id: number;
  nama: string;
  kelas_nama: string | null;
}

type Tab = "jadwal" | "materi" | "tugas";

// Tab bar - gaya SAMA dgn TabBar internal JadwalPelajaranScreen.tsx (file
// itu tidak mengekspor TabBar-nya, jadi disalin di sini), tapi 3 tombol
// bukan 2.
function TabBar({ activeTab, onChange, colors }: { activeTab: Tab; onChange: (t: Tab) => void; colors: ReturnType<typeof useThemeColors> }) {
  return (
    <View className="px-4 pt-5">
      <View className="flex-row gap-2 p-1 bg-muted rounded-xl">
        <Pressable onPress={() => onChange("jadwal")} className={`flex-1 py-2.5 rounded-lg flex-row items-center justify-center gap-1.5 ${activeTab === "jadwal" ? "bg-card" : ""}`}>
          <CalendarDays size={15} color={activeTab === "jadwal" ? colors.primary : colors.mutedForeground} />
          <Text className={`text-sm font-medium ${activeTab === "jadwal" ? "text-foreground" : "text-muted-foreground"}`}>Jadwal & Kalender</Text>
        </Pressable>
        <Pressable onPress={() => onChange("materi")} className={`flex-1 py-2.5 rounded-lg flex-row items-center justify-center gap-1.5 ${activeTab === "materi" ? "bg-card" : ""}`}>
          <BookOpen size={15} color={activeTab === "materi" ? colors.primary : colors.mutedForeground} />
          <Text className={`text-sm font-medium ${activeTab === "materi" ? "text-foreground" : "text-muted-foreground"}`}>Materi</Text>
        </Pressable>
        <Pressable onPress={() => onChange("tugas")} className={`flex-1 py-2.5 rounded-lg flex-row items-center justify-center gap-1.5 ${activeTab === "tugas" ? "bg-card" : ""}`}>
          <ClipboardList size={15} color={activeTab === "tugas" ? colors.primary : colors.mutedForeground} />
          <Text className={`text-sm font-medium ${activeTab === "tugas" ? "text-foreground" : "text-muted-foreground"}`}>Tugas</Text>
        </Pressable>
      </View>
    </View>
  );
}

// Shell 3 tab Akademik Siswa (2026-09-24) - pemisahan Tugas & Materi yang
// sebelumnya tercampur di 1 layar (TugasAnakScreen lama, sekarang khusus
// dipertahankan biar tidak mematahkan APK lama yg belum di-build ulang).
// Port native dari webview AkademikSiswaScreen.tsx. ChildSwitcher DITARUH
// SATU KALI di sini (bukan diulang di tiap tab) krn tab Materi & Tugas
// sama-sama perlu tahu anak aktif; tab Jadwal PUNYA ChildSwitcher sendiri
// di dalam JadwalPelajaranScreen (dipakai apa adanya, tidak diubah) makanya
// ChildSwitcher shell ini disembunyikan saat tab itu aktif supaya tidak
// dobel.
export function AkademikSiswaScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [activeTab, setActiveTab] = useState<Tab>("jadwal");
  const [children, setChildren] = useState<ChildData[]>([]);
  const [activeChildId, setActiveChildId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
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

  function handleSelectChild(id: number) {
    setActiveChildId(id);
  }

  const child = children.find((c) => c.id === activeChildId) ?? null;

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error || !child) {
    return (
      <View className="flex-1 items-center justify-center bg-background gap-3 px-8">
        <AlertCircle size={32} color={colors.mutedForeground} />
        <Text className="text-sm text-muted-foreground text-center">{error || "Belum ada data anak yang tertaut ke akun ini."}</Text>
      </View>
    );
  }

  // Tab "Jadwal" punya ChildSwitcher & layout scroll sendiri (flex-1) di
  // dalam JadwalPelajaranScreen - dirender langsung tanpa ScrollView
  // tambahan di sini supaya tidak nested-scroll.
  if (activeTab === "jadwal") {
    return (
      <View className="flex-1 bg-background">
        <TabBar activeTab={activeTab} onChange={setActiveTab} colors={colors} />
        <JadwalPelajaranScreen mode="anak" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <TabBar activeTab={activeTab} onChange={setActiveTab} colors={colors} />
      <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 12 }}>
        <ChildSwitcher children={children} activeId={activeChildId} onChange={handleSelectChild} />

        {activeTab === "materi" && <SiswaMateriScreen studentCacheId={child.id} studentNama={child.nama} kelasNama={child.kelas_nama} />}
        {activeTab === "tugas" && <SiswaTugasScreen studentCacheId={child.id} studentNama={child.nama} kelasNama={child.kelas_nama} />}
      </ScrollView>
    </View>
  );
}

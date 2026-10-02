import React, { useState } from "react";
import { View, Text, Pressable, useWindowDimensions } from "react-native";
import { CalendarDays, BookOpen, ClipboardList, Award } from "lucide-react-native";
import { JadwalPelajaranScreen } from "./JadwalPelajaranScreen";
import { GuruMateriScreen } from "./GuruMateriScreen";
import { GuruTugasScreen } from "./GuruTugasScreen";
import { NilaiGuruScreen } from "./NilaiGuruScreen";
import { useRaportAktif } from "../../hooks/useRaportAktif";
import { useThemeColors } from "../../context/ThemeContext";

type AkademikTab = "jadwal" | "materi" | "tugas" | "nilai";

const TABS: { key: AkademikTab; label: string; Icon: React.ComponentType<{ size?: number; color?: string }> }[] = [
  { key: "jadwal", label: "Jadwal & Kalender", Icon: CalendarDays },
  { key: "materi", label: "Materi", Icon: BookOpen },
  { key: "tugas", label: "Tugas", Icon: ClipboardList },
  { key: "nilai", label: "Nilai", Icon: Award },
];

// Tab bar gaya SAMA dgn TabBar internal JadwalPelajaranScreen.tsx (3 tombol,
// bukan 2 - itu TabBar internal punya JadwalPelajaranScreen sendiri, KHUSUS
// "Kalender Kegiatan"/"Jadwal Pelajaran", tetap dipertahankan apa adanya di
// dalam tab "Jadwal & Kalender" di bawah ini). Port native dari webview
// AkademikGuruScreen.tsx (poin 3 Fase 2, 2026-09-24).
// Tab "Nilai" (2026-10-02) muncul HANYA bila fitur Nilai Raport sudah dinyalakan Admin IT
// (useRaportAktif); dgn 4 tab di layar sempit (HP), label "Jadwal & Kalender" dipersingkat
// jadi "Jadwal" (di web: breakpoint sm = 640 dp).
function TabBar({ activeTab, onChange, colors, tampilNilai }: { activeTab: AkademikTab; onChange: (t: AkademikTab) => void; colors: ReturnType<typeof useThemeColors>; tampilNilai: boolean }) {
  const { width } = useWindowDimensions();
  const sempit = width < 640;
  return (
    <View className="flex-row gap-1.5 p-1 bg-muted rounded-xl">
      {TABS.filter((t) => t.key !== "nilai" || tampilNilai).map(({ key, label, Icon }) => (
        <Pressable
          key={key}
          onPress={() => onChange(key)}
          className={`flex-1 min-w-0 py-2.5 rounded-lg flex-row items-center justify-center gap-1.5 ${activeTab === key ? "bg-card" : ""}`}
        >
          <Icon size={15} color={activeTab === key ? colors.primary : colors.mutedForeground} />
          <Text numberOfLines={1} className={`text-sm font-medium ${activeTab === key ? "text-foreground" : "text-muted-foreground"}`}>
            {key === "jadwal" && tampilNilai && sempit ? "Jadwal" : label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// Shell menu "Mengajar" guru - pecahan dari BuatTugasScreen.tsx lama (poin 3
// Fase 2, 2026-09-24): Tugas & Materi dipisah tab masing2, Jadwal Pelajaran
// dipindah ke sini juga (dipakai APA ADANYA dari file lama, TIDAK diubah).
// Tiap tab me-render layar penuh sendiri (padding sendiri2) - TabBar shell
// ini sengaja di luar itu supaya tidak dobel padding dgn TabBar internal
// JadwalPelajaranScreen mode guru. Port native dari webview
// AkademikGuruScreen.tsx.
export function AkademikGuruScreen() {
  const [activeTab, setActiveTab] = useState<AkademikTab>("jadwal");
  const colors = useThemeColors();
  const tampilNilai = useRaportAktif();

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 pt-5">
        <TabBar activeTab={activeTab} onChange={setActiveTab} colors={colors} tampilNilai={tampilNilai} />
      </View>
      <View className="flex-1">
        {activeTab === "jadwal" && <JadwalPelajaranScreen mode="guru" />}
        {activeTab === "materi" && <GuruMateriScreen />}
        {activeTab === "tugas" && <GuruTugasScreen />}
        {activeTab === "nilai" && tampilNilai && <NilaiGuruScreen />}
      </View>
    </View>
  );
}

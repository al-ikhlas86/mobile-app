// ============================================================
// PENGENALAN WAJAH - TAB WALI KELAS (2026-09-05, W10) - BARU. Wali kelas
// dapat 2 tab (pola tab identik PresensiScreen.tsx: "Daftarkan Wajah" =
// FaceEnrollmentScreen APA ADANYA, tidak diubah; "Siswa Terdaftar" = list
// baru). Guru/pegawai BUKAN wali kelas TIDAK PERNAH melihat komponen ini
// sama sekali - RootNavigator merender FaceEnrollmentScreen langsung
// tanpa tab utk mereka (lihat wiring di situ), perilaku lama 100%
// tidak berubah.
// ============================================================
import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { ScanFace, Users } from "lucide-react-native";
import { FaceEnrollmentScreen } from "./FaceEnrollmentScreen";
import { SiswaTerdaftarScreen } from "./SiswaTerdaftarScreen";
import { useThemeColors } from "../../context/ThemeContext";

type Tab = "daftar" | "siswa";

export function PengenalanWajahTabs({ onNavigate }: { onNavigate: (screen: string, params?: Record<string, unknown>) => void }) {
  const colors = useThemeColors();
  const [activeTab, setActiveTab] = useState<Tab>("daftar");

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 pt-5">
        <View className="flex-row gap-2 p-1 bg-muted rounded-xl">
          <Pressable onPress={() => setActiveTab("daftar")} className={`flex-1 py-2.5 rounded-lg flex-row items-center justify-center gap-1.5 ${activeTab === "daftar" ? "bg-card" : ""}`}>
            <ScanFace size={15} color={activeTab === "daftar" ? colors.primary : colors.mutedForeground} />
            <Text className={`text-sm font-medium ${activeTab === "daftar" ? "text-foreground" : "text-muted-foreground"}`}>Daftarkan Wajah</Text>
          </Pressable>
          <Pressable onPress={() => setActiveTab("siswa")} className={`flex-1 py-2.5 rounded-lg flex-row items-center justify-center gap-1.5 ${activeTab === "siswa" ? "bg-card" : ""}`}>
            <Users size={15} color={activeTab === "siswa" ? colors.primary : colors.mutedForeground} />
            <Text className={`text-sm font-medium ${activeTab === "siswa" ? "text-foreground" : "text-muted-foreground"}`}>Siswa Terdaftar</Text>
          </Pressable>
        </View>
      </View>

      {activeTab === "daftar" ? (
        <FaceEnrollmentScreen onNavigate={onNavigate} target="self" />
      ) : (
        <SiswaTerdaftarScreen />
      )}
    </View>
  );
}

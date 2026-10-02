import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { ClipboardList, Settings } from "lucide-react-native";
import { NilaiGuruScreen } from "./NilaiGuruScreen";
import { PengaturanNilaiScreen } from "./PengaturanNilaiScreen";
import { useThemeColors } from "../../context/ThemeContext";

type Tab = "isi" | "pengaturan";

// Menu "Nilai Raport" untuk Admin TU / Admin IT (2026-10-02) - port native dari webview
// NilaiRaportAdminScreen.tsx: tab 1 = lembar nilai semua kelas (isi/koreksi/terbitkan - dipakai
// ulang dari layar guru, server yang membatasi hak), tab 2 = pengaturan komponen, bobot, KKM,
// dan saklar fitur. Tiap tab merender layar penuh (scroll & padding sendiri) - tab bar ini
// di luar mereka, gaya sama dgn TabBar AkademikGuruScreen.
export function NilaiRaportAdminScreen() {
  const colors = useThemeColors();
  const [tab, setTab] = useState<Tab>("isi");
  const gaya = (aktif: boolean) => `flex-1 py-2.5 rounded-lg flex-row items-center justify-center gap-1.5 ${aktif ? "bg-card" : ""}`;
  const teks = (aktif: boolean) => `text-sm font-medium ${aktif ? "text-foreground" : "text-muted-foreground"}`;
  return (
    <View className="flex-1 bg-background">
      <View className="px-4 pt-5">
        <View className="flex-row gap-2 p-1 bg-muted rounded-xl">
          <Pressable onPress={() => setTab("isi")} className={gaya(tab === "isi")}>
            <ClipboardList size={15} color={tab === "isi" ? colors.primary : colors.mutedForeground} />
            <Text className={teks(tab === "isi")}>Nilai & Terbit</Text>
          </Pressable>
          <Pressable onPress={() => setTab("pengaturan")} className={gaya(tab === "pengaturan")}>
            <Settings size={15} color={tab === "pengaturan" ? colors.primary : colors.mutedForeground} />
            <Text className={teks(tab === "pengaturan")}>Pengaturan</Text>
          </Pressable>
        </View>
      </View>
      <View className="flex-1">
        {tab === "isi" ? <NilaiGuruScreen /> : <PengaturanNilaiScreen />}
      </View>
    </View>
  );
}

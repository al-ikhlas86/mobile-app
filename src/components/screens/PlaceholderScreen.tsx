import React from "react";
import { View, Text } from "react-native";
import { Wrench } from "lucide-react-native";
import { useThemeColors } from "../../context/ThemeContext";

// Dipakai utk 2 kasus BEDA (dibedakan lewat prop subtitle):
// 1. Layar yang belum sempat diporting dari versi webview (default) -
//    ditampilkan apa adanya supaya navigasi tetap utuh selagi porting
//    berlanjut. Lihat PROGRESS.md utk daftar lengkap yang masih pending.
// 2. Menu yang GENUINELY belum dibangun sama sekali di sistem manapun
//    (mis. Slip Gaji, Keuangan) - dipanggil dgn subtitle kustom, pesannya
//    HARUS beda krn "masih tersedia di versi web" itu bohong utk kasus ini
//    (webnya JUGA cuma placeholder yg sama, lihat PlaceholderScreen.tsx web).
export function PlaceholderScreen({ title, subtitle }: { title: string; subtitle?: string }) {
  const colors = useThemeColors();
  return (
    <View className="flex-1 items-center justify-center bg-background gap-3 px-8">
      <Wrench size={32} color={colors.mutedForeground} />
      <Text className="text-base font-bold text-foreground text-center">{title}</Text>
      <Text className="text-sm text-muted-foreground text-center">
        {subtitle ?? "Fitur ini belum diporting ke versi native, masih tersedia di versi web."}
      </Text>
    </View>
  );
}

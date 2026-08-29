import React from "react";
import { View, Text } from "react-native";
import { Wallet } from "lucide-react-native";
import { useThemeColors } from "../../context/ThemeContext";

export function DetailPembayaran() {
  const colors = useThemeColors();
  return (
    <View className="flex-1 items-center justify-center bg-background gap-4 px-8">
      <View className="w-20 h-20 rounded-2xl bg-primary/10 items-center justify-center"><Wallet size={36} color={colors.primary} /></View>
      <View>
        <Text className="text-lg font-bold text-foreground text-center">Rincian Pembayaran Belum Tersedia</Text>
        <Text className="text-sm text-muted-foreground mt-2 text-center">Modul Keuangan aplikasi ini belum tersambung ke sistem Akuntansi sekolah.</Text>
      </View>
    </View>
  );
}

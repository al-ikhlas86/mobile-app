import React from "react";
import { View, Text } from "react-native";
import { Wrench } from "lucide-react-native";

// Layar yang belum sempat diporting dari versi webview - ditampilkan apa
// adanya (bukan crash/blank) supaya navigasi tetap utuh selagi porting
// berlanjut. Lihat PROGRESS.md utk daftar lengkap yang masih pending.
export function PlaceholderScreen({ title }: { title: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-background gap-3 px-8">
      <Wrench size={32} color="#6E776F" />
      <Text className="text-base font-bold text-foreground text-center">{title}</Text>
      <Text className="text-sm text-muted-foreground text-center">Fitur ini belum diporting ke versi native, masih tersedia di versi web.</Text>
    </View>
  );
}

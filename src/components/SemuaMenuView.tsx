import React, { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Search } from "lucide-react-native";
import { Input } from "./ui/Input";
import { QuickMenuButton, type MenuCategory } from "./QuickMenuGrid";
import { useTheme, useThemeColors } from "../context/ThemeContext";

export function SemuaMenuView({ categories, onBack }: { categories: MenuCategory[]; onBack: () => void }) {
  const [search, setSearch] = useState("");
  // paddingBottom TETAP (32) SEBELUMNYA tidak cukup - kategori terakhir
  // (mis. "Log Aktivitas") kepotong tepat di batas bawah layar (dilaporkan
  // user via screenshot). insets.bottom saja tidak cukup krn tab bar
  // MainTabs.tsx sendiri tingginya 56+insets.bottom - tambahkan itu jg
  // supaya baris terakhir jelas bebas dari tab bar, bukan cuma nyaris pas.
  const insets = useSafeAreaInsets();
  // Sebelumnya warna panah kembali di-hardcode gelap (#17201B) - tak
  // terlihat sama sekali di tema gelap (dilaporkan user via screenshot
  // 2026-08-28: dibandingkan sisi-sisi tema terang vs gelap). Ikut pola
  // warna adaptif yang sama dgn tombol tema di MainTabs.tsx.
  const { isDark } = useTheme();
  const colors = useThemeColors();
  const backIconColor = isDark ? "#F1F1F2" : "#17201B";

  const filtered = categories
    .map((c) => ({ ...c, items: c.items.filter((i) => i.label.toLowerCase().includes(search.toLowerCase())) }))
    .filter((c) => c.items.length > 0);

  return (
    <ScrollView className="flex-1 bg-background px-4 pt-14" contentContainerStyle={{ paddingBottom: insets.bottom + 56 + 24, gap: 20 }}>
      <View className="flex-row items-center gap-2 -ml-1">
        <Pressable onPress={onBack} className="p-1.5 rounded-full">
          <ArrowLeft size={18} color={backIconColor} />
        </Pressable>
        <Text className="text-base font-bold text-foreground">Semua Menu</Text>
      </View>

      <Input placeholder="Cari menu..." value={search} onChangeText={setSearch} icon={<Search size={18} color={colors.mutedForeground} />} />

      {filtered.length === 0 ? (
        <Text className="text-sm text-muted-foreground text-center py-8">Menu tidak ditemukan.</Text>
      ) : (
        filtered.map((cat) => (
          <View key={cat.title}>
            <Text className="text-base font-bold text-foreground mb-3">{cat.title}</Text>
            <View className="flex-row flex-wrap gap-2.5">
              {cat.items.map((item, idx) => (
                <QuickMenuButton key={idx} item={item} />
              ))}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

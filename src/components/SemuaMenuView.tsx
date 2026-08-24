import React, { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { ArrowLeft, Search } from "lucide-react-native";
import { Input } from "./ui/Input";
import { QuickMenuButton, type MenuCategory } from "./QuickMenuGrid";

export function SemuaMenuView({ categories, onBack }: { categories: MenuCategory[]; onBack: () => void }) {
  const [search, setSearch] = useState("");

  const filtered = categories
    .map((c) => ({ ...c, items: c.items.filter((i) => i.label.toLowerCase().includes(search.toLowerCase())) }))
    .filter((c) => c.items.length > 0);

  return (
    <ScrollView className="flex-1 bg-background px-4 pt-14" contentContainerStyle={{ paddingBottom: 32, gap: 20 }}>
      <View className="flex-row items-center gap-2 -ml-1">
        <Pressable onPress={onBack} className="p-1.5 rounded-full">
          <ArrowLeft size={18} color="#17201B" />
        </Pressable>
        <Text className="text-base font-bold text-foreground">Semua Menu</Text>
      </View>

      <Input placeholder="Cari menu..." value={search} onChangeText={setSearch} icon={<Search size={18} color="#6E776F" />} />

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

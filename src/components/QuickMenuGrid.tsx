import React from "react";
import { View, Text, Pressable } from "react-native";
import { Grid3x3 } from "lucide-react-native";

export interface QuickMenuItem {
  label: string;
  icon: React.ReactNode;
  colorScheme: "blue" | "green" | "orange" | "red" | "purple" | "teal" | "indigo" | "pink";
  onPress: () => void;
}
export interface MenuCategory {
  title: string;
  items: QuickMenuItem[];
}

export const MENU_BG_COLORS: Record<string, string> = {
  blue: "bg-emerald-50",
  green: "bg-emerald-50",
  orange: "bg-amber-50",
  red: "bg-rose-50",
  purple: "bg-violet-50",
  teal: "bg-teal-50",
  indigo: "bg-lime-50",
  pink: "bg-pink-50",
};

export function QuickMenuButton({ item }: { item: QuickMenuItem }) {
  return (
    <Pressable
      onPress={item.onPress}
      className="flex-row items-center gap-2 rounded-2xl border border-border bg-card px-2.5 py-2 min-h-[58px] active:opacity-70"
      style={{ width: "48%" }}
    >
      <View className={`w-9 h-9 rounded-full items-center justify-center ${MENU_BG_COLORS[item.colorScheme]}`}>
        {item.icon}
      </View>
      <Text numberOfLines={2} className="flex-1 text-[10.5px] font-semibold text-foreground">{item.label}</Text>
    </Pressable>
  );
}

export function QuickMenuGrid({ items, onSeeAll }: { items: QuickMenuItem[]; onSeeAll: () => void }) {
  const preview = items.slice(0, 7);
  return (
    <View className="flex-row flex-wrap gap-2">
      {preview.map((item, idx) => (
        <QuickMenuButton key={idx} item={item} />
      ))}
      <Pressable
        onPress={onSeeAll}
        className="flex-row items-center gap-2 rounded-2xl border border-dashed border-primary/40 bg-secondary/60 px-2.5 py-2 min-h-[58px] active:opacity-70"
        style={{ width: "48%" }}
      >
        <View className="w-9 h-9 rounded-full items-center justify-center bg-card">
          <Grid3x3 size={18} color="#356447" />
        </View>
        <Text className="flex-1 text-[10.5px] font-semibold text-foreground">Semua Menu</Text>
      </Pressable>
    </View>
  );
}

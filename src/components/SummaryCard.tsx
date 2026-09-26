import React from "react";
import { View, Text } from "react-native";

interface SummaryCardProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
  colorScheme?: "blue" | "green" | "orange" | "red" | "purple" | "default";
  subtitle?: string;
  compact?: boolean;
}

// Fix (2026-09-26) - blue SEBELUMNYA emerald, lihat catatan sama di
// QuickMenuGrid.tsx & webview SummaryCard.tsx.
const schemes = {
  blue: { iconBg: "bg-blue-100 dark:bg-blue-900/20", iconWrap: "" },
  green: { iconBg: "bg-green-100 dark:bg-green-900/20", iconWrap: "" },
  orange: { iconBg: "bg-amber-100 dark:bg-amber-900/20", iconWrap: "" },
  red: { iconBg: "bg-red-100 dark:bg-red-900/20", iconWrap: "" },
  purple: { iconBg: "bg-purple-100 dark:bg-purple-900/20", iconWrap: "" },
  default: { iconBg: "bg-muted", iconWrap: "" },
};

export function SummaryCard({ label, value, icon, colorScheme = "default", subtitle, compact = false }: SummaryCardProps) {
  const s = schemes[colorScheme];
  if (compact) {
    return (
      <View className="rounded-2xl px-2.5 py-2.5 border border-border bg-card">
        <View className="flex-row items-center justify-between gap-1.5">
          <View className="flex-1">
            <Text numberOfLines={2} className="text-[9px] text-muted-foreground font-semibold">{label}</Text>
            <Text className="text-sm font-bold text-foreground">{value}</Text>
          </View>
          {icon && <View className={`w-6 h-6 rounded-md items-center justify-center ${s.iconBg}`}>{icon}</View>}
        </View>
      </View>
    );
  }
  return (
    <View className="rounded-2xl p-3 border border-border bg-card">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text numberOfLines={2} className="text-[10px] text-muted-foreground font-semibold mb-1">{label}</Text>
          <Text className="text-base font-bold text-foreground">{value}</Text>
          {subtitle && <Text numberOfLines={2} className="text-[9px] text-muted-foreground mt-1">{subtitle}</Text>}
        </View>
        {icon && <View className={`w-9 h-9 rounded-xl items-center justify-center ${s.iconBg}`}>{icon}</View>}
      </View>
    </View>
  );
}

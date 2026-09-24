import React, { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Grid3x3 } from "lucide-react-native";
import { useThemeColors } from "../context/ThemeContext";
import { api, type BerandaPreferensi } from "../services/api";

const DEFAULT_PREFS: BerandaPreferensi = { hiddenMenu: [], menuOrder: [], hideBeritaTerbaru: false, hideBeritaTerpopuler: false };

// Kustomisasi Beranda per-user (2026-09-03) - padanan native dari webview
// QuickMenuGrid.tsx, lihat catatan lengkap di sana.
export function useBerandaPreferensi() {
  const [prefs, setPrefs] = useState<BerandaPreferensi>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await api.berandaPreferensi();
      if (res.success) setPrefs({ ...DEFAULT_PREFS, ...res.data });
      setLoading(false);
    })();
  }, []);

  async function simpan(next: BerandaPreferensi) {
    setPrefs(next);
    await api.updateBerandaPreferensi(next);
  }

  return { prefs, loading, simpan };
}

export function terapkanUrutanMenu<T extends { label: string }>(items: T[], prefs: BerandaPreferensi): T[] {
  const visible = items.filter((i) => !prefs.hiddenMenu.includes(i.label));
  if (prefs.menuOrder.length === 0) return visible;
  const posisi = new Map(prefs.menuOrder.map((label, idx) => [label, idx]));
  return [...visible].sort((a, b) => {
    const pa = posisi.has(a.label) ? posisi.get(a.label)! : Infinity;
    const pb = posisi.has(b.label) ? posisi.get(b.label)! : Infinity;
    return pa - pb;
  });
}

export interface QuickMenuItem {
  label: string;
  icon: React.ReactNode;
  colorScheme: "blue" | "green" | "orange" | "red" | "purple" | "teal" | "indigo" | "pink";
  onPress: () => void;
  /** badgeCount (2026-09-24, Poin 3 Fase 2) - lihat catatan sama di webview QuickMenuGrid.tsx. */
  badgeCount?: number;
}
export interface MenuCategory {
  title: string;
  items: QuickMenuItem[];
}

export const MENU_BG_COLORS: Record<string, string> = {
  blue: "bg-emerald-50 dark:bg-emerald-900/10",
  green: "bg-emerald-50 dark:bg-emerald-900/10",
  orange: "bg-amber-50 dark:bg-amber-900/10",
  red: "bg-rose-50",
  purple: "bg-violet-50",
  teal: "bg-teal-50 dark:bg-teal-900/10",
  indigo: "bg-lime-50",
  pink: "bg-pink-50 dark:bg-pink-900/10",
};

export function QuickMenuButton({ item }: { item: QuickMenuItem }) {
  return (
    <Pressable
      onPress={item.onPress}
      className="flex-row items-center gap-2 rounded-2xl border border-border bg-card px-2.5 py-2 min-h-[58px] active:opacity-70"
      style={{ width: "48%" }}
    >
      <View className="relative">
        <View className={`w-9 h-9 rounded-full items-center justify-center ${MENU_BG_COLORS[item.colorScheme]}`}>
          {item.icon}
        </View>
        {!!item.badgeCount && (
          <View className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-red-500 items-center justify-center px-1">
            <Text className="text-white text-[9px] font-bold">{item.badgeCount > 9 ? "9+" : item.badgeCount}</Text>
          </View>
        )}
      </View>
      <Text numberOfLines={2} className="flex-1 text-[10.5px] font-semibold text-foreground">{item.label}</Text>
    </Pressable>
  );
}

export function QuickMenuGrid({ items, onSeeAll }: { items: QuickMenuItem[]; onSeeAll: () => void }) {
  const colors = useThemeColors();
  const { prefs } = useBerandaPreferensi();
  const preview = terapkanUrutanMenu(items, prefs).slice(0, 7);
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
          <Grid3x3 size={18} color={colors.primary} />
        </View>
        <Text className="flex-1 text-[10.5px] font-semibold text-foreground">Semua Menu</Text>
      </Pressable>
    </View>
  );
}

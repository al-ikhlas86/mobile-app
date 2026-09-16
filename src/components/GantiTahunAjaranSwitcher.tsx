// ============================================================
// POPUP "GANTI TAHUN AJARAN" - port native dari webview
// GantiTahunAjaranSwitcher.tsx (2026-09-04, Fase 4). Chrome (overlay+
// bottom-sheet) disalin dari DemoModeSwitcher.tsx native - SENGAJA BUKAN
// <Modal> (sama alasan dgn AccountSwitcher.tsx native: window Modal
// Android tidak konsisten mewarisi nav bar).
// ============================================================
import React from "react";
import { View, Text, Pressable, FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, CalendarClock, Check, RotateCcw } from "lucide-react-native";
import type { TahunAjaranOption } from "../services/viewingYearService";
import { useThemeColors } from "../context/ThemeContext";

interface Props {
  visible: boolean;
  options: TahunAjaranOption[];
  viewingYear: TahunAjaranOption | null; // null = sedang ikut tahun aktif
  loading: boolean;
  errorMessage: string | null;
  onPick: (year: TahunAjaranOption | null) => void;
  onClose: () => void;
}

export function GantiTahunAjaranSwitcher({ visible, options, viewingYear, loading, errorMessage, onPick, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  if (!visible) return null;
  return (
    <View className="absolute inset-0" style={{ zIndex: 55, elevation: 55 }}>
      <Pressable className="flex-1 bg-black/50 justify-end" onPress={onClose}>
        <Pressable className="bg-card rounded-t-3xl max-h-[80%]" style={{ paddingBottom: insets.bottom }} onPress={(e) => e.stopPropagation()}>
          <View className="p-4 border-b border-border">
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-bold text-foreground">Ganti Tahun Ajaran</Text>
              <Pressable onPress={onClose}><X size={20} color={colors.mutedForeground} /></Pressable>
            </View>
            <Text className="text-xs text-muted-foreground mt-1">Lihat menu &amp; data sesuai tahun yang dipilih. Reset ke tahun aktif tiap login.</Text>
          </View>

          {errorMessage && (
            <View className="mx-4 mt-3 p-3 rounded-xl bg-red-50 dark:bg-red-900/10">
              <Text className="text-xs text-red-600 dark:text-red-400">{errorMessage}</Text>
            </View>
          )}

          {viewingYear && (
            <Pressable
              onPress={() => onPick(null)}
              disabled={loading}
              className="flex-row items-center gap-3 mx-4 mt-3 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-300 dark:border-amber-700"
              style={{ opacity: loading ? 0.5 : 1 }}
            >
              <RotateCcw size={18} color="#B45309" />
              <View className="flex-1">
                <Text className="font-semibold text-sm text-amber-700 dark:text-amber-400">Kembali ke Tahun Aktif</Text>
                <Text className="text-xs text-amber-600 dark:text-amber-400">Sedang melihat {viewingYear.nama}</Text>
              </View>
            </Pressable>
          )}

          <Text className="text-xs font-semibold text-muted-foreground uppercase px-4 mt-4 mb-2">Pilih Tahun Ajaran</Text>
          {options.length === 0 && !loading && (
            <Text className="text-sm text-muted-foreground text-center py-4">Belum ada data tahun ajaran.</Text>
          )}
          <FlatList
            data={options}
            keyExtractor={(o) => String(o.id)}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, gap: 4 }}
            renderItem={({ item }) => {
              const active = viewingYear ? viewingYear.id === item.id : item.isActive;
              return (
                <Pressable
                  disabled={loading}
                  onPress={() => onPick(item.isActive ? null : item)}
                  className={`flex-row items-center gap-3 p-3 rounded-2xl ${active ? "bg-primary/10 border border-primary/30" : ""}`}
                  style={{ opacity: loading ? 0.5 : 1 }}
                >
                  <CalendarClock size={18} color={active ? colors.primary : colors.mutedForeground} />
                  <View className="flex-1">
                    <Text className={`font-medium text-sm ${active ? "text-primary" : "text-foreground"}`}>
                      {item.nama}{item.isActive ? " (tahun aktif)" : ""}
                    </Text>
                  </View>
                  {active && <Check size={16} color={colors.primary} />}
                </Pressable>
              );
            }}
          />
        </Pressable>
      </Pressable>
    </View>
  );
}

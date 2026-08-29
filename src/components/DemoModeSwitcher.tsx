// ============================================================
// POPUP "MODE DEMO" - port native dari webview DemoModeSwitcher.tsx.
// SENGAJA BUKAN <Modal> - sama alasan dgn AccountSwitcher.tsx native
// (window Modal Android tidak konsisten mewarisi nav bar).
// ============================================================
import React from "react";
import { View, Text, Pressable, FlatList, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, PlayCircle, LogOut } from "lucide-react-native";
import type { DemoRoleOption } from "../services/demoService";
import { useThemeColors } from "../context/ThemeContext";

interface Props {
  visible: boolean;
  roles: DemoRoleOption[];
  activeDemoLabel: string | null;
  loading: boolean;
  errorMessage: string | null;
  onPick: (role: string) => void;
  onExitDemo: () => void;
  onClose: () => void;
}

export function DemoModeSwitcher({ visible, roles, activeDemoLabel, loading, errorMessage, onPick, onExitDemo, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  if (!visible) return null;
  return (
    <View className="absolute inset-0" style={{ zIndex: 55, elevation: 55 }}>
      <Pressable className="flex-1 bg-black/50 justify-end" onPress={onClose}>
        <Pressable className="bg-card rounded-t-3xl max-h-[80%]" style={{ paddingBottom: insets.bottom }} onPress={(e) => e.stopPropagation()}>
          <View className="p-4 border-b border-border">
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-bold text-foreground">Mode Demo</Text>
              <Pressable onPress={onClose}><X size={20} color={colors.mutedForeground} /></Pressable>
            </View>
            <Text className="text-xs text-muted-foreground mt-1">Lihat & uji tampilan sebagai role lain. Data terpisah, tidak menyentuh data asli.</Text>
          </View>

          {errorMessage && (
            <View className="mx-4 mt-3 p-3 rounded-xl bg-red-50">
              <Text className="text-xs text-red-600">{errorMessage}</Text>
            </View>
          )}

          {activeDemoLabel && (
            <Pressable onPress={onExitDemo} className="flex-row items-center gap-3 mx-4 mt-3 p-3.5 rounded-2xl bg-amber-50 border border-amber-300">
              <LogOut size={18} color="#B45309" />
              <View className="flex-1">
                <Text className="font-semibold text-sm text-amber-700">Keluar dari Mode Demo</Text>
                <Text className="text-xs text-amber-600">Kembali ke akun Admin IT asli Anda</Text>
              </View>
            </Pressable>
          )}

          <Text className="text-xs font-semibold text-muted-foreground uppercase px-4 mt-4 mb-2">Pilih Role Demo</Text>
          <FlatList
            data={roles}
            keyExtractor={(r) => r.role}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, gap: 4 }}
            renderItem={({ item }) => {
              const active = item.label === activeDemoLabel;
              return (
                <Pressable
                  disabled={loading}
                  onPress={() => onPick(item.role)}
                  className={`flex-row items-center gap-3 p-3 rounded-2xl ${active ? "bg-primary/10 border border-primary/30" : ""}`}
                  style={{ opacity: loading ? 0.5 : 1 }}
                >
                  <PlayCircle size={18} color={active ? colors.primary : colors.mutedForeground} />
                  <Text className={`font-medium text-sm ${active ? "text-primary" : "text-foreground"}`}>{item.label}</Text>
                </Pressable>
              );
            }}
            ListFooterComponent={loading ? <ActivityIndicator className="mt-2" /> : null}
          />
        </Pressable>
      </Pressable>
    </View>
  );
}

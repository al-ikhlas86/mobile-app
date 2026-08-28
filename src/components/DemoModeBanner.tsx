// ============================================================
// BANNER MODE DEMO - port native dari webview DemoModeBanner.tsx.
// ============================================================
import React from "react";
import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertTriangle, LogOut } from "lucide-react-native";

export function DemoModeBanner({ roleLabel, onExit }: { roleLabel: string; onExit: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="absolute left-0 right-0 top-0 bg-amber-500 flex-row items-center justify-center gap-2 px-4 pb-2"
      style={{ paddingTop: insets.top + 6, zIndex: 60, elevation: 60 }}
    >
      <AlertTriangle size={14} color="#fff" />
      <Text className="text-white text-xs font-bold flex-shrink" numberOfLines={1}>
        MODE DEMO — {roleLabel}
      </Text>
      <Pressable onPress={onExit} className="flex-row items-center gap-1 px-2.5 py-1 rounded-full bg-white/20">
        <LogOut size={11} color="#fff" />
        <Text className="text-white text-[10px] font-bold">Keluar</Text>
      </Pressable>
    </View>
  );
}

// ============================================================
// BANNER MODE DEMO - port native dari webview (versi ringkas, lihat
// masukan user 2026-08-28: dipersingkat dari 1 baris panjang jadi
// badge kecil "Demo" + tombol Keluar).
// ============================================================
import React from "react";
import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LogOut } from "lucide-react-native";

export function DemoModeBanner({ onExit }: { roleLabel: string; onExit: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="absolute left-0 right-0 top-0 bg-amber-500 flex-row items-center justify-between px-3 pb-1"
      style={{ paddingTop: insets.top + 3, zIndex: 60, elevation: 60 }}
    >
      <Text className="text-white text-[10px] font-bold uppercase tracking-wide">Demo</Text>
      <Pressable onPress={onExit} className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-white/20">
        <LogOut size={10} color="#fff" />
        <Text className="text-white text-[9px] font-bold">Keluar</Text>
      </Pressable>
    </View>
  );
}

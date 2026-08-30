import React from "react";
import { View, Text, Image, ScrollView, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { CalendarDays, Bell, Sun, Moon } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import { useAccountSwitcher } from "../context/AccountSwitcherContext";
import { getActiveSession } from "../services/authService";
import { resolveAvatarUrl } from "../services/api";

interface DashboardLayoutProps {
  name: string;
  roleLabel?: string;
  date: string;
  unitLabel?: string;
  children: React.ReactNode;
}

// Baris ikon (logo+role kiri, toggle tema+avatar+bel notifikasi kanan) DAN
// teks sambutan SEKARANG satu kolom normal-flow (bukan absolute keduanya) -
// versi sebelumnya numpuk/tabrakan krn header absolute tidak menyisakan
// ruang nyata utk teks sambutan di bawahnya (ditemukan dari screenshot HP
// asli user, bukan tebakan). Cuma badge tanggal pojok kanan-bawah yang
// tetap absolute (aman, tidak ada elemen lain di situ).
export function DashboardLayout({ name, roleLabel, date, unitLabel, children }: DashboardLayoutProps) {
  const { isDark, toggleTheme } = useTheme();
  const navigation = useNavigation<any>();
  const { open: openSwitcher } = useAccountSwitcher();
  const session = getActiveSession();
  const avatarUrl = resolveAvatarUrl(session?.avatarUrl ?? null);

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ paddingBottom: 32 }}>
      <View className="relative" style={{ minHeight: 220 }}>
        <Image source={require("../../assets/hero.webp")} className="absolute inset-0 w-full h-full" resizeMode="cover" />
        <View className="absolute inset-0 bg-black/40" />

        <View className="pt-12 px-4 pb-2 flex-row items-center gap-2">
          <View className="h-9 w-9 rounded-full border border-white/40 bg-white/92 p-1 items-center justify-center overflow-hidden">
            <Image source={require("../../assets/favicon.png")} className="w-full h-full" resizeMode="contain" />
          </View>
          <View className="flex-1 min-w-0">
            <Text className="text-white text-xs font-bold" numberOfLines={1}>Al-Ikhlas 86</Text>
            <Text className="text-white/70 text-[10px]" numberOfLines={1}>{session?.role ?? ""}</Text>
          </View>
          <Pressable onPress={toggleTheme} className="w-8 h-8 rounded-full bg-black/20 items-center justify-center">
            {isDark ? <Sun size={15} color="#fff" /> : <Moon size={15} color="#fff" />}
          </Pressable>
          <Pressable onPress={openSwitcher} className="w-8 h-8 rounded-full bg-white/20 items-center justify-center overflow-hidden">
            {avatarUrl ? <Image source={{ uri: avatarUrl }} className="w-full h-full" /> : <Text className="text-white text-xs font-bold">{session?.avatarInitials ?? ""}</Text>}
          </Pressable>
          <Pressable onPress={() => navigation.navigate("notifikasi")} className="w-8 h-8 rounded-full bg-black/20 items-center justify-center">
            <Bell size={15} color="#fff" />
          </Pressable>
        </View>

        <View className="px-5 pt-4 pb-8">
          <Text className="text-white/75 text-[11px] font-semibold uppercase tracking-wide">{roleLabel ?? "Layanan Digital Sekolah"}</Text>
          <Text className="text-white/85 text-xs mt-1">Selamat datang kembali</Text>
          <Text className="text-white text-xl font-bold mt-0.5">{name}</Text>
          {unitLabel && <Text className="text-white/70 text-xs mt-0.5">Unit {unitLabel}</Text>}
          <View className="flex-row items-center gap-1.5 mt-3 self-start bg-black/25 rounded-full px-2.5 py-1">
            <CalendarDays size={13} color="#fff" />
            <Text className="text-white text-[10px]">{date}</Text>
          </View>
        </View>
      </View>
      <View className="-mt-4 bg-background rounded-t-3xl px-4 pt-5" style={{ gap: 20 }}>
        {children}
      </View>
    </ScrollView>
  );
}

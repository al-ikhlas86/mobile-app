import React, { useState } from "react";
import { View, Text, Image, ScrollView, Pressable, RefreshControl } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { CalendarDays, CalendarClock, Bell, Sun, Moon } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import { useAccountSwitcher } from "../context/AccountSwitcherContext";
import { getActiveSession } from "../services/authService";
import { resolveAvatarUrl } from "../services/api";
import { getViewingYear, useViewingYearTick } from "../services/viewingYearService";
import { useUnreadNotificationCount } from "../hooks/useUnreadNotificationCount";

interface DashboardLayoutProps {
  name: string;
  roleLabel?: string;
  date: string;
  unitLabel?: string;
  children: React.ReactNode;
  // Pull-to-refresh Beranda (2026-09-05, W5) - OPSIONAL, cuma dashboard yg
  // py data utk di-refresh (Guru/Pegawai/OrangTua, lihat berita+ringkasan
  // hari ini) yang kasih fungsi ini - dashboard lain (AdminIT dkk) tidak
  // terpengaruh sama sekali kalau prop ini tidak diisi.
  onRefresh?: () => Promise<void> | void;
}

// Baris ikon (logo+role kiri, toggle tema+avatar+bel notifikasi kanan) DAN
// teks sambutan SEKARANG satu kolom normal-flow (bukan absolute keduanya) -
// versi sebelumnya numpuk/tabrakan krn header absolute tidak menyisakan
// ruang nyata utk teks sambutan di bawahnya (ditemukan dari screenshot HP
// asli user, bukan tebakan). Cuma badge tanggal pojok kanan-bawah yang
// tetap absolute (aman, tidak ada elemen lain di situ).
export function DashboardLayout({ name, roleLabel, date, unitLabel, children, onRefresh }: DashboardLayoutProps) {
  const { isDark, toggleTheme } = useTheme();
  const navigation = useNavigation<any>();
  const { open: openSwitcher } = useAccountSwitcher();
  const session = getActiveSession();
  const avatarUrl = resolveAvatarUrl(session?.avatarUrl ?? null);
  // Badge "sedang melihat tahun X" (2026-09-04, Fase 4) - murni indikator,
  // TIDAK py aksi cepat sendiri (dipakai lintas banyak dashboard, lihat
  // catatan lengkap di versi webview DashboardLayout.tsx soal kenapa baca
  // langsung dari viewingYearService bukan prop).
  useViewingYearTick();
  const viewingYear = getViewingYear();
  // Badge unread dipindah kesini (2026-09-21) - tab "Notifikasi" dihapus
  // dari bottom nav (BottomNav webview versi lama; MainTabs di sini)
  // supaya tidak hilang begitu saja dari pandangan, cuma pindah tempat.
  const { total: unreadCount } = useUnreadNotificationCount();
  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() {
    if (!onRefresh) return;
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} /> : undefined}
    >
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
          <Pressable onPress={() => navigation.navigate("notifikasi")} className="relative w-8 h-8 rounded-full bg-black/20 items-center justify-center">
            <Bell size={15} color="#fff" />
            {unreadCount > 0 && (
              <View className="absolute -right-1 -top-1 min-w-[16px] h-4 rounded-full bg-red-500 items-center justify-center px-1">
                <Text className="text-white text-[9px] font-bold">{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            )}
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
        {viewingYear && (
          <View className="flex-row items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-300 dark:border-amber-700 px-3 py-2.5">
            <CalendarClock size={14} color="#B45309" />
            <Text className="flex-1 text-xs text-amber-700 dark:text-amber-400">
              Sedang melihat tahun ajaran <Text className="font-bold">{viewingYear.nama}</Text> - buka Profil untuk kembali ke tahun aktif.
            </Text>
          </View>
        )}
        {children}
      </View>
    </ScrollView>
  );
}

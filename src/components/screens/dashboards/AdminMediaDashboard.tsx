import React, { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { FileText, Plus, BookOpen, User, Ban, Heart, MessageCircle, BarChart3, ChevronRight } from "lucide-react-native";
import { SummaryCard } from "../../SummaryCard";
import { QuickMenuGrid, type MenuCategory } from "../../QuickMenuGrid";
import { SemuaMenuView } from "../../SemuaMenuView";
import { useIsFocused } from "@react-navigation/native";
import { useBackWhen } from "../../../hooks/useBackWhen";
import { api } from "../../../services/api";
import { type RoleName } from "../../../services/authService";
import { DashboardLayout } from "../../DashboardLayout";
import { useThemeColors } from "../../../context/ThemeContext";

interface Props { onNavigate: (screen: string, params?: Record<string, unknown>) => void; role: RoleName; }
interface StatsSummary { total_published: number; total_likes: number; total_comments: number; }

export function AdminMediaDashboard({ onNavigate }: Props) {
  const colors = useThemeColors();
  // unitLabel (label katalog di header) DIHAPUS (2026-09-14, Sistem
  // Katalog) - role tidak lagi menyiratkan SD/TK (generik "Admin Media"),
  // katalog yang dipegang sekarang data (user_capabilities.catalog_id) yang
  // BELUM di-thread ke sesi frontend - lihat KapasitasTambahanScreen.tsx
  // utk lihat/kelola katalog yang sebenarnya dipegang tiap orang.
  const today = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const [showAllMenu, setShowAllMenu] = useState(false);
  // isFocused - lihat catatan lengkap di AdminITDashboard.tsx (pola sama
  // dipakai semua dashboard): tanpa ini, kembali dari layar hasil "Semua
  // Menu" butuh 2x klik & lompat ke Beranda (bukan balik ke Semua Menu).
  const isFocused = useIsFocused();
  useBackWhen(showAllMenu && isFocused, () => setShowAllMenu(false));
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setStatsLoading(true);
      const res = await api.beritaAcaraStats();
      if (res.success) setStats(res.data);
      setStatsLoading(false);
    })();
  }, []);

  const menuCategories: MenuCategory[] = [
    { title: "Berita Acara", items: [
      { label: "Kelola Berita Acara", icon: <FileText size={20} color="#047857" />, colorScheme: "blue", onPress: () => onNavigate("berita-acara-admin") },
      { label: "Berita Acara (Lihat)", icon: <BookOpen size={20} color="#0f766e" />, colorScheme: "teal", onPress: () => onNavigate("berita-acara") },
      { label: "Statistik Konten", icon: <BarChart3 size={20} color="#7c3aed" />, colorScheme: "purple", onPress: () => onNavigate("statistik-konten") },
      { label: "Pengguna Diblokir", icon: <Ban size={20} color="#be123c" />, colorScheme: "red", onPress: () => onNavigate("blokiran-komentar") },
    ] },
    { title: "Akun", items: [
      { label: "Profil", icon: <User size={20} color="#4d7c0f" />, colorScheme: "indigo", onPress: () => onNavigate("profil") },
    ] },
  ];

  if (showAllMenu) return <SemuaMenuView categories={menuCategories} onBack={() => setShowAllMenu(false)} />;

  return (
    <DashboardLayout name="Admin Media" roleLabel="Ruang Redaksi Sekolah" date={today}>
      <Pressable onPress={() => onNavigate("berita-acara-admin")} className="w-full bg-primary rounded-2xl p-4 flex-row items-center gap-4">
        <View className="w-12 h-12 rounded-xl bg-white/20 items-center justify-center"><Plus size={24} color={colors.primaryForeground} /></View>
        <View className="flex-1">
          <Text className="text-primary-foreground font-bold text-base">Buat Berita Baru</Text>
          <Text className="text-primary-foreground text-sm">Tambah berita acara dan unggah media</Text>
        </View>
      </Pressable>

      <View>
        <Text className="text-sm font-semibold text-muted-foreground mb-3 uppercase">Statistik Konten</Text>
        {statsLoading ? (
          <Text className="text-sm text-muted-foreground">Memuat statistik...</Text>
        ) : stats ? (
          <>
            <View className="flex-row gap-2.5">
              <View className="flex-1"><SummaryCard label="Berita Terbit" value={String(stats.total_published)} icon={<FileText size={16} color="#047857" />} colorScheme="blue" compact /></View>
              <View className="flex-1"><SummaryCard label="Total Suka" value={String(stats.total_likes)} icon={<Heart size={16} color="#be123c" />} colorScheme="red" compact /></View>
              <View className="flex-1"><SummaryCard label="Total Komentar" value={String(stats.total_comments)} icon={<MessageCircle size={16} color="#16a34a" />} colorScheme="green" compact /></View>
            </View>
            <Pressable onPress={() => onNavigate("statistik-konten")} className="mt-2.5 flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl border border-border">
              <Text className="text-sm font-medium text-foreground">Lihat Statistik Lengkap</Text>
              <ChevronRight size={16} color={colors.foreground} />
            </Pressable>
          </>
        ) : (
          <Text className="text-sm text-muted-foreground">Gagal memuat statistik.</Text>
        )}
      </View>

      <View>
        <Text className="text-sm font-semibold text-muted-foreground mb-3 uppercase">Menu Utama</Text>
        <QuickMenuGrid items={menuCategories.flatMap((c) => c.items)} onSeeAll={() => setShowAllMenu(true)} />
      </View>
    </DashboardLayout>
  );
}

import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { GraduationCap, FileText, Clock, UserCog, BarChart3, MessageSquareWarning, Search } from "lucide-react-native";
import { SummaryCard } from "../../SummaryCard";
import { QuickMenuGrid, type MenuCategory } from "../../QuickMenuGrid";
import { SemuaMenuView } from "../../SemuaMenuView";
import { useBackWhen } from "../../../hooks/useBackWhen";
import { api } from "../../../services/api";
import { DashboardLayout } from "../../DashboardLayout";

interface Props { onNavigate: (screen: string, params?: Record<string, unknown>) => void; }
interface Stats { totalSiswaAktif: number; totalPegawaiAktif: number; }

export function AdminTUDashboard({ onNavigate }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAllMenu, setShowAllMenu] = useState(false);
  useBackWhen(showAllMenu, () => setShowAllMenu(false));
  const today = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await api.stats();
      if (res.success) setStats(res.data);
      setLoading(false);
    })();
  }, []);

  const menuCategories: MenuCategory[] = [
    { title: "Operasional", items: [
      { label: "Berita Acara", icon: <FileText size={20} color="#4d7c0f" />, colorScheme: "indigo", onPress: () => onNavigate("berita-acara") },
      { label: "Presensi", icon: <Clock size={20} color="#b45309" />, colorScheme: "orange", onPress: () => onNavigate("presensi-admin-tu") },
      { label: "Rekapitulasi Kehadiran", icon: <BarChart3 size={20} color="#7c3aed" />, colorScheme: "purple", onPress: () => onNavigate("rekapitulasi-kehadiran") },
      { label: "Aduan Masuk", icon: <MessageSquareWarning size={20} color="#dc2626" />, colorScheme: "red", onPress: () => onNavigate("aduan-masuk") },
      { label: "Cari Siswa & Guru", icon: <Search size={20} color="#0f766e" />, colorScheme: "teal", onPress: () => onNavigate("cari-siswa-guru") },
    ] },
  ];

  if (showAllMenu) return <SemuaMenuView categories={menuCategories} onBack={() => setShowAllMenu(false)} />;

  return (
    <DashboardLayout name="Admin TU" roleLabel="Administrasi Tata Usaha" date={today}>
      <View>
        <Text className="text-sm font-semibold text-muted-foreground mb-3 uppercase">Ringkasan</Text>
        {loading ? (
          <Text className="text-sm text-muted-foreground">Memuat...</Text>
        ) : stats ? (
          <View className="flex-row gap-3">
            <View className="flex-1"><SummaryCard label="Total Siswa Aktif" value={String(stats.totalSiswaAktif)} icon={<GraduationCap size={18} color="#047857" />} colorScheme="blue" subtitle="dari Hub API" /></View>
            <View className="flex-1"><SummaryCard label="Total Pegawai Aktif" value={String(stats.totalPegawaiAktif)} icon={<UserCog size={18} color="#16a34a" />} colorScheme="green" subtitle="dari Hub API" /></View>
          </View>
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

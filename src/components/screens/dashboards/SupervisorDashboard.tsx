import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { Users, CreditCard, FileText, User, GraduationCap, UserCog, RefreshCw, TrendingUp, AlertCircle, BarChart2, History, ArrowUpCircle, ArrowDownCircle } from "lucide-react-native";
import { SummaryCard } from "../../SummaryCard";
import { QuickMenuGrid, type MenuCategory } from "../../QuickMenuGrid";
import { SemuaMenuView } from "../../SemuaMenuView";
import { useIsFocused } from "@react-navigation/native";
import { useBackWhen } from "../../../hooks/useBackWhen";
import { api } from "../../../services/api";
import { DashboardLayout } from "../../DashboardLayout";

interface Props { onNavigate: (screen: string, params?: Record<string, unknown>) => void; }
interface Stats { totalSiswaAktif: number; totalPenggunaAktif: number; totalPegawaiAktif: number; lastSyncAt: string | null; }

function formatSync(ts: string | null): string {
  if (!ts) return "Belum pernah sync";
  const d = new Date(ts.replace(" ", "T"));
  return d.toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function SupervisorDashboard({ onNavigate }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAllMenu, setShowAllMenu] = useState(false);
  // isFocused - lihat catatan lengkap di AdminITDashboard.tsx (pola sama
  // dipakai semua dashboard): tanpa ini, kembali dari layar hasil "Semua
  // Menu" butuh 2x klik & lompat ke Beranda (bukan balik ke Semua Menu).
  const isFocused = useIsFocused();
  useBackWhen(showAllMenu && isFocused, () => setShowAllMenu(false));
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
    { title: "Keuangan", items: [
      { label: "Data Pembayaran Siswa", icon: <CreditCard size={20} color="#1d4ed8" />, colorScheme: "blue", onPress: () => onNavigate("keuangan-admin") },
      { label: "Tagihan", icon: <FileText size={20} color="#b45309" />, colorScheme: "orange", onPress: () => onNavigate("placeholder", { title: "Tagihan" }) },
      { label: "Pembayaran Masuk", icon: <TrendingUp size={20} color="#15803d" />, colorScheme: "green", onPress: () => onNavigate("placeholder", { title: "Pembayaran Masuk" }) },
      { label: "Tunggakan", icon: <AlertCircle size={20} color="#dc2626" />, colorScheme: "red", onPress: () => onNavigate("placeholder", { title: "Tunggakan" }) },
      { label: "Rekap Keuangan", icon: <BarChart2 size={20} color="#7c3aed" />, colorScheme: "purple", onPress: () => onNavigate("placeholder", { title: "Rekap Keuangan" }) },
      { label: "Laporan Keuangan", icon: <BarChart2 size={20} color="#4338ca" />, colorScheme: "indigo", onPress: () => onNavigate("placeholder", { title: "Laporan Keuangan" }) },
      { label: "Riwayat Transaksi", icon: <History size={20} color="#0f766e" />, colorScheme: "teal", onPress: () => onNavigate("placeholder", { title: "Riwayat Transaksi" }) },
      { label: "Pemasukan", icon: <ArrowUpCircle size={20} color="#15803d" />, colorScheme: "green", onPress: () => onNavigate("placeholder", { title: "Pemasukan" }) },
      { label: "Pengeluaran", icon: <ArrowDownCircle size={20} color="#dc2626" />, colorScheme: "red", onPress: () => onNavigate("placeholder", { title: "Pengeluaran" }) },
    ] },
    { title: "Operasional", items: [
      { label: "Berita Acara", icon: <FileText size={20} color="#1d4ed8" />, colorScheme: "blue", onPress: () => onNavigate("berita-acara") },
      { label: "Ringkasan Presensi", icon: <BarChart2 size={20} color="#b45309" />, colorScheme: "orange", onPress: () => onNavigate("ringkasan") },
      { label: "Performa Individu", icon: <BarChart2 size={20} color="#0d9488" />, colorScheme: "teal", onPress: () => onNavigate("performa-cari") },
    ] },
    { title: "Akun", items: [
      { label: "Profil", icon: <User size={20} color="#4338ca" />, colorScheme: "indigo", onPress: () => onNavigate("profil") },
    ] },
  ];

  if (showAllMenu) return <SemuaMenuView categories={menuCategories} onBack={() => setShowAllMenu(false)} />;

  return (
    <DashboardLayout name="Supervisor" roleLabel="Ringkasan Eksekutif" date={today}>
      <View>
        <Text className="text-sm font-semibold text-muted-foreground mb-3 uppercase">Ringkasan Sistem</Text>
        {loading ? (
          <Text className="text-sm text-muted-foreground">Memuat...</Text>
        ) : stats ? (
          <View className="flex-row flex-wrap gap-3">
            <View style={{ width: "47%" }}><SummaryCard label="Total Siswa Aktif" value={String(stats.totalSiswaAktif)} icon={<GraduationCap size={18} color="#1d4ed8" />} colorScheme="blue" subtitle="dari Hub API" /></View>
            <View style={{ width: "47%" }}><SummaryCard label="Total Pengguna Aktif" value={String(stats.totalPenggunaAktif)} icon={<Users size={18} color="#7c3aed" />} colorScheme="purple" subtitle="akun aplikasi ini" /></View>
            <View style={{ width: "47%" }}><SummaryCard label="Total Pegawai Aktif" value={String(stats.totalPegawaiAktif)} icon={<UserCog size={18} color="#16a34a" />} colorScheme="green" subtitle="dari Hub API" /></View>
            <View style={{ width: "47%" }}><SummaryCard label="Sinkronisasi Terakhir" value={formatSync(stats.lastSyncAt)} icon={<RefreshCw size={18} color="#b45309" />} colorScheme="orange" subtitle="Hub API + Absen" /></View>
          </View>
        ) : (
          <Text className="text-sm text-muted-foreground">Gagal memuat statistik.</Text>
        )}
      </View>
      <View className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
        <Text className="text-xs text-amber-700 dark:text-amber-400">Ringkasan Keuangan belum tersedia - modul Keuangan aplikasi ini belum tersambung ke sistem Akuntansi sekolah.</Text>
      </View>
      <View>
        <Text className="text-sm font-semibold text-muted-foreground mb-3 uppercase">Menu Utama</Text>
        <QuickMenuGrid items={menuCategories.flatMap((c) => c.items)} onSeeAll={() => setShowAllMenu(true)} />
      </View>
    </DashboardLayout>
  );
}

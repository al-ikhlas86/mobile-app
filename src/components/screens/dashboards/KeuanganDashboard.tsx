import React, { useState } from "react";
import { View, Text } from "react-native";
import { Info, CreditCard, FileText, Clock, MessageSquareWarning, TrendingUp, AlertCircle, BarChart2, History } from "lucide-react-native";
import { QuickMenuGrid, type MenuCategory } from "../../QuickMenuGrid";
import { SemuaMenuView } from "../../SemuaMenuView";
import { useIsFocused } from "@react-navigation/native";
import { useBackWhen } from "../../../hooks/useBackWhen";
import { DashboardLayout } from "../../DashboardLayout";

interface Props { onNavigate: (screen: string, params?: Record<string, unknown>) => void; }

export function KeuanganDashboard({ onNavigate }: Props) {
  const today = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const [showAllMenu, setShowAllMenu] = useState(false);
  // isFocused - lihat catatan lengkap di AdminITDashboard.tsx (pola sama
  // dipakai semua dashboard): tanpa ini, kembali dari layar hasil "Semua
  // Menu" butuh 2x klik & lompat ke Beranda (bukan balik ke Semua Menu).
  const isFocused = useIsFocused();
  useBackWhen(showAllMenu && isFocused, () => setShowAllMenu(false));

  const menuCategories: MenuCategory[] = [
    { title: "Keuangan", items: [
      { label: "Data Pembayaran Siswa", icon: <CreditCard size={20} color="#047857" />, colorScheme: "blue", onPress: () => onNavigate("keuangan-admin") },
      // Placeholder - port dari webview (Projek.md 2026-08-13, dipasang
      // kembali atas permintaan user 2026-08-29).
      { label: "Tagihan", icon: <FileText size={20} color="#b45309" />, colorScheme: "orange", onPress: () => onNavigate("placeholder", { title: "Tagihan" }) },
      { label: "Pembayaran Masuk", icon: <TrendingUp size={20} color="#16a34a" />, colorScheme: "green", onPress: () => onNavigate("placeholder", { title: "Pembayaran Masuk" }) },
      { label: "Tunggakan", icon: <AlertCircle size={20} color="#dc2626" />, colorScheme: "red", onPress: () => onNavigate("placeholder", { title: "Tunggakan" }) },
      { label: "Rekap Keuangan", icon: <BarChart2 size={20} color="#7c3aed" />, colorScheme: "purple", onPress: () => onNavigate("placeholder", { title: "Rekap Keuangan" }) },
      { label: "Laporan Keuangan", icon: <BarChart2 size={20} color="#4f46e5" />, colorScheme: "indigo", onPress: () => onNavigate("placeholder", { title: "Laporan Keuangan" }) },
      { label: "Riwayat Transaksi", icon: <History size={20} color="#0f766e" />, colorScheme: "teal", onPress: () => onNavigate("placeholder", { title: "Riwayat Transaksi" }) },
    ] },
    { title: "Operasional", items: [
      { label: "Berita Acara", icon: <FileText size={20} color="#047857" />, colorScheme: "blue", onPress: () => onNavigate("berita-acara") },
      { label: "Presensi", icon: <Clock size={20} color="#16a34a" />, colorScheme: "green", onPress: () => onNavigate("presensi") },
      { label: "Aduan Masuk", icon: <MessageSquareWarning size={20} color="#dc2626" />, colorScheme: "red", onPress: () => onNavigate("aduan-masuk") },
    ] },
  ];

  if (showAllMenu) return <SemuaMenuView categories={menuCategories} onBack={() => setShowAllMenu(false)} />;

  return (
    <DashboardLayout name="Tim Keuangan" roleLabel="Administrasi Keuangan" date={today}>
      <View className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex-row gap-2">
        <Info size={16} color="#b45309" />
        <Text className="text-xs text-amber-700 dark:text-amber-400 flex-1">Ringkasan Keuangan belum tersedia - modul ini belum tersambung ke sistem Akuntansi sekolah.</Text>
      </View>
      <View>
        <Text className="text-sm font-semibold text-muted-foreground mb-3 uppercase">Menu Utama</Text>
        <QuickMenuGrid items={menuCategories.flatMap((c) => c.items)} onSeeAll={() => setShowAllMenu(true)} />
      </View>
    </DashboardLayout>
  );
}

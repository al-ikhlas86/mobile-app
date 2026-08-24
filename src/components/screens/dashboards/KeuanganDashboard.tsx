import React, { useState } from "react";
import { View, Text } from "react-native";
import { Info, CreditCard, FileText, Clock, MessageSquareWarning } from "lucide-react-native";
import { QuickMenuGrid, type MenuCategory } from "../../QuickMenuGrid";
import { SemuaMenuView } from "../../SemuaMenuView";
import { DashboardLayout } from "../../DashboardLayout";

interface Props { onNavigate: (screen: string, params?: Record<string, unknown>) => void; }

export function KeuanganDashboard({ onNavigate }: Props) {
  const today = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const [showAllMenu, setShowAllMenu] = useState(false);

  const menuCategories: MenuCategory[] = [
    { title: "Keuangan", items: [
      { label: "Data Pembayaran Siswa", icon: <CreditCard size={20} color="#047857" />, colorScheme: "blue", onPress: () => onNavigate("keuangan-admin") },
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
      <View className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex-row gap-2">
        <Info size={16} color="#b45309" />
        <Text className="text-xs text-amber-700 flex-1">Ringkasan Keuangan belum tersedia - modul ini belum tersambung ke sistem Akuntansi sekolah.</Text>
      </View>
      <View>
        <Text className="text-sm font-semibold text-muted-foreground mb-3 uppercase">Menu Utama</Text>
        <QuickMenuGrid items={menuCategories.flatMap((c) => c.items)} onSeeAll={() => setShowAllMenu(true)} />
      </View>
    </DashboardLayout>
  );
}

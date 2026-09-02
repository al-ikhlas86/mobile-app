import React, { useState } from "react";
import { View, Text } from "react-native";
import { ClipboardCheck, Clock, BarChart3, PieChart } from "lucide-react-native";
import { QuickMenuGrid, type MenuCategory } from "../../QuickMenuGrid";
import { SemuaMenuView } from "../../SemuaMenuView";
import { useIsFocused } from "@react-navigation/native";
import { useBackWhen } from "../../../hooks/useBackWhen";
import { type RoleName } from "../../../services/authService";
import { DashboardLayout } from "../../DashboardLayout";
import { useThemeColors } from "../../../context/ThemeContext";

interface Props { onNavigate: (screen: string, params?: Record<string, unknown>) => void; role: RoleName; }

// Kepala Sekolah (2026-08-31) - port 1:1 dari webview, lihat catatan
// arsitektur lengkap di sana. "Ringkasan Presensi" ditambahkan (audit
// 2026-08-31) - sempat ketinggalan dari menu ini (oversight), backend
// /api/ringkasan/ sudah ter-scope unit_id sejak awal, aman ditampilkan.
export function KepalaSekolahDashboard({ onNavigate, role }: Props) {
  const colors = useThemeColors();
  const isSD = role === "Kepala Sekolah (SD)";
  const unitLabel = isSD ? "SD" : "TK & Playground";
  const today = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const [showAllMenu, setShowAllMenu] = useState(false);
  // isFocused - lihat catatan lengkap di AdminITDashboard.tsx (pola sama
  // dipakai semua dashboard): tanpa ini, kembali dari layar hasil "Semua
  // Menu" butuh 2x klik & lompat ke Beranda (bukan balik ke Semua Menu).
  const isFocused = useIsFocused();
  useBackWhen(showAllMenu && isFocused, () => setShowAllMenu(false));

  const menuCategories: MenuCategory[] = [
    { title: "Operasional", items: [
      { label: "Persetujuan Izin Guru", icon: <ClipboardCheck size={20} color={colors.primary} />, colorScheme: "blue", onPress: () => onNavigate("persetujuan-izin-guru") },
      { label: "Presensi", icon: <Clock size={20} color="#b45309" />, colorScheme: "orange", onPress: () => onNavigate("presensi-admin-tu") },
      { label: "Rekapitulasi Kehadiran", icon: <BarChart3 size={20} color="#7c3aed" />, colorScheme: "purple", onPress: () => onNavigate("rekapitulasi-kehadiran") },
      { label: "Ringkasan Presensi", icon: <PieChart size={20} color="#16a34a" />, colorScheme: "green", onPress: () => onNavigate("ringkasan") },
    ] },
  ];

  if (showAllMenu) {
    return <SemuaMenuView categories={menuCategories} onBack={() => setShowAllMenu(false)} />;
  }

  return (
    <DashboardLayout name="Kepala Sekolah" roleLabel="Kepala Sekolah" date={today} unitLabel={unitLabel}>
      <View>
        <Text className="text-sm font-semibold text-muted-foreground mb-3 uppercase">Menu Utama</Text>
        <QuickMenuGrid items={menuCategories.flatMap((c) => c.items)} onSeeAll={() => setShowAllMenu(true)} />
      </View>
    </DashboardLayout>
  );
}

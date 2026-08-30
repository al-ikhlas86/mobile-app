import React, { useState } from "react";
import { View, Text } from "react-native";
import { ClipboardCheck, Clock, BarChart3 } from "lucide-react-native";
import { QuickMenuGrid, type MenuCategory } from "../../QuickMenuGrid";
import { SemuaMenuView } from "../../SemuaMenuView";
import { useBackWhen } from "../../../hooks/useBackWhen";
import { type RoleName } from "../../../services/authService";
import { DashboardLayout } from "../../DashboardLayout";
import { useThemeColors } from "../../../context/ThemeContext";

interface Props { onNavigate: (screen: string, params?: Record<string, unknown>) => void; role: RoleName; }

// Kepala Sekolah (2026-08-31) - port 1:1 dari webview, lihat catatan
// arsitektur lengkap di sana (kenapa TIDAK ada kartu ringkasan statistik).
export function KepalaSekolahDashboard({ onNavigate, role }: Props) {
  const colors = useThemeColors();
  const isSD = role === "Kepala Sekolah (SD)";
  const unitLabel = isSD ? "SD" : "TK & Playground";
  const today = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const [showAllMenu, setShowAllMenu] = useState(false);
  useBackWhen(showAllMenu, () => setShowAllMenu(false));

  const menuCategories: MenuCategory[] = [
    { title: "Operasional", items: [
      { label: "Persetujuan Izin Guru", icon: <ClipboardCheck size={20} color={colors.primary} />, colorScheme: "blue", onPress: () => onNavigate("persetujuan-izin-guru") },
      { label: "Presensi", icon: <Clock size={20} color="#b45309" />, colorScheme: "orange", onPress: () => onNavigate("presensi-admin-tu") },
      { label: "Rekapitulasi Kehadiran", icon: <BarChart3 size={20} color="#7c3aed" />, colorScheme: "purple", onPress: () => onNavigate("rekapitulasi-kehadiran") },
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

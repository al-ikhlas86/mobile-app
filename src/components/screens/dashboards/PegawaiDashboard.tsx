import React, { useCallback, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Clock, Calendar, FileText, User, CheckCircle, Award } from "lucide-react-native";
import { SummaryCard } from "../../SummaryCard";
import { QuickMenuGrid, type MenuCategory } from "../../QuickMenuGrid";
import { SemuaMenuView } from "../../SemuaMenuView";
import { useBackWhen } from "../../../hooks/useBackWhen";
import { NewsCarousel, useNewsList } from "../../NewsCarousel";
import { api } from "../../../services/api";
import { getActiveSession } from "../../../services/authService";
import { getTodayLocal } from "../../../utils/formatters";
import { DashboardLayout } from "../../DashboardLayout";

interface Props { onNavigate: (screen: string, params?: Record<string, unknown>) => void; }
interface AttendanceRow { tanggal: string; status: string; }

export function PegawaiDashboard({ onNavigate }: Props) {
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllMenu, setShowAllMenu] = useState(false);
  useBackWhen(showAllMenu, () => setShowAllMenu(false));
  const session = getActiveSession();
  const news = useNewsList();

  // useFocusEffect (bukan useEffect biasa) - bottom-tabs TIDAK unmount
  // layar saat pindah tab, jadi data absen di sini akan basi kalau cuma
  // fetch sekali saat mount: user checkin di tab Presensi lalu balik ke tab
  // Beranda, angka "Presensi Bulan Ini" di sini tetap angka LAMA krn effect
  // mount-nya tidak pernah terpanggil ulang (laporan bug user, root cause).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        const res = await api.attendanceMe();
        if (active && res.success) setRecords(res.data);
        if (active) setLoading(false);
      })();
      return () => { active = false; };
    }, [])
  );

  const today = getTodayLocal();
  const hadirHariIni = records.some((r) => r.tanggal === today);
  const hadirBulanIni = records.filter((r) => r.tanggal.startsWith(today.slice(0, 7))).length;
  const todayLabel = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const menuCategories: MenuCategory[] = [
    { title: "Presensi & Wajah", items: [
      { label: "Presensi Pegawai", icon: <Clock size={20} color="#047857" />, colorScheme: "blue", onPress: () => onNavigate("presensi") },
      { label: "Pengenalan Wajah", icon: <User size={20} color="#7c3aed" />, colorScheme: "purple", onPress: () => onNavigate("pengenalan-wajah") },
    ] },
    { title: "Informasi", items: [
      { label: "Berita Acara", icon: <FileText size={20} color="#0f766e" />, colorScheme: "teal", onPress: () => onNavigate("berita-acara") },
    ] },
    { title: "Administrasi", items: [
      { label: "Slip Gaji", icon: <Award size={20} color="#b45309" />, colorScheme: "orange", onPress: () => onNavigate("placeholder", { title: "Slip Gaji" }) },
      { label: "Jadwal Kerja", icon: <Calendar size={20} color="#4338ca" />, colorScheme: "indigo", onPress: () => onNavigate("jadwal-kerja") },
    ] },
    { title: "Akun", items: [
      { label: "Profil", icon: <User size={20} color="#4d7c0f" />, colorScheme: "indigo", onPress: () => onNavigate("profil") },
    ] },
  ];

  if (showAllMenu) return <SemuaMenuView categories={menuCategories} onBack={() => setShowAllMenu(false)} />;

  return (
    <DashboardLayout name={session?.fullName ?? "Pegawai"} roleLabel="Ruang Pegawai" date={todayLabel}>
      <View>
        <Text className="text-sm font-semibold text-muted-foreground mb-3 uppercase">Hari Ini</Text>
        {loading ? (
          <Text className="text-sm text-muted-foreground">Memuat...</Text>
        ) : (
          <View className="flex-row gap-3">
            <View className="flex-1"><SummaryCard label="Status Hari Ini" value={hadirHariIni ? "Hadir" : "-"} icon={<CheckCircle size={18} color={hadirHariIni ? "#16a34a" : "#6E776F"} />} colorScheme={hadirHariIni ? "green" : "default"} subtitle={today} /></View>
            <View className="flex-1"><SummaryCard label="Presensi Bulan Ini" value={String(hadirBulanIni)} icon={<Calendar size={18} color="#047857" />} colorScheme="blue" subtitle="hari hadir" /></View>
          </View>
        )}
      </View>

      <Pressable onPress={() => onNavigate("presensi")} className="w-full bg-primary rounded-2xl p-4 flex-row items-center gap-4">
        <View className="w-12 h-12 rounded-xl bg-white/20 items-center justify-center"><Clock size={24} color="#fff" /></View>
        <View className="flex-1">
          <Text className="text-white font-bold text-base">Presensi Sekarang</Text>
          <Text className="text-white/70 text-sm">{hadirHariIni ? "Sudah presensi hari ini" : "Belum presensi masuk hari ini"}</Text>
        </View>
      </Pressable>

      <View>
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-sm font-semibold text-muted-foreground uppercase">Berita Terbaru</Text>
          <Pressable onPress={() => onNavigate("berita-acara")}><Text className="text-xs font-semibold text-primary">Lihat Semua</Text></Pressable>
        </View>
        <NewsCarousel items={news.terbaru} loading={news.loading} onOpenNews={(id) => onNavigate("berita-acara-viewer", { newsId: id })} />
      </View>
      <View>
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-sm font-semibold text-muted-foreground uppercase">Berita Terpopuler</Text>
          <Pressable onPress={() => onNavigate("berita-acara")}><Text className="text-xs font-semibold text-primary">Lihat Semua</Text></Pressable>
        </View>
        <NewsCarousel items={news.terpopuler} loading={news.loading} onOpenNews={(id) => onNavigate("berita-acara-viewer", { newsId: id })} />
      </View>

      <View>
        <Text className="text-sm font-semibold text-muted-foreground mb-3 uppercase">Menu</Text>
        <QuickMenuGrid items={menuCategories.flatMap((c) => c.items)} onSeeAll={() => setShowAllMenu(true)} />
      </View>
    </DashboardLayout>
  );
}

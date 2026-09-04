import React, { useCallback, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { Clock, Calendar, FileText, User, Users, CheckCircle, BookOpen, ClipboardCheck, ClipboardList, BarChart3, MessageSquareWarning, Award, PieChart, UserPlus, Search, Ban, CreditCard } from "lucide-react-native";
import { SummaryCard } from "../../SummaryCard";
import { QuickMenuGrid, useBerandaPreferensi, type MenuCategory } from "../../QuickMenuGrid";
import { SemuaMenuView } from "../../SemuaMenuView";
import { useBackWhen } from "../../../hooks/useBackWhen";
import { NewsCarousel, useNewsList } from "../../NewsCarousel";
import { api } from "../../../services/api";
import { getActiveSession, useSessionRefreshTick, type RoleName } from "../../../services/authService";
import { getTodayLocal } from "../../../utils/formatters";
import { DashboardLayout } from "../../DashboardLayout";
import { useThemeColors } from "../../../context/ThemeContext";

interface Props { onNavigate: (screen: string, params?: Record<string, unknown>) => void; role: RoleName; }
interface AttendanceRow { tanggal: string; status: string; }

export function GuruDashboard({ onNavigate, role }: Props) {
  const colors = useThemeColors();
  const isGuruKelas = role === "Guru Kelas";
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [daysPresent, setDaysPresent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAllMenu, setShowAllMenu] = useState(false);
  const { prefs: berandaPrefs } = useBerandaPreferensi();
  // isFocused - lihat catatan lengkap di AdminITDashboard.tsx (pola sama
  // dipakai semua dashboard): tanpa ini, kembali dari layar hasil "Semua
  // Menu" butuh 2x klik & lompat ke Beranda (bukan balik ke Semua Menu).
  const isFocused = useIsFocused();
  useBackWhen(showAllMenu && isFocused, () => setShowAllMenu(false));
  // useSessionRefreshTick() (2026-09-04) - paksa render ulang begitu sesi
  // di-refresh dari server (mis. Admin IT baru kasih capability tambahan) -
  // lihat catatan lengkap di webview GuruDashboard.tsx.
  useSessionRefreshTick();
  const session = getActiveSession();
  // Kepala Sekolah (2026-09-04) - FLAG di atas role dasar, BUKAN dashboard
  // terpisah lagi. Lihat catatan lengkap di webview GuruDashboard.tsx.
  const isKepalaSekolah = session?.isKepalaSekolah === true;
  // Manajemen Pengguna multi-flag (2026-09-04) - lihat catatan lengkap di
  // webview GuruDashboard.tsx.
  const capabilities = session?.capabilities ?? [];
  const hasCap = (cap: string) => capabilities.includes(cap);
  const isTuLike = hasCap("admin_tu_sd") || hasCap("admin_tu_tk") || hasCap("supervisor");
  const isMediaLike = hasCap("admin_media_sd") || hasCap("admin_media_tk");
  const isKeuangan = hasCap("keuangan");
  const news = useNewsList();

  // useFocusEffect - lihat catatan di PegawaiDashboard.tsx (fix bug angka
  // presensi basi krn tab tidak pernah unmount saat pindah tab).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        const [res, statRes] = await Promise.all([api.attendanceMe(), api.attendanceStatistikMe()]);
        if (active && res.success) setRecords(res.data);
        if (active && statRes.success && statRes.data) setDaysPresent(statRes.data.days_present);
        if (active) setLoading(false);
      })();
      return () => { active = false; };
    }, [])
  );

  const today = getTodayLocal();
  // Sama spt PegawaiDashboard - HANYA Hadir/Terlambat dihitung "hadir",
  // "Presensi Bulan Ini" pakai sumber sama dgn layar Statistik.
  const todayRecord = records.find((r) => r.tanggal === today);
  const hadirHariIni = todayRecord?.status === 'Hadir' || todayRecord?.status === 'Terlambat';
  const hadirBulanIni = daysPresent;
  const todayLabel = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const menuCategories: MenuCategory[] = [
    { title: "Presensi & Wajah", items: [
      { label: isGuruKelas ? "Kehadiran Diri" : "Presensi Guru", icon: <Clock size={20} color="#047857" />, colorScheme: "blue", onPress: () => onNavigate("presensi") },
      { label: "Pengenalan Wajah", icon: <User size={20} color="#7c3aed" />, colorScheme: "purple", onPress: () => onNavigate("pengenalan-wajah") },
      ...(isGuruKelas ? [
        { label: "Kehadiran Siswa", icon: <Users size={20} color="#0f766e" />, colorScheme: "teal" as const, onPress: () => onNavigate("presensi-admin-tu") },
        { label: "Persetujuan Izin", icon: <ClipboardCheck size={20} color="#7c3aed" />, colorScheme: "purple" as const, onPress: () => onNavigate("persetujuan-izin") },
        { label: "Rekapitulasi Kehadiran", icon: <BarChart3 size={20} color="#4338ca" />, colorScheme: "indigo" as const, onPress: () => onNavigate("rekapitulasi-kehadiran") },
        { label: "Ringkasan Presensi", icon: <BarChart3 size={20} color="#b45309" />, colorScheme: "orange" as const, onPress: () => onNavigate("ringkasan") },
        { label: "Performa Individu", icon: <BarChart3 size={20} color="#0d9488" />, colorScheme: "teal" as const, onPress: () => onNavigate("performa-cari") },
        { label: "Aduan Masuk", icon: <MessageSquareWarning size={20} color="#dc2626" />, colorScheme: "red" as const, onPress: () => onNavigate("aduan-masuk") },
      ] : []),
      ...(isKepalaSekolah ? [
        { label: "Persetujuan Izin Guru", icon: <ClipboardCheck size={20} color="#1d4ed8" />, colorScheme: "blue" as const, onPress: () => onNavigate("persetujuan-izin-guru") },
      ] : []),
      // Kapasitas Admin TU SD/TK/Supervisor (2026-09-04, capability jamak) -
      // lihat catatan lengkap di webview GuruDashboard.tsx.
      ...(isTuLike && !isGuruKelas && !isKepalaSekolah ? [
        { label: "Kehadiran Siswa", icon: <Users size={20} color="#0f766e" />, colorScheme: "teal" as const, onPress: () => onNavigate("presensi-admin-tu") },
        { label: "Rekapitulasi Kehadiran", icon: <BarChart3 size={20} color="#4338ca" />, colorScheme: "indigo" as const, onPress: () => onNavigate("rekapitulasi-kehadiran") },
        { label: "Ringkasan Presensi", icon: <PieChart size={20} color="#b45309" />, colorScheme: "orange" as const, onPress: () => onNavigate("ringkasan") },
        { label: "Performa Individu", icon: <BarChart3 size={20} color="#0d9488" />, colorScheme: "teal" as const, onPress: () => onNavigate("performa-cari") },
        { label: "Aduan Masuk", icon: <MessageSquareWarning size={20} color="#dc2626" />, colorScheme: "red" as const, onPress: () => onNavigate("aduan-masuk") },
      ] : []),
      ...(isTuLike ? [
        { label: "Persetujuan PSB", icon: <UserPlus size={20} color="#1d4ed8" />, colorScheme: "blue" as const, onPress: () => onNavigate("persetujuan-psb") },
        { label: "Cari Siswa & Guru", icon: <Search size={20} color="#0f766e" />, colorScheme: "teal" as const, onPress: () => onNavigate("cari-siswa-guru") },
      ] : []),
      // Kapasitas Admin Media SD/TK (2026-09-04).
      ...(isMediaLike ? [
        { label: "Kelola Berita Acara", icon: <FileText size={20} color="#1d4ed8" />, colorScheme: "blue" as const, onPress: () => onNavigate("berita-acara-admin") },
        { label: "Statistik Konten", icon: <BarChart3 size={20} color="#7c3aed" />, colorScheme: "purple" as const, onPress: () => onNavigate("statistik-konten") },
        { label: "Pengguna Diblokir", icon: <Ban size={20} color="#dc2626" />, colorScheme: "red" as const, onPress: () => onNavigate("blokiran-komentar") },
      ] : []),
      // Kapasitas Keuangan (2026-09-04).
      ...(isKeuangan ? [
        { label: "Data Pembayaran Siswa", icon: <CreditCard size={20} color="#1d4ed8" />, colorScheme: "blue" as const, onPress: () => onNavigate("keuangan-admin") },
      ] : []),
    ] },
    { title: "Mengajar", items: [
      { label: "Kalender Akademik", icon: <BookOpen size={20} color="#4d7c0f" />, colorScheme: "indigo", onPress: () => onNavigate("jadwal-pelajaran") },
      { label: "Buat Tugas / Materi", icon: <ClipboardList size={20} color="#047857" />, colorScheme: "blue", onPress: () => onNavigate("buat-tugas") },
    ] },
    { title: "Administrasi", items: [
      { label: "Slip Gaji", icon: <Award size={20} color="#b45309" />, colorScheme: "orange", onPress: () => onNavigate("placeholder", { title: "Slip Gaji" }) },
    ] },
    { title: "Informasi", items: [
      { label: "Berita Acara", icon: <FileText size={20} color="#0f766e" />, colorScheme: "teal", onPress: () => onNavigate("berita-acara") },
    ] },
    { title: "Akun", items: [
      { label: "Profil", icon: <User size={20} color="#047857" />, colorScheme: "blue", onPress: () => onNavigate("profil") },
    ] },
  ];

  if (showAllMenu) return <SemuaMenuView categories={menuCategories} onBack={() => setShowAllMenu(false)} hasBerita />;

  return (
    <DashboardLayout name={session?.fullName ?? (isGuruKelas ? "Guru Kelas" : "Guru")} roleLabel={`${isGuruKelas ? "Ruang Guru Kelas" : "Ruang Guru"}${isKepalaSekolah ? " + Kepala Sekolah" : ""}`} date={todayLabel}>
      <View>
        <Text className="text-sm font-semibold text-muted-foreground mb-3 uppercase">Hari Ini</Text>
        {loading ? (
          <Text className="text-sm text-muted-foreground">Memuat...</Text>
        ) : (
          <View className="flex-row gap-3">
            <View className="flex-1"><SummaryCard label="Status Hari Ini" value={hadirHariIni ? "Hadir" : "-"} icon={<CheckCircle size={18} color={hadirHariIni ? "#16a34a" : colors.mutedForeground} />} colorScheme={hadirHariIni ? "green" : "default"} subtitle={today} /></View>
            <View className="flex-1"><SummaryCard label="Presensi Bulan Ini" value={String(hadirBulanIni)} icon={<Calendar size={18} color="#047857" />} colorScheme="blue" subtitle="hari hadir" /></View>
          </View>
        )}
      </View>

      <Pressable onPress={() => onNavigate("presensi")} className="w-full bg-primary rounded-2xl p-4 flex-row items-center gap-4">
        <View className="w-12 h-12 rounded-xl bg-white/20 items-center justify-center"><Clock size={24} color={colors.primaryForeground} /></View>
        <View className="flex-1">
          <Text className="text-primary-foreground font-bold text-base">Presensi Sekarang</Text>
          <Text className="text-primary-foreground text-sm">{hadirHariIni ? "Sudah presensi hari ini" : "Belum presensi masuk hari ini"}</Text>
        </View>
      </Pressable>

      {!berandaPrefs.hideBeritaTerbaru && (
        <View>
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-sm font-semibold text-muted-foreground uppercase">Berita Terbaru</Text>
            <Pressable onPress={() => onNavigate("berita-acara")}><Text className="text-xs font-semibold text-primary">Lihat Semua</Text></Pressable>
          </View>
          <NewsCarousel items={news.terbaru} loading={news.loading} onOpenNews={(id) => onNavigate("berita-acara-viewer", { newsId: id })} />
        </View>
      )}
      {!berandaPrefs.hideBeritaTerpopuler && (
        <View>
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-sm font-semibold text-muted-foreground uppercase">Berita Terpopuler</Text>
            <Pressable onPress={() => onNavigate("berita-acara")}><Text className="text-xs font-semibold text-primary">Lihat Semua</Text></Pressable>
          </View>
          <NewsCarousel items={news.terpopuler} loading={news.loading} onOpenNews={(id) => onNavigate("berita-acara-viewer", { newsId: id })} />
        </View>
      )}

      <View>
        <Text className="text-sm font-semibold text-muted-foreground mb-3 uppercase">Menu</Text>
        <QuickMenuGrid items={menuCategories.flatMap((c) => c.items)} onSeeAll={() => setShowAllMenu(true)} />
      </View>
    </DashboardLayout>
  );
}

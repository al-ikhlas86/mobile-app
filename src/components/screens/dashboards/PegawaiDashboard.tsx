import React, { useCallback, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { Clock, Calendar, FileText, User, CheckCircle, Award, Users, ClipboardCheck, BarChart3, PieChart, MessageSquareWarning, UserPlus, Search, Ban, CreditCard } from "lucide-react-native";
import { SummaryCard } from "../../SummaryCard";
import { QuickMenuGrid, type MenuCategory } from "../../QuickMenuGrid";
import { SemuaMenuView } from "../../SemuaMenuView";
import { useBackWhen } from "../../../hooks/useBackWhen";
import { NewsCarousel, useNewsList } from "../../NewsCarousel";
import { api } from "../../../services/api";
import { getActiveSession, useSessionRefreshTick } from "../../../services/authService";
import { getTodayLocal } from "../../../utils/formatters";
import { DashboardLayout } from "../../DashboardLayout";
import { useThemeColors } from "../../../context/ThemeContext";

interface Props { onNavigate: (screen: string, params?: Record<string, unknown>) => void; }
interface AttendanceRow { tanggal: string; status: string; }

export function PegawaiDashboard({ onNavigate }: Props) {
  const colors = useThemeColors();
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [daysPresent, setDaysPresent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAllMenu, setShowAllMenu] = useState(false);
  // isFocused - lihat catatan lengkap di AdminITDashboard.tsx (pola sama
  // dipakai semua dashboard): tanpa ini, kembali dari layar hasil "Semua
  // Menu" butuh 2x klik & lompat ke Beranda (bukan balik ke Semua Menu).
  const isFocused = useIsFocused();
  useBackWhen(showAllMenu && isFocused, () => setShowAllMenu(false));
  // useSessionRefreshTick() (2026-09-04) - lihat catatan lengkap di
  // webview GuruDashboard.tsx.
  useSessionRefreshTick();
  const session = getActiveSession();
  // Kepala Sekolah (2026-09-04) - FLAG di atas role dasar, BUKAN dashboard
  // terpisah lagi. Lihat catatan lengkap di webview PegawaiDashboard.tsx.
  const isKepalaSekolah = session?.isKepalaSekolah === true;
  // Manajemen Pengguna multi-flag (2026-09-04) - lihat catatan lengkap di
  // webview GuruDashboard.tsx.
  const capabilities = session?.capabilities ?? [];
  const hasCap = (cap: string) => capabilities.includes(cap);
  // admin_tu_sd/tk & admin_media_sd/tk DIGABUNG jadi generik (2026-09-14,
  // Sistem Katalog) - lihat catatan sama di GuruDashboard.tsx.
  const isTuLike = hasCap("admin_tu") || hasCap("supervisor");
  const isMediaLike = hasCap("admin_media");
  const isKeuangan = hasCap("keuangan");
  const news = useNewsList();

  // fetchAttendanceData murni fetch (TIDAK setState sendiri) - dipakai 2
  // pemanggil dgn kebutuhan guard beda, lihat catatan lengkap di
  // GuruDashboard.tsx (pola identik).
  const fetchAttendanceData = useCallback(() => Promise.all([api.attendanceMe(), api.attendanceStatistikMe()]), []);

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
        const [res, statRes] = await fetchAttendanceData();
        if (active && res.success) setRecords(res.data);
        if (active && statRes.success && statRes.data) setDaysPresent(statRes.data.days_present);
        if (active) setLoading(false);
      })();
      return () => { active = false; };
    }, [fetchAttendanceData])
  );

  // Pull-to-refresh Beranda (2026-09-05, W5) - tarik ke bawah refetch data
  // absen HARI INI + berita (news.refresh), lihat DashboardLayout::onRefresh.
  const handleRefresh = useCallback(async () => {
    const [[res, statRes]] = await Promise.all([fetchAttendanceData(), news.refresh()]);
    if (res.success) setRecords(res.data);
    if (statRes.success && statRes.data) setDaysPresent(statRes.data.days_present);
  }, [fetchAttendanceData, news.refresh]);

  const today = getTodayLocal();
  // "Hadir" HANYA Hadir/Terlambat (dulu cuma cek ADA baris, "Izin" ikut
  // tampil "Hadir" - bug nyata). "Presensi Bulan Ini" pakai sumber SAMA dgn
  // layar Statistik (days_present, cuma Hadir/Terlambat di hari sekolah
  // resmi) - dulu count semua baris attendance_cache apa adanya, ikut
  // menghitung "Izin" & Sabtu/Minggu sbg "hadir" (bug nyata, laporan user
  // 2026-08-31: Statistik "2/n" vs Beranda "5" utk data yang sama).
  const todayRecord = records.find((r) => r.tanggal === today);
  const hadirHariIni = todayRecord?.status === 'Hadir' || todayRecord?.status === 'Terlambat';
  const hadirBulanIni = daysPresent;
  const todayLabel = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const menuCategories: MenuCategory[] = [
    { title: "Presensi & Wajah", items: [
      { label: "Presensi Pegawai", icon: <Clock size={20} color="#1d4ed8" />, colorScheme: "blue", onPress: () => onNavigate("presensi") },
      { label: "Pengenalan Wajah", icon: <User size={20} color="#7c3aed" />, colorScheme: "purple", onPress: () => onNavigate("pengenalan-wajah") },
      ...(isKepalaSekolah ? [
        { label: "Persetujuan Izin Guru", icon: <ClipboardCheck size={20} color="#1d4ed8" />, colorScheme: "blue" as const, onPress: () => onNavigate("persetujuan-izin-guru") },
      ] : []),
      // Kepsek TANPA capability TU juga butuh lihat Aduan Masuk (sejak Aduan
      // Pegawai ada, 2026-09-14) - blok isTuLike di bawah SUDAH menyertakan
      // "Aduan Masuk" utk kepsek yg KEBETULAN juga TU, di sini KHUSUS kepsek
      // murni supaya tidak dobel.
      ...(isKepalaSekolah && !isTuLike ? [
        { label: "Aduan Masuk", icon: <MessageSquareWarning size={20} color="#dc2626" />, colorScheme: "red" as const, onPress: () => onNavigate("aduan-masuk") },
      ] : []),
      ...(isTuLike || isKepalaSekolah ? [
        { label: "Kehadiran Siswa", icon: <Users size={20} color="#0f766e" />, colorScheme: "teal" as const, onPress: () => onNavigate("presensi-admin-tu") },
        { label: "Rekapitulasi Kehadiran", icon: <BarChart3 size={20} color="#4338ca" />, colorScheme: "indigo" as const, onPress: () => onNavigate("rekapitulasi-kehadiran") },
        { label: "Ringkasan Presensi", icon: <PieChart size={20} color="#b45309" />, colorScheme: "orange" as const, onPress: () => onNavigate("ringkasan") },
      ] : []),
      // Kapasitas Admin TU SD/TK/Supervisor (2026-09-04).
      ...(isTuLike ? [
        { label: "Performa Individu", icon: <BarChart3 size={20} color="#0d9488" />, colorScheme: "teal" as const, onPress: () => onNavigate("performa-cari") },
        { label: "Aduan Masuk", icon: <MessageSquareWarning size={20} color="#dc2626" />, colorScheme: "red" as const, onPress: () => onNavigate("aduan-masuk") },
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
    { title: "Informasi", items: [
      { label: "Berita Acara", icon: <FileText size={20} color="#0f766e" />, colorScheme: "teal", onPress: () => onNavigate("berita-acara") },
    ] },
    { title: "Administrasi", items: [
      { label: "Slip Gaji", icon: <Award size={20} color="#b45309" />, colorScheme: "orange", onPress: () => onNavigate("placeholder", { title: "Slip Gaji" }) },
      { label: "Jadwal Kerja", icon: <Calendar size={20} color="#4338ca" />, colorScheme: "indigo", onPress: () => onNavigate("jadwal-kerja") },
      // Aduan Pegawai (2026-09-14) - beda dari "Aduan Masuk" di atas (itu
      // utk MENERIMA, khusus TU/Kepsek) - ini utk SEMUA pegawai MENGIRIM
      // aduan soal dirinya/hal umum ke Kepsek/TU/Admin IT unit sendiri.
      { label: "Kirim Aduan", icon: <MessageSquareWarning size={20} color="#dc2626" />, colorScheme: "red", onPress: () => onNavigate("kirim-aduan-pegawai") },
    ] },
    { title: "Akun", items: [
      { label: "Profil", icon: <User size={20} color="#4338ca" />, colorScheme: "indigo", onPress: () => onNavigate("profil") },
    ] },
  ];

  if (showAllMenu) return <SemuaMenuView categories={menuCategories} onBack={() => setShowAllMenu(false)} />;

  return (
    <DashboardLayout name={session?.fullName ?? "Pegawai"} roleLabel={`Ruang Pegawai${isKepalaSekolah ? " + Kepala Sekolah" : ""}`} date={todayLabel} onRefresh={handleRefresh}>
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

      <View>
        <Text className="text-sm font-semibold text-muted-foreground mb-3 uppercase">Menu</Text>
        <QuickMenuGrid items={menuCategories.flatMap((c) => c.items)} onSeeAll={() => setShowAllMenu(true)} />
      </View>

      {/* Berita dipindah ke BAWAH menu (2026-09-05, W9) - lihat catatan
          lengkap di GuruDashboard.tsx. */}
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
    </DashboardLayout>
  );
}

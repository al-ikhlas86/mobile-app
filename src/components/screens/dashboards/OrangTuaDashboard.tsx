import React, { useCallback, useRef, useState } from "react";
import { View, Text, ActivityIndicator, Pressable } from "react-native";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { Clock, User, FileText, CheckCircle, AlertCircle, Info, ScanFace, BookOpen, ClipboardList, MessageSquareWarning, CreditCard, Shirt } from "lucide-react-native";
import { SummaryCard } from "../../SummaryCard";
import { QuickMenuGrid, useBerandaPreferensi, type MenuCategory } from "../../QuickMenuGrid";
import { SemuaMenuView } from "../../SemuaMenuView";
import { useBackWhen } from "../../../hooks/useBackWhen";
import { Card } from "../../ui/Card";
import { ChildSwitcher } from "../../ChildSwitcher";
import { NewsCarousel, useNewsList } from "../../NewsCarousel";
import { api } from "../../../services/api";
import { getActiveSession } from "../../../services/authService";
import { useUnreadNotificationCount } from "../../../hooks/useUnreadNotificationCount";
import { getTodayLocal } from "../../../utils/formatters";
import { DashboardLayout } from "../../DashboardLayout";
import { useThemeColors } from "../../../context/ThemeContext";

interface Props { onNavigate: (screen: string, params?: Record<string, unknown>) => void; }
interface ChildData { id: number; nama: string; nis: string; kelas_nama: string | null; tingkat: string | null; status: string; }
interface AttendanceRow { student_cache_id: number; tanggal: string; status: string; }

export function OrangTuaDashboard({ onNavigate }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [children, setChildren] = useState<ChildData[]>([]);
  const [activeChildId, setActiveChildId] = useState<number | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [showAllMenu, setShowAllMenu] = useState(false);
  const { prefs: berandaPrefs } = useBerandaPreferensi();
  // Dibaca dalam useFocusEffect (deps [], jangan re-jalan tiap ganti anak) -
  // ref supaya nilai TERBARU terbaca tanpa membuat effect fetch ulang tiap
  // switch anak.
  const activeChildIdRef = useRef<number | null>(null);
  // isFocused - lihat catatan lengkap di AdminITDashboard.tsx (pola sama
  // dipakai semua dashboard): tanpa ini, kembali dari layar hasil "Semua
  // Menu" butuh 2x klik & lompat ke Beranda (bukan balik ke Semua Menu).
  const isFocused = useIsFocused();
  useBackWhen(showAllMenu && isFocused, () => setShowAllMenu(false));
  const colors = useThemeColors();
  const session = getActiveSession();
  const news = useNewsList();
  // Badge notifikasi menu Akademik - lihat catatan sama di GuruDashboard.tsx.
  const { akademik: akademikBadge } = useUnreadNotificationCount();
  const todayLabel = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // fetchChildrenData murni fetch (TIDAK setState sendiri) - dipakai 2
  // pemanggil dgn kebutuhan guard beda, lihat catatan lengkap di
  // GuruDashboard.tsx (pola identik).
  const fetchChildrenData = useCallback(() => Promise.all([api.myChildren(), api.attendanceMyChildren()]), []);
  function applyChildrenData(childrenRes: Awaited<ReturnType<typeof api.myChildren>>, attendanceRes: Awaited<ReturnType<typeof api.attendanceMyChildren>>) {
    if (childrenRes.success) {
      setChildren(childrenRes.data);
      const keepActive = activeChildIdRef.current !== null && childrenRes.data.some((c: ChildData) => c.id === activeChildIdRef.current);
      const nextActiveId = keepActive ? activeChildIdRef.current : (childrenRes.data[0]?.id ?? null);
      activeChildIdRef.current = nextActiveId;
      setActiveChildId(nextActiveId);
    } else setError(childrenRes.message ?? "Gagal memuat data anak.");
    if (attendanceRes.success) setAttendance(attendanceRes.data);
  }

  // useFocusEffect - lihat catatan di PegawaiDashboard.tsx (fix bug angka
  // presensi basi krn tab tidak pernah unmount saat pindah tab).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        const [childrenRes, attendanceRes] = await fetchChildrenData();
        if (active) applyChildrenData(childrenRes, attendanceRes);
        if (active) setLoading(false);
      })();
      return () => { active = false; };
    }, [fetchChildrenData])
  );

  // Pull-to-refresh Beranda (2026-09-05, W5) - lihat DashboardLayout::onRefresh.
  const handleRefresh = useCallback(async () => {
    const [[childrenRes, attendanceRes]] = await Promise.all([fetchChildrenData(), news.refresh()]);
    applyChildrenData(childrenRes, attendanceRes);
  }, [fetchChildrenData, news.refresh]);

  function handleSelectChild(id: number) {
    activeChildIdRef.current = id;
    setActiveChildId(id);
  }

  if (loading) return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator color={colors.primary} /></View>;

  const child = children.find((c) => c.id === activeChildId) ?? null;

  if (error || !child) {
    return (
      <View className="flex-1 items-center justify-center bg-background gap-3 px-8">
        <AlertCircle size={32} color={colors.mutedForeground} />
        <Text className="text-sm text-muted-foreground text-center">{error || "Belum ada data anak yang tertaut ke akun ini."}</Text>
      </View>
    );
  }

  const today = getTodayLocal();
  // "Terlambat" ikut dihitung "hadir" (konsisten dgn dashboard Pegawai/Guru
  // & layar Statistik) - SEBELUMNYA cuma cek status==="Hadir" persis, jadi
  // anak yang terlambat masuk tampil seolah belum presensi sama sekali.
  // CATATAN: tidak spt dashboard Pegawai/Guru, angka ini BELUM disamakan ke
  // sumber days_present (Statistik Anak) krn perlu fetch per-anak terpisah
  // (arsitektur di sini sengaja fetch 1x utk SEMUA anak, lihat komentar
  // useFocusEffect) - closest-safe-fix dulu, bukan penyelarasan penuh.
  const isPresent = (a: AttendanceRow) => a.status === "Hadir" || a.status === "Terlambat";
  const hadirHariIni = attendance.some((a) => a.student_cache_id === child.id && a.tanggal === today && isPresent(a));
  const totalHadirBulanIni = attendance.filter((a) => a.student_cache_id === child.id && isPresent(a) && a.tanggal.slice(0, 7) === today.slice(0, 7)).length;

  const menuCategories: MenuCategory[] = [
    { title: "Anak", items: [
      { label: "Kehadiran Anak", icon: <Clock size={20} color="#b45309" />, colorScheme: "orange", onPress: () => onNavigate("presensi") },
      { label: "Kalender Kegiatan", icon: <BookOpen size={20} color="#4338ca" />, colorScheme: "indigo", onPress: () => onNavigate("kalender-kegiatan") },
      // Akademik (2026-09-24, Poin 3 Fase 2) - GANTI "Kalender Akademik" +
      // "Tugas & Materi" lama, lihat catatan lengkap di webview
      // OrangTuaDashboard.tsx.
      { label: "Akademik", icon: <ClipboardList size={20} color="#1d4ed8" />, colorScheme: "blue", onPress: () => onNavigate("akademik"), badgeCount: akademikBadge },
      { label: "Pengenalan Wajah Anak", icon: <ScanFace size={20} color="#7c3aed" />, colorScheme: "purple", onPress: () => onNavigate("pengenalan-wajah") },
      { label: "Kirim Aduan", icon: <MessageSquareWarning size={20} color="#dc2626" />, colorScheme: "red", onPress: () => onNavigate("kirim-aduan") },
      { label: "Rincian Biaya", icon: <CreditCard size={20} color="#1d4ed8" />, colorScheme: "blue", onPress: () => onNavigate("placeholder", { title: "Rincian Biaya (belum tersambung)" }) },
      // Placeholder - tombol saja dulu (2026-09-11, poin #9) - lihat catatan
      // lengkap di versi webview OrangTuaDashboard.tsx.
      { label: "Seragam", icon: <Shirt size={20} color="#c2410c" />, colorScheme: "orange", onPress: () => onNavigate("placeholder", { title: "Seragam (segera hadir)" }) },
    ] },
    { title: "Informasi", items: [
      { label: "Berita Acara", icon: <FileText size={20} color="#0f766e" />, colorScheme: "teal", onPress: () => onNavigate("berita-acara") },
    ] },
    { title: "Akun", items: [
      { label: "Profil", icon: <User size={20} color="#4338ca" />, colorScheme: "indigo", onPress: () => onNavigate("profil") },
    ] },
  ];

  if (showAllMenu) return <SemuaMenuView categories={menuCategories} onBack={() => setShowAllMenu(false)} hasBerita />;

  return (
    <DashboardLayout name={session?.fullName ?? "Orang Tua"} roleLabel="Portal Orang Tua" date={todayLabel} onRefresh={handleRefresh}>
      <ChildSwitcher children={children} activeId={activeChildId} onChange={handleSelectChild} />

      <Card padding="md">
        <Text className="text-xs text-muted-foreground mb-1">Data Anak</Text>
        <Text className="text-sm font-bold text-foreground">{child.nama}</Text>
        <Text className="text-xs text-muted-foreground mt-0.5">{child.kelas_nama ? `Kelas ${child.kelas_nama}` : "Kelas belum diatur"} · NIS: {child.nis}</Text>
        <View className={`self-start flex-row items-center gap-1 px-2.5 py-1 rounded-full mt-2 ${hadirHariIni ? "bg-green-100 dark:bg-green-900/20" : "bg-muted"}`}>
          <CheckCircle size={12} color={hadirHariIni ? "#15803d" : colors.mutedForeground} />
          <Text className={`text-xs font-medium ${hadirHariIni ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}`}>{hadirHariIni ? "Hadir Hari Ini" : "Belum Ada Presensi Hari Ini"}</Text>
        </View>
      </Card>

      <View>
        <Text className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Ringkasan</Text>
        <View className="flex-row gap-2">
          <View className="flex-1 gap-2">
            <SummaryCard compact label="Presensi Bulan Ini" value={`${totalHadirBulanIni} hari`} icon={<Info size={13} color="#1d4ed8" />} colorScheme="blue" />
            <SummaryCard compact label="Status Hari Ini" value={hadirHariIni ? "Hadir" : "-"} icon={<CheckCircle size={13} color="#16a34a" />} colorScheme={hadirHariIni ? "green" : "default"} />
          </View>
          <View className="flex-1 rounded-lg px-2.5 py-2 border border-border border-l-4 bg-amber-50 dark:bg-amber-900/10 justify-center" style={{ borderLeftColor: "#f59e0b" }}>
            <Text className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">Data Keuangan</Text>
            <Text className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">Belum tersambung</Text>
          </View>
        </View>
      </View>

      <View>
        <Text className="text-sm font-semibold text-muted-foreground mb-3 uppercase">Menu</Text>
        <QuickMenuGrid items={menuCategories.flatMap((c) => c.items)} onSeeAll={() => setShowAllMenu(true)} />
      </View>

      {/* Berita dipindah ke BAWAH menu (2026-09-05, W9) - lihat catatan
          lengkap di GuruDashboard.tsx. */}
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
    </DashboardLayout>
  );
}

import React, { useCallback, useState } from "react";
import { View, Text, ActivityIndicator, Pressable } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Clock, User, FileText, CheckCircle, AlertCircle, Info, ScanFace, BookOpen, MessageSquareWarning } from "lucide-react-native";
import { SummaryCard } from "../../SummaryCard";
import { QuickMenuGrid, type MenuCategory } from "../../QuickMenuGrid";
import { SemuaMenuView } from "../../SemuaMenuView";
import { Card } from "../../ui/Card";
import { NewsCarousel, useNewsList } from "../../NewsCarousel";
import { api } from "../../../services/api";
import { getActiveSession } from "../../../services/authService";
import { getTodayLocal } from "../../../utils/formatters";
import { DashboardLayout } from "../../DashboardLayout";

interface Props { onNavigate: (screen: string, params?: Record<string, unknown>) => void; }
interface ChildData { id: number; nama: string; nis: string; kelas_nama: string | null; tingkat: string | null; status: string; }
interface AttendanceRow { student_cache_id: number; tanggal: string; status: string; }

export function OrangTuaDashboard({ onNavigate }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [child, setChild] = useState<ChildData | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [showAllMenu, setShowAllMenu] = useState(false);
  const session = getActiveSession();
  const news = useNewsList();
  const todayLabel = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // useFocusEffect - lihat catatan di PegawaiDashboard.tsx (fix bug angka
  // presensi basi krn tab tidak pernah unmount saat pindah tab).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        const [childrenRes, attendanceRes] = await Promise.all([api.myChildren(), api.attendanceMyChildren()]);
        if (!active) return;
        if (childrenRes.success) setChild(childrenRes.data[0] ?? null);
        else setError(childrenRes.message ?? "Gagal memuat data anak.");
        if (attendanceRes.success) setAttendance(attendanceRes.data);
        setLoading(false);
      })();
      return () => { active = false; };
    }, [])
  );

  if (loading) return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator color="#356447" /></View>;

  if (error || !child) {
    return (
      <View className="flex-1 items-center justify-center bg-background gap-3 px-8">
        <AlertCircle size={32} color="#6E776F" />
        <Text className="text-sm text-muted-foreground text-center">{error || "Belum ada data anak yang tertaut ke akun ini."}</Text>
      </View>
    );
  }

  const today = getTodayLocal();
  const hadirHariIni = attendance.some((a) => a.student_cache_id === child.id && a.tanggal === today && a.status === "Hadir");
  const totalHadirBulanIni = attendance.filter((a) => a.student_cache_id === child.id && a.status === "Hadir" && a.tanggal.slice(0, 7) === today.slice(0, 7)).length;

  const menuCategories: MenuCategory[] = [
    { title: "Anak", items: [
      { label: "Kehadiran Anak", icon: <Clock size={20} color="#b45309" />, colorScheme: "orange", onPress: () => onNavigate("presensi") },
      { label: "Jadwal Pelajaran", icon: <BookOpen size={20} color="#4d7c0f" />, colorScheme: "indigo", onPress: () => onNavigate("jadwal-pelajaran") },
      { label: "Pengenalan Wajah Anak", icon: <ScanFace size={20} color="#7c3aed" />, colorScheme: "purple", onPress: () => onNavigate("pengenalan-wajah") },
      { label: "Kirim Aduan", icon: <MessageSquareWarning size={20} color="#dc2626" />, colorScheme: "red", onPress: () => onNavigate("kirim-aduan") },
    ] },
    { title: "Informasi", items: [
      { label: "Berita Acara", icon: <FileText size={20} color="#0f766e" />, colorScheme: "teal", onPress: () => onNavigate("berita-acara") },
    ] },
    { title: "Akun", items: [
      { label: "Profil", icon: <User size={20} color="#4d7c0f" />, colorScheme: "indigo", onPress: () => onNavigate("profil") },
    ] },
  ];

  if (showAllMenu) return <SemuaMenuView categories={menuCategories} onBack={() => setShowAllMenu(false)} />;

  return (
    <DashboardLayout name={session?.fullName ?? "Orang Tua"} roleLabel="Portal Orang Tua" date={todayLabel}>
      <Card padding="md">
        <Text className="text-xs text-muted-foreground mb-1">Data Anak</Text>
        <Text className="text-sm font-bold text-foreground">{child.nama}</Text>
        <Text className="text-xs text-muted-foreground mt-0.5">{child.kelas_nama ? `Kelas ${child.kelas_nama}` : "Kelas belum diatur"} · NIS: {child.nis}</Text>
        <View className={`self-start flex-row items-center gap-1 px-2.5 py-1 rounded-full mt-2 ${hadirHariIni ? "bg-green-100" : "bg-muted"}`}>
          <CheckCircle size={12} color={hadirHariIni ? "#15803d" : "#6E776F"} />
          <Text className={`text-xs font-medium ${hadirHariIni ? "text-green-700" : "text-muted-foreground"}`}>{hadirHariIni ? "Hadir Hari Ini" : "Belum Ada Presensi Hari Ini"}</Text>
        </View>
      </Card>

      <View>
        <Text className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Ringkasan</Text>
        <View className="flex-row gap-2">
          <View className="flex-1 gap-2">
            <SummaryCard compact label="Presensi Bulan Ini" value={`${totalHadirBulanIni} hari`} icon={<Info size={13} color="#047857" />} colorScheme="blue" />
            <SummaryCard compact label="Status Hari Ini" value={hadirHariIni ? "Hadir" : "-"} icon={<CheckCircle size={13} color="#16a34a" />} colorScheme={hadirHariIni ? "green" : "default"} />
          </View>
          <View className="flex-1 rounded-lg px-2.5 py-2 border border-border border-l-4 bg-amber-50 justify-center" style={{ borderLeftColor: "#f59e0b" }}>
            <Text className="text-[10px] font-semibold text-amber-700">Data Keuangan</Text>
            <Text className="text-[10px] text-amber-600 mt-0.5">Belum tersambung</Text>
          </View>
        </View>
      </View>

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

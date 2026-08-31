import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { Users, Shield, HardDrive, FileText, CreditCard, Clock, RefreshCw, GraduationCap, UserCog, MessageCircle, Megaphone, Ban, Activity, History, BarChart3, MessageSquareWarning, UserPlus, MapPin } from "lucide-react-native";
import { SummaryCard } from "../../SummaryCard";
import { QuickMenuGrid, type MenuCategory } from "../../QuickMenuGrid";
import { SemuaMenuView } from "../../SemuaMenuView";
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

export function AdminITDashboard({ onNavigate }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAllMenu, setShowAllMenu] = useState(false);
  useBackWhen(showAllMenu, () => setShowAllMenu(false));

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await api.stats();
      if (res.success) setStats(res.data);
      setLoading(false);
    })();
  }, []);

  const today = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const menuCategories: MenuCategory[] = [
    { title: "Administrasi Pengguna", items: [
      { label: "Manajemen Pengguna", icon: <Users size={20} color="#047857" />, colorScheme: "blue", onPress: () => onNavigate("manajemen-pengguna") },
      { label: "Role & Hak Akses", icon: <Shield size={20} color="#7c3aed" />, colorScheme: "purple", onPress: () => onNavigate("role-hak-akses") },
      { label: "Koneksi Bot WhatsApp", icon: <MessageCircle size={20} color="#047857" />, colorScheme: "green", onPress: () => onNavigate("koneksi-wa-bot") },
      { label: "Buat Pengumuman", icon: <Megaphone size={20} color="#b45309" />, colorScheme: "orange", onPress: () => onNavigate("buat-pengumuman") },
      { label: "Pengguna Diblokir", icon: <Ban size={20} color="#be123c" />, colorScheme: "red", onPress: () => onNavigate("blokiran-komentar") },
    ] },
    { title: "Operasional", items: [
      { label: "Persetujuan PSB", icon: <UserPlus size={20} color="#2563eb" />, colorScheme: "blue", onPress: () => onNavigate("persetujuan-psb") },
      { label: "Berita Acara", icon: <FileText size={20} color="#047857" />, colorScheme: "blue", onPress: () => onNavigate("berita-acara") },
      { label: "Keuangan", icon: <CreditCard size={20} color="#047857" />, colorScheme: "green", onPress: () => onNavigate("keuangan-admin") },
      { label: "Presensi", icon: <Clock size={20} color="#b45309" />, colorScheme: "orange", onPress: () => onNavigate("presensi-admin-tu") },
      { label: "Rekapitulasi Kehadiran", icon: <BarChart3 size={20} color="#7c3aed" />, colorScheme: "purple", onPress: () => onNavigate("rekapitulasi-kehadiran") },
      { label: "Ringkasan Presensi", icon: <BarChart3 size={20} color="#b45309" />, colorScheme: "orange", onPress: () => onNavigate("ringkasan") },
      { label: "Performa Individu", icon: <BarChart3 size={20} color="#0d9488" />, colorScheme: "teal", onPress: () => onNavigate("performa-cari") },
      { label: "Pengaturan Lokasi Presensi", icon: <MapPin size={20} color="#047857" />, colorScheme: "green", onPress: () => onNavigate("pengaturan-lokasi") },
      { label: "Jam Keterlambatan", icon: <Clock size={20} color="#b45309" />, colorScheme: "orange", onPress: () => onNavigate("pengaturan-jam-keterlambatan") },
      { label: "Aduan Masuk", icon: <MessageSquareWarning size={20} color="#dc2626" />, colorScheme: "red", onPress: () => onNavigate("aduan-masuk") },
      { label: "Backup Database", icon: <HardDrive size={20} color="#0f766e" />, colorScheme: "teal", onPress: () => onNavigate("backup-database") },
      { label: "Status Sinkronisasi", icon: <Activity size={20} color="#7c3aed" />, colorScheme: "purple", onPress: () => onNavigate("status-sinkronisasi") },
      { label: "Log Aktivitas", icon: <History size={20} color="#047857" />, colorScheme: "blue", onPress: () => onNavigate("log-aktivitas") },
    ] },
  ];

  if (showAllMenu) return <SemuaMenuView categories={menuCategories} onBack={() => setShowAllMenu(false)} />;

  return (
    <DashboardLayout name="Admin IT" roleLabel="Pusat Kendali Sistem" date={today}>
      <View>
        <Text className="text-sm font-semibold text-muted-foreground mb-3 uppercase">Status Sistem</Text>
        {loading ? (
          <Text className="text-sm text-muted-foreground">Memuat statistik...</Text>
        ) : stats ? (
          <View className="flex-row flex-wrap gap-3">
            <View style={{ width: "47%" }}><SummaryCard label="Total Siswa Aktif" value={String(stats.totalSiswaAktif)} icon={<GraduationCap size={18} color="#047857" />} colorScheme="blue" subtitle="dari Hub API" /></View>
            <View style={{ width: "47%" }}><SummaryCard label="Total Pengguna Aktif" value={String(stats.totalPenggunaAktif)} icon={<Users size={18} color="#7c3aed" />} colorScheme="purple" subtitle="akun aplikasi ini" /></View>
            <View style={{ width: "47%" }}><SummaryCard label="Total Pegawai Aktif" value={String(stats.totalPegawaiAktif)} icon={<UserCog size={18} color="#16a34a" />} colorScheme="green" subtitle="dari Hub API" /></View>
            <View style={{ width: "47%" }}><SummaryCard label="Sinkronisasi Terakhir" value={formatSync(stats.lastSyncAt)} icon={<RefreshCw size={18} color="#b45309" />} colorScheme="orange" subtitle="Hub API + Absen" /></View>
          </View>
        ) : (
          <Text className="text-sm text-muted-foreground">Gagal memuat statistik.</Text>
        )}
      </View>
      <View>
        <Text className="text-sm font-semibold text-muted-foreground mb-3 uppercase">Menu Utama</Text>
        <QuickMenuGrid items={menuCategories.flatMap((c) => c.items)} onSeeAll={() => setShowAllMenu(true)} />
      </View>
    </DashboardLayout>
  );
}

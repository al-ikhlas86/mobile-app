import React, { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Search, BarChart3 } from "lucide-react-native";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { SimplePicker } from "../ui/SimplePicker";
import { SimpleCalendarPicker } from "../ui/SimpleCalendarPicker";
import { api } from "../../services/api";
import { getTodayLocal } from "../../utils/formatters";
import { getActiveSession, type RoleName } from "../../services/authService";
import { useThemeColors } from "../../context/ThemeContext";

type TabType = "Siswa" | "Guru" | "Pegawai";
interface AttendanceRow { id: number; entity_name: string; kelas_nama?: string | null; jabatan?: string | null; check_in_time: string | null; check_out_time: string | null; status: string; }
interface ClassOption { tingkat: string; kelas: string; label: string; }
const TAB_TO_ENTITY: Record<TabType, "siswa" | "guru" | "karyawan"> = { Siswa: "siswa", Guru: "guru", Pegawai: "karyawan" };

// admin_tu_sd/tk DIGABUNG jadi generik (2026-09-14, Sistem Katalog) - nama
// lama TETAP dicek (pola "legacy names") jaga2 sesi lama.
const UNRESTRICTED_ROLES: RoleName[] = ["Admin IT", "Supervisor", "Admin TU", "Admin TU (SD)", "Admin TU (TK & Playground)", "Keuangan"];

// isKepalaSekolah (2026-09-04) - FLAG di atas role dasar, BUKAN lagi role
// "Kepala Sekolah (SD)"/"(TK & Playground)" terpisah. isWaliKelas (2026-09-04,
// Fase 3) - Guru Kelas JUGA FLAG sekarang, sama pola - dulu `role === "Guru
// Kelas"`.
// isKeuanganCap (2026-09-21) - "Keuangan" di UNRESTRICTED_ROLES di atas cuma
// cocok kalau role DASAR akun itu literal "Keuangan" (akun standalone lama).
// Sejak Keuangan jadi MURNI capability yang ditempel ke akun guru/pegawai
// yang sudah ada (Kapasitas Tambahan), akun begitu role dasarnya tetap
// "Guru"/"Pegawai" - jatuh ke cabang paling bawah (cuma lihat dirinya
// sendiri/1 tab). Ditemukan dari laporan user (screenshot nyata: akun
// Keuangan cuma dapat 1 tab "Pegawai", tanpa Guru/Siswa) - port 1:1 dari
// perbaikan webview.
function allowedTabsForRole(role?: RoleName, isKepalaSekolah?: boolean, isWaliKelas?: boolean, isKeuanganCap?: boolean): TabType[] {
  if (!role || isKepalaSekolah || isKeuanganCap || UNRESTRICTED_ROLES.includes(role)) return ["Siswa", "Guru", "Pegawai"];
  if (role === "Guru" && isWaliKelas) return ["Siswa", "Guru"];
  if (role === "Guru") return ["Guru"];
  return ["Pegawai"];
}
function isUnrestricted(role?: RoleName, isKepalaSekolah?: boolean, isKeuanganCap?: boolean): boolean {
  return !role || !!isKepalaSekolah || !!isKeuanganCap || UNRESTRICTED_ROLES.includes(role);
}
function badgeVariantForStatus(status: string): "success" | "error" | "warning" | "info" | "muted" {
  if (status === "Hadir") return "success";
  if (status === "Terlambat") return "warning";
  if (status === "Sakit" || status === "Izin") return "info";
  if (status === "Menunggu Persetujuan") return "warning";
  if (status === "Alfa") return "error";
  return "muted";
}

interface Props { role?: RoleName; onNavigate?: (screen: string, params?: Record<string, unknown>) => void; }

export function PresensiAdminTU({ role, onNavigate }: Props = {}) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const isKepalaSekolah = getActiveSession()?.isKepalaSekolah === true;
  const isWaliKelas = getActiveSession()?.isWaliKelas === true;
  const isKeuanganCap = (getActiveSession()?.capabilities ?? []).includes("keuangan");
  const tabs = useMemo(() => allowedTabsForRole(role, isKepalaSekolah, isWaliKelas, isKeuanganCap), [role, isKepalaSekolah, isWaliKelas, isKeuanganCap]);
  const unrestricted = isUnrestricted(role, isKepalaSekolah, isKeuanganCap);
  const [tab, setTab] = useState<TabType>(tabs[0]);
  const [search, setSearch] = useState("");
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(getTodayLocal());
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [selectedClass, setSelectedClass] = useState(""); // "tingkat|kelas" atau "" = semua

  useEffect(() => {
    if (unrestricted && tab === "Siswa") {
      api.attendanceClasses().then((res) => { if (res.success) setClassOptions(res.data); });
    }
  }, [unrestricted, tab]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [tingkat, kelas] = selectedClass ? selectedClass.split("|") : [undefined, undefined];
      const res = unrestricted
        ? await api.attendanceAllFiltered(TAB_TO_ENTITY[tab], date, tingkat, kelas)
        : await api.attendanceAll(TAB_TO_ENTITY[tab], date);
      if (res.success) setRecords(res.data);
      setLoading(false);
    })();
  }, [tab, date, selectedClass, unrestricted]);

  const filtered = records.filter((r) => r.entity_name.toLowerCase().includes(search.toLowerCase()));
  const hadirCount = records.filter((r) => r.status === "Hadir" || r.status === "Terlambat").length;
  const classPickerOptions = [{ value: "", label: "Semua Kelas" }, ...classOptions.map((c) => ({ value: `${c.tingkat}|${c.kelas}`, label: c.label }))];

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 pt-5">
        <View className="bg-primary rounded-xl p-4">
          <Text className="text-primary-foreground text-xs">Rekap Kehadiran</Text>
          <Text className="text-primary-foreground font-bold text-base mt-0.5">{new Date(date + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</Text>
          <View className="mt-2">
            <Text className="text-primary-foreground text-xs">Total Tercatat Hadir</Text>
            <Text className="text-primary-foreground font-bold text-lg">{hadirCount}</Text>
          </View>
        </View>

        {onNavigate && (
          <Card padding="sm" onPress={() => onNavigate("rekapitulasi-kehadiran")} className="mt-3">
            <View className="flex-row items-center gap-3">
              <View className="w-9 h-9 rounded-lg bg-primary/10 items-center justify-center"><BarChart3 size={16} color={colors.primary} /></View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground">Rekapitulasi Kehadiran Bulanan</Text>
                <Text className="text-xs text-muted-foreground">Lihat & unduh rekap 1 bulan penuh</Text>
              </View>
            </View>
          </Card>
        )}

        <View className="mt-4 gap-2">
          <SimpleCalendarPicker value={date} onChange={setDate} />
          {unrestricted && tab === "Siswa" && classOptions.length > 0 && (
            <SimplePicker value={selectedClass} options={classPickerOptions} onChange={setSelectedClass} placeholder="Semua Kelas" />
          )}
        </View>

        <View className="mt-3"><Input placeholder={`Cari ${tab.toLowerCase()}...`} value={search} onChangeText={setSearch} icon={<Search size={18} color={colors.mutedForeground} />} /></View>

        {tabs.length > 1 && (
          <View className="flex-row gap-2 p-1 bg-muted rounded-xl mt-4">
            {tabs.map((t) => (
              <Pressable key={t} onPress={() => { setTab(t); setSelectedClass(""); }} className={`flex-1 py-2 rounded-lg items-center ${tab === t ? "bg-card" : ""}`}>
                <Text className={`text-sm font-medium ${tab === t ? "text-foreground" : "text-muted-foreground"}`}>{t}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <FlatList
        className="flex-1 px-4 mt-4"
        contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 8 }}
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={<Text className="text-sm text-muted-foreground text-center py-6">{loading ? "Memuat..." : "Belum ada presensi tercatat tanggal ini."}</Text>}
        renderItem={({ item }) => (
          <Card padding="sm">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center"><Text className="text-primary font-bold text-sm">{item.entity_name.charAt(0)}</Text></View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground">{item.entity_name}</Text>
                <Text className="text-xs text-muted-foreground">{item.kelas_nama ?? item.jabatan ?? tab} {item.check_in_time ? `· ${item.check_in_time} WIB` : ""}</Text>
              </View>
              <Badge variant={badgeVariantForStatus(item.status)}>{item.status}</Badge>
            </View>
          </Card>
        )}
      />
    </View>
  );
}

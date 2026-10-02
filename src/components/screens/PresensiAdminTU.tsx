import React, { useEffect, useRef, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Search, BarChart3 } from "lucide-react-native";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { SimplePicker } from "../ui/SimplePicker";
import { SimpleCalendarPicker } from "../ui/SimpleCalendarPicker";
import { api } from "../../services/api";
import { getTodayLocal } from "../../utils/formatters";
import type { RoleName } from "../../services/authService";
import { useThemeColors } from "../../context/ThemeContext";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";

type Entitas = "siswa" | "guru" | "karyawan";
interface AttendanceRow { id: number; entity_name: string; kelas_nama?: string | null; jabatan?: string | null; check_in_time: string | null; check_out_time: string | null; status: string; }
interface ClassOption { tingkat: string; kelas: string; label: string; }

// Jawaban GET /api/attendance/akses (lihat backend services/attendanceAkses.js) - port 1:1 dari webview (2026-10-02).
// Hak lihat ditentukan SERVER, bukan lagi tebakan dari nama role/capability di klien. Aturan singkat: Admin IT semua |
// Supervisor & Kepala Sekolah siswa+staf di unit katalognya | Admin TU & Keuangan staf di unit katalognya (tanpa siswa) |
// Wali Kelas HANYA siswa kelasnya | guru/pegawai biasa HANYA dirinya sendiri.
interface Akses {
  siswa: "semua" | "unit" | "kelas" | "tidak";
  staf: "semua" | "unit" | "diri" | "tidak";
  diriSebagai: "guru" | "karyawan" | null;
  tabHarian: Entitas[];
  scopeBulanan: ("kelas" | "pegawai")[];
  kelasSendiri: { tingkat: string; kelas: string; label: string } | null;
  stafHanyaDiri: boolean;
}

const LABEL_TAB: Record<Entitas, string> = { siswa: "Siswa", guru: "Guru", karyawan: "Pegawai" };

function badgeVariantForStatus(status: string): "success" | "error" | "warning" | "info" | "muted" {
  if (status === "Hadir") return "success";
  if (status === "Terlambat") return "warning";
  if (status === "Sakit" || status === "Izin") return "info";
  if (status === "Menunggu Persetujuan") return "warning";
  if (status === "Alfa") return "error";
  return "muted";
}

// `role` tidak dipakai lagi - dipertahankan supaya pemanggil lama (RootNavigator, MainTabs) tidak perlu diubah.
interface Props { role?: RoleName; onNavigate?: (screen: string, params?: Record<string, unknown>) => void; }

export function PresensiAdminTU({ onNavigate }: Props = {}) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [akses, setAkses] = useState<Akses | null>(null);
  const [aksesError, setAksesError] = useState("");
  const [tab, setTab] = useState<Entitas | null>(null);
  const [search, setSearch] = useState("");
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(getTodayLocal());
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [selectedClass, setSelectedClass] = useState(""); // "tingkat|kelas" atau "" = semua
  const sudahMuat = useRef(false);
  // Nomor permintaan terbaru - jawaban permintaan lama (mis. penyegaran otomatis yang sempat berangkat sebelum tanggal/
  // tab diganti) dibuang supaya tidak menimpa data pilihan terbaru.
  const idMuat = useRef(0);

  useEffect(() => {
    api.attendanceAkses().then((res: any) => {
      if (res.success) { setAkses(res.data); setTab(res.data.tabHarian[0] ?? null); }
      else setAksesError(res.message ?? "Gagal memuat hak akses presensi.");
    });
  }, []);

  const bolehPilihKelas = akses?.siswa === "semua" || akses?.siswa === "unit";
  useEffect(() => {
    if (bolehPilihKelas && tab === "siswa") {
      api.attendanceClasses().then((res) => { if (res.success) setClassOptions(res.data); });
    }
  }, [bolehPilihKelas, tab]);

  // senyap=true: penyegaran otomatis - tanpa "Memuat..." (kecuali muat pertama setelah tab/tanggal/kelas berganti), dan
  // tidak menyentuh tab/tanggal/kelas/pencarian/posisi scroll pilihan pengguna.
  async function muat(senyap = false) {
    if (!tab) return;
    const id = ++idMuat.current;
    if (!senyap || !sudahMuat.current) setLoading(true);
    const [tingkat, kelas] = selectedClass ? selectedClass.split("|") : [undefined, undefined];
    const res = await api.attendanceAllFiltered(tab, date, tingkat, kelas);
    if (id !== idMuat.current) return;
    if (res.success) setRecords(res.data);
    sudahMuat.current = true;
    setLoading(false);
  }

  useEffect(() => {
    sudahMuat.current = false;
    muat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, date, selectedClass]);

  // Presensi yang tercatat di tempat lain (kiosk wajah, HP lain) langsung muncul tanpa tarik-refresh manual.
  useAutoRefresh(() => muat(true), 20000);

  const filtered = records.filter((r) => r.entity_name.toLowerCase().includes(search.toLowerCase()));
  const hadirCount = records.filter((r) => r.status === "Hadir" || r.status === "Terlambat").length;
  const classPickerOptions = [{ value: "", label: "Semua Kelas" }, ...classOptions.map((c) => ({ value: `${c.tingkat}|${c.kelas}`, label: c.label }))];

  if (aksesError) {
    return <View className="flex-1 bg-background px-4 pt-5"><Text className="text-sm text-red-500 text-center py-6">{aksesError}</Text></View>;
  }
  if (!akses) {
    return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator color={colors.primary} /></View>;
  }
  if (akses.tabHarian.length === 0 || !tab) {
    return (
      <View className="flex-1 bg-background px-4 pt-5">
        <Text className="text-sm text-muted-foreground text-center py-6">Akun ini tidak punya akses melihat rekap kehadiran.</Text>
      </View>
    );
  }

  const subJudul = akses.siswa === "kelas" && akses.kelasSendiri ? `Kelas ${akses.kelasSendiri.label}` : akses.stafHanyaDiri ? "Kehadiran Anda" : null;

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 pt-5">
        <View className="bg-primary rounded-xl p-4">
          <Text className="text-primary-foreground text-xs">Rekap Kehadiran{subJudul ? ` · ${subJudul}` : ""}</Text>
          <Text className="text-primary-foreground font-bold text-base mt-0.5">{new Date(date + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</Text>
          <View className="mt-2">
            <Text className="text-primary-foreground text-xs">Total Tercatat Hadir</Text>
            <Text className="text-primary-foreground font-bold text-lg">{hadirCount}</Text>
          </View>
        </View>

        {akses.scopeBulanan.length > 0 && onNavigate && (
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
          {bolehPilihKelas && tab === "siswa" && classOptions.length > 0 && (
            <SimplePicker value={selectedClass} options={classPickerOptions} onChange={setSelectedClass} placeholder="Semua Kelas" />
          )}
        </View>

        <View className="mt-3"><Input placeholder={`Cari ${LABEL_TAB[tab].toLowerCase()}...`} value={search} onChangeText={setSearch} icon={<Search size={18} color={colors.mutedForeground} />} /></View>

        {akses.tabHarian.length > 1 && (
          <View className="flex-row gap-2 p-1 bg-muted rounded-xl mt-4">
            {akses.tabHarian.map((t) => (
              <Pressable key={t} onPress={() => { setTab(t); setSelectedClass(""); }} className={`flex-1 py-2 rounded-lg items-center ${tab === t ? "bg-card" : ""}`}>
                <Text className={`text-sm font-medium ${tab === t ? "text-foreground" : "text-muted-foreground"}`}>{LABEL_TAB[t]}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <FlatList
        className="flex-1 px-4 mt-4"
        contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 8 }}
        data={loading ? [] : filtered}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={<Text className="text-sm text-muted-foreground text-center py-6">{loading ? "Memuat..." : "Belum ada presensi tercatat tanggal ini."}</Text>}
        renderItem={({ item }) => (
          <Card padding="sm">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center"><Text className="text-primary font-bold text-sm">{item.entity_name.charAt(0)}</Text></View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground">{item.entity_name}</Text>
                <Text className="text-xs text-muted-foreground">{item.kelas_nama ?? item.jabatan ?? LABEL_TAB[tab]} {item.check_in_time ? `· ${item.check_in_time} WIB` : ""}</Text>
              </View>
              <Badge variant={badgeVariantForStatus(item.status)}>{item.status}</Badge>
            </View>
          </Card>
        )}
      />
    </View>
  );
}

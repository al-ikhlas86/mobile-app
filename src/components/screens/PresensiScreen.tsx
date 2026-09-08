import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, RefreshControl, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { MapPin, LogIn, LogOut, ClipboardList, ChevronRight, CalendarCheck, FileWarning, Send, Paperclip } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { SimplePicker } from "../ui/SimplePicker";
import { SimpleCalendarPicker } from "../ui/SimpleCalendarPicker";
import { api } from "../../services/api";
import { getTodayLocal } from "../../utils/formatters";
import { useThemeColors } from "../../context/ThemeContext";

interface Props {
  role: string;
  // Guru Kelas jadi FLAG (2026-09-04, Fase 3) - dulu dibaca dari
  // `role === "Guru Kelas"`, sekarang di-thread sbg prop terpisah.
  isWaliKelas?: boolean;
  onNavigate: (screen: string, params?: Record<string, unknown>) => void;
}

interface AttendanceRow {
  tanggal: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
}

interface Statistik {
  total_active_days: number;
  days_present: number;
  absent_count: number;
  late_count: number;
  late_disabled: boolean;
  attendance_percentage: number;
}

const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const JENIS_OPTIONS = [
  { value: "sakit", label: "Sakit" },
  { value: "izin", label: "Izin (Ada Keperluan)" },
  { value: "terlambat", label: "Terlambat (kasih tahu lebih dulu)" },
];

// Ambang akurasi sama dgn default server (checkin_max_accuracy_meters di
// Absen) - cuma dipakai di sini utk keputusan RETRY sblm kirim ke server,
// bukan menggantikan validasi server (server tetap penentu akhir, admin
// bisa ubah ambangnya kapan saja tanpa aplikasi ini perlu tahu).
const GPS_ACCURACY_TARGET_M = 50;
const GPS_RETRY_MAX_ATTEMPTS = 3;
const GPS_RETRY_DELAY_MS = 2500;

// Diminta user 2026-08-29 - "presensi sempet beberapa kali gagal padahal
// udah nyalain gps, terus baru akhirnya bisa". Akar masalah: fix GPS
// PERTAMA setelah GPS baru dinyalakan/lokasi baru dibuka seringkali masih
// kasar (network-based, bisa 100-500m+) sebelum satelit benar2 terkunci -
// server menolaknya (akurasi > 50m) dan sebelumnya user harus tap tombol
// Masuk/Pulang ULANG SENDIRI berkali-kali sampai kebetulan dapat fix yang
// bagus. Sekarang aplikasi yang menunggu/mencoba ulang di belakang layar
// (server TETAP jadi penentu akhir, ini cuma mengurangi kegagalan yang
// sebenarnya bisa dihindari dgn menunggu sebentar).
async function getAccuratePosition(
  onAttempt?: (attempt: number, max: number) => void
): Promise<Location.LocationObject> {
  let best: Location.LocationObject | null = null;
  for (let attempt = 1; attempt <= GPS_RETRY_MAX_ATTEMPTS; attempt++) {
    onAttempt?.(attempt, GPS_RETRY_MAX_ATTEMPTS);
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation });
    if (!best || (pos.coords.accuracy ?? Infinity) < (best.coords.accuracy ?? Infinity)) {
      best = pos;
    }
    if ((pos.coords.accuracy ?? Infinity) <= GPS_ACCURACY_TARGET_M) {
      return pos;
    }
    if (attempt < GPS_RETRY_MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, GPS_RETRY_DELAY_MS));
    }
  }
  return best!; // belum cukup akurat setelah semua percobaan - tetap kirim yg terbaik, biar server yg putuskan
}

function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

// Status Izin/Sakit/Menunggu/Alfa/Libur sekarang beneran bervariasi
// (sebelumnya server SELALU balikin 'Hadir' apa adanya, lihat
// AttendanceStatusResolver baru di Absen).
function badgeVariantForStatus(status: string): "success" | "error" | "warning" | "info" | "muted" {
  if (status === "Hadir") return "success";
  if (status === "Terlambat") return "warning";
  if (status === "Sakit" || status === "Izin") return "info";
  if (status === "Menunggu Persetujuan") return "warning";
  if (status === "Alfa") return "error";
  return "muted"; // Libur
}

export function PresensiScreen({ role, isWaliKelas, onNavigate }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [activeTab, setActiveTab] = useState<"hadir" | "izin">("hadir");
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statistik, setStatistik] = useState<Statistik | null>(null);
  const [checkinBusy, setCheckinBusy] = useState<"masuk" | "pulang" | null>(null);
  const [checkinMessage, setCheckinMessage] = useState<{ text: string; kind: "ok" | "error" | "progress" } | null>(null);

  const [izinTanggal, setIzinTanggal] = useState(getTodayLocal());
  const [izinJenis, setIzinJenis] = useState<"sakit" | "izin" | "terlambat">("sakit");
  const [izinKeterangan, setIzinKeterangan] = useState("");
  const [izinFoto, setIzinFoto] = useState<{ uri: string; mimeType?: string; name: string } | null>(null);
  const [izinBusy, setIzinBusy] = useState(false);
  const [izinMessage, setIzinMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const load = async () => {
    const [res, statRes] = await Promise.all([api.attendanceMe(), api.attendanceStatistikMe()]);
    if (res.success) setRecords(res.data);
    if (statRes.success) setStatistik(statRes.data);
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, []));

  async function handleCheckin(type: "masuk" | "pulang") {
    setCheckinBusy(type);
    setCheckinMessage(null);

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setCheckinBusy(null);
      setCheckinMessage({ text: "Izin lokasi ditolak. Aktifkan izin lokasi utk aplikasi ini di Pengaturan HP.", kind: "error" });
      return;
    }

    try {
      const pos = await getAccuratePosition((attempt, max) => {
        setCheckinMessage(
          attempt === 1
            ? { text: "Mencari lokasi GPS...", kind: "progress" }
            : { text: `Sinyal GPS belum stabil, mencoba lagi (${attempt}/${max})...`, kind: "progress" }
        );
      });
      // pos.mocked - field ASLI Android bawaan expo-location (bukan
      // heuristik) - true kalau lokasi berasal dari aplikasi mock-GPS.
      // Server (Absen) tetap jadi penentu akhir tolak/terima, ini cuma
      // supaya UX cepat (tidak perlu tunggu roundtrip server dulu utk
      // kasus yang jelas-jelas palsu).
      const res = await api.attendanceCheckin(type, pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy ?? undefined, pos.mocked === true, pos.timestamp);
      setCheckinBusy(null);
      setCheckinMessage({ text: res.message ?? (res.success ? "Presensi berhasil." : "Presensi gagal."), kind: res.success ? "ok" : "error" });
      if (res.success) load();
    } catch {
      setCheckinBusy(null);
      setCheckinMessage({ text: "Gagal mendapatkan lokasi GPS. Pastikan GPS aktif dan coba lagi.", kind: "error" });
    }
  }

  async function handlePickFoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setIzinFoto({ uri: asset.uri, mimeType: asset.mimeType ?? "image/jpeg", name: asset.fileName ?? "bukti.jpg" });
  }

  async function handleSubmitIzin() {
    if (!izinKeterangan.trim()) {
      setIzinMessage({ text: "Alasan/keterangan wajib diisi.", ok: false });
      return;
    }
    setIzinBusy(true);
    setIzinMessage(null);
    const res = await api.leaveSubmit({
      tanggal: izinTanggal,
      jenis: izinJenis,
      keterangan: izinKeterangan.trim(),
      buktiFotoUri: izinFoto?.uri,
      buktiFotoMime: izinFoto?.mimeType,
    });
    setIzinBusy(false);
    setIzinMessage({ text: res.message ?? (res.success ? "Pengajuan terkirim." : "Pengajuan gagal."), ok: !!res.success });
    if (res.success) {
      setIzinKeterangan("");
      setIzinFoto(null);
      load();
    }
  }

  const today = getTodayLocal();
  const todayRecord = records.find((r) => r.tanggal === today);

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 pt-5">
        <View className="flex-row gap-2 p-1 bg-muted rounded-xl">
          <Pressable onPress={() => setActiveTab("hadir")} className={`flex-1 py-2.5 rounded-lg flex-row items-center justify-center gap-1.5 ${activeTab === "hadir" ? "bg-card" : ""}`}>
            <CalendarCheck size={15} color={activeTab === "hadir" ? colors.primary : colors.mutedForeground} />
            <Text className={`text-sm font-medium ${activeTab === "hadir" ? "text-foreground" : "text-muted-foreground"}`}>Hadir</Text>
          </Pressable>
          <Pressable onPress={() => setActiveTab("izin")} className={`flex-1 py-2.5 rounded-lg flex-row items-center justify-center gap-1.5 ${activeTab === "izin" ? "bg-card" : ""}`}>
            <FileWarning size={15} color={activeTab === "izin" ? colors.primary : colors.mutedForeground} />
            <Text className={`text-sm font-medium ${activeTab === "izin" ? "text-foreground" : "text-muted-foreground"}`}>Izin / Sakit</Text>
          </Pressable>
        </View>
      </View>

      {activeTab === "izin" ? (
        <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
          <Card padding="lg">
            <Text className="text-sm font-semibold text-foreground mb-1">Ajukan Izin / Sakit / Terlambat</Text>
            <Text className="text-xs text-muted-foreground mb-4">Pengajuan Sakit/Izin berstatus Menunggu Persetujuan sampai disetujui Kepala Sekolah - jika ditolak, hari itu dianggap Alfa. Pengajuan Terlambat cuma catatan alasan di muka - Anda tetap wajib presensi Masuk seperti biasa nanti.</Text>
            <View className="gap-3">
              <View>
                <Text className="text-xs font-medium text-foreground mb-1.5">Tanggal</Text>
                <SimpleCalendarPicker value={izinTanggal} onChange={setIzinTanggal} />
              </View>
              <View>
                <Text className="text-xs font-medium text-foreground mb-1.5">Jenis Pengajuan</Text>
                <SimplePicker value={izinJenis} options={JENIS_OPTIONS} onChange={(v) => setIzinJenis(v as "sakit" | "izin" | "terlambat")} />
              </View>
              <View>
                <Text className="text-xs font-medium text-foreground mb-1.5">Alasan / Keterangan</Text>
                <Input value={izinKeterangan} onChangeText={setIzinKeterangan} placeholder="Tuliskan alasan izin/sakit..." multiline numberOfLines={3} style={{ minHeight: 80, textAlignVertical: "top", paddingTop: 12 }} />
              </View>
              <View>
                <Text className="text-xs font-medium text-foreground mb-1.5">Unggah Bukti Foto (Surat Dokter/Izin) - opsional</Text>
                <Pressable onPress={handlePickFoto} className="flex-row items-center gap-2 border border-dashed border-border rounded-xl px-3 py-3">
                  <Paperclip size={15} color={colors.mutedForeground} />
                  <Text className="text-sm text-muted-foreground flex-1" numberOfLines={1}>{izinFoto ? izinFoto.name : "Pilih file foto..."}</Text>
                </Pressable>
              </View>
              <Button onPress={handleSubmitIzin} disabled={izinBusy} loading={izinBusy} className="mt-1">
                <Send size={14} color={colors.primaryForeground} />{"  "}Kirim Form Izin/Sakit
              </Button>
              {izinMessage && (
                <Text className={`text-xs text-center ${izinMessage.ok ? "text-green-600" : "text-red-500"}`}>{izinMessage.text}</Text>
              )}
            </View>
          </Card>
        </ScrollView>
      ) : (
        <ScrollView
          className="flex-1 px-4 pt-4"
          contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          <Card padding="md">
            <View className="flex-row items-center gap-1.5 mb-2">
              <MapPin size={14} color={colors.primary} />
              <Text className="text-xs font-semibold text-foreground">Presensi via Aplikasi</Text>
            </View>
            <Text className="text-xs text-muted-foreground mb-2.5">Lokasi GPS wajib berada di area Yayasan.</Text>
            <View className="flex-row gap-2">
              <Button size="sm" className="flex-1" onPress={() => handleCheckin("masuk")} disabled={checkinBusy !== null}>
                {checkinBusy === "masuk" ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : <LogIn size={13} color={colors.primaryForeground} />}
                {"  "}Masuk
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onPress={() => handleCheckin("pulang")} disabled={checkinBusy !== null}>
                {checkinBusy === "pulang" ? <ActivityIndicator size="small" color={colors.primary} /> : <LogOut size={13} color={colors.primary} />}
                {"  "}Pulang
              </Button>
            </View>
            {checkinMessage && (
              <Text
                className={`text-xs mt-2 text-center ${
                  checkinMessage.kind === "ok" ? "text-green-600" : checkinMessage.kind === "error" ? "text-red-500" : "text-muted-foreground"
                }`}
              >
                {checkinMessage.text}
              </Text>
            )}
          </Card>

          <Card padding="sm" onPress={() => onNavigate("presensi-admin-tu")}>
            <View className="flex-row items-center gap-3">
              <View className="w-9 h-9 rounded-lg bg-primary/10 items-center justify-center">
                <ClipboardList size={16} color={colors.primary} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground">Rekap Kehadiran</Text>
                <Text className="text-xs text-muted-foreground">{isWaliKelas ? "Kehadiran Anda & siswa kelas Anda" : "Kehadiran Anda"}</Text>
              </View>
              <ChevronRight size={16} color={colors.mutedForeground} />
            </View>
          </Card>

          <Card padding="lg">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-sm font-semibold text-foreground">Status Hari Ini</Text>
              {todayRecord ? <Badge variant={badgeVariantForStatus(todayRecord.status)}>{todayRecord.status}</Badge> : <Badge variant="warning">Belum Presensi</Badge>}
            </View>
            <View className="flex-row gap-4">
              <View className="flex-1 items-center p-3 bg-muted rounded-xl gap-1">
                <Text className="text-xs text-muted-foreground">Jam Masuk</Text>
                <Text className="text-base font-bold text-foreground">{todayRecord?.check_in_time ? `${todayRecord.check_in_time} WIB` : "—"}</Text>
              </View>
              <View className="flex-1 items-center p-3 bg-muted rounded-xl gap-1">
                <Text className="text-xs text-muted-foreground">Jam Pulang</Text>
                <Text className="text-base font-bold text-foreground">{todayRecord?.check_out_time ? `${todayRecord.check_out_time} WIB` : "—"}</Text>
              </View>
            </View>
          </Card>

          {statistik && (
            <Card padding="lg">
              <Text className="text-sm font-semibold text-foreground mb-1">Statistik {MONTH_NAMES[new Date().getMonth()]} {new Date().getFullYear()}</Text>
              <Text className="text-xs text-muted-foreground mb-4">Sumber: sistem Absen sekolah, sama dengan yang dilihat admin.</Text>
              <View className="flex-row gap-3">
                <View className="flex-1 items-center p-3 bg-primary/10 rounded-xl gap-1">
                  <Text className="text-xl font-bold text-primary">{statistik.attendance_percentage}%</Text>
                  <Text className="text-xs text-muted-foreground text-center">Kehadiran</Text>
                </View>
                <View className="flex-1 items-center p-3 bg-muted rounded-xl gap-1">
                  <Text className="text-xl font-bold text-foreground">{statistik.days_present}/{statistik.total_active_days}</Text>
                  <Text className="text-xs text-muted-foreground text-center">Hari Hadir</Text>
                </View>
                <View className="flex-1 items-center p-3 bg-muted rounded-xl gap-1">
                  <Text className="text-xl font-bold text-foreground">{statistik.late_disabled ? "—" : statistik.late_count}</Text>
                  <Text className="text-xs text-muted-foreground text-center">Kali Telat</Text>
                </View>
              </View>
            </Card>
          )}

          <View>
            <Text className="text-sm font-semibold text-foreground mb-3">Riwayat Presensi</Text>
            {loading ? (
              <Text className="text-sm text-muted-foreground text-center py-4">Memuat...</Text>
            ) : records.length === 0 ? (
              <Text className="text-sm text-muted-foreground text-center py-4">Belum ada riwayat presensi.</Text>
            ) : (
              <View className="gap-2">
                {records.map((r, idx) => (
                  <Card key={idx} padding="sm">
                    <View className="flex-row items-center gap-3">
                      <View className="flex-1">
                        <Text className="text-sm font-medium text-foreground">{formatDateFull(r.tanggal)}</Text>
                        <View className="flex-row gap-3 mt-0.5">
                          <Text className="text-xs text-muted-foreground">Masuk: {r.check_in_time ?? "—"}</Text>
                          <Text className="text-xs text-muted-foreground">Pulang: {r.check_out_time ?? "—"}</Text>
                        </View>
                      </View>
                      <Badge variant={badgeVariantForStatus(r.status)}>{r.status}</Badge>
                    </View>
                  </Card>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

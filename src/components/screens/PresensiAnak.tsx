import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Pressable } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { CheckCircle, Calendar, Clock, AlertCircle, CalendarCheck, FileWarning, Send, Paperclip } from "lucide-react-native";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { SimplePicker } from "../ui/SimplePicker";
import { SimpleCalendarPicker } from "../ui/SimpleCalendarPicker";
import { api } from "../../services/api";
import { getTodayLocal } from "../../utils/formatters";

interface ChildData { id: number; nama: string; kelas_nama: string | null; }
interface AttendanceRow { student_cache_id: number; tanggal: string; check_in_time: string | null; check_out_time: string | null; status: string; }
interface Statistik { total_active_days: number; days_present: number; absent_count: number; late_count: number; late_disabled: boolean; attendance_percentage: number; }

const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const JENIS_OPTIONS = [{ value: "sakit", label: "Sakit" }, { value: "izin", label: "Izin (Ada Keperluan)" }];

function initials(name: string): string { return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join(""); }
function formatDateFull(dateStr: string): string { return new Date(dateStr).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); }

function badgeVariantForStatus(status: string): "success" | "error" | "warning" | "info" | "muted" {
  if (status === "Hadir") return "success";
  if (status === "Terlambat") return "warning";
  if (status === "Sakit" || status === "Izin") return "info";
  if (status === "Menunggu Persetujuan") return "warning";
  if (status === "Alfa") return "error";
  return "muted";
}

export function PresensiAnak() {
  const [activeTab, setActiveTab] = useState<"hadir" | "izin">("hadir");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [child, setChild] = useState<ChildData | null>(null);
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [statistik, setStatistik] = useState<Statistik | null>(null);

  const [izinTanggal, setIzinTanggal] = useState(getTodayLocal());
  const [izinJenis, setIzinJenis] = useState<"sakit" | "izin">("sakit");
  const [izinKeterangan, setIzinKeterangan] = useState("");
  const [izinFoto, setIzinFoto] = useState<{ uri: string; mimeType?: string; name: string } | null>(null);
  const [izinBusy, setIzinBusy] = useState(false);
  const [izinMessage, setIzinMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const load = async () => {
    setLoading(true);
    const [childrenRes, attendanceRes] = await Promise.all([api.myChildren(), api.attendanceMyChildren()]);
    if (childrenRes.success) {
      const firstChild = childrenRes.data[0] ?? null;
      setChild(firstChild);
      if (firstChild) {
        const statRes = await api.attendanceStatistikAnak(firstChild.id);
        if (statRes.success) setStatistik(statRes.data);
      }
    } else setError(childrenRes.message ?? "Gagal memuat data anak.");
    if (attendanceRes.success) setRecords(attendanceRes.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  async function handlePickFoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setIzinFoto({ uri: asset.uri, mimeType: asset.mimeType ?? "image/jpeg", name: asset.fileName ?? "bukti.jpg" });
  }

  async function handleSubmitIzin() {
    if (!child) return;
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
      studentCacheId: child.id,
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

  if (loading) return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator color="#356447" /></View>;
  if (error || !child) {
    return (
      <View className="flex-1 items-center justify-center bg-background gap-3 px-8">
        <AlertCircle size={32} color="#6E776F" />
        <Text className="text-sm text-muted-foreground text-center">{error || "Belum ada data anak yang tertaut ke akun ini."}</Text>
      </View>
    );
  }

  const childRecords = records.filter((r) => r.student_cache_id === child.id).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  const today = getTodayLocal();
  const todayRecord = childRecords.find((r) => r.tanggal === today);

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 pt-5">
        <Card padding="md" className="bg-primary border-0">
          <View className="flex-row items-center gap-4">
            <View className="w-12 h-12 rounded-full bg-white/20 items-center justify-center"><Text className="text-white font-bold text-lg">{initials(child.nama)}</Text></View>
            <View>
              <Text className="text-white font-bold text-base">{child.nama}</Text>
              <Text className="text-white/80 text-sm">{child.kelas_nama ? `Kelas ${child.kelas_nama}` : "Kelas belum diatur"}</Text>
            </View>
          </View>
        </Card>

        <View className="flex-row gap-2 p-1 bg-muted rounded-xl mt-4">
          <Pressable onPress={() => setActiveTab("hadir")} className={`flex-1 py-2.5 rounded-lg flex-row items-center justify-center gap-1.5 ${activeTab === "hadir" ? "bg-card" : ""}`}>
            <CalendarCheck size={15} color={activeTab === "hadir" ? "#356447" : "#6E776F"} />
            <Text className={`text-sm font-medium ${activeTab === "hadir" ? "text-foreground" : "text-muted-foreground"}`}>Hadir</Text>
          </Pressable>
          <Pressable onPress={() => setActiveTab("izin")} className={`flex-1 py-2.5 rounded-lg flex-row items-center justify-center gap-1.5 ${activeTab === "izin" ? "bg-card" : ""}`}>
            <FileWarning size={15} color={activeTab === "izin" ? "#356447" : "#6E776F"} />
            <Text className={`text-sm font-medium ${activeTab === "izin" ? "text-foreground" : "text-muted-foreground"}`}>Izin / Sakit</Text>
          </Pressable>
        </View>
      </View>

      {activeTab === "izin" ? (
        <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 32 }}>
          <Card padding="lg">
            <Text className="text-sm font-semibold text-foreground mb-1">Ajukan Izin / Sakit untuk {child.nama}</Text>
            <Text className="text-xs text-muted-foreground mb-4">Pengajuan akan berstatus Menunggu Persetujuan sampai disetujui Guru Kelas. Jika ditolak, hari itu dianggap Alfa.</Text>
            <View className="gap-3">
              <View>
                <Text className="text-xs font-medium text-foreground mb-1.5">Tanggal</Text>
                <SimpleCalendarPicker value={izinTanggal} onChange={setIzinTanggal} />
              </View>
              <View>
                <Text className="text-xs font-medium text-foreground mb-1.5">Jenis Pengajuan</Text>
                <SimplePicker value={izinJenis} options={JENIS_OPTIONS} onChange={(v) => setIzinJenis(v as "sakit" | "izin")} />
              </View>
              <View>
                <Text className="text-xs font-medium text-foreground mb-1.5">Alasan / Keterangan</Text>
                <Input value={izinKeterangan} onChangeText={setIzinKeterangan} placeholder="Tuliskan alasan izin/sakit..." multiline numberOfLines={3} style={{ minHeight: 80, textAlignVertical: "top", paddingTop: 12 }} />
              </View>
              <View>
                <Text className="text-xs font-medium text-foreground mb-1.5">Unggah Bukti Foto (Surat Dokter/Izin) - opsional</Text>
                <Pressable onPress={handlePickFoto} className="flex-row items-center gap-2 border border-dashed border-border rounded-xl px-3 py-3">
                  <Paperclip size={15} color="#6E776F" />
                  <Text className="text-sm text-muted-foreground flex-1" numberOfLines={1}>{izinFoto ? izinFoto.name : "Pilih file foto..."}</Text>
                </Pressable>
              </View>
              <Button onPress={handleSubmitIzin} disabled={izinBusy} loading={izinBusy} className="mt-1">
                <Send size={14} color="#fff" />{"  "}Kirim Form Izin/Sakit
              </Button>
              {izinMessage && (
                <Text className={`text-xs text-center ${izinMessage.ok ? "text-green-600" : "text-red-500"}`}>{izinMessage.text}</Text>
              )}
            </View>
          </Card>
        </ScrollView>
      ) : (
        <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 32, gap: 20 }}>
          <Card padding="lg">
            <View className="flex-row items-center gap-2 mb-4">
              <Calendar size={18} color="#356447" />
              <Text className="text-sm font-semibold text-foreground">{formatDateFull(today)}</Text>
            </View>
            {todayRecord ? (
              <View className="flex-row items-center justify-between p-4 bg-green-50 rounded-xl border border-green-200">
                <View className="flex-row items-center gap-3">
                  <CheckCircle size={24} color="#16a34a" />
                  <View>
                    <Text className="text-sm font-bold text-green-700">{todayRecord.status}</Text>
                    <Text className="text-xs text-green-600/70">Anak masuk sekolah hari ini</Text>
                  </View>
                </View>
                {todayRecord.check_in_time && (
                  <View className="items-end">
                    <Text className="text-xs text-muted-foreground">Jam Masuk</Text>
                    <Text className="text-sm font-bold text-foreground">{todayRecord.check_in_time} WIB</Text>
                  </View>
                )}
              </View>
            ) : (
              <Text className="text-sm text-muted-foreground text-center py-4">Data presensi hari ini belum tersedia</Text>
            )}
          </Card>

          {statistik ? (
            <Card padding="lg">
              <Text className="text-sm font-semibold text-foreground mb-1">Statistik {MONTH_NAMES[new Date().getMonth()]} {new Date().getFullYear()}</Text>
              <Text className="text-xs text-muted-foreground mb-4">Sumber: sistem Absen sekolah, sama dengan yang dilihat admin.</Text>
              <View className="flex-row gap-3">
                <View className="flex-1 items-center p-3 bg-primary/10 rounded-xl gap-1"><Text className="text-xl font-bold text-primary">{statistik.attendance_percentage}%</Text><Text className="text-xs text-muted-foreground text-center">Kehadiran</Text></View>
                <View className="flex-1 items-center p-3 bg-muted rounded-xl gap-1"><Text className="text-xl font-bold text-foreground">{statistik.days_present}/{statistik.total_active_days}</Text><Text className="text-xs text-muted-foreground text-center">Hari Hadir</Text></View>
                <View className="flex-1 items-center p-3 bg-muted rounded-xl gap-1"><Text className="text-xl font-bold text-foreground">{statistik.late_disabled ? "—" : statistik.late_count}</Text><Text className="text-xs text-muted-foreground text-center">Kali Telat</Text></View>
              </View>
            </Card>
          ) : (
            <Card padding="md"><Text className="text-xs text-muted-foreground">Statistik presensi belum tersedia dari sistem Absen.</Text></Card>
          )}

          <View>
            <Text className="text-sm font-semibold text-foreground mb-3">Riwayat Presensi Anak</Text>
            {childRecords.length === 0 && <Text className="text-sm text-muted-foreground text-center py-4">Belum ada riwayat presensi.</Text>}
            <View className="gap-2">
              {childRecords.map((r, idx) => (
                <Card key={idx} padding="sm">
                  <View className="flex-row items-center gap-3">
                    <View className="flex-1">
                      <Text className="text-sm font-medium text-foreground">{formatDateFull(r.tanggal)}</Text>
                      <Text className="text-xs text-muted-foreground mt-0.5">{r.check_in_time ? `Masuk: ${r.check_in_time} WIB` : "Tidak ada catatan masuk"}{r.check_out_time ? ` · Pulang: ${r.check_out_time} WIB` : ""}</Text>
                    </View>
                    <Badge variant={badgeVariantForStatus(r.status)}>{r.status}</Badge>
                  </View>
                </Card>
              ))}
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, Linking } from "react-native";
import { Printer, ChevronLeft, ChevronRight } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { SimplePicker } from "../ui/SimplePicker";
import { api, API_URL } from "../../services/api";
import { getActiveSession, type RoleName } from "../../services/authService";
import { useThemeColors } from "../../context/ThemeContext";

interface ClassOption { tingkat: string; kelas: string; label: string; }
interface MatrixRow { id: number; nama: string; harian: Record<string, string>; totals: { H: number; T: number; I: number; S: number; A: number }; }

const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const STATUS_BG: Record<string, string> = {
  H: "#ecfdf5", T: "#fffbeb", I: "#eff6ff", S: "#eff6ff", A: "#fef2f2", L: "#f4f4f5", M: "#fffbeb",
};
const STATUS_TEXT: Record<string, string> = {
  H: "#047857", T: "#b45309", I: "#1d4ed8", S: "#1d4ed8", A: "#b91c1c", L: "#71717a", M: "#b45309",
};
const CELL_W = 28;
const NAME_W = 130;

// admin_tu_sd/tk DIGABUNG jadi generik (2026-09-14, Sistem Katalog) - nama
// lama TETAP dicek (pola "legacy names") jaga2 sesi lama.
const UNRESTRICTED_ROLES: RoleName[] = ["Admin IT", "Supervisor", "Admin TU", "Admin TU (SD)", "Admin TU (TK & Playground)", "Keuangan"];

// isKepalaSekolah (2026-09-04) - FLAG di atas role dasar, BUKAN lagi role
// "Kepala Sekolah (SD/TK)" terpisah.
export function RekapitulasiKehadiranScreen({ role }: { role?: RoleName }) {
  const colors = useThemeColors();
  // isKeuanganCap (2026-09-21) - port 1:1 dari perbaikan webview - Keuangan
  // via capability (role dasar tetap Guru/Pegawai) luput dari cek literal
  // role di bawah, jadi terjebak scope=kelas tanpa picker (403).
  const isKeuanganCap = (getActiveSession()?.capabilities ?? []).includes("keuangan");
  const isAdmin = !role || getActiveSession()?.isKepalaSekolah === true || isKeuanganCap || UNRESTRICTED_ROLES.includes(role);
  const [scope, setScope] = useState<"kelas" | "pegawai">("kelas");
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [now] = useState(new Date());
  const [bulan, setBulan] = useState(now.getMonth() + 1);
  const [tahun, setTahun] = useState(now.getFullYear());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [judul, setJudul] = useState("");
  const [rows, setRows] = useState<MatrixRow[]>([]);
  const [daysInMonth, setDaysInMonth] = useState(30);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      api.attendanceClasses().then((res) => {
        if (res.success) {
          setClassOptions(res.data);
          if (res.data[0]) setSelectedClass(`${res.data[0].tingkat}|${res.data[0].kelas}`);
        }
      });
    }
  }, [isAdmin]);

  useEffect(() => {
    (async () => {
      if (scope === "kelas" && isAdmin && !selectedClass) return;
      setLoading(true);
      setError("");
      const [tingkat, kelas] = selectedClass ? selectedClass.split("|") : [undefined, undefined];
      const res = await api.attendanceMonthlyMatrix(scope, { tingkat, kelas, bulan, tahun });
      if (res.success) {
        setRows(res.data);
        setJudul(res.meta.judul);
        setDaysInMonth(res.meta.days_in_month);
      } else {
        setError(res.message ?? "Gagal memuat rekapitulasi.");
        setRows([]);
      }
      setLoading(false);
    })();
  }, [scope, selectedClass, bulan, tahun, isAdmin]);

  function changeMonth(delta: number) {
    let m = bulan + delta;
    let y = tahun;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setBulan(m);
    setTahun(y);
  }

  async function handleDownloadPdf() {
    setDownloading(true);
    const [tingkat, kelas] = selectedClass ? selectedClass.split("|") : [undefined, undefined];
    const res = await api.attendanceMonthlyMatrixDownloadLink(scope, { tingkat, kelas, bulan, tahun });
    setDownloading(false);
    if (res.success) {
      Linking.openURL(`${API_URL}${res.path}`);
    }
  }

  const scopeOptions = [{ value: "kelas", label: "Siswa per Kelas" }, { value: "pegawai", label: "Guru & Pegawai" }];
  const classPickerOptions = classOptions.map((c) => ({ value: `${c.tingkat}|${c.kelas}`, label: c.label }));

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 pt-5 pb-3 gap-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-1 bg-muted rounded-xl p-1">
            <Pressable onPress={() => changeMonth(-1)} className="p-1.5 rounded-lg"><ChevronLeft size={16} color={colors.primary} /></Pressable>
            <Text className="text-sm font-medium text-foreground px-2" style={{ minWidth: 110, textAlign: "center" }}>{MONTH_NAMES[bulan - 1]} {tahun}</Text>
            <Pressable onPress={() => changeMonth(1)} className="p-1.5 rounded-lg"><ChevronRight size={16} color={colors.primary} /></Pressable>
          </View>
          <Button size="sm" variant="outline" onPress={handleDownloadPdf} disabled={downloading || rows.length === 0} loading={downloading}>
            <Printer size={14} color={colors.primary} />{"  "}Cetak/PDF
          </Button>
        </View>

        {isAdmin && (
          <View className="gap-2">
            <SimplePicker value={scope} options={scopeOptions} onChange={(v) => { setScope(v as "kelas" | "pegawai"); setSelectedClass(""); }} />
            {scope === "kelas" && classPickerOptions.length > 0 && (
              <SimplePicker value={selectedClass} options={classPickerOptions} onChange={setSelectedClass} />
            )}
          </View>
        )}

        {!!judul && <Text className="text-sm font-semibold text-foreground">{judul}</Text>}
      </View>

      {loading ? (
        <Text className="text-sm text-muted-foreground text-center py-6">Memuat...</Text>
      ) : error ? (
        <Text className="text-sm text-red-500 text-center py-6">{error}</Text>
      ) : rows.length === 0 ? (
        <Text className="text-sm text-muted-foreground text-center py-6">Tidak ada data.</Text>
      ) : (
        <ScrollView horizontal className="px-4" contentContainerStyle={{ paddingBottom: 8 }}>
          <View>
            <Card padding="none" className="overflow-hidden">
              {/* Header */}
              <View className="flex-row bg-muted border-b border-border">
                <View style={{ width: NAME_W }} className="px-2 py-2 justify-center"><Text className="text-xs font-semibold text-foreground">Nama</Text></View>
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                  <View key={d} style={{ width: CELL_W }} className="items-center py-2"><Text className="text-[10px] text-muted-foreground">{d}</Text></View>
                ))}
                {["H", "T", "I", "S", "A"].map((c) => (
                  <View key={c} style={{ width: CELL_W }} className="items-center py-2"><Text className="text-[10px] font-semibold text-foreground">{c}</Text></View>
                ))}
              </View>
              {/* Rows */}
              <ScrollView style={{ maxHeight: 480 }}>
                {rows.map((row) => (
                  <View key={row.id} className="flex-row border-b border-border/50">
                    <View style={{ width: NAME_W }} className="px-2 py-1.5 justify-center"><Text className="text-xs text-foreground" numberOfLines={1}>{row.nama}</Text></View>
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                      const code = row.harian[String(d)] ?? "-";
                      return (
                        <View key={d} style={{ width: CELL_W, backgroundColor: STATUS_BG[code] }} className="items-center justify-center py-1.5">
                          <Text style={{ color: STATUS_TEXT[code] ?? "#6E776F", fontSize: 10, fontWeight: code === "A" ? "700" : "400" }}>{code}</Text>
                        </View>
                      );
                    })}
                    <View style={{ width: CELL_W }} className="items-center justify-center py-1.5"><Text className="text-xs font-medium text-foreground">{row.totals.H}</Text></View>
                    <View style={{ width: CELL_W }} className="items-center justify-center py-1.5"><Text className="text-xs text-foreground">{row.totals.T}</Text></View>
                    <View style={{ width: CELL_W }} className="items-center justify-center py-1.5"><Text className="text-xs text-foreground">{row.totals.I}</Text></View>
                    <View style={{ width: CELL_W }} className="items-center justify-center py-1.5"><Text className="text-xs text-foreground">{row.totals.S}</Text></View>
                    <View style={{ width: CELL_W }} className="items-center justify-center py-1.5"><Text className="text-xs font-medium" style={{ color: colors.destructive }}>{row.totals.A}</Text></View>
                  </View>
                ))}
              </ScrollView>
            </Card>
          </View>
        </ScrollView>
      )}

      <View className="px-4 py-2 flex-row flex-wrap gap-x-3">
        {["H = Hadir", "T = Terlambat", "I = Izin", "S = Sakit", "A = Alfa", "L = Libur", "M = Menunggu"].map((t) => (
          <Text key={t} className="text-[10px] text-muted-foreground">{t}</Text>
        ))}
      </View>
    </View>
  );
}

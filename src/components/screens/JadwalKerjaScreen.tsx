import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Calendar, AlertCircle, PartyPopper, Briefcase } from "lucide-react-native";
import { Card } from "../ui/Card";
import { api } from "../../services/api";
import { AcademicMonthCalendar, indexAgenda, toISO, type AgendaItem } from "./JadwalPelajaranScreen";
import { useTheme, useThemeColors } from "../../context/ThemeContext";
import { warnaKontras } from "../../utils/warnaKontras";

// Jadwal Kerja Pegawai - BEDA dari Jadwal Pelajaran Guru: Pegawai tidak
// punya jadwal mengajar per-jam/kelas, yang relevan cuma "hari ini kerja
// atau libur?" - dari kalender akademik yang SAMA (/api/schedule/kalender,
// unit-scoped otomatis dari employee_cache_id akun ini) yang diatur Admin
// TU di data master.
export function JadwalKerjaScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(() => toISO(new Date()));

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await api.scheduleKalender();
      if (res.success) setAgenda(res.data ?? []);
      else setError(res.message ?? "Gagal memuat kalender kerja.");
      setLoading(false);
    })();
  }, []);

  if (loading) return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator color={colors.primary} /></View>;
  if (error) return <View className="flex-1 items-center justify-center bg-background gap-3 px-8"><AlertCircle size={32} color={colors.mutedForeground} /><Text className="text-sm text-muted-foreground text-center">{error}</Text></View>;

  const agendaByDate = indexAgenda(agenda);
  const selectedAgenda = agendaByDate[selectedDate] || [];
  const selectedLiburItems = selectedAgenda.filter((a) => Number(a.is_libur) === 1);
  const isLibur = selectedLiburItems.length > 0;
  const selectedNonLiburAgenda = selectedAgenda.filter((a) => Number(a.is_libur) !== 1);
  const selectedDateLabel = new Date(selectedDate + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <ScrollView className="flex-1 bg-background px-4 pt-5" contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 16 }}>
      {agenda.length === 0 && (
        <Card padding="lg"><View className="items-center py-4"><Calendar size={32} color={colors.mutedForeground} /><Text className="text-sm text-muted-foreground mt-2">Belum ada kalender akademik yang diatur Admin TU.</Text></View></Card>
      )}

      <AcademicMonthCalendar hasSchedule={{}} agendaByDate={agendaByDate} selected={selectedDate} onSelectDate={setSelectedDate} />

      <View>
        <Text className="text-sm font-semibold text-foreground mb-2 capitalize">{selectedDateLabel}</Text>

        {isLibur ? (
          <Card padding="md" className="bg-red-50 border-red-200">
            <View className="flex-row items-start gap-3">
              <View className="w-9 h-9 rounded-xl bg-red-100 items-center justify-center"><PartyPopper size={18} color="#dc2626" /></View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-red-700">Libur</Text>
                {selectedLiburItems.map((a, i) => (
                  <Text key={i} className="text-xs text-red-600 mt-0.5">{a.judul}{a.keterangan ? ` - ${a.keterangan}` : ""}</Text>
                ))}
              </View>
            </View>
          </Card>
        ) : (
          <Card padding="md" className="bg-emerald-50 border-emerald-200">
            <View className="flex-row items-start gap-3">
              <View className="w-9 h-9 rounded-xl bg-emerald-100 items-center justify-center"><Briefcase size={18} color="#16a34a" /></View>
              <Text className="text-sm font-bold text-emerald-700">Hari Kerja Biasa</Text>
            </View>
          </Card>
        )}

        {selectedNonLiburAgenda.length > 0 && (
          <View className="mt-2 gap-2">
            {selectedNonLiburAgenda.map((a, i) => (
              <Card key={i} padding="sm">
                <View className="flex-row items-start gap-2">
                  <View className="w-1.5 h-1.5 rounded-full mt-1.5" style={{ backgroundColor: warnaKontras(a.warna, isDark) }} />
                  <View className="flex-1">
                    <Text className="text-xs font-medium text-foreground">{a.judul}</Text>
                    <Text className="text-[10px] text-muted-foreground">{[a.waktu, a.sasaran].filter(Boolean).join(" · ")}</Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

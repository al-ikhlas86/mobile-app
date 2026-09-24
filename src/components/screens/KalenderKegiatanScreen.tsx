import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Calendar, PartyPopper } from "lucide-react-native";
import { Card } from "../ui/Card";
import { api } from "../../services/api";
import { useTheme, useThemeColors } from "../../context/ThemeContext";
import { warnaKontras } from "../../utils/warnaKontras";
import { AcademicMonthCalendar, indexAgenda, toISO, type AgendaItem } from "./JadwalPelajaranScreen";

// Kalender Kegiatan (2026-09-24, Poin 3 Fase 2) - port native dari webview
// KalenderKegiatanScreen.tsx. LAYAR TERPISAH dari JadwalPelajaranScreen
// (bukan modifikasi file itu) - SENGAJA, supaya logika jadwal-mengajar/
// jadwal-kelas yang sudah teruji di sana tidak ikut tersentuh sama sekali.
// Jadwal pribadi (mengajar/kelas) sekarang tinggal di menu "Akademik"
// (JadwalPelajaranScreen dipakai apa adanya di sana), layar ini MURNI
// agenda umum unit (kalender_akademik_cache) - tidak ada data pribadi/
// jadwal mengajar/jadwal kelas ditampilkan di sini sama sekali.
const NO_SCHEDULE = { senin: false, selasa: false, rabu: false, kamis: false, jumat: false, sabtu: false, minggu: false };

export function KalenderKegiatanScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(() => toISO(new Date()));

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await api.scheduleKalender();
      if (res.success) setAgenda(res.data ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator color={colors.primary} /></View>;
  }

  const agendaByDate = indexAgenda(agenda);
  const selectedAgenda = agendaByDate[selectedDate] || [];
  const selectedLiburItems = selectedAgenda.filter((a) => Number(a.is_libur) === 1);
  const selectedLainnya = selectedAgenda.filter((a) => Number(a.is_libur) !== 1);
  const selectedDateLabel = new Date(selectedDate + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <ScrollView className="flex-1 bg-background px-4 pt-5" contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 16 }}>
      <AcademicMonthCalendar hasSchedule={NO_SCHEDULE} agendaByDate={agendaByDate} selected={selectedDate} onSelectDate={setSelectedDate} />

      <View>
        <Text className="text-sm font-semibold text-foreground mb-2 capitalize">{selectedDateLabel}</Text>

        {selectedLiburItems.length > 0 && (
          <Card padding="md" className="bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800 mb-2">
            <View className="flex-row items-start gap-3">
              <View className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/20 items-center justify-center">
                <PartyPopper size={18} color="#dc2626" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-red-700 dark:text-red-400">Libur</Text>
                {selectedLiburItems.map((a, i) => (
                  <Text key={i} className="text-xs text-red-600 dark:text-red-400 mt-0.5">{a.judul}{a.keterangan ? ` - ${a.keterangan}` : ""}</Text>
                ))}
              </View>
            </View>
          </Card>
        )}

        {selectedLainnya.length > 0 ? (
          <View className="gap-2">
            {selectedLainnya.map((a, i) => (
              <Card key={i} padding="sm">
                <View className="flex-row items-start gap-2">
                  <View className="w-1.5 h-1.5 rounded-full mt-1.5" style={{ backgroundColor: warnaKontras(a.warna, isDark) }} />
                  <View className="flex-1">
                    <Text className="text-xs font-medium text-foreground">{a.judul}</Text>
                    <Text className="text-[10px] text-muted-foreground">{[a.waktu, a.sasaran].filter(Boolean).join(" · ")}</Text>
                    {!!a.keterangan && <Text className="text-[11px] text-muted-foreground mt-0.5">{a.keterangan}</Text>}
                  </View>
                </View>
              </Card>
            ))}
          </View>
        ) : selectedLiburItems.length === 0 ? (
          <Card padding="md">
            <View className="items-center py-3">
              <Calendar size={28} color={colors.mutedForeground} />
              <Text className="text-sm text-muted-foreground mt-2 text-center">Tidak ada kegiatan pada hari ini.</Text>
            </View>
          </Card>
        ) : null}
      </View>
    </ScrollView>
  );
}

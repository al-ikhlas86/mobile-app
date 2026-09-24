import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Calendar, AlertCircle, User, PartyPopper } from "lucide-react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Card } from "../ui/Card";
import { ChildSwitcher } from "../ChildSwitcher";
import { api } from "../../services/api";
import { useThemeColors } from "../../context/ThemeContext";

interface Slot { hari: string; jam_ke: number | null; jam_mulai: string; jam_selesai: string; mata_pelajaran_nama: string; jenis?: "pelajaran" | "kegiatan"; kelas_nama?: string; guru_nama?: string | null; }
interface ChildData { id: number; nama: string; kelas_nama: string | null; }
export interface AgendaItem { judul: string; kategori: string | null; warna: string | null; tanggal_mulai: string; tanggal_selesai: string | null; waktu: string | null; sasaran: string | null; is_libur: number; keterangan: string | null; }

const HARI_LABEL: Record<string, string> = { minggu: "Minggu", senin: "Senin", selasa: "Selasa", rabu: "Rabu", kamis: "Kamis", jumat: "Jumat", sabtu: "Sabtu" };
const DAY_KEY_BY_INDEX = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];
const WEEKDAY_HEADER = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function jam(t: string): string { return (t || "").slice(0, 5); }

// Status satu slot jadwal relatif thd waktu SEKARANG di perangkat guru
// (2026-09-03, diminta user: "beri tanda pada saat sedang berlangsung").
export type StatusSlot = "berlangsung" | "selesai" | "belum";
export function statusSlot(isoTanggal: string, jamMulai: string, jamSelesai: string, sekarang: Date): StatusSlot {
  const isoSekarang = toISO(sekarang);
  if (isoTanggal < isoSekarang) return "selesai";
  if (isoTanggal > isoSekarang) return "belum";
  const menitKe = (t: string): number => {
    const [h, m] = jam(t).split(":").map((n) => parseInt(n, 10));
    return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
  };
  const kini = sekarang.getHours() * 60 + sekarang.getMinutes();
  if (kini < menitKe(jamMulai)) return "belum";
  if (kini >= menitKe(jamSelesai)) return "selesai";
  return "berlangsung";
}

export function toISO(d: Date): string { const m = String(d.getMonth() + 1).padStart(2, "0"); const day = String(d.getDate()).padStart(2, "0"); return `${d.getFullYear()}-${m}-${day}`; }

interface CalendarCell { date: number | null; iso: string | null; hariKey: string | null; isToday: boolean; }
function buildMonthGrid(viewMonth: Date): CalendarCell[] {
  const year = viewMonth.getFullYear(); const month = viewMonth.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date(); const sameMonth = today.getFullYear() === year && today.getMonth() === month;
  const cells: CalendarCell[] = [];
  for (let i = 0; i < firstDayIndex; i++) cells.push({ date: null, iso: null, hariKey: null, isToday: false });
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month, d);
    cells.push({ date: d, iso: toISO(dt), hariKey: DAY_KEY_BY_INDEX[dt.getDay()], isToday: sameMonth && today.getDate() === d });
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, iso: null, hariKey: null, isToday: false });
  return cells;
}
export function indexAgenda(agenda: AgendaItem[]): Record<string, AgendaItem[]> {
  const out: Record<string, AgendaItem[]> = {};
  for (const a of agenda) {
    const mulai = new Date(a.tanggal_mulai + "T00:00:00");
    const selesai = new Date((a.tanggal_selesai || a.tanggal_mulai) + "T00:00:00");
    for (let d = new Date(mulai); d <= selesai; d.setDate(d.getDate() + 1)) {
      const key = toISO(d);
      (out[key] = out[key] || []).push(a);
    }
  }
  return out;
}

// Kalender bulan - SETIAP tanggal bisa diklik, model "pilih 1 tanggal,
// lihat detailnya" - diminta user 2026-08-29: default hari ini, klik
// tanggal lain ganti yang ditampilkan, libur dari kalender akademik MENANG
// atas jadwal weekday biasa. Dipakai ulang APA ADANYA oleh
// KalenderKegiatanScreen.tsx (agenda umum) & JadwalKerjaScreen.tsx
// (hasSchedule={} - tidak py jadwal pelajaran sama sekali).
export function AcademicMonthCalendar({ hasSchedule, agendaByDate, selected, onSelectDate }: { hasSchedule: Record<string, boolean>; agendaByDate: Record<string, AgendaItem[]>; selected: string; onSelectDate: (iso: string) => void }) {
  const colors = useThemeColors();
  const [viewMonth, setViewMonth] = useState(() => { const d = new Date(selected + "T00:00:00"); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const cells = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);
  const monthLabel = viewMonth.toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  return (
    <Card padding="md">
      <View className="flex-row items-center justify-between mb-3">
        <Pressable onPress={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))} className="p-1.5"><ChevronLeft size={18} color={colors.mutedForeground} /></Pressable>
        <Text className="text-sm font-semibold text-foreground capitalize">{monthLabel}</Text>
        <Pressable onPress={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))} className="p-1.5"><ChevronRight size={18} color={colors.mutedForeground} /></Pressable>
      </View>

      <View className="flex-row mb-1">
        {WEEKDAY_HEADER.map((w) => <Text key={w} className="flex-1 text-center text-[10px] font-medium text-muted-foreground py-1">{w}</Text>)}
      </View>
      <View className="flex-row flex-wrap">
        {cells.map((cell, idx) => {
          if (cell.date === null) return <View key={idx} style={{ width: "14.28%" }} className="aspect-square" />;
          const agenda = cell.iso ? (agendaByDate[cell.iso] || []) : [];
          const libur = agenda.some((a) => Number(a.is_libur) === 1);
          const adaJadwal = cell.hariKey ? hasSchedule[cell.hariKey] : false;
          // adaAgenda (2026-09-24) - event umum non-libur, dikasih warna sel
          // PENUH (bukan cuma titik kecil) supaya kalender lebih hidup/mudah
          // di-scan sekilas, diminta user (referensi kalender P&L app
          // trading: sel berwarna penuh per status). SENGAJA pakai 1 warna
          // tema tetap (amber), BUKAN warna bebas per-event (beda dari
          // dipakai sbg titik kecil sebelumnya) - warna arbitrer sbg
          // BACKGROUND sel berisiko kontras jelek di salah satu tema.
          const adaAgenda = agenda.some((a) => Number(a.is_libur) !== 1);
          return (
            <Pressable
              key={idx}
              onPress={() => cell.iso && onSelectDate(cell.iso)}
              style={{ width: "14.28%" }}
              // Indikator "tanggal yang di-tap" pakai BORDER (bukan
              // backgroundColor) - lihat catatan panjang di versi lama file
              // ini soal kenapa (bentrok dgn backgroundColor libur/agenda/
              // jadwal kalau pakai warna latar juga).
              className={`aspect-square items-center justify-center rounded-lg ${selected === cell.iso ? "border-2 border-primary" : cell.isToday ? "border border-primary" : ""} ${libur ? "bg-red-100 dark:bg-red-900/20" : adaAgenda ? "bg-amber-100 dark:bg-amber-900/20" : adaJadwal ? "bg-primary/10" : ""}`}
            >
              <Text className={`text-xs ${libur ? "text-red-700 dark:text-red-400 font-semibold" : adaAgenda ? "text-amber-800 dark:text-amber-300 font-semibold" : adaJadwal ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{cell.date}</Text>
              {adaJadwal && !libur && !adaAgenda && (
                <View className="mt-0.5" style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary }} />
              )}
            </Pressable>
          );
        })}
      </View>

      <View className="flex-row flex-wrap items-center justify-center mt-3" style={{ gap: 10 }}>
        {Object.keys(hasSchedule).length > 0 && (
          <View className="flex-row items-center" style={{ gap: 4 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary }} />
            <Text className="text-[10px] text-muted-foreground">jadwal</Text>
          </View>
        )}
        <View className="flex-row items-center" style={{ gap: 4 }}>
          <View style={{ width: 10, height: 10, borderRadius: 3 }} className="bg-amber-200 dark:bg-amber-900/50" />
          <Text className="text-[10px] text-muted-foreground">ada kegiatan</Text>
        </View>
        <View className="flex-row items-center" style={{ gap: 4 }}>
          <View style={{ width: 10, height: 10, borderRadius: 3 }} className="bg-red-200 dark:bg-red-900/50" />
          <Text className="text-[10px] text-muted-foreground">libur</Text>
        </View>
      </View>
    </Card>
  );
}

// Jadwal & Kalender pribadi - tab pertama menu "Akademik" (2026-09-24, Poin
// 3 Fase 2). DIROMBAK TOTAL dari versi sebelumnya: dulu ada 2 tab internal
// ("Kalender Kegiatan"/"Jadwal Pelajaran") yang duplikatif begitu dipindah
// ke dalam Akademik - Kalender Kegiatan SUDAH jadi menu tersendiri
// (KalenderKegiatanScreen.tsx, event umum sekolah), jadi layar ini SEKARANG
// MURNI jadwal pribadi (mengajar utk guru, kelas utk siswa) - TIDAK LAGI
// menampilkan agenda umum sama sekali (cuma status libur, krn itu langsung
// menentukan ada KBM atau tidak). Port 1:1 dari webview JadwalPelajaranScreen.tsx.
export function JadwalPelajaranScreen({ mode }: { mode: "guru" | "anak" }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [children, setChildren] = useState<ChildData[]>([]);
  const [activeChildId, setActiveChildId] = useState<number | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [agendaLibur, setAgendaLibur] = useState<AgendaItem[]>([]);
  const [meta, setMeta] = useState<{ tahunAjaran?: string; semester?: string; message?: string } | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => toISO(new Date()));
  const [sekarang, setSekarang] = useState(() => new Date());
  const colors = useThemeColors();

  useEffect(() => {
    const t = setInterval(() => setSekarang(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true); setError("");
      const kalenderPromise = api.scheduleKalender().catch(() => null);
      if (mode === "anak") {
        const childrenRes = await api.myChildren();
        if (!childrenRes.success) { setError(childrenRes.message ?? "Gagal memuat data anak."); setLoading(false); return; }
        setChildren(childrenRes.data);
        const firstChild = childrenRes.data[0] ?? null;
        setActiveChildId(firstChild?.id ?? null);
        if (!firstChild) { setLoading(false); return; }
        const res = await api.scheduleAnak(firstChild.id);
        if (res.success) { setSlots(res.data); setMeta(res.meta ?? null); } else setError(res.message ?? "Gagal memuat jadwal pelajaran.");
      } else {
        const res = await api.scheduleMe();
        if (res.success) { setSlots(res.data); setMeta(res.meta ?? null); } else setError(res.message ?? "Gagal memuat jadwal mengajar.");
      }
      const kal = await kalenderPromise;
      if (kal?.success) {
        const rawAgenda: AgendaItem[] = kal.data ?? [];
        setAgendaLibur(rawAgenda.filter((a) => Number(a.is_libur) === 1));
      }
      setLoading(false);
    })();
  }, [mode]);

  async function handleSelectChild(id: number) {
    setActiveChildId(id);
    setLoading(true);
    setError("");
    const res = await api.scheduleAnak(id);
    if (res.success) { setSlots(res.data); setMeta(res.meta ?? null); } else setError(res.message ?? "Gagal memuat jadwal pelajaran.");
    setLoading(false);
  }

  const child = children.find((c) => c.id === activeChildId) ?? null;

  if (loading) return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator color={colors.primary} /></View>;
  if (error) return <View className="flex-1 items-center justify-center bg-background gap-3 px-8"><AlertCircle size={32} color={colors.mutedForeground} /><Text className="text-sm text-muted-foreground text-center">{error}</Text></View>;
  if (mode === "anak" && !child) return <View className="flex-1 items-center justify-center bg-background gap-3 px-8"><AlertCircle size={32} color={colors.mutedForeground} /><Text className="text-sm text-muted-foreground text-center">Belum ada data anak yang tertaut ke akun ini.</Text></View>;

  const grouped: Record<string, Slot[]> = {};
  for (const s of slots) (grouped[s.hari] = grouped[s.hari] || []).push(s);
  const hasSchedule: Record<string, boolean> = Object.fromEntries(Object.keys(HARI_LABEL).map((h) => [h, (grouped[h] || []).some((s) => s.jenis !== "kegiatan")]));
  const agendaByDate = indexAgenda(agendaLibur);

  const selectedLiburItems = agendaByDate[selectedDate] || [];
  const isLibur = selectedLiburItems.length > 0;
  const selectedHariKey = DAY_KEY_BY_INDEX[new Date(selectedDate + "T00:00:00").getDay()];
  const selectedSlots = isLibur ? [] : (grouped[selectedHariKey] || []);
  const selectedDateLabel = new Date(selectedDate + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <View className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4 pt-5" contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 16 }}>
        {mode === "anak" && <ChildSwitcher children={children} activeId={activeChildId} onChange={handleSelectChild} />}

        {mode === "anak" && child && (
          <Card padding="md" className="bg-primary border-0">
            <View className="flex-row items-center gap-4">
              <View className="w-12 h-12 rounded-full bg-white/20 items-center justify-center"><User size={22} color={colors.primaryForeground} /></View>
              <View><Text className="text-primary-foreground font-bold text-base">{child.nama}</Text><Text className="text-primary-foreground text-sm">{child.kelas_nama ? `Kelas ${child.kelas_nama}` : "Kelas belum diatur"}</Text></View>
            </View>
          </Card>
        )}

        {meta?.message ? <Card padding="md"><Text className="text-sm text-muted-foreground text-center">{meta.message}</Text></Card> : null}
        {meta?.tahunAjaran ? <Text className="text-xs text-muted-foreground text-center">Tahun Ajaran {meta.tahunAjaran} · Semester {meta.semester === "genap" ? "Genap" : "Ganjil"}</Text> : null}

        {!meta?.message && slots.length === 0 && (
          <Card padding="lg"><View className="items-center py-4"><Calendar size={32} color={colors.mutedForeground} /><Text className="text-sm text-muted-foreground mt-2">Belum ada jadwal pelajaran yang diatur.</Text></View></Card>
        )}

        {slots.length > 0 && (
          <>
            <AcademicMonthCalendar hasSchedule={hasSchedule} agendaByDate={agendaByDate} selected={selectedDate} onSelectDate={setSelectedDate} />

            <View>
              <Text className="text-sm font-semibold text-foreground mb-2 capitalize">{selectedDateLabel}</Text>

              {isLibur ? (
                <Card padding="md" className="bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800">
                  <View className="flex-row items-start gap-3">
                    <View className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/20 items-center justify-center"><PartyPopper size={18} color="#dc2626" /></View>
                    <View className="flex-1">
                      <Text className="text-sm font-bold text-red-700 dark:text-red-400">Libur - tidak ada KBM</Text>
                      {selectedLiburItems.map((a, i) => (
                        <Text key={i} className="text-xs text-red-600 dark:text-red-400 mt-0.5">{a.judul}{a.keterangan ? ` - ${a.keterangan}` : ""}</Text>
                      ))}
                    </View>
                  </View>
                </Card>
              ) : selectedSlots.length > 0 ? (
                <View className="gap-2">
                  <Text className="text-xs text-muted-foreground">{selectedSlots.filter((s) => s.jenis !== "kegiatan").length} jam {mode === "guru" ? "mengajar" : "pelajaran"}</Text>
                  {selectedSlots.map((s, idx) => {
                    const kegiatan = s.jenis === "kegiatan";
                    const status = kegiatan ? null : statusSlot(selectedDate, s.jam_mulai, s.jam_selesai, sekarang);
                    const gayaKartu = status === "berlangsung" ? "border-primary bg-primary/5" : status === "selesai" ? "opacity-60" : "";
                    const labelStatus = status === "berlangsung" ? "Sedang berlangsung" : status === "selesai" ? "Selesai" : "Belum mulai";
                    const warnaBadge =
                      status === "berlangsung" ? { bg: "bg-primary", fg: colors.primaryForeground }
                      : status === "selesai" ? { bg: "bg-muted", fg: colors.mutedForeground }
                      : { bg: "bg-amber-100 dark:bg-amber-900/20", fg: "#92400e" };
                    return (
                      <Card key={idx} padding="sm" className={kegiatan ? "opacity-80" : gayaKartu}>
                        <View className="flex-row items-center gap-3">
                          <View className={`items-center justify-center rounded-lg px-2 py-1.5 ${kegiatan ? "bg-muted" : "bg-primary/10"}`} style={{ minWidth: 64 }}>
                            <Text className={`text-[11px] font-semibold ${kegiatan ? "text-muted-foreground" : "text-primary"}`}>{jam(s.jam_mulai)}</Text>
                            <Text className="text-[10px] text-muted-foreground">s/d {jam(s.jam_selesai)}</Text>
                          </View>
                          <View className="flex-1">
                            <Text className={`text-sm ${kegiatan ? "text-muted-foreground" : "font-medium text-foreground"}`}>{s.mata_pelajaran_nama}</Text>
                            <Text className="text-xs text-muted-foreground mt-0.5">
                              {kegiatan ? (s.jam_ke ? `Jam ke-${s.jam_ke}` : "") : [s.jam_ke ? `Jam ke-${s.jam_ke}` : null, mode === "guru" ? `Kelas ${s.kelas_nama}` : (s.guru_nama || "Tanpa guru tetap")].filter(Boolean).join(" · ")}
                            </Text>
                            {status && (
                              <View className={`self-start mt-1.5 px-2 py-0.5 rounded-full ${warnaBadge.bg}`}>
                                <Text className="text-[10px] font-medium" style={{ color: warnaBadge.fg }}>{labelStatus}</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </Card>
                    );
                  })}
                </View>
              ) : (
                <Card padding="md"><Text className="text-sm text-muted-foreground text-center">Tidak ada jadwal pada hari ini.</Text></Card>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

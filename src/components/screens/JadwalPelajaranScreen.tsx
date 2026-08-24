import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { Calendar, Clock, AlertCircle, User, ChevronLeft, ChevronRight, Coffee } from "lucide-react-native";
import { Card } from "../ui/Card";
import { api } from "../../services/api";

interface Slot { hari: string; jam_ke: number | null; jam_mulai: string; jam_selesai: string; mata_pelajaran_nama: string; jenis?: "pelajaran" | "kegiatan"; kelas_nama?: string; guru_nama?: string | null; }
interface ChildData { id: number; nama: string; kelas_nama: string | null; }
interface AgendaItem { judul: string; kategori: string | null; warna: string | null; tanggal_mulai: string; tanggal_selesai: string | null; waktu: string | null; sasaran: string | null; is_libur: number; keterangan: string | null; }

const HARI_LIST = ["senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];
const HARI_LABEL: Record<string, string> = { senin: "Senin", selasa: "Selasa", rabu: "Rabu", kamis: "Kamis", jumat: "Jumat", sabtu: "Sabtu" };
const DAY_KEY_BY_INDEX = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];
const WEEKDAY_HEADER = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function jam(t: string): string { return (t || "").slice(0, 5); }
function toISO(d: Date): string { const m = String(d.getMonth() + 1).padStart(2, "0"); const day = String(d.getDate()).padStart(2, "0"); return `${d.getFullYear()}-${m}-${day}`; }

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
function indexAgenda(agenda: AgendaItem[]): Record<string, AgendaItem[]> {
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

function MonthCalendar({ hasSchedule, agendaByDate, onPickHari }: { hasSchedule: Record<string, boolean>; agendaByDate: Record<string, AgendaItem[]>; onPickHari: (hari: string) => void }) {
  const [viewMonth, setViewMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); });
  const [selected, setSelected] = useState<string | null>(null);
  const cells = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);
  const monthLabel = viewMonth.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  const agendaTerpilih = selected ? (agendaByDate[selected] || []) : [];

  return (
    <Card padding="md">
      <View className="flex-row items-center justify-between mb-3">
        <Pressable onPress={() => { setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1)); setSelected(null); }} className="p-1.5"><ChevronLeft size={18} color="#6E776F" /></Pressable>
        <Text className="text-sm font-semibold text-foreground capitalize">{monthLabel}</Text>
        <Pressable onPress={() => { setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1)); setSelected(null); }} className="p-1.5"><ChevronRight size={18} color="#6E776F" /></Pressable>
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
          const bisaDiketuk = agenda.length > 0 || (adaJadwal && !libur);
          return (
            <Pressable
              key={idx}
              disabled={!bisaDiketuk}
              onPress={() => { if (agenda.length > 0) setSelected(cell.iso); else if (cell.hariKey) onPickHari(cell.hariKey); }}
              style={{ width: "14.28%" }}
              className={`aspect-square items-center justify-center rounded-lg ${cell.isToday ? "border border-primary" : ""} ${selected === cell.iso ? "bg-primary/20" : ""} ${libur ? "bg-red-100" : adaJadwal ? "bg-primary/10" : ""}`}
            >
              <Text className={`text-xs ${libur ? "text-red-700 font-semibold" : adaJadwal ? "text-foreground font-semibold" : "text-muted-foreground/60"}`}>{cell.date}</Text>
            </Pressable>
          );
        })}
      </View>

      {agendaTerpilih.length > 0 && (
        <View className="mt-3 pt-3 border-t border-border">
          <Text className="text-[11px] font-semibold text-muted-foreground mb-1">{new Date(selected + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}</Text>
          {agendaTerpilih.map((a, i) => (
            <View key={i} className="flex-row items-start gap-2 py-1">
              <View className="w-1.5 h-1.5 rounded-full mt-1.5" style={{ backgroundColor: a.warna || "#f59e0b" }} />
              <View>
                <Text className="text-xs font-medium text-foreground">{a.judul}{Number(a.is_libur) === 1 ? " (Libur)" : ""}</Text>
                <Text className="text-[10px] text-muted-foreground">{[a.waktu, a.sasaran].filter(Boolean).join(" · ")}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

export function JadwalPelajaranScreen({ mode }: { mode: "guru" | "anak" }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [child, setChild] = useState<ChildData | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [meta, setMeta] = useState<{ tahunAjaran?: string; semester?: string; message?: string } | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true); setError("");
      const kalenderPromise = api.scheduleKalender().catch(() => null);
      if (mode === "anak") {
        const childrenRes = await api.myChildren();
        if (!childrenRes.success) { setError(childrenRes.message ?? "Gagal memuat data anak."); setLoading(false); return; }
        const firstChild = childrenRes.data[0] ?? null;
        setChild(firstChild);
        if (!firstChild) { setLoading(false); return; }
        const res = await api.scheduleAnak(firstChild.id);
        if (res.success) { setSlots(res.data); setMeta(res.meta ?? null); } else setError(res.message ?? "Gagal memuat jadwal pelajaran.");
      } else {
        const res = await api.scheduleMe();
        if (res.success) { setSlots(res.data); setMeta(res.meta ?? null); } else setError(res.message ?? "Gagal memuat jadwal mengajar.");
      }
      const kal = await kalenderPromise;
      if (kal?.success) setAgenda(kal.data ?? []);
      setLoading(false);
    })();
  }, [mode]);

  if (loading) return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator color="#356447" /></View>;
  if (error) return <View className="flex-1 items-center justify-center bg-background gap-3 px-8"><AlertCircle size={32} color="#6E776F" /><Text className="text-sm text-muted-foreground text-center">{error}</Text></View>;
  if (mode === "anak" && !child) return <View className="flex-1 items-center justify-center bg-background gap-3 px-8"><AlertCircle size={32} color="#6E776F" /><Text className="text-sm text-muted-foreground text-center">Belum ada data anak yang tertaut ke akun ini.</Text></View>;

  const grouped: Record<string, Slot[]> = Object.fromEntries(HARI_LIST.map((h) => [h, []]));
  for (const s of slots) if (grouped[s.hari]) grouped[s.hari].push(s);
  const hasSchedule: Record<string, boolean> = Object.fromEntries(HARI_LIST.map((h) => [h, grouped[h].some((s) => s.jenis !== "kegiatan")]));
  const agendaByDate = indexAgenda(agenda);

  return (
    <ScrollView className="flex-1 bg-background px-4 pt-5" contentContainerStyle={{ paddingBottom: 32, gap: 16 }}>
      {mode === "anak" && child && (
        <Card padding="md" className="bg-primary border-0">
          <View className="flex-row items-center gap-4">
            <View className="w-12 h-12 rounded-full bg-white/20 items-center justify-center"><User size={22} color="#fff" /></View>
            <View><Text className="text-white font-bold text-base">{child.nama}</Text><Text className="text-white/80 text-sm">{child.kelas_nama ? `Kelas ${child.kelas_nama}` : "Kelas belum diatur"}</Text></View>
          </View>
        </Card>
      )}

      {meta?.message ? <Card padding="md"><Text className="text-sm text-muted-foreground text-center">{meta.message}</Text></Card> : null}
      {meta?.tahunAjaran ? <Text className="text-xs text-muted-foreground text-center">Tahun Ajaran {meta.tahunAjaran} · Semester {meta.semester === "genap" ? "Genap" : "Ganjil"}</Text> : null}

      {!meta?.message && slots.length === 0 && agenda.length === 0 && (
        <Card padding="lg"><View className="items-center py-4"><Calendar size={32} color="#6E776F" /><Text className="text-sm text-muted-foreground mt-2">Belum ada jadwal pelajaran yang diatur.</Text></View></Card>
      )}

      {(slots.length > 0 || agenda.length > 0) && <MonthCalendar hasSchedule={hasSchedule} agendaByDate={agendaByDate} onPickHari={() => {}} />}

      {HARI_LIST.map((hari) => {
        const items = grouped[hari];
        if (items.length === 0) return null;
        return (
          <View key={hari}>
            <Text className="text-sm font-semibold text-foreground mb-2">{HARI_LABEL[hari]}</Text>
            <View className="gap-2">
              {items.map((s, idx) => {
                const kegiatan = s.jenis === "kegiatan";
                return (
                  <Card key={idx} padding="sm" className={kegiatan ? "opacity-80" : ""}>
                    <View className="flex-row items-center gap-3">
                      <View className={`items-center justify-center rounded-lg px-2 py-1.5 ${kegiatan ? "bg-muted" : "bg-primary/10"}`} style={{ minWidth: 64 }}>
                        {kegiatan ? <Coffee size={13} color="#6E776F" /> : <Clock size={13} color="#356447" />}
                        <Text className={`text-[11px] font-semibold ${kegiatan ? "text-muted-foreground" : "text-primary"}`}>{jam(s.jam_mulai)}</Text>
                        <Text className="text-[10px] text-muted-foreground">{jam(s.jam_selesai)}</Text>
                      </View>
                      <View className="flex-1">
                        <Text className={`text-sm ${kegiatan ? "text-muted-foreground" : "font-medium text-foreground"}`}>{s.mata_pelajaran_nama}</Text>
                        <Text className="text-xs text-muted-foreground mt-0.5">
                          {kegiatan ? (s.jam_ke ? `Jam ke-${s.jam_ke}` : "") : [s.jam_ke ? `Jam ke-${s.jam_ke}` : null, mode === "guru" ? `Kelas ${s.kelas_nama}` : (s.guru_nama || "Tanpa guru tetap")].filter(Boolean).join(" · ")}
                        </Text>
                      </View>
                    </View>
                  </Card>
                );
              })}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

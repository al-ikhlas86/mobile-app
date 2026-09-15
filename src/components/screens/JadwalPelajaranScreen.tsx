import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Calendar, CalendarDays, BookOpen, Clock, AlertCircle, User, ChevronLeft, ChevronRight, Coffee, PartyPopper } from "lucide-react-native";
import { Card } from "../ui/Card";
import { ChildSwitcher } from "../ChildSwitcher";
import { api } from "../../services/api";
import { useTheme, useThemeColors } from "../../context/ThemeContext";
import { warnaKontras, WARNA_AGENDA_DEFAULT } from "../../utils/warnaKontras";

interface Slot { hari: string; jam_ke: number | null; jam_mulai: string; jam_selesai: string; mata_pelajaran_nama: string; jenis?: "pelajaran" | "kegiatan"; kelas_nama?: string; guru_nama?: string | null; }
interface ChildData { id: number; nama: string; kelas_nama: string | null; }
export interface AgendaItem { judul: string; kategori: string | null; warna: string | null; tanggal_mulai: string; tanggal_selesai: string | null; waktu: string | null; sasaran: string | null; is_libur: number; keterangan: string | null; }

const HARI_LABEL: Record<string, string> = { minggu: "Minggu", senin: "Senin", selasa: "Selasa", rabu: "Rabu", kamis: "Kamis", jumat: "Jumat", sabtu: "Sabtu" };
const DAY_KEY_BY_INDEX = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];
const WEEKDAY_HEADER = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function jam(t: string): string { return (t || "").slice(0, 5); }

// Status satu slot jadwal relatif thd waktu SEKARANG di perangkat guru
// (2026-09-03, diminta user: "beri tanda pada saat sedang berlangsung").
// Sengaja memakai jam lokal perangkat, konsisten dgn seluruh layar ini yang
// juga memakai `new Date()` lokal - sekolah & penggunanya sama-sama WIB.
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

function geserHari(iso: string, selisih: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + selisih);
  return toISO(d);
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

// Kalender bulan - SETIAP tanggal bisa diklik (bukan cuma yang ada jadwal/
// agenda), model "pilih 1 tanggal, lihat detailnya" - diminta user
// 2026-08-29: default hari ini, klik tanggal lain ganti yang ditampilkan,
// libur dari kalender akademik MENANG atas jadwal weekday biasa.
export function AcademicMonthCalendar({ hasSchedule, agendaByDate, selected, onSelectDate }: { hasSchedule: Record<string, boolean>; agendaByDate: Record<string, AgendaItem[]>; selected: string; onSelectDate: (iso: string) => void }) {
  const colors = useThemeColors();
  const { isDark } = useTheme();
  const [viewMonth, setViewMonth] = useState(() => { const d = new Date(selected + "T00:00:00"); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const cells = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);
  const monthLabel = viewMonth.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  // Warna contoh utk keterangan simbol diambil dari agenda yang BENAR2 ada
  // (warna dipilih Admin TU per kegiatan, bukan tetap) supaya titik di
  // keterangan sewarna dgn titik yang muncul di tanggalnya.
  const warnaContohAgenda = useMemo(() => {
    for (const items of Object.values(agendaByDate)) {
      for (const a of items) {
        if (Number(a.is_libur) !== 1 && a.warna) return a.warna;
      }
    }
    return WARNA_AGENDA_DEFAULT;
  }, [agendaByDate]);

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
          return (
            <Pressable
              key={idx}
              onPress={() => cell.iso && onSelectDate(cell.iso)}
              style={{ width: "14.28%" }}
              // Indikator "tanggal yang di-tap" (2026-09-15) - SEBELUMNYA
              // "bg-primary/20" (warna latar), BENTROK dgn backgroundColor
              // yang SAMA dipakai libur ("bg-red-100")/adaJadwal
              // ("bg-primary/10") di bawah - keduanya sama2 nge-set
              // backgroundColor, jadi kelas yg belakangan (libur/adaJadwal)
              // SELALU menang & menutupi tanda seleksi (dilaporkan user:
              // "klik tanggal tidak ada tandanya"). Ganti ke BORDER (property
              // RN yg beda dari backgroundColor - borderWidth/borderColor
              // vs backgroundColor - tidak akan pernah saling menimpa),
              // pola sama persis versi webview (pakai "ring", constraint yg
              // sama: harus di layer terpisah dari background).
              className={`aspect-square items-center justify-center rounded-lg ${selected === cell.iso ? "border-2 border-primary" : cell.isToday ? "border border-primary" : ""} ${libur ? "bg-red-100" : adaJadwal ? "bg-primary/10" : ""}`}
            >
              {/* text-muted-foreground TANPA modifier opacity (2026-08-29) -
                  sebelumnya "/60" (mis. text-muted-foreground/60), yang
                  meredupkan warna abu2 gelap ke titik hampir tidak
                  terbaca di atas latar HITAM mode gelap ("kedip2 tapi
                  hitam" yang dilaporkan user). --muted-foreground SUDAH
                  dikalibrasi terpisah per tema (abu gelap utk terang,
                  abu terang utk gelap) - tidak perlu opacity tambahan. */}
              <Text className={`text-xs ${libur ? "text-red-700 font-semibold" : adaJadwal ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{cell.date}</Text>
              {/* Titik penanda (2026-09-02): SEBELUMNYA native cuma menandai
                  hari lewat WARNA LATAR - libur dapat latar merah, hari ber-
                  jadwal dapat latar primary, tapi tanggal yang cuma berisi
                  KEGIATAN (is_libur=0, mis. "Pembagian buku kelas 1-3")
                  tampil persis sama seperti tanggal kosong. Akibatnya di
                  layar Jadwal Kerja pegawai (hasSchedule={} - tanpa latar
                  jadwal sama sekali) agenda sekolah benar2 tidak kelihatan
                  sampai tanggalnya diketuk satu per satu. Webview sudah
                  punya titik ini sejak awal; native ketinggalan.

                  Revisi hari yang sama, setelah user memakai APK-nya:
                  1. Titik 4px yang di-`absolute bottom-1` ternyata JATUH DI
                     ATAS angka tanggalnya (sel cuma ~45dp, angka mengisi
                     hampir seluruh tinggi) - terlihat seperti CORETAN di
                     angka 14-22, bukan penanda. Sekarang angka & titik
                     ditumpuk normal dlm kolom, dan tinggi baris titik
                     SELALU dipesan (6px) walau tanggalnya kosong supaya
                     seluruh angka tetap sebaris rapi.
                  2. Ukuran dinaikkan 4px -> 7px.
                  3. Warna agenda dilewatkan warnaKontras() dulu: warna itu
                     dipilih Admin TU (bisa apa saja, mis. hijau gelap
                     #198754) dan nyaris lenyap di atas latar HITAM mode
                     gelap. Libur & jadwal pakai warna tema yang MEMANG
                     sudah dikalibrasi per tema di ThemeContext. */}
              <View className="flex-row items-center justify-center mt-0.5" style={{ gap: 3, height: 7 }}>
                {adaJadwal && !libur && (
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary }} />
                )}
                {libur ? (
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.destructive }} />
                ) : agenda.length > 0 ? (
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: warnaKontras(agenda[0].warna, isDark) }} />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Keterangan simbol - item "jadwal pelajaran" hanya muncul kalau
          pemanggilnya memang mengirim hasSchedule (layar Jadwal Pelajaran).
          Jadwal Kerja pegawai mengirim {} sehingga tidak lagi menjanjikan
          penanda yang memang tidak pernah ada di layarnya. */}
      <View className="flex-row flex-wrap items-center justify-center mt-3" style={{ gap: 10 }}>
        {Object.keys(hasSchedule).length > 0 && (
          <View className="flex-row items-center" style={{ gap: 4 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary }} />
            <Text className="text-[10px] text-muted-foreground">jadwal pelajaran</Text>
          </View>
        )}
        <View className="flex-row items-center" style={{ gap: 4 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: warnaKontras(warnaContohAgenda, isDark) }} />
          <Text className="text-[10px] text-muted-foreground">agenda/kegiatan</Text>
        </View>
        <View className="flex-row items-center" style={{ gap: 4 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.destructive }} />
          <Text className="text-[10px] text-muted-foreground">libur</Text>
        </View>
      </View>
    </Card>
  );
}

// Pemilih tab - pola & gaya SAMA PERSIS dgn PresensiScreen (Hadir/Izin)
// supaya terasa satu aplikasi, bukan komponen baru yang beda sendiri.
function TabBar({ activeTab, onChange, colors }: { activeTab: "kalender" | "jadwal"; onChange: (t: "kalender" | "jadwal") => void; colors: ReturnType<typeof useThemeColors> }) {
  return (
    <View className="px-4 pt-5">
      <View className="flex-row gap-2 p-1 bg-muted rounded-xl">
        <Pressable onPress={() => onChange("kalender")} className={`flex-1 py-2.5 rounded-lg flex-row items-center justify-center gap-1.5 ${activeTab === "kalender" ? "bg-card" : ""}`}>
          <CalendarDays size={15} color={activeTab === "kalender" ? colors.primary : colors.mutedForeground} />
          <Text className={`text-sm font-medium ${activeTab === "kalender" ? "text-foreground" : "text-muted-foreground"}`}>Kalender Kegiatan</Text>
        </Pressable>
        <Pressable onPress={() => onChange("jadwal")} className={`flex-1 py-2.5 rounded-lg flex-row items-center justify-center gap-1.5 ${activeTab === "jadwal" ? "bg-card" : ""}`}>
          <BookOpen size={15} color={activeTab === "jadwal" ? colors.primary : colors.mutedForeground} />
          <Text className={`text-sm font-medium ${activeTab === "jadwal" ? "text-foreground" : "text-muted-foreground"}`}>Jadwal Pelajaran</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function JadwalPelajaranScreen({ mode }: { mode: "guru" | "anak" }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [children, setChildren] = useState<ChildData[]>([]);
  const [activeChildId, setActiveChildId] = useState<number | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [meta, setMeta] = useState<{ tahunAjaran?: string; semester?: string; message?: string } | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => toISO(new Date()));
  // Tab "Jadwal Pelajaran" (2026-09-03) KHUSUS guru - orang tua tetap
  // melihat satu layar seperti sebelumnya (tab ini soal mapel yang DIAMPU
  // guru, tidak relevan utk mereka).
  const [activeTab, setActiveTab] = useState<"kalender" | "jadwal">("kalender");
  // Jam berjalan utk penanda "sedang berlangsung" - ditik tiap 30 detik
  // supaya penandanya berpindah sendiri saat jam pelajaran berganti, tanpa
  // guru perlu menutup & membuka ulang layarnya.
  const [sekarang, setSekarang] = useState(() => new Date());
  const colors = useThemeColors();
  const { isDark } = useTheme();

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
        // Diminta user 2026-09-03: ortu cuma perlu lihat jadwal pelajaran
        // anaknya sendiri, BUKAN agenda internal sekolah (rapat guru dst)
        // yang unit-wide dan tidak relevan buat mereka. Penanda LIBUR tetap
        // disertakan (bukan "agenda", tapi bagian dari status jadwal - hari
        // itu memang tidak ada KBM, ortu wajib tahu).
        setAgenda(mode === "anak" ? rawAgenda.filter((a) => Number(a.is_libur) === 1) : rawAgenda);
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
  const agendaByDate = indexAgenda(agenda);

  const selectedAgenda = agendaByDate[selectedDate] || [];
  const selectedLiburItems = selectedAgenda.filter((a) => Number(a.is_libur) === 1);
  const isLibur = selectedLiburItems.length > 0;
  const selectedHariKey = DAY_KEY_BY_INDEX[new Date(selectedDate + "T00:00:00").getDay()];
  const selectedSlots = isLibur ? [] : (grouped[selectedHariKey] || []);
  const selectedNonLiburAgenda = selectedAgenda.filter((a) => Number(a.is_libur) !== 1);
  const selectedDateLabel = new Date(selectedDate + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // ============ TAB "JADWAL PELAJARAN" (guru saja) ============
  // Daftar mapel yang diampu pada SATU tanggal terpilih, bisa digeser ke
  // hari berikutnya/sebelumnya sejauh apa pun (diminta user: "bisa cek juga
  // untuk hari esoknya, lusa, minggu depan dan seterusnya").
  if (mode === "guru" && activeTab === "jadwal") {
    const pelajaranHariIni = selectedSlots.filter((s) => s.jenis !== "kegiatan");
    const isHariIni = selectedDate === toISO(sekarang);

    return (
      <View className="flex-1 bg-background">
        <TabBar activeTab={activeTab} onChange={setActiveTab} colors={colors} />

        <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 32 + insets.bottom, paddingTop: 16, gap: 12 }}>
          <Card padding="sm">
            <View className="flex-row items-center justify-between">
              <Pressable onPress={() => setSelectedDate(geserHari(selectedDate, -1))} className="p-2">
                <ChevronLeft size={18} color={colors.mutedForeground} />
              </Pressable>
              <View className="flex-1 items-center">
                <Text className="text-sm font-semibold text-foreground capitalize">{selectedDateLabel}</Text>
                {!isHariIni && (
                  <Pressable onPress={() => setSelectedDate(toISO(sekarang))} className="mt-0.5">
                    <Text className="text-[11px] text-primary">Kembali ke hari ini</Text>
                  </Pressable>
                )}
              </View>
              <Pressable onPress={() => setSelectedDate(geserHari(selectedDate, 1))} className="p-2">
                <ChevronRight size={18} color={colors.mutedForeground} />
              </Pressable>
            </View>
          </Card>

          {isLibur ? (
            <Card padding="md" className="bg-red-50 border-red-200">
              <View className="flex-row items-start gap-3">
                <View className="w-9 h-9 rounded-xl bg-red-100 items-center justify-center"><PartyPopper size={18} color="#dc2626" /></View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-red-700">Libur - tidak ada KBM</Text>
                  {selectedLiburItems.map((a, i) => (
                    <Text key={i} className="text-xs text-red-600 mt-0.5">{a.judul}{a.keterangan ? ` - ${a.keterangan}` : ""}</Text>
                  ))}
                </View>
              </View>
            </Card>
          ) : pelajaranHariIni.length === 0 ? (
            <Card padding="lg">
              <View className="items-center py-4">
                <Calendar size={32} color={colors.mutedForeground} />
                <Text className="text-sm text-muted-foreground mt-2 text-center">Tidak ada jadwal mengajar pada hari ini.</Text>
              </View>
            </Card>
          ) : (
            <>
              <Text className="text-xs text-muted-foreground">{pelajaranHariIni.length} jam mengajar</Text>
              {pelajaranHariIni.map((s, idx) => {
                const status = statusSlot(selectedDate, s.jam_mulai, s.jam_selesai, sekarang);
                const gayaKartu =
                  status === "berlangsung" ? "border-primary bg-primary/5"
                  : status === "selesai" ? "opacity-60" : "";
                const labelStatus =
                  status === "berlangsung" ? "Sedang berlangsung"
                  : status === "selesai" ? "Selesai" : "Belum mulai";
                const warnaBadge =
                  status === "berlangsung" ? { bg: "bg-primary", fg: colors.primaryForeground }
                  : status === "selesai" ? { bg: "bg-muted", fg: colors.mutedForeground }
                  : { bg: "bg-amber-100", fg: "#92400e" };

                return (
                  <Card key={idx} padding="md" className={gayaKartu}>
                    <View className="flex-row items-start gap-3">
                      <View className="items-center justify-center rounded-lg px-2 py-2 bg-primary/10" style={{ minWidth: 68 }}>
                        <Text className="text-[11px] font-bold text-primary">{jam(s.jam_mulai)}</Text>
                        <Text className="text-[10px] text-muted-foreground">s/d</Text>
                        <Text className="text-[11px] font-semibold text-primary">{jam(s.jam_selesai)}</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-foreground">{s.mata_pelajaran_nama}</Text>
                        <Text className="text-xs text-muted-foreground mt-0.5">
                          {[s.kelas_nama ? `Kelas ${s.kelas_nama}` : null, s.jam_ke ? `Jam ke-${s.jam_ke}` : null].filter(Boolean).join(" · ")}
                        </Text>
                        <View className={`self-start mt-2 px-2 py-0.5 rounded-full ${warnaBadge.bg}`}>
                          <Text className="text-[10px] font-medium" style={{ color: warnaBadge.fg }}>{labelStatus}</Text>
                        </View>
                      </View>
                    </View>
                  </Card>
                );
              })}
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {mode === "guru" && <TabBar activeTab={activeTab} onChange={setActiveTab} colors={colors} />}
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

      {!meta?.message && slots.length === 0 && agenda.length === 0 && (
        <Card padding="lg"><View className="items-center py-4"><Calendar size={32} color={colors.mutedForeground} /><Text className="text-sm text-muted-foreground mt-2">Belum ada jadwal pelajaran yang diatur.</Text></View></Card>
      )}

      {(slots.length > 0 || agenda.length > 0) && (
        <>
          <AcademicMonthCalendar hasSchedule={hasSchedule} agendaByDate={agendaByDate} selected={selectedDate} onSelectDate={setSelectedDate} />

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
            ) : selectedSlots.length > 0 ? (
              <View className="gap-2">
                {selectedSlots.map((s, idx) => {
                  const kegiatan = s.jenis === "kegiatan";
                  return (
                    <Card key={idx} padding="sm" className={kegiatan ? "opacity-80" : ""}>
                      <View className="flex-row items-center gap-3">
                        <View className={`items-center justify-center rounded-lg px-2 py-1.5 ${kegiatan ? "bg-muted" : "bg-primary/10"}`} style={{ minWidth: 64 }}>
                          {kegiatan ? <Coffee size={13} color={colors.mutedForeground} /> : <Clock size={13} color={colors.primary} />}
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
            ) : (
              <Card padding="md"><Text className="text-sm text-muted-foreground text-center">Tidak ada jadwal pada hari ini.</Text></Card>
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
        </>
      )}
      </ScrollView>
    </View>
  );
}

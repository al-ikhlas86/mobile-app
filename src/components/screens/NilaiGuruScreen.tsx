import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, TextInput, ScrollView, ActivityIndicator, Keyboard } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Clock, Lock, Send, Undo2, History, ClipboardPaste } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { SimplePicker } from "../ui/SimplePicker";
import { SimpleCalendarPicker } from "../ui/SimpleCalendarPicker";
import { api } from "../../services/api";
import { getActiveSession } from "../../services/authService";
import { useThemeColors } from "../../context/ThemeContext";
import { konfirmasi } from "../../utils/konfirmasi";
import {
  type KomponenNilai, LABEL_GRADE, LABEL_SEMESTER, parseNilaiInput, hitungNilaiAkhir, predikatDari, formatNilai,
  formatWaktuDb, defaultJadwalTerbit, warnaPredikat,
} from "../../utils/nilaiRaport";

// Nilai Raport - layar guru / wali kelas / admin (2026-10-02). Port native dari webview
// NilaiGuruScreen.tsx. SEMUA aturan (siapa boleh isi, nilai akhir, terkunci setelah terbit)
// diputuskan server (routes/raport.js); layar ini hanya menampilkan & mengirim isian.
// Mengetik langsung tersimpan otomatis (draf) - debounce 700 ms, hanya sel yang berubah.
//
// Beda dgn web (disengaja, karena platformnya lain):
//  - Tabel: kolom nama DIPISAH dari kolom nilai (nama tetap di kiri, kolom nilai di
//    ScrollView horizontal) krn RN tidak punya `position: sticky`. Tinggi baris dibuat tetap
//    supaya kedua sisi tetap sejajar.
//  - window.confirm -> Alert.alert (utils/konfirmasi.ts); <input datetime-local> ->
//    SimpleCalendarPicker (tanggal) + isian jam HH:MM, dirakit jadi "YYYY-MM-DDTHH:mm".
//  - Enter/panah bawah -> tombol "Next" keyboard (onSubmitEditing) pindah ke siswa berikutnya.
//  - Tambahan "Tempel dari Excel": kolom angka (decimal-pad) di Android bisa menyaring tab/
//    baris-baru saat ditempel, jadi disediakan kotak teks biasa sbg jalur tempel yang pasti jalan.

interface KelasOpsi {
  kelasId: number; kelasNama: string; tingkat: string | null; unitId: number; waliKelas: boolean; bisaSikap: boolean;
  mapel: { sourceId: number; nama: string }[];
}
interface Opsi {
  tahun: { sourceId: number; nama: string; aktif: boolean } | null;
  semesterDefault: "ganjil" | "genap";
  kelas: KelasOpsi[];
  peran: { admin: boolean; waliKelas: boolean; kepalaSekolah: boolean };
}
interface Akses { lihat: boolean; isi: boolean; ubahStatus: boolean; tarik: boolean }
interface StatusLembar { status: "draf" | "dijadwalkan" | "terbit"; terbitPada: string | null; terlihatOrangTua: boolean }
interface BarisSiswa { id: number; nama: string; nis: string; nilai: Record<string, number | null>; nilaiAkhir: number | null; predikat: string | null; tuntas: boolean | null }

type Semester = "ganjil" | "genap";
const SENTINEL_SIKAP = "sikap";

// Ukuran tabel nilai (dp). Tinggi baris TETAP supaya kolom nama (kiri) & kolom nilai (kanan) sejajar.
const NAMA_W = 120;
const KOLOM_W = 62;
const AKHIR_W = 72;
const ROW_H = 56;
const HEAD_H = 46;

// Akun Alumni (guru purna bakti) hanya boleh MELIHAT - sama pola GuruTugasScreen. Backend
// (blockAlumni) tetap penjaga utamanya, ini murni UX supaya tidak ada autosave yang pasti ditolak.
function aksesUntukAlumni(akses: Akses): Akses {
  return getActiveSession()?.isAlumni === true ? { ...akses, isi: false, ubahStatus: false, tarik: false } : akses;
}

function Memuat() {
  const colors = useThemeColors();
  return <View className="items-center justify-center py-12"><ActivityIndicator color={colors.primary} /></View>;
}

export function NilaiGuruScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [gerbang, setGerbang] = useState<"memuat" | "mati" | "ok">("memuat");
  const [opsi, setOpsi] = useState<Opsi | null>(null);
  const [error, setError] = useState("");
  const [semester, setSemester] = useState<Semester>("ganjil");
  const [kelasId, setKelasId] = useState("");
  const [mapel, setMapel] = useState("");

  useEffect(() => {
    let batal = false;
    (async () => {
      const st: any = await api.raportStatus();
      if (batal) return;
      if (!st?.success) { setError(st?.message ?? "Gagal memuat."); setGerbang("ok"); return; }
      if (!st.data.aktif && !st.data.bisaMengatur) { setGerbang("mati"); return; }
      const res: any = await api.raportOpsi();
      if (batal) return;
      if (!res?.success) {
        if (res?.code === "RAPORT_NONAKTIF") setGerbang("mati");
        else { setError(res?.message ?? "Gagal memuat daftar kelas."); setGerbang("ok"); }
        return;
      }
      setOpsi(res.data);
      setSemester(res.data.semesterDefault);
      const k = res.data.kelas[0];
      if (k) { setKelasId(String(k.kelasId)); setMapel(k.mapel[0] ? String(k.mapel[0].sourceId) : k.bisaSikap ? SENTINEL_SIKAP : ""); }
      setGerbang("ok");
    })();
    return () => { batal = true; };
  }, []);

  const kelasAktif = opsi?.kelas.find((k) => String(k.kelasId) === kelasId) ?? null;
  const opsiMapel = useMemo(() => {
    if (!kelasAktif) return [];
    const daftar = kelasAktif.mapel.map((m) => ({ value: String(m.sourceId), label: m.nama }));
    if (kelasAktif.bisaSikap) daftar.unshift({ value: SENTINEL_SIKAP, label: "Nilai Sikap" });
    return daftar;
  }, [kelasAktif]);

  function gantiKelas(v: string) {
    setKelasId(v);
    const k = opsi?.kelas.find((x) => String(x.kelasId) === v);
    setMapel(k ? (k.mapel[0] ? String(k.mapel[0].sourceId) : k.bisaSikap ? SENTINEL_SIKAP : "") : "");
  }

  if (gerbang === "memuat") return <View className="flex-1 bg-background"><Memuat /></View>;
  if (gerbang === "mati") {
    return (
      <View className="flex-1 bg-background items-center justify-center gap-3 px-8">
        <Lock size={32} color={colors.mutedForeground} />
        <Text className="text-sm text-muted-foreground text-center">Fitur Nilai belum diaktifkan oleh sekolah. Akan muncul di sini setelah siap digunakan.</Text>
      </View>
    );
  }
  if (error) return <View className="flex-1 bg-background px-4 pt-5"><Pesan tipe="galat">{error}</Pesan></View>;
  if (!opsi || opsi.kelas.length === 0) {
    return (
      <View className="flex-1 bg-background items-center justify-center gap-3 px-8">
        <AlertCircle size={32} color={colors.mutedForeground} />
        <Text className="text-sm text-muted-foreground text-center leading-5">
          Belum ada kelas atau mata pelajaran yang bisa Anda isi. Kelas dan mata pelajaran mengikuti Jadwal Pelajaran dan data wali kelas dari Data Master.
        </Text>
      </View>
    );
  }

  const adaPilihan = Boolean(kelasAktif && mapel);
  return (
    <KeyboardAwareScrollView
      className="flex-1 bg-background px-4 pt-5"
      contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 16 }}
      bottomOffset={20}
      keyboardShouldPersistTaps="handled"
    >
      {/* zIndex: dropdown SimplePicker harus menutupi kartu di bawahnya (Android menggambar
          saudara berikutnya di atas dropdown bila zIndex-nya sama). */}
      <View style={{ zIndex: 30 }}>
        <Card padding="md" className="gap-3">
          <View className="flex-row gap-2 p-1 bg-muted rounded-xl">
            {(["ganjil", "genap"] as Semester[]).map((s) => (
              <Pressable key={s} onPress={() => setSemester(s)} className={`flex-1 py-2 rounded-lg items-center ${semester === s ? "bg-card" : ""}`}>
                <Text className={`text-sm font-medium ${semester === s ? "text-foreground" : "text-muted-foreground"}`}>Semester {LABEL_SEMESTER[s]}</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ zIndex: 2 }}>
            <Text className="text-xs text-muted-foreground mb-1">Kelas</Text>
            <SimplePicker value={kelasId} onChange={gantiKelas}
              options={opsi.kelas.map((k) => ({ value: String(k.kelasId), label: `${k.kelasNama}${k.waliKelas ? " (wali kelas)" : ""}` }))} />
          </View>
          <View style={{ zIndex: 1 }}>
            <Text className="text-xs text-muted-foreground mb-1">Mata pelajaran</Text>
            <SimplePicker value={mapel} onChange={setMapel} options={opsiMapel} placeholder="Pilih mata pelajaran" />
          </View>
          {opsi.tahun && <Text className="text-[11px] text-muted-foreground">Tahun ajaran {opsi.tahun.nama}{opsi.tahun.aktif ? "" : " (arsip, hanya baca)"}</Text>}
        </Card>
      </View>

      {adaPilihan && kelasAktif && (mapel === SENTINEL_SIKAP
        ? <LembarSikap key={`s-${kelasAktif.kelasId}-${semester}`} kelasId={kelasAktif.kelasId} semester={semester} />
        : <LembarNilai key={`n-${kelasAktif.kelasId}-${mapel}-${semester}`} kelasId={kelasAktif.kelasId} mapelSourceId={Number(mapel)} semester={semester} />)}
    </KeyboardAwareScrollView>
  );
}

function Pesan({ tipe, children }: { tipe: "galat" | "info" | "sukses"; children: React.ReactNode }) {
  const colors = useThemeColors();
  const warna = tipe === "galat" ? "#dc2626" : tipe === "sukses" ? "#16a34a" : colors.mutedForeground;
  const Ikon = tipe === "sukses" ? CheckCircle2 : AlertCircle;
  return (
    <Card padding="md"><View className="flex-row items-start gap-2.5"><Ikon size={16} color={warna} /><Text className="text-sm text-foreground flex-1">{children}</Text></View></Card>
  );
}

// ---------------------------------------------------------------- status tayang (dipakai nilai & sikap)
function PanelStatus({ status, akses, belumLengkap, sebelumUbah, onUbah }: {
  status: StatusLembar; akses: Akses; belumLengkap: number;
  sebelumUbah: () => Promise<boolean>;
  onUbah: (status: "draf" | "dijadwalkan" | "terbit", terbitPada?: string, paksa?: boolean) => Promise<any>;
}) {
  const colors = useThemeColors();
  const [bekerja, setBekerja] = useState(false);
  // Jadwal terbit = tanggal (SimpleCalendarPicker, "YYYY-MM-DD") + jam ("HH:MM", WIB); null = form tertutup.
  const [jadwal, setJadwal] = useState<{ tanggal: string; jam: string } | null>(null);
  const [pesan, setPesan] = useState("");

  async function jalankan(target: "draf" | "dijadwalkan" | "terbit", terbitPada?: string) {
    setPesan("");
    if (target === "terbit" && !(await konfirmasi("Terbitkan nilai", "Terbitkan nilai ini sekarang? Orang tua akan menerima notifikasi dan nilai terkunci (tidak bisa diubah guru).", "Terbitkan"))) return;
    if (target === "draf" && status.status === "terbit" && !(await konfirmasi("Tarik ke draf", "Tarik nilai kembali ke draf? Orang tua tidak bisa melihatnya lagi sampai diterbitkan ulang.", "Tarik"))) return;
    setBekerja(true);
    try {
      if (target !== "draf" && !(await sebelumUbah())) { setPesan("Masih ada isian yang belum tersimpan. Coba lagi sebentar."); return; }
      let res = await onUbah(target, terbitPada);
      if (res?.code === "BELUM_LENGKAP") {
        if (!(await konfirmasi("Nilai belum lengkap", res.message))) return;
        res = await onUbah(target, terbitPada, true);
      }
      if (!res?.success) setPesan(res?.message ?? "Gagal mengubah status.");
      else setJadwal(null);
    } finally {
      setBekerja(false);
    }
  }

  function bukaJadwal() {
    if (jadwal !== null) { setJadwal(null); return; }
    const awal = status.terbitPada ? status.terbitPada.replace(" ", "T").slice(0, 16) : defaultJadwalTerbit();
    const [tanggal, jam] = awal.split("T");
    setJadwal({ tanggal, jam });
  }

  function simpanJadwal() {
    if (!jadwal) return;
    // Terima "7:00" / "07.00" / "07:00" -> "07:00".
    const m = /^(\d{1,2})[:.](\d{2})$/.exec(jadwal.jam.trim());
    if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) { setPesan("Jam harus berformat HH:MM, contoh 07:00."); return; }
    jalankan("dijadwalkan", `${jadwal.tanggal}T${m[1].padStart(2, "0")}:${m[2]}`);
  }

  const badge = status.status === "terbit"
    ? <Badge variant="success">Terbit</Badge>
    : status.status === "dijadwalkan"
      ? <Badge variant="warning">{`Dijadwalkan ${formatWaktuDb(status.terbitPada)}`}</Badge>
      : <Badge variant="muted">Draf (belum terlihat orang tua)</Badge>;

  return (
    <Card padding="md" className="gap-3">
      <View className="flex-row flex-wrap items-center gap-2">
        <Text className="text-sm font-semibold text-foreground">Status tayang</Text>
        {badge}
      </View>
      {status.status === "terbit" && (
        <View className="flex-row items-start gap-1.5">
          <Lock size={12} color={colors.mutedForeground} style={{ marginTop: 2 }} />
          <Text className="text-xs text-muted-foreground flex-1">Terkunci. Hanya wali kelas, kepala sekolah, atau admin yang bisa menarik kembali ke draf.</Text>
        </View>
      )}
      {status.status !== "terbit" && belumLengkap > 0 && <Text className="text-xs text-amber-700 dark:text-amber-400">{belumLengkap} siswa belum lengkap.</Text>}

      {(akses.ubahStatus || akses.tarik) && (
        <View className="flex-row flex-wrap gap-2">
          {status.status !== "terbit" && akses.ubahStatus && (
            <>
              <Button size="sm" disabled={bekerja} onPress={() => jalankan("terbit")}>
                <Send size={14} color={colors.primaryForeground} />{" "}Terbitkan sekarang
              </Button>
              <Button size="sm" variant="outline" disabled={bekerja} onPress={bukaJadwal}>
                <Clock size={14} color={colors.primary} />{" "}{status.status === "dijadwalkan" ? "Ubah jadwal" : "Jadwalkan"}
              </Button>
              {status.status === "dijadwalkan" && <Button size="sm" variant="ghost" disabled={bekerja} onPress={() => jalankan("draf")}>Batalkan jadwal</Button>}
            </>
          )}
          {status.status === "terbit" && akses.tarik && (
            <Button size="sm" variant="outline" disabled={bekerja} onPress={() => jalankan("draf")}>
              <Undo2 size={14} color={colors.primary} />{" "}Tarik ke draf
            </Button>
          )}
        </View>
      )}
      {jadwal !== null && (
        <View className="gap-2">
          <View>
            <Text className="text-xs font-medium text-foreground mb-1.5">Tanggal terbit</Text>
            <SimpleCalendarPicker value={jadwal.tanggal} onChange={(v) => setJadwal((j) => (j ? { ...j, tanggal: v } : j))} />
          </View>
          <View>
            <Text className="text-xs font-medium text-foreground mb-1.5">Jam terbit (WIB)</Text>
            <Input value={jadwal.jam} onChangeText={(v) => setJadwal((j) => (j ? { ...j, jam: v } : j))} placeholder="HH:MM, contoh 07:00" maxLength={5} keyboardType="numbers-and-punctuation" />
          </View>
          <View className="flex-row">
            <Button size="sm" disabled={bekerja} onPress={simpanJadwal}>Simpan jadwal</Button>
          </View>
        </View>
      )}
      {bekerja && (
        <View className="flex-row items-center gap-1.5">
          <ActivityIndicator size="small" color={colors.mutedForeground} />
          <Text className="text-xs text-muted-foreground">Memproses...</Text>
        </View>
      )}
      {pesan ? <Text className="text-xs text-red-600 dark:text-red-400">{pesan}</Text> : null}
    </Card>
  );
}

type StatusSimpan = "diam" | "menyimpan" | "tersimpan" | "gagal";
function IndikatorSimpan({ status, pesan, onCoba }: { status: StatusSimpan; pesan: string; onCoba: () => void }) {
  const colors = useThemeColors();
  if (status === "menyimpan") {
    return <View className="flex-row items-center gap-1.5"><ActivityIndicator size="small" color={colors.mutedForeground} /><Text className="text-xs text-muted-foreground">Menyimpan...</Text></View>;
  }
  if (status === "tersimpan") {
    return <View className="flex-row items-center gap-1.5"><CheckCircle2 size={12} color="#16a34a" /><Text className="text-xs text-green-600 dark:text-green-400">Tersimpan otomatis</Text></View>;
  }
  if (status === "gagal") {
    return (
      <View className="flex-row flex-wrap items-center gap-1.5">
        <AlertCircle size={12} color="#dc2626" />
        <Text className="text-xs text-red-600 dark:text-red-400">{pesan || "Belum tersimpan."}</Text>
        <Pressable onPress={onCoba} hitSlop={8}><Text className="text-xs font-medium text-red-600 dark:text-red-400 underline">Coba lagi</Text></Pressable>
      </View>
    );
  }
  return <Text className="text-xs text-muted-foreground">Ketik nilai, tersimpan otomatis sebagai draf.</Text>;
}

// ---------------------------------------------------------------- lembar nilai per mapel
interface PropsBaris {
  r: number; siswaId: number; komponen: KomponenNilai[]; teksBaris: Record<string, string> | undefined;
  kodeSalah: string; akhirServer: number | null; kkm: number; bisaIsi: boolean;
  inputRefs: React.MutableRefObject<Record<string, TextInput | null>>;
  onUbah: (studentId: number, kode: string, teks: string, r: number, c: number) => void;
  onSubmit: (r: number, c: number) => void;
  onFokus: (r: number, c: number) => void;
}

// Satu baris sisi KANAN (sel nilai + Akhir). React.memo: mengetik di 1 sel hanya merender ulang
// baris itu (props lain stabil), jadi kelas 30-40 siswa tetap lancar di HP menengah ke bawah.
const BarisNilai = React.memo(function BarisNilai({ r, siswaId, komponen, teksBaris, kodeSalah, akhirServer, kkm, bisaIsi, inputRefs, onUbah, onSubmit, onFokus }: PropsBaris) {
  const nilai: Record<string, number | null> = {};
  for (const k of komponen) nilai[k.kode] = parseNilaiInput(teksBaris?.[k.kode] ?? "").nilai;
  const akhirLokal = hitungNilaiAkhir(komponen, nilai);
  const akhir = akhirLokal ?? akhirServer;
  const pred = predikatDari(akhirLokal);
  return (
    <View style={{ height: ROW_H, flexDirection: "row", alignItems: "center" }} className="border-t border-border/60">
      {komponen.map((k, c) => {
        const salah = kodeSalah.includes(`,${k.kode},`);
        return (
          <View key={k.kode} style={{ width: KOLOM_W, alignItems: "center" }}>
            <TextInput
              ref={(el) => { inputRefs.current[`${r}|${c}`] = el; }}
              value={teksBaris?.[k.kode] ?? ""}
              editable={bisaIsi}
              keyboardType="decimal-pad"
              returnKeyType="next"
              submitBehavior="submit"
              selectTextOnFocus
              onChangeText={(t) => onUbah(siswaId, k.kode, t, r, c)}
              onSubmitEditing={() => onSubmit(r, c)}
              onFocus={() => onFokus(r, c)}
              style={{ width: 52, height: 40, paddingVertical: 0, paddingHorizontal: 2 }}
              className={`text-center text-sm text-foreground bg-input-background rounded-lg border ${salah ? "border-red-500" : "border-border"} ${bisaIsi ? "" : "opacity-60"}`}
            />
          </View>
        );
      })}
      <View style={{ width: AKHIR_W, alignItems: "center" }}>
        <Text className={`text-sm font-semibold ${warnaPredikat(pred)}`}>{formatNilai(akhir)}</Text>
        {pred && <Text className={`text-[10px] ${warnaPredikat(pred)}`}>{pred}{akhirLokal !== null && akhirLokal < kkm ? " · < KKM" : ""}</Text>}
      </View>
    </View>
  );
});

function LembarNilai({ kelasId, mapelSourceId, semester }: { kelasId: number; mapelSourceId: number; semester: Semester }) {
  const colors = useThemeColors();
  const [memuat, setMemuat] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<any>(null);
  const [teks, setTeks] = useState<Record<number, Record<string, string>>>({});
  const [galat, setGalat] = useState<Record<string, string>>({});
  const [statusSimpan, setStatusSimpan] = useState<StatusSimpan>("diam");
  const [pesanSimpan, setPesanSimpan] = useState("");
  const [status, setStatus] = useState<StatusLembar | null>(null);
  const [akhirServer, setAkhirServer] = useState<Record<number, { nilaiAkhir: number | null }>>({});
  const [riwayatTerbuka, setRiwayatTerbuka] = useState(false);
  const [tempelTerbuka, setTempelTerbuka] = useState(false);
  const [tempelTeks, setTempelTeks] = useState("");
  const [infoTempel, setInfoTempel] = useState("");

  const inputRefs = useRef<Record<string, TextInput | null>>({});
  const kotor = useRef<Map<string, { studentId: number; kode: string }>>(new Map());
  const teksRef = useRef(teks);
  teksRef.current = teks;
  const dataRef = useRef<any>(null);
  dataRef.current = data;
  const selTerakhir = useRef({ r: 0, c: 0 });
  const pewaktu = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sedangSimpan = useRef(false);
  const sudahUnmount = useRef(false);
  useEffect(() => () => { sudahUnmount.current = true; if (pewaktu.current) clearTimeout(pewaktu.current); }, []);

  const muat = useCallback(async () => {
    setMemuat(true);
    setError("");
    const res: any = await api.raportLembar({ kelasId, mapelSourceId, semester });
    if (sudahUnmount.current) return;
    if (!res?.success) { setError(res?.message ?? "Gagal memuat lembar nilai."); setMemuat(false); return; }
    setData(res.data);
    setStatus(res.data.status);
    const awal: Record<number, Record<string, string>> = {};
    for (const s of res.data.siswa as BarisSiswa[]) {
      awal[s.id] = {};
      for (const k of res.data.komponen as KomponenNilai[]) awal[s.id][k.kode] = s.nilai[k.kode] === null ? "" : String(s.nilai[k.kode]).replace(".", ",");
    }
    setTeks(awal);
    setGalat({});
    setAkhirServer({});
    kotor.current.clear();
    setMemuat(false);
  }, [kelasId, mapelSourceId, semester]);
  useEffect(() => { muat(); }, [muat]);

  const komponen: KomponenNilai[] = data?.komponen ?? [];
  const akses: Akses = aksesUntukAlumni(data?.akses ?? { lihat: false, isi: false, ubahStatus: false, tarik: false });

  const simpanSekarang = useCallback(async (): Promise<boolean> => {
    if (pewaktu.current) { clearTimeout(pewaktu.current); pewaktu.current = null; }
    if (sedangSimpan.current) return false;
    if (kotor.current.size === 0) return true;
    sedangSimpan.current = true;
    setStatusSimpan("menyimpan");
    const kirim = [...kotor.current.values()].map((e) => ({ ...e, teks: teksRef.current[e.studentId]?.[e.kode] ?? "" }));
    const res: any = await api.raportSimpanNilai({
      kelasId, mapelSourceId, semester, sumber: "app",
      perubahan: kirim.map((e) => ({ studentId: e.studentId, kode: e.kode, nilai: parseNilaiInput(e.teks).nilai })),
    });
    sedangSimpan.current = false;
    if (sudahUnmount.current) return false;
    if (!res?.success) {
      setStatusSimpan("gagal");
      setPesanSimpan(res?.message ?? "Belum tersimpan.");
      pewaktu.current = setTimeout(() => { simpanSekarang(); }, 8000); // coba lagi otomatis
      return false;
    }
    for (const e of kirim) {
      if ((teksRef.current[e.studentId]?.[e.kode] ?? "") === e.teks) kotor.current.delete(`${e.studentId}|${e.kode}`);
    }
    const ditolak: { studentId: number; kode: string; alasan: string }[] = res.data.ditolak ?? [];
    if (ditolak.length) {
      setGalat((g) => { const n = { ...g }; for (const d of ditolak) { n[`${d.studentId}|${d.kode}`] = d.alasan; kotor.current.delete(`${d.studentId}|${d.kode}`); } return n; });
    }
    setAkhirServer((a) => { const n = { ...a }; for (const b of res.data.baris ?? []) n[b.id] = { nilaiAkhir: b.nilaiAkhir }; return n; });
    setStatusSimpan("tersimpan");
    if (kotor.current.size > 0) pewaktu.current = setTimeout(() => { simpanSekarang(); }, 700);
    return kotor.current.size === 0;
  }, [kelasId, mapelSourceId, semester]);

  // Stabil (hanya bergantung simpanSekarang yang stabil) supaya React.memo BarisNilai efektif.
  const setSel = useCallback((studentId: number, kode: string, nilaiTeks: string) => {
    const cek = parseNilaiInput(nilaiTeks);
    setTeks((t) => ({ ...t, [studentId]: { ...(t[studentId] ?? {}), [kode]: nilaiTeks } }));
    teksRef.current = { ...teksRef.current, [studentId]: { ...(teksRef.current[studentId] ?? {}), [kode]: nilaiTeks } };
    const kunci = `${studentId}|${kode}`;
    if (!cek.ok) {
      setGalat((g) => ({ ...g, [kunci]: "Isi angka 0-100." }));
      kotor.current.delete(kunci);
      return;
    }
    setGalat((g) => { if (!(kunci in g)) return g; const n = { ...g }; delete n[kunci]; return n; });
    kotor.current.set(kunci, { studentId, kode });
    setStatusSimpan("diam");
    if (pewaktu.current) clearTimeout(pewaktu.current);
    pewaktu.current = setTimeout(() => { simpanSekarang(); }, 700);
  }, [simpanSekarang]);

  // Tempel banyak sel (Excel/Sheets): baris -> siswa berikutnya, kolom (tab) -> komponen berikutnya.
  const tempelBlok = useCallback((mentah: string, r: number, c: number) => {
    const baris = mentah.replace(/\r/g, "").replace(/\n+$/, "").split("\n").map((b) => b.split("\t"));
    const siswa: BarisSiswa[] = dataRef.current?.siswa ?? [];
    const kompon: KomponenNilai[] = dataRef.current?.komponen ?? [];
    baris.forEach((kolomKolom, i) => {
      const s = siswa[r + i];
      if (!s) return;
      kolomKolom.forEach((nilaiTeks, j) => {
        const k = kompon[c + j];
        if (k) setSel(s.id, k.kode, nilaiTeks.trim());
      });
    });
  }, [setSel]);

  const onUbah = useCallback((studentId: number, kode: string, nilaiTeks: string, r: number, c: number) => {
    // Satu sel: perilaku normal. Mengandung tab/baris-baru = hasil tempel blok dari Excel.
    if (/[\t\n]/.test(nilaiTeks.trim())) tempelBlok(nilaiTeks, r, c);
    else setSel(studentId, kode, nilaiTeks);
  }, [setSel, tempelBlok]);

  const fokus = useCallback((r: number, c: number) => {
    const el = inputRefs.current[`${r}|${c}`];
    if (el) el.focus();
    else Keyboard.dismiss(); // sudah baris terakhir
  }, []);
  const onSubmit = useCallback((r: number, c: number) => fokus(r + 1, c), [fokus]);
  const onFokus = useCallback((r: number, c: number) => { selTerakhir.current = { r, c }; }, []);

  function terapkanTempel() {
    if (tempelTeks.trim() === "") return;
    const { r, c } = selTerakhir.current;
    tempelBlok(tempelTeks, r, c);
    const s = dataRef.current?.siswa?.[r];
    const k = dataRef.current?.komponen?.[c];
    setInfoTempel(`Ditempel mulai dari ${s?.nama ?? "siswa pertama"} - ${k?.nama ?? "komponen pertama"}.`);
    setTempelTeks("");
  }

  const ringkas = useMemo(() => {
    if (!data) return { lengkap: 0, belum: 0 };
    let lengkap = 0;
    for (const s of data.siswa as BarisSiswa[]) {
      const nilai: Record<string, number | null> = {};
      for (const k of komponen) nilai[k.kode] = parseNilaiInput(teks[s.id]?.[k.kode] ?? "").nilai;
      if (hitungNilaiAkhir(komponen, nilai) !== null) lengkap++;
    }
    return { lengkap, belum: data.siswa.length - lengkap };
  }, [data, komponen, teks]);

  if (memuat) return <Memuat />;
  if (error) return <Pesan tipe="galat">{error}</Pesan>;
  if (!data || !status) return null;
  const siswa: BarisSiswa[] = data.siswa;
  const jumlahGalat = Object.keys(galat).length;
  const pesanGalat = Object.values(galat)[0];

  return (
    <View className="gap-4">
      {/* zIndex: kalender jadwal di PanelStatus tidak boleh tertutup kartu tabel di bawahnya */}
      <View style={{ zIndex: 20 }}>
        <PanelStatus
          status={status} akses={akses} belumLengkap={ringkas.belum}
          sebelumUbah={async () => { if (kotor.current.size === 0 && !sedangSimpan.current) return true; return simpanSekarang(); }}
          onUbah={async (target, terbitPada, paksa) => {
            const res: any = await api.raportUbahStatus({ kelasId, mapelSourceId, semester, status: target, terbitPada, paksa });
            if (res?.success) await muat();
            return res;
          }}
        />
      </View>

      <Card padding="none" className="overflow-hidden">
        <View className="flex-row flex-wrap items-center justify-between gap-2 px-4 pt-3 pb-2">
          <View className="flex-shrink">
            <Text className="text-sm font-semibold text-foreground">{data.mapel.nama} - {data.kelas.nama}</Text>
            <Text className="text-[11px] text-muted-foreground">KKM {data.kkm} · {ringkas.lengkap}/{siswa.length} siswa lengkap</Text>
          </View>
          {akses.isi && <IndikatorSimpan status={statusSimpan} pesan={pesanSimpan} onCoba={() => { simpanSekarang(); }} />}
        </View>
        {!akses.isi && (
          <View className="flex-row items-center gap-1.5 px-4 pb-2">
            <Lock size={12} color={colors.mutedForeground} />
            <Text className="text-xs text-muted-foreground flex-1">
              {status.terlihatOrangTua ? "Nilai sudah terbit sehingga tidak bisa diubah." : "Anda hanya bisa melihat lembar ini."}
            </Text>
          </View>
        )}
        {siswa.length === 0 ? (
          <Text className="px-4 pb-4 text-sm text-muted-foreground">Belum ada siswa aktif di kelas ini.</Text>
        ) : (
          <View className="flex-row border-t border-border">
            {/* kolom nama - tetap di kiri */}
            <View style={{ width: NAMA_W }} className="bg-card">
              <View style={{ height: HEAD_H, justifyContent: "center" }} className="bg-muted px-2">
                <Text className="text-xs font-medium text-muted-foreground">Siswa</Text>
              </View>
              {siswa.map((s) => (
                <View key={s.id} style={{ height: ROW_H, justifyContent: "center" }} className="border-t border-border/60 px-2">
                  <Text numberOfLines={2} className="text-[13px] text-foreground leading-4">{s.nama}</Text>
                  <Text numberOfLines={1} className="text-[10px] text-muted-foreground">{s.nis}</Text>
                </View>
              ))}
            </View>
            {/* kolom nilai - bisa digeser ke samping bila tidak muat */}
            <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator style={{ flex: 1 }}>
              <View>
                <View style={{ height: HEAD_H, flexDirection: "row", alignItems: "center" }} className="bg-muted">
                  {komponen.map((k) => (
                    <View key={k.kode} style={{ width: KOLOM_W, alignItems: "center", paddingHorizontal: 2 }}>
                      <Text numberOfLines={1} className="text-xs font-medium text-muted-foreground">{k.nama}</Text>
                      <Text className="text-[10px] text-muted-foreground">{k.bobot}%</Text>
                    </View>
                  ))}
                  <View style={{ width: AKHIR_W, alignItems: "center" }}>
                    <Text className="text-xs font-medium text-muted-foreground">Akhir</Text>
                  </View>
                </View>
                {siswa.map((s, r) => {
                  let kodeSalah = ",";
                  for (const k of komponen) if (galat[`${s.id}|${k.kode}`]) kodeSalah += `${k.kode},`;
                  return (
                    <BarisNilai
                      key={s.id} r={r} siswaId={s.id} komponen={komponen} teksBaris={teks[s.id]} kodeSalah={kodeSalah}
                      akhirServer={akhirServer[s.id]?.nilaiAkhir ?? null} kkm={data.kkm} bisaIsi={akses.isi}
                      inputRefs={inputRefs} onUbah={onUbah} onSubmit={onSubmit} onFokus={onFokus}
                    />
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}
        {jumlahGalat > 0 && (
          <Text className="px-4 py-2 text-[11px] text-red-600 dark:text-red-400 border-t border-border">
            {jumlahGalat} isian salah (kotak merah): {pesanGalat}
          </Text>
        )}
        {akses.isi && siswa.length > 0 && (
          <Text className="px-4 py-2 text-[11px] text-muted-foreground border-t border-border">
            Tips: tombol Next di keyboard pindah ke siswa berikutnya pada kolom yang sama. Geser tabel ke samping bila kolom tidak muat.
          </Text>
        )}
      </Card>

      {akses.isi && siswa.length > 0 && (
        <Card padding="none">
          <Pressable onPress={() => setTempelTerbuka((v) => !v)} className="flex-row items-center justify-between gap-2 px-4 py-3">
            <View className="flex-row items-center gap-2">
              <ClipboardPaste size={15} color={colors.foreground} />
              <Text className="text-sm font-semibold text-foreground">Tempel dari Excel</Text>
            </View>
            {tempelTerbuka ? <ChevronUp size={16} color={colors.mutedForeground} /> : <ChevronDown size={16} color={colors.mutedForeground} />}
          </Pressable>
          {tempelTerbuka && (
            <View className="px-4 pb-4 pt-3 border-t border-border gap-2">
              <Text className="text-[11px] text-muted-foreground leading-4">
                Salin blok nilai dari Excel/Sheets (baris = siswa berikutnya, kolom = komponen berikutnya), tempel di kotak ini,
                lalu ketuk Terapkan. Dimulai dari sel yang terakhir Anda ketuk di tabel (bila belum ada: siswa pertama, komponen pertama).
              </Text>
              <Input
                value={tempelTeks} onChangeText={setTempelTeks} multiline numberOfLines={4}
                placeholder={"85\t90\t78\t88\n70\t75\t80\t82"}
                style={{ minHeight: 96, textAlignVertical: "top", paddingTop: 12 }}
              />
              <View className="flex-row">
                <Button size="sm" disabled={tempelTeks.trim() === ""} onPress={terapkanTempel}>Terapkan</Button>
              </View>
              {infoTempel ? <Text className="text-xs text-green-600 dark:text-green-400">{infoTempel}</Text> : null}
            </View>
          )}
        </Card>
      )}

      <RiwayatPanel terbuka={riwayatTerbuka} setTerbuka={setRiwayatTerbuka} kelasId={kelasId} mapelSourceId={mapelSourceId} semester={semester} komponen={komponen} versi={statusSimpan === "tersimpan" ? 1 : 0} />
    </View>
  );
}

function RiwayatPanel({ terbuka, setTerbuka, kelasId, mapelSourceId, semester, komponen, versi }: {
  terbuka: boolean; setTerbuka: (b: boolean) => void; kelasId: number; mapelSourceId: number; semester: Semester; komponen: KomponenNilai[]; versi: number;
}) {
  const colors = useThemeColors();
  const [baris, setBaris] = useState<any[] | null>(null);
  const [memuat, setMemuat] = useState(false);
  useEffect(() => {
    if (!terbuka) return;
    let batal = false;
    setMemuat(true);
    api.raportRiwayat({ kelasId, mapelSourceId, semester }).then((res: any) => {
      if (batal) return;
      setBaris(res?.success ? res.data : []);
      setMemuat(false);
    });
    return () => { batal = true; };
  }, [terbuka, kelasId, mapelSourceId, semester, versi]);
  const namaKomponen = (kode: string) => (kode === "sikap" ? "Sikap" : komponen.find((k) => k.kode === kode)?.nama ?? kode);
  return (
    <Card padding="none">
      <Pressable onPress={() => setTerbuka(!terbuka)} className="flex-row items-center justify-between gap-2 px-4 py-3">
        <View className="flex-row items-center gap-2">
          <History size={15} color={colors.foreground} />
          <Text className="text-sm font-semibold text-foreground">Riwayat perubahan</Text>
        </View>
        {terbuka ? <ChevronUp size={16} color={colors.mutedForeground} /> : <ChevronDown size={16} color={colors.mutedForeground} />}
      </Pressable>
      {terbuka && (
        <View className="px-4 pb-4 pt-3 border-t border-border gap-2">
          {memuat && <ActivityIndicator size="small" color={colors.mutedForeground} />}
          {!memuat && baris && baris.length === 0 && <Text className="text-xs text-muted-foreground">Belum ada perubahan tercatat.</Text>}
          {baris?.map((b) => (
            <View key={b.id}>
              <Text className="text-[11px] text-muted-foreground">{formatWaktuDb(b.created_at)} · {b.oleh ?? "-"}{b.sumber === "excel" ? " (Excel)" : ""}</Text>
              <Text className="text-xs text-foreground leading-4">
                {b.siswa_nama} - {namaKomponen(b.komponen_kode)}: {b.nilai_lama ?? "kosong"} → {b.nilai_baru ?? "kosong"}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- lembar nilai sikap (wali kelas)
const WARNA_GRADE: Record<string, string> = {
  sangat_baik: "bg-green-600 border-green-600",
  baik: "bg-blue-600 border-blue-600",
  cukup: "bg-amber-500 border-amber-500",
  perlu_bimbingan: "bg-red-600 border-red-600",
};

function LembarSikap({ kelasId, semester }: { kelasId: number; semester: Semester }) {
  const colors = useThemeColors();
  const [memuat, setMemuat] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<any>(null);
  const [status, setStatus] = useState<StatusLembar | null>(null);
  const [grade, setGrade] = useState<Record<number, string | null>>({});
  const [catatan, setCatatan] = useState<Record<number, string>>({});
  const [terbukaCatatan, setTerbukaCatatan] = useState<Record<number, boolean>>({});
  const [statusSimpan, setStatusSimpan] = useState<StatusSimpan>("diam");
  const [pesanSimpan, setPesanSimpan] = useState("");
  const [riwayatTerbuka, setRiwayatTerbuka] = useState(false);
  const antrean = useRef<Map<number, { grade: string | null; catatan?: string | null }>>(new Map());
  const sedangSimpan = useRef(false);
  const sudahUnmount = useRef(false);
  const pewaktu = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { sudahUnmount.current = true; if (pewaktu.current) clearTimeout(pewaktu.current); }, []);

  const muat = useCallback(async () => {
    setMemuat(true);
    setError("");
    const res: any = await api.raportSikap({ kelasId, semester });
    if (sudahUnmount.current) return;
    if (!res?.success) { setError(res?.message ?? "Gagal memuat nilai sikap."); setMemuat(false); return; }
    setData(res.data);
    setStatus(res.data.status);
    const g: Record<number, string | null> = {};
    const c: Record<number, string> = {};
    for (const s of res.data.siswa) { g[s.id] = s.grade; c[s.id] = s.catatan ?? ""; }
    setGrade(g); setCatatan(c); setTerbukaCatatan({});
    antrean.current.clear();
    setMemuat(false);
  }, [kelasId, semester]);
  useEffect(() => { muat(); }, [muat]);

  const akses: Akses = aksesUntukAlumni(data?.akses ?? { lihat: false, isi: false, ubahStatus: false, tarik: false });

  const simpanSekarang = useCallback(async (): Promise<boolean> => {
    if (pewaktu.current) { clearTimeout(pewaktu.current); pewaktu.current = null; }
    if (sedangSimpan.current) return false;
    if (antrean.current.size === 0) return true;
    sedangSimpan.current = true;
    setStatusSimpan("menyimpan");
    const kirim = [...antrean.current.entries()];
    const res: any = await api.raportSimpanSikap({
      kelasId, semester, sumber: "app",
      perubahan: kirim.map(([studentId, v]) => ({ studentId, grade: v.grade, ...(v.catatan !== undefined ? { catatan: v.catatan } : {}) })),
    });
    sedangSimpan.current = false;
    if (sudahUnmount.current) return false;
    if (!res?.success) {
      setStatusSimpan("gagal"); setPesanSimpan(res?.message ?? "Belum tersimpan.");
      pewaktu.current = setTimeout(() => { simpanSekarang(); }, 8000);
      return false;
    }
    for (const [id, v] of kirim) {
      const sekarang = antrean.current.get(id);
      if (sekarang && sekarang.grade === v.grade && sekarang.catatan === v.catatan) antrean.current.delete(id);
    }
    setStatusSimpan("tersimpan");
    if (antrean.current.size > 0) pewaktu.current = setTimeout(() => { simpanSekarang(); }, 500);
    return antrean.current.size === 0;
  }, [kelasId, semester]);

  function jadwalkan(ms = 400) {
    if (pewaktu.current) clearTimeout(pewaktu.current);
    pewaktu.current = setTimeout(() => { simpanSekarang(); }, ms);
  }

  function pilih(studentId: number, g: string) {
    if (!akses.isi) return;
    const baru = grade[studentId] === g ? null : g; // ketuk lagi = kosongkan
    setGrade((x) => ({ ...x, [studentId]: baru }));
    const lama = antrean.current.get(studentId);
    antrean.current.set(studentId, { grade: baru, ...(lama?.catatan !== undefined ? { catatan: lama.catatan } : {}) });
    setStatusSimpan("diam");
    jadwalkan(300);
  }

  function ubahCatatan(studentId: number, teks: string) {
    setCatatan((x) => ({ ...x, [studentId]: teks }));
    antrean.current.set(studentId, { grade: grade[studentId] ?? null, catatan: teks.trim() === "" ? null : teks });
    setStatusSimpan("diam");
    jadwalkan(900);
  }

  if (memuat) return <Memuat />;
  if (error) return <Pesan tipe="galat">{error}</Pesan>;
  if (!data || !status) return null;
  const siswa: { id: number; nama: string; nis: string }[] = data.siswa;
  const lengkap = siswa.filter((s) => grade[s.id]).length;

  return (
    <View className="gap-4">
      <View style={{ zIndex: 20 }}>
        <PanelStatus
          status={status} akses={akses} belumLengkap={siswa.length - lengkap}
          sebelumUbah={async () => { if (antrean.current.size === 0 && !sedangSimpan.current) return true; return simpanSekarang(); }}
          onUbah={async (target, terbitPada, paksa) => {
            const res: any = await api.raportUbahStatus({ kelasId, mapelSourceId: 0, semester, status: target, terbitPada, paksa });
            if (res?.success) await muat();
            return res;
          }}
        />
      </View>
      <Card padding="none" className="overflow-hidden">
        <View className="flex-row flex-wrap items-center justify-between gap-2 px-4 pt-3 pb-2">
          <View className="flex-shrink">
            <Text className="text-sm font-semibold text-foreground">Nilai Sikap - {data.kelas.nama}</Text>
            <Text className="text-[11px] text-muted-foreground">{lengkap}/{siswa.length} siswa terisi</Text>
          </View>
          {akses.isi && <IndikatorSimpan status={statusSimpan} pesan={pesanSimpan} onCoba={() => { simpanSekarang(); }} />}
        </View>
        {!akses.isi && (
          <View className="flex-row items-center gap-1.5 px-4 pb-2">
            <Lock size={12} color={colors.mutedForeground} />
            <Text className="text-xs text-muted-foreground flex-1">
              {status.terlihatOrangTua ? "Nilai sikap sudah terbit sehingga tidak bisa diubah." : "Anda hanya bisa melihat lembar ini."}
            </Text>
          </View>
        )}
        <View className="border-t border-border">
          {siswa.map((s, i) => (
            <View key={s.id} className={`px-4 py-3 gap-2 ${i > 0 ? "border-t border-border/60" : ""}`}>
              <View className="flex-row items-baseline justify-between gap-2">
                <Text className="text-sm text-foreground flex-1">{s.nama}</Text>
                <Text className="text-[10px] text-muted-foreground">{s.nis}</Text>
              </View>
              <View className="flex-row flex-wrap gap-1.5">
                {(data.pilihan as { nilai: string; label: string }[]).map((p) => {
                  const aktif = grade[s.id] === p.nilai;
                  return (
                    <Pressable key={p.nilai} disabled={!akses.isi} onPress={() => pilih(s.id, p.nilai)}
                      style={{ width: "48.8%" }}
                      className={`rounded-lg border px-2 py-2.5 items-center ${aktif ? WARNA_GRADE[p.nilai] : "bg-card border-border"} ${akses.isi ? "" : "opacity-60"}`}>
                      <Text className={`text-xs font-medium ${aktif ? "text-white" : "text-foreground"}`}>{LABEL_GRADE[p.nilai] ?? p.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {(akses.isi || catatan[s.id]) && (
                terbukaCatatan[s.id] || catatan[s.id]
                  ? <Input value={catatan[s.id] ?? ""} onChangeText={(t) => ubahCatatan(s.id, t)} editable={akses.isi} multiline maxLength={500}
                      placeholder="Catatan wali kelas (opsional)" style={{ minHeight: 64, textAlignVertical: "top", paddingTop: 12 }} />
                  : <Pressable onPress={() => setTerbukaCatatan((x) => ({ ...x, [s.id]: true }))} className="self-start py-1"><Text className="text-xs text-primary underline">+ Tambah catatan</Text></Pressable>
              )}
            </View>
          ))}
          {siswa.length === 0 && <Text className="px-4 py-4 text-sm text-muted-foreground">Belum ada siswa aktif di kelas ini.</Text>}
        </View>
      </Card>
      <RiwayatPanel terbuka={riwayatTerbuka} setTerbuka={setRiwayatTerbuka} kelasId={kelasId} mapelSourceId={0} semester={semester} komponen={[]} versi={statusSimpan === "tersimpan" ? 1 : 0} />
    </View>
  );
}

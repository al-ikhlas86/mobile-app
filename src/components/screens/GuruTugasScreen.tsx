import React, { useEffect, useState } from "react";
import { View, Text, Pressable, Alert, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import * as DocumentPicker from "expo-document-picker";
import { ClipboardList, Plus, Trash2, ChevronDown, ChevronUp, Lock, Unlock, Check, Save, Paperclip, FileText, X, Printer } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Input } from "../ui/Input";
import { SimplePicker } from "../ui/SimplePicker";
import { SimpleCalendarPicker } from "../ui/SimpleCalendarPicker";
import { api, API_URL } from "../../services/api";
import { getActiveSession } from "../../services/authService";
import { getTodayLocal } from "../../utils/formatters";
import { useThemeColors } from "../../context/ThemeContext";

// Batas & format SAMA PERSIS dgn backend (routes/tugas.js ALLOWED_MIME_LAMPIRAN/
// MAX_LAMPIRAN_BYTES) - daftar di sini cuma penyaring di picker, penegakan
// SEBENARNYA tetap di server (lihat catatan sama persis di BuatTugasScreen.tsx).
const MAX_LAMPIRAN_MB = 10;

function formatUkuranBerkas(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDateFull(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

// Sentinel string dipakai di SimplePicker (cuma terima value string) utk
// mewakili mataPelajaranSourceId null ("Umum (Wali Kelas)") - dikonversi
// balik ke null/undefined asli persis sebelum dikirim ke api. Port 1:1 dari
// webview GuruTugasScreen.tsx.
const SENTINEL_UMUM = "umum";

interface PengajaranOption {
  kelasId: number;
  kelasNama: string;
  tingkat: string | null;
  mataPelajaranSourceId: number | null;
  mataPelajaranNama: string;
}

interface TugasRow {
  id: number;
  judul: string;
  deskripsi: string | null;
  tanggal: string;
  deadline: string | null;
  deadline_jam: string | null;
  kunci_otomatis: number;
  dibuka_manual: number;
  terkunci: boolean;
  kelas_nama: string;
  mata_pelajaran_source_id: number | null;
  mata_pelajaran_nama: string | null;
  jumlah_selesai: number;
  jumlah_dinilai?: number;
  total_tugas_kelas?: number;
  lampiran_filename: string | null;
  lampiran_nama_asli: string | null;
  lampiran_ukuran: number | null;
}

interface RekapSiswa {
  student_cache_id: number;
  nama: string;
  status: "belum" | "sudah";
  nilai: string | null;
  catatan_guru: string | null;
  terlambat: number | null;
  dikerjakan_at: string | null;
}

function opsiMapelUntukKelas(pengajaranOptions: PengajaranOption[], kelasIdStr: string): { value: string; label: string }[] {
  return pengajaranOptions
    .filter((o) => String(o.kelasId) === kelasIdStr)
    .map((o) => ({
      value: o.mataPelajaranSourceId === null ? SENTINEL_UMUM : String(o.mataPelajaranSourceId),
      label: o.mataPelajaranNama || "Umum (Wali Kelas)",
    }));
}

// Guru - kelola Tugas (perlu dikerjakan siswa, punya deadline/kunci/nilai).
// Kelas & mapel yang muncul di form dibatasi ke kombinasi yang BENAR-BENAR
// diampu guru ini (tugasPengajaranOptions), dipisah dari GuruMateriScreen.tsx
// (poin 3 Fase 2, 2026-09-24). Port native dari webview GuruTugasScreen.tsx +
// gaya BuatTugasScreen.tsx native lama - toggleKunci/simpanNilai/toggleRekap
// di bawah PORT APA ADANYA dari BuatTugasScreen.tsx lama (logikanya SUDAH
// benar di situ, TIDAK ada bug spt versi web lama yg pernah memanggil fungsi
// yg tidak pernah didefinisikan).
export function GuruTugasScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  // Status Akun Alumni (guru purna bakti) - form "Buat Tugas" disembunyikan,
  // sama pola persis GuruDashboard.tsx webview (menu "Buat Tugas / Materi"
  // disembunyikan total utk isAlumni) - backend (blockAlumni) TETAP jadi
  // penjagaan utama, ini murni UX. Daftar "Tugas Saya" (read-only) TETAP
  // tampil.
  const isAlumni = getActiveSession()?.isAlumni === true;

  const [pengajaranOptions, setPengajaranOptions] = useState<PengajaranOption[]>([]);
  const [tugasList, setTugasList] = useState<TugasRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);

  const [kelasId, setKelasId] = useState<string>("");
  const [mapelValue, setMapelValue] = useState<string>("");
  const [judul, setJudul] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [tanggal, setTanggal] = useState(getTodayLocal());
  const [deadline, setDeadline] = useState("");
  const [deadlineJam, setDeadlineJam] = useState("");
  const [kunciOtomatis, setKunciOtomatis] = useState(false);
  const [lampiran, setLampiran] = useState<{ uri: string; name: string; mimeType: string; size: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const [filterKelasId, setFilterKelasId] = useState("");
  const [filterMapelValue, setFilterMapelValue] = useState("");

  // Draf nilai/catatan per (tugasId, siswaId) - port 1:1 dari BuatTugasScreen.tsx lama.
  const [draftNilai, setDraftNilai] = useState<Record<string, { nilai: string; catatan: string }>>({});
  const [menyimpanNilai, setMenyimpanNilai] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [rekapByTugas, setRekapByTugas] = useState<Record<number, RekapSiswa[]>>({});
  const [rekapLoading, setRekapLoading] = useState<number | null>(null);

  const kelasSelectOptions = (() => {
    const seen = new Set<number>();
    const out: { value: string; label: string }[] = [];
    for (const o of pengajaranOptions) {
      if (seen.has(o.kelasId)) continue;
      seen.add(o.kelasId);
      out.push({ value: String(o.kelasId), label: `${o.kelasNama}${o.tingkat ? ` (${o.tingkat})` : ""}` });
    }
    return out;
  })();
  const mapelSelectOptionsForm = opsiMapelUntukKelas(pengajaranOptions, kelasId);

  // Filter Mapel dipersempit ke kombinasi kelas filter yg dipilih (kalau
  // ada) supaya tidak menampilkan mapel yg tidak relevan - kalau filter
  // Kelas "Semua", tampilkan semua mapel yg diampu guru (dedupe).
  const filterMapelSelectOptions = (() => {
    const base = filterKelasId ? pengajaranOptions.filter((o) => String(o.kelasId) === filterKelasId) : pengajaranOptions;
    const seen = new Set<string>();
    const out: { value: string; label: string }[] = [{ value: "", label: "Semua Mata Pelajaran" }];
    for (const o of base) {
      const v = o.mataPelajaranSourceId === null ? SENTINEL_UMUM : String(o.mataPelajaranSourceId);
      if (seen.has(v)) continue;
      seen.add(v);
      out.push({ value: v, label: o.mataPelajaranNama || "Umum (Wali Kelas)" });
    }
    return out;
  })();
  const filterKelasSelectOptions = [{ value: "", label: "Semua Kelas" }, ...kelasSelectOptions];

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await api.tugasPengajaranOptions();
      if (res.success) {
        setPengajaranOptions(res.data);
        const firstKelas = res.data[0];
        if (firstKelas) setKelasId(String(firstKelas.kelasId));
      }
      setLoading(false);
    })();
  }, []);

  // Mapel form mengikuti kelas form - direset ke opsi pertama tiap kali
  // kelas form berganti (termasuk saat terisi otomatis pertama kali).
  useEffect(() => {
    const opts = opsiMapelUntukKelas(pengajaranOptions, kelasId);
    setMapelValue(opts[0]?.value ?? "");
  }, [kelasId, pengajaranOptions]);

  async function loadList() {
    setListLoading(true);
    const res = await api.tugasMine({
      jenis: "tugas",
      kelasId: filterKelasId ? Number(filterKelasId) : undefined,
      mataPelajaranSourceId: filterMapelValue === "" ? undefined : filterMapelValue === SENTINEL_UMUM ? null : Number(filterMapelValue),
    });
    setListLoading(false);
    if (res.success) setTugasList(res.data);
  }

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKelasId, filterMapelValue]);

  function handleFilterKelasChange(v: string) {
    setFilterKelasId(v);
    setFilterMapelValue("");
  }

  async function pilihLampiran() {
    const hasil = await DocumentPicker.getDocumentAsync({
      type: [
        "application/pdf", "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "image/jpeg", "image/png", "image/webp", "image/gif",
      ],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (hasil.canceled || !hasil.assets?.[0]) return;
    const berkas = hasil.assets[0];
    if ((berkas.size ?? 0) > MAX_LAMPIRAN_MB * 1024 * 1024) {
      setMessage({ text: `Berkas terlalu besar, maksimal ${MAX_LAMPIRAN_MB} MB.`, ok: false });
      return;
    }
    setLampiran({ uri: berkas.uri, name: berkas.name, mimeType: berkas.mimeType || "application/octet-stream", size: berkas.size ?? 0 });
  }

  async function handleSubmit() {
    if (!kelasId || !judul.trim()) {
      setMessage({ text: "Kelas dan judul wajib diisi.", ok: false });
      return;
    }
    setSaving(true);
    setMessage(null);
    const res = await api.tugasCreate({
      kelasId: Number(kelasId),
      jenis: "tugas",
      judul: judul.trim(),
      deskripsi: deskripsi.trim() || undefined,
      tanggal,
      deadline: deadline || undefined,
      deadlineJam: deadlineJam || undefined,
      kunciOtomatis,
      lampiran: lampiran ? { uri: lampiran.uri, name: lampiran.name, mimeType: lampiran.mimeType } : undefined,
      mataPelajaranSourceId: mapelValue === SENTINEL_UMUM ? null : (mapelValue ? Number(mapelValue) : undefined),
      pengajaranModeBaru: true,
    });
    setSaving(false);
    setMessage({ text: res.message ?? (res.success ? "Tugas berhasil dibuat." : "Gagal membuat tugas."), ok: !!res.success });
    if (res.success) {
      setJudul(""); setDeskripsi(""); setDeadline(""); setDeadlineJam(""); setKunciOtomatis(false); setLampiran(null);
      loadList();
    }
  }

  function handleDelete(id: number) {
    Alert.alert("Hapus Tugas", "Hapus tugas ini? Status pengerjaan siswa ikut terhapus.", [
      { text: "Batal", style: "cancel" },
      { text: "Hapus", style: "destructive", onPress: async () => { const res = await api.tugasDelete(id); if (res.success) loadList(); } },
    ]);
  }

  async function toggleRekap(id: number) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!rekapByTugas[id]) {
      setRekapLoading(id);
      const res = await api.tugasRekap(id);
      setRekapLoading(null);
      if (res.success) setRekapByTugas((prev) => ({ ...prev, [id]: res.data.siswa }));
    }
  }

  /**
   * Buka/tutup pengumpulan. Yang di-toggle adalah `dibukaManual` (bukan
   * kunci otomatisnya) - niat guru saat membuat tugas tetap tersimpan, yang
   * berubah cuma "saya izinkan lagi untuk sekarang". Port apa adanya dari
   * BuatTugasScreen.tsx native lama.
   */
  async function toggleKunci(t: TugasRow) {
    const res = await api.tugasSetKunci(t.id, { dibukaManual: !Number(t.dibuka_manual) });
    if (res.success) loadList();
    else setMessage({ text: res.message ?? "Gagal mengubah kunci.", ok: false });
  }

  // Port apa adanya dari BuatTugasScreen.tsx native lama.
  async function simpanNilai(tugasId: number, studentCacheId: number, draf: { nilai: string; catatan: string }) {
    const kunciDraf = `${tugasId}:${studentCacheId}`;
    setMenyimpanNilai(kunciDraf);
    const res = await api.tugasBeriNilai(tugasId, {
      studentCacheId,
      nilai: draf.nilai.trim() || undefined,
      catatan: draf.catatan.trim() || undefined,
    });
    setMenyimpanNilai(null);
    if (res.success) {
      // Muat ulang rekap tugas ini saja supaya nilai tersimpan terlihat apa
      // adanya dari server, bukan cuma dari draf lokal.
      const segar = await api.tugasRekap(tugasId);
      if (segar.success) setRekapByTugas((prev) => ({ ...prev, [tugasId]: segar.data.siswa }));
      loadList();
    } else {
      setMessage({ text: res.message ?? "Gagal menyimpan nilai.", ok: false });
    }
  }

  // Pola download PDF RN - lebih simpel dari web (tidak ada masalah popup-
  // blocker), lihat RekapitulasiKehadiranScreen.tsx::handleDownloadPdf.
  async function handleDownloadPdf(tugasId: number) {
    setDownloadingId(tugasId);
    const res = await api.tugasRekapDownloadLink(tugasId);
    setDownloadingId(null);
    if (res.success) Linking.openURL(`${API_URL}${res.path}`);
  }

  return (
    <KeyboardAwareScrollView className="flex-1 bg-background px-4 pt-5" contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 20 }} bottomOffset={20}>
      {!isAlumni && (
        <Card padding="lg">
          <View className="flex-row items-center gap-1.5 mb-1">
            <ClipboardList size={16} color={colors.primary} />
            <Text className="text-sm font-semibold text-foreground">Buat Tugas</Text>
          </View>
          <Text className="text-xs text-muted-foreground mb-4">Terkirim ke semua Orang Tua siswa di kelas yang dipilih.</Text>

          {loading ? (
            <Text className="text-sm text-muted-foreground text-center py-4">Memuat...</Text>
          ) : kelasSelectOptions.length === 0 ? (
            <Text className="text-sm text-muted-foreground text-center py-4">Akun ini belum terdaftar mengajar kelas manapun.</Text>
          ) : (
            <View className="gap-3">
              <View>
                <Text className="text-xs font-medium text-foreground mb-1.5">Kelas</Text>
                <SimplePicker value={kelasId} options={kelasSelectOptions} onChange={setKelasId} />
              </View>
              <View>
                <Text className="text-xs font-medium text-foreground mb-1.5">Mata Pelajaran</Text>
                <SimplePicker value={mapelValue} options={mapelSelectOptionsForm} onChange={setMapelValue} />
              </View>
              <View>
                <Text className="text-xs font-medium text-foreground mb-1.5">Judul</Text>
                <Input value={judul} onChangeText={setJudul} maxLength={200} placeholder="Contoh: PR Matematika Bab 3" />
              </View>
              <View>
                <Text className="text-xs font-medium text-foreground mb-1.5">Deskripsi / Catatan</Text>
                <Input value={deskripsi} onChangeText={setDeskripsi} placeholder="Detail tugas..." multiline numberOfLines={3} style={{ minHeight: 80, textAlignVertical: "top", paddingTop: 12 }} />
              </View>
              <View>
                <Text className="text-xs font-medium text-foreground mb-1.5">Tanggal</Text>
                <SimpleCalendarPicker value={tanggal} onChange={setTanggal} />
              </View>
              <View>
                <Text className="text-xs font-medium text-foreground mb-1.5">Batas Kumpul</Text>
                <SimpleCalendarPicker value={deadline} onChange={setDeadline} />
              </View>
              <View>
                <Text className="text-xs font-medium text-foreground mb-1.5">Jam Batas (WIB)</Text>
                <Input
                  value={deadlineJam}
                  onChangeText={setDeadlineJam}
                  placeholder="Contoh: 15:00 (kosong = sampai akhir hari)"
                  maxLength={5}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <Pressable onPress={() => setKunciOtomatis((v) => !v)} className="flex-row items-start gap-2.5 py-1">
                <View className={`w-5 h-5 rounded border items-center justify-center mt-0.5 ${kunciOtomatis ? "bg-primary border-primary" : "border-border"}`}>
                  {kunciOtomatis && <Check size={13} color={colors.primaryForeground} />}
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-medium text-foreground">Kunci pengumpulan setelah lewat batas</Text>
                  <Text className="text-[11px] text-muted-foreground mt-0.5">
                    Siswa tidak bisa mengumpulkan lagi setelah lewat jam batas. Anda tetap bisa membukanya kembali
                    kapan saja lewat daftar di bawah.
                  </Text>
                </View>
              </Pressable>

              <View>
                <Text className="text-xs font-medium text-foreground mb-1.5">Lampiran Berkas (opsional)</Text>
                {lampiran ? (
                  <View className="flex-row items-center gap-2 bg-muted rounded-xl px-3 py-2.5">
                    <FileText size={16} color={colors.primary} />
                    <View className="flex-1">
                      <Text className="text-xs font-medium text-foreground" numberOfLines={1}>{lampiran.name}</Text>
                      <Text className="text-[10px] text-muted-foreground">{formatUkuranBerkas(lampiran.size)}</Text>
                    </View>
                    <Pressable onPress={() => setLampiran(null)} className="p-1">
                      <X size={16} color={colors.mutedForeground} />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable onPress={pilihLampiran} className="flex-row items-center justify-center gap-2 border border-dashed border-border rounded-xl px-3 py-3">
                    <Paperclip size={15} color={colors.mutedForeground} />
                    <Text className="text-xs text-muted-foreground">Pilih berkas (PDF/Word/PPT/Excel/gambar, maks {MAX_LAMPIRAN_MB} MB)</Text>
                  </Pressable>
                )}
              </View>

              <Button onPress={handleSubmit} disabled={saving} loading={saving} className="mt-1">
                <Plus size={14} color={colors.primaryForeground} />{"  "}{saving ? "Menyimpan..." : "Buat Tugas"}
              </Button>
              {message && <Text className={`text-xs text-center ${message.ok ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>{message.text}</Text>}
            </View>
          )}
        </Card>
      )}

      <View>
        <Text className="text-sm font-semibold text-foreground mb-2">Tugas Saya</Text>
        <View className="flex-row gap-2 mb-3">
          <View className="flex-1">
            <SimplePicker value={filterKelasId} options={filterKelasSelectOptions} onChange={handleFilterKelasChange} />
          </View>
          <View className="flex-1">
            <SimplePicker value={filterMapelValue} options={filterMapelSelectOptions} onChange={setFilterMapelValue} />
          </View>
        </View>
        {listLoading ? (
          <Text className="text-sm text-muted-foreground text-center py-4">Memuat...</Text>
        ) : tugasList.length === 0 ? (
          <Text className="text-sm text-muted-foreground text-center py-4">Belum ada tugas yang dibuat.</Text>
        ) : (
          <View className="gap-2">
            {tugasList.map((t) => (
              <Card key={t.id} padding="sm">
                <View className="flex-row items-start justify-between gap-2">
                  <View className="flex-1">
                    <View className="flex-row items-center gap-1.5 mb-0.5">
                      <ClipboardList size={13} color={colors.primary} />
                      <Text className="text-sm font-medium text-foreground" numberOfLines={1}>{t.judul}</Text>
                    </View>
                    <Text className="text-xs text-muted-foreground">
                      Kelas {t.kelas_nama} · {t.mata_pelajaran_nama || "Umum (Wali Kelas)"} · {formatDateFull(t.tanggal)}
                      {t.deadline ? ` · batas ${formatDateFull(t.deadline)}${t.deadline_jam ? ` ${String(t.deadline_jam).slice(0, 5)} WIB` : ""}` : ""}
                    </Text>
                    {t.lampiran_filename && (
                      <Pressable
                        onPress={() => Linking.openURL(`${API_URL}/uploads/tugas/${t.lampiran_filename}`)}
                        className="flex-row items-center gap-1.5 mt-1 self-start"
                      >
                        <Paperclip size={11} color={colors.primary} />
                        <Text className="text-[11px] text-primary underline" numberOfLines={1}>{t.lampiran_nama_asli}</Text>
                        {typeof t.lampiran_ukuran === "number" && (
                          <Text className="text-[10px] text-muted-foreground">({formatUkuranBerkas(t.lampiran_ukuran)})</Text>
                        )}
                      </Pressable>
                    )}
                    <Text className="text-xs text-primary mt-0.5">
                      {t.jumlah_selesai} siswa sudah mengerjakan
                      {typeof t.jumlah_dinilai === "number" ? ` · ${t.jumlah_dinilai} dinilai` : ""}
                    </Text>
                    {typeof t.total_tugas_kelas === "number" && (
                      <Text className="text-[11px] text-muted-foreground mt-0.5">Total {t.total_tugas_kelas} tugas Anda di kelas ini</Text>
                    )}
                    {t.deadline ? (
                      <Pressable onPress={() => toggleKunci(t)} className="self-start mt-1.5 flex-row items-center gap-1.5 px-2 py-1 rounded-full bg-muted">
                        {t.terkunci ? <Lock size={11} color="#dc2626" /> : <Unlock size={11} color={colors.primary} />}
                        <Text className={`text-[10px] font-medium ${t.terkunci ? "text-red-600 dark:text-red-400" : "text-primary"}`}>
                          {t.terkunci ? "Terkunci - ketuk untuk buka" : Number(t.dibuka_manual) ? "Dibuka kembali - ketuk untuk tutup" : Number(t.kunci_otomatis) ? "Akan terkunci setelah batas" : "Tidak dikunci"}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <View className="flex-row items-center gap-1">
                    <Pressable onPress={() => toggleRekap(t.id)} className="p-1.5">
                      {expandedId === t.id ? <ChevronUp size={16} color={colors.mutedForeground} /> : <ChevronDown size={16} color={colors.mutedForeground} />}
                    </Pressable>
                    <Pressable onPress={() => handleDelete(t.id)} className="p-1.5">
                      <Trash2 size={15} color="#ef4444" />
                    </Pressable>
                  </View>
                </View>
                {expandedId === t.id && (
                  <View className="mt-3 pt-3 border-t border-border">
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-xs font-medium text-foreground">Rekap Pengumpulan</Text>
                      {(rekapByTugas[t.id]?.length ?? 0) > 0 && (
                        <Button size="sm" variant="outline" onPress={() => handleDownloadPdf(t.id)} disabled={downloadingId === t.id} loading={downloadingId === t.id}>
                          <Printer size={13} color={colors.primary} />{"  "}Cetak PDF
                        </Button>
                      )}
                    </View>
                    {rekapLoading === t.id ? (
                      <Text className="text-xs text-muted-foreground text-center py-2">Memuat rekap...</Text>
                    ) : (rekapByTugas[t.id]?.length ?? 0) === 0 ? (
                      <Text className="text-xs text-muted-foreground text-center py-2">Tidak ada siswa aktif di kelas ini.</Text>
                    ) : (
                      <View className="gap-2.5">
                        {rekapByTugas[t.id].map((s) => {
                          const kunciDraf = `${t.id}:${s.student_cache_id}`;
                          const draf = draftNilai[kunciDraf] ?? { nilai: s.nilai ?? "", catatan: s.catatan_guru ?? "" };
                          return (
                            <View key={s.student_cache_id} className="pb-2.5 border-b border-border">
                              <View className="flex-row items-center justify-between mb-1.5">
                                <Text className="text-xs text-foreground flex-1">{s.nama}</Text>
                                <View className="flex-row items-center gap-1">
                                  {Number(s.terlambat) === 1 && <Badge variant="warning">Terlambat</Badge>}
                                  <Badge variant={s.status === "sudah" ? "success" : "muted"}>{s.status === "sudah" ? "Sudah" : "Belum"}</Badge>
                                </View>
                              </View>
                              <View className="flex-row gap-1.5">
                                <View style={{ width: 76 }}>
                                  <Input
                                    value={draf.nilai}
                                    onChangeText={(v) => setDraftNilai((d) => ({ ...d, [kunciDraf]: { ...draf, nilai: v } }))}
                                    placeholder="Nilai"
                                    maxLength={10}
                                  />
                                </View>
                                <View className="flex-1">
                                  <Input
                                    value={draf.catatan}
                                    onChangeText={(v) => setDraftNilai((d) => ({ ...d, [kunciDraf]: { ...draf, catatan: v } }))}
                                    placeholder="Catatan untuk siswa"
                                  />
                                </View>
                                <Pressable
                                  onPress={() => simpanNilai(t.id, s.student_cache_id, draf)}
                                  disabled={menyimpanNilai === kunciDraf}
                                  className="px-3 justify-center rounded-lg bg-primary"
                                >
                                  <Save size={14} color={colors.primaryForeground} />
                                </Pressable>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                )}
              </Card>
            ))}
          </View>
        )}
      </View>
    </KeyboardAwareScrollView>
  );
}

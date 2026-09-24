import React, { useRef, useState, useEffect } from "react";
import { View, Text, ActivityIndicator, Pressable, Linking } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { ClipboardList, CheckCircle, Paperclip, AlertCircle, Award, FileText, X, Send, Pencil } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Input } from "../ui/Input";
import { SimplePicker } from "../ui/SimplePicker";
import { api, API_URL } from "../../services/api";
import { useThemeColors } from "../../context/ThemeContext";

// Batas & format SAMA PERSIS dgn backend (routes/tugas.js
// ALLOWED_MIME_LAMPIRAN/MAX_LAMPIRAN_BYTES) - daftar di sini cuma penyaring
// picker, penegakan sebenarnya tetap di server.
const MAX_LAMPIRAN_MB = 10;

function formatUkuranBerkas(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDateFull(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

interface TugasRow {
  id: number;
  judul: string;
  deskripsi: string | null;
  tanggal: string;
  deadline: string | null;
  deadline_jam: string | null;
  terkunci: boolean;
  nilai: string | null;
  catatan_guru: string | null;
  terlambat: number | null;
  guru_nama: string;
  mata_pelajaran_source_id: number | null;
  mata_pelajaran_nama: string | null;
  status_pengerjaan: "belum" | "sudah";
  lampiran_filename: string | null;
  lampiran_nama_asli: string | null;
  lampiran_ukuran: number | null;
  jawaban_teks: string | null;
  jawaban_lampiran_filename: string | null;
  jawaban_lampiran_nama_asli: string | null;
  jawaban_lampiran_ukuran: number | null;
}

interface MapelOption {
  value: string;
  label: string;
}

interface Props {
  studentCacheId: number;
  studentNama: string;
  kelasNama: string | null;
}

// Tugas sisi siswa - REVISI TugasAnakScreen.tsx native (dipertahankan apa
// adanya utk kompatibilitas APK lama yg belum di-build ulang). Logika form
// "Isi Jawaban" (kirimJawaban, pilihLampiranJawaban, dst) DISALIN APA ADANYA
// dari file itu - lihat file itu utk sejarah keputusan desainnya. Bedanya
// di sini (2026-09-24, diminta user: tugas & materi jadi 2 layar terpisah,
// masing2 bisa difilter per mata pelajaran): HANYA jenis="tugas" (materi
// punya layar sendiri, SiswaMateriScreen), tanpa badge/icon "Materi" krn
// semua baris di layar ini pasti tugas, filter dropdown Mata Pelajaran
// ditambahkan, dan studentCacheId murni PROP dari shell (AkademikSiswaScreen)
// - ChildSwitcher/myChildren() TIDAK dipanggil di sini.
export function SiswaTugasScreen({ studentCacheId, studentNama, kelasNama }: Props) {
  const colors = useThemeColors();
  // allTugas = hasil fetch TANPA filter mapel, dipakai HANYA utk membangun
  // opsi dropdown (tidak ada endpoint daftar mapel terpisah sisi siswa).
  // tugasList = data yang benar2 ditampilkan, hasil fetch dgn filter aktif.
  const [allTugas, setAllTugas] = useState<TugasRow[]>([]);
  const [tugasList, setTugasList] = useState<TugasRow[]>([]);
  const [mapelFilter, setMapelFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Form "Isi Jawaban" - 1 per layar (accordion), bukan per-kartu, supaya
  // state-nya sederhana.
  const [activeFormId, setActiveFormId] = useState<number | null>(null);
  const [jawabanTeks, setJawabanTeks] = useState("");
  const [lampiranBaru, setLampiranBaru] = useState<{ uri: string; name: string; mimeType: string; size: number } | null>(null);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function mapelSourceIdFromFilter(v: string): number | null | undefined {
    return v === "all" ? undefined : v === "null" ? null : Number(v);
  }

  const loadTugasFiltered = async (filter: string) => {
    const res = await api.tugasAnak(studentCacheId, { jenis: "tugas", mataPelajaranSourceId: mapelSourceIdFromFilter(filter) });
    if (res.success) setTugasList(res.data);
    else setError(res.message ?? "Gagal memuat tugas.");
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      setMapelFilter("all");
      const res = await api.tugasAnak(studentCacheId, { jenis: "tugas" });
      if (res.success) {
        setAllTugas(res.data);
        setTugasList(res.data);
      } else {
        setError(res.message ?? "Gagal memuat tugas.");
      }
      setLoading(false);
    })();
  }, [studentCacheId]);

  async function handleFilterChange(v: string) {
    setMapelFilter(v);
    setLoading(true);
    setError("");
    await loadTugasFiltered(v);
    setLoading(false);
  }

  function bukaFormJawaban(t: TugasRow) {
    setActiveFormId(t.id);
    setJawabanTeks(t.jawaban_teks ?? "");
    setLampiranBaru(null);
    setFormError("");
  }

  function tutupFormJawaban() {
    setActiveFormId(null);
    setJawabanTeks("");
    setLampiranBaru(null);
    setFormError("");
  }

  async function pilihLampiranJawaban() {
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
      setFormError(`Berkas terlalu besar, maksimal ${MAX_LAMPIRAN_MB} MB.`);
      return;
    }
    setFormError("");
    setLampiranBaru({ uri: berkas.uri, name: berkas.name, mimeType: berkas.mimeType || "application/octet-stream", size: berkas.size ?? 0 });
  }

  async function kirimJawaban(t: TugasRow) {
    if (!jawabanTeks.trim() && !lampiranBaru && !t.jawaban_lampiran_filename) {
      setFormError("Isi jawaban teks atau lampirkan berkas dulu.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    const res = await api.tugasKumpulkanJawaban(t.id, {
      studentCacheId,
      jawabanTeks: jawabanTeks.trim() || undefined,
      lampiran: lampiranBaru,
    });
    setSubmitting(false);
    if (res.success) {
      tutupFormJawaban();
      loadTugasFiltered(mapelFilter);
    } else {
      setFormError(res.message ?? "Gagal mengirim jawaban.");
    }
  }

  // Pasangan unik {source_id, nama} dari data TANPA filter - source_id null
  // (mapel "Umum", tanpa mapel tertentu) dipetakan ke key khusus "null".
  const mapelMap = new Map<string, string>();
  for (const t of allTugas) {
    const key = t.mata_pelajaran_source_id === null ? "null" : String(t.mata_pelajaran_source_id);
    if (!mapelMap.has(key)) mapelMap.set(key, t.mata_pelajaran_nama ?? "Umum");
  }
  const mapelOptions: MapelOption[] = [
    { value: "all", label: "Semua Mata Pelajaran" },
    ...Array.from(mapelMap.entries()).map(([value, label]) => ({ value, label })),
  ];

  if (loading && allTugas.length === 0) {
    return (
      <View className="items-center justify-center py-12">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View className="items-center justify-center gap-3 px-8 py-12">
        <AlertCircle size={32} color={colors.mutedForeground} />
        <Text className="text-sm text-muted-foreground text-center">{error}</Text>
      </View>
    );
  }

  return (
    <View className="gap-3">
      <Text className="text-xs text-muted-foreground -mt-1">
        Tugas untuk kelas {kelasNama ?? "-"} ({studentNama}).
      </Text>

      {mapelOptions.length > 1 && (
        <SimplePicker value={mapelFilter} options={mapelOptions} onChange={handleFilterChange} placeholder="Mata Pelajaran" />
      )}

      {tugasList.length === 0 ? (
        <Text className="text-sm text-muted-foreground text-center py-8">Belum ada tugas untuk kelas ini.</Text>
      ) : (
        <View className="gap-3">
          {tugasList.map((t) => (
            <Card key={t.id} padding="md">
              <View className="flex-row items-center gap-1.5 mb-1">
                <ClipboardList size={15} color={colors.primary} />
                <Text className="text-sm font-semibold text-foreground flex-1">{t.judul}</Text>
              </View>
              <Text className="text-xs text-muted-foreground mb-2">
                {t.guru_nama}
                {t.mata_pelajaran_nama ? ` · ${t.mata_pelajaran_nama}` : ""} · {formatDateFull(t.tanggal)}
                {t.deadline ? ` · batas kumpul ${formatDateFull(t.deadline)}${t.deadline_jam ? ` pukul ${String(t.deadline_jam).slice(0, 5)} WIB` : ""}` : ""}
              </Text>
              {!!t.deskripsi && <Text className="text-sm text-foreground mb-3">{t.deskripsi}</Text>}

              {t.lampiran_filename && (
                <Pressable
                  onPress={() => Linking.openURL(`${API_URL}/uploads/tugas/${t.lampiran_filename}`)}
                  className="flex-row items-center gap-2 bg-muted rounded-xl px-3 py-2 mb-3 self-start"
                >
                  <Paperclip size={14} color={colors.primary} />
                  <Text className="text-xs font-medium text-primary underline" numberOfLines={1}>{t.lampiran_nama_asli}</Text>
                  {typeof t.lampiran_ukuran === "number" && (
                    <Text className="text-[10px] text-muted-foreground">({formatUkuranBerkas(t.lampiran_ukuran)})</Text>
                  )}
                </Pressable>
              )}

              <View className="gap-2">
                <View className="flex-row items-center gap-2 flex-wrap">
                  {t.status_pengerjaan === "sudah" && (
                    <>
                      <Badge variant="success">
                        <CheckCircle size={11} color={colors.primary} /> Sudah Dikerjakan
                      </Badge>
                      {Number(t.terlambat) === 1 && <Badge variant="warning">Terlambat</Badge>}
                    </>
                  )}
                  {t.terkunci && t.status_pengerjaan !== "sudah" && (
                    // Disembunyikan HANYA sbg kejelasan - penolakan sungguhannya
                    // di server (routes/tugas.js), tidak bisa ditembus.
                    <Badge variant="error">Pengumpulan ditutup guru</Badge>
                  )}
                  {!t.terkunci && activeFormId !== t.id && (
                    <Button size="sm" variant={t.status_pengerjaan === "sudah" ? "outline" : "primary"} onPress={() => bukaFormJawaban(t)}>
                      {t.status_pengerjaan === "sudah" ? <Pencil size={13} color={colors.primary} /> : <Send size={13} color={colors.primaryForeground} />}
                      {"  "}{t.status_pengerjaan === "sudah" ? "Ubah Jawaban" : "Isi Jawaban"}
                    </Button>
                  )}
                </View>

                {/* Jawaban yang sudah dikirim - ditampilkan walau form sedang tertutup */}
                {activeFormId !== t.id && (!!t.jawaban_teks || !!t.jawaban_lampiran_filename) && (
                  <View className="bg-muted rounded-xl px-3 py-2">
                    <Text className="text-[10px] font-semibold text-muted-foreground mb-1">Jawaban Anda</Text>
                    {!!t.jawaban_teks && <Text className="text-xs text-foreground">{t.jawaban_teks}</Text>}
                    {!!t.jawaban_lampiran_filename && (
                      <Pressable onPress={() => Linking.openURL(`${API_URL}/uploads/tugas/${t.jawaban_lampiran_filename}`)} className="flex-row items-center gap-1.5 mt-1 self-start">
                        <FileText size={13} color={colors.primary} />
                        <Text className="text-xs font-medium text-primary underline" numberOfLines={1}>{t.jawaban_lampiran_nama_asli}</Text>
                        {typeof t.jawaban_lampiran_ukuran === "number" && (
                          <Text className="text-[10px] text-muted-foreground">({formatUkuranBerkas(t.jawaban_lampiran_ukuran)})</Text>
                        )}
                      </Pressable>
                    )}
                  </View>
                )}

                {/* Form isi/ubah jawaban - 1 kartu accordion */}
                {activeFormId === t.id && (
                  <View className="gap-2 bg-muted rounded-xl p-3">
                    <Input
                      value={jawabanTeks}
                      onChangeText={setJawabanTeks}
                      placeholder="Tulis jawaban di sini (opsional kalau melampirkan berkas)..."
                      multiline
                      numberOfLines={3}
                      style={{ minHeight: 72, textAlignVertical: "top", paddingTop: 12 }}
                    />
                    {lampiranBaru ? (
                      <View className="flex-row items-center justify-between gap-2 bg-card rounded-lg px-3 py-2">
                        <View className="flex-row items-center gap-1.5 flex-1">
                          <FileText size={13} color={colors.primary} />
                          <Text className="text-xs text-foreground flex-1" numberOfLines={1}>{lampiranBaru.name}</Text>
                          <Text className="text-[10px] text-muted-foreground">({formatUkuranBerkas(lampiranBaru.size)})</Text>
                        </View>
                        <Pressable onPress={() => setLampiranBaru(null)}>
                          <X size={14} color={colors.mutedForeground} />
                        </Pressable>
                      </View>
                    ) : (
                      <Pressable onPress={pilihLampiranJawaban} className="flex-row items-center gap-1.5 bg-card rounded-lg px-3 py-2 self-start">
                        <Paperclip size={13} color={colors.primary} />
                        <Text className="text-xs text-primary">{t.jawaban_lampiran_filename ? "Ganti lampiran" : "Lampirkan berkas"} (maks {MAX_LAMPIRAN_MB} MB)</Text>
                      </Pressable>
                    )}
                    {!!formError && <Text className="text-xs text-red-600 dark:text-red-400">{formError}</Text>}
                    <View className="flex-row items-center gap-2">
                      <Button size="sm" onPress={() => kirimJawaban(t)} disabled={submitting} loading={submitting}>
                        <Send size={13} color={colors.primaryForeground} />{"  "}Kirim Jawaban
                      </Button>
                      <Button size="sm" variant="outline" onPress={tutupFormJawaban} disabled={submitting}>Batal</Button>
                    </View>
                  </View>
                )}
              </View>

              {(t.nilai || t.catatan_guru) && (
                <View className="mt-3 pt-3 border-t border-border">
                  <View className="flex-row items-center gap-1.5">
                    <Award size={14} color={colors.primary} />
                    <Text className="text-xs font-semibold text-foreground">
                      Penilaian Guru{t.nilai ? `: ${t.nilai}` : ""}
                    </Text>
                  </View>
                  {!!t.catatan_guru && <Text className="text-xs text-muted-foreground mt-1">{t.catatan_guru}</Text>}
                </View>
              )}
            </Card>
          ))}
        </View>
      )}
    </View>
  );
}

import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Pressable, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import { ClipboardList, BookOpen, CheckCircle, Paperclip, Award, AlertCircle, FileText, X, Send, Pencil } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Input } from "../ui/Input";
import { ChildSwitcher } from "../ChildSwitcher";
import { api, API_URL } from "../../services/api";
import { useThemeColors } from "../../context/ThemeContext";

interface ChildData { id: number; nama: string; kelas_nama: string | null; }
interface TugasRow { id: number; jenis: "tugas" | "materi"; judul: string; deskripsi: string | null; tanggal: string; deadline: string | null; deadline_jam: string | null; terkunci: boolean; guru_nama: string; status_pengerjaan: "belum" | "sudah"; nilai: string | null; catatan_guru: string | null; terlambat: number | null; lampiran_filename: string | null; lampiran_nama_asli: string | null; lampiran_ukuran: number | null; jawaban_teks: string | null; jawaban_lampiran_filename: string | null; jawaban_lampiran_nama_asli: string | null; jawaban_lampiran_ukuran: number | null; }

function formatDateFull(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function formatUkuranBerkas(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Batas & format SAMA PERSIS dgn backend (routes/tugas.js) - lihat catatan
// di BuatTugasScreen.tsx.
const MAX_LAMPIRAN_MB = 10;

// Orang Tua - lihat Tugas & Materi Pembelajaran utk kelas anaknya. Port
// native dari webview TugasAnakScreen.tsx. "Isi Jawaban" (2026-09-03,
// diminta user: "seperti Google Classroom") GANTIKAN tombol placeholder
// lama - kirim jawaban teks &/atau lampiran SUNGGUHAN lewat
// tugasKumpulkanJawaban, bukan cuma tandai status.
export function TugasAnakScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [children, setChildren] = useState<ChildData[]>([]);
  const [activeChildId, setActiveChildId] = useState<number | null>(null);
  const [tugasList, setTugasList] = useState<TugasRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Form "Isi Jawaban" - 1 per layar (accordion).
  const [activeFormId, setActiveFormId] = useState<number | null>(null);
  const [jawabanTeks, setJawabanTeks] = useState("");
  const [lampiranBaru, setLampiranBaru] = useState<{ uri: string; name: string; mimeType: string; size: number } | null>(null);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadTugas = async (childId: number) => {
    const res = await api.tugasAnak(childId);
    if (res.success) setTugasList(res.data);
  };

  const load = async () => {
    setLoading(true);
    setError("");
    const childrenRes = await api.myChildren();
    if (childrenRes.success) {
      setChildren(childrenRes.data);
      const keepActive = activeChildId !== null && childrenRes.data.some((c: ChildData) => c.id === activeChildId);
      const nextActiveId = keepActive ? activeChildId : (childrenRes.data[0]?.id ?? null);
      setActiveChildId(nextActiveId);
      if (nextActiveId) await loadTugas(nextActiveId);
    } else {
      setError(childrenRes.message ?? "Gagal memuat data anak.");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  async function handleSelectChild(id: number) {
    setActiveChildId(id);
    setLoading(true);
    await loadTugas(id);
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
    if (!activeChildId) return;
    if (!jawabanTeks.trim() && !lampiranBaru && !t.jawaban_lampiran_filename) {
      setFormError("Isi jawaban teks atau lampirkan berkas dulu.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    const res = await api.tugasKumpulkanJawaban(t.id, {
      studentCacheId: activeChildId,
      jawabanTeks: jawabanTeks.trim() || undefined,
      lampiran: lampiranBaru,
    });
    setSubmitting(false);
    if (res.success) {
      tutupFormJawaban();
      loadTugas(activeChildId);
    } else {
      setFormError(res.message ?? "Gagal mengirim jawaban.");
    }
  }

  const child = children.find((c) => c.id === activeChildId) ?? null;

  if (loading) return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator color={colors.primary} /></View>;

  if (error || !child) {
    return (
      <View className="flex-1 items-center justify-center bg-background gap-3 px-8">
        <AlertCircle size={32} color={colors.mutedForeground} />
        <Text className="text-sm text-muted-foreground text-center">{error || "Belum ada data anak yang tertaut ke akun ini."}</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background px-4 pt-5" contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 12 }}>
      <ChildSwitcher children={children} activeId={activeChildId} onChange={handleSelectChild} />

      <Text className="text-xs text-muted-foreground">
        Tugas & materi pembelajaran untuk kelas {child.kelas_nama ?? "-"} ({child.nama}).
      </Text>

      {tugasList.length === 0 ? (
        <Text className="text-sm text-muted-foreground text-center py-8">Belum ada tugas/materi untuk kelas ini.</Text>
      ) : (
        <View className="gap-3">
          {tugasList.map((t) => (
            <Card key={t.id} padding="md">
              <View className="flex-row items-start justify-between gap-2 mb-1">
                <View className="flex-row items-center gap-1.5 flex-1">
                  {t.jenis === "tugas" ? <ClipboardList size={15} color={colors.primary} /> : <BookOpen size={15} color={colors.primary} />}
                  <Text className="text-sm font-semibold text-foreground flex-1">{t.judul}</Text>
                </View>
                <Badge variant={t.jenis === "tugas" ? "info" : "muted"}>{t.jenis === "tugas" ? "Tugas" : "Materi"}</Badge>
              </View>
              <Text className="text-xs text-muted-foreground mb-2">
                {t.guru_nama} · {formatDateFull(t.tanggal)}
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

              {t.jenis === "tugas" && (
                <View className="gap-2">
                  <View className="flex-row items-center gap-2 flex-wrap">
                    {t.status_pengerjaan === "sudah" && (
                      <>
                        <Badge variant="success">Sudah Dikerjakan</Badge>
                        {Number(t.terlambat) === 1 && <Badge variant="warning">Terlambat</Badge>}
                      </>
                    )}
                    {t.terkunci && t.status_pengerjaan !== "sudah" && (
                      // Tombol disembunyikan HANYA sbg kejelasan utk ortu -
                      // penolakan sungguhannya ada di server (routes/tugas.js),
                      // jadi tidak bisa ditembus lewat permintaan langsung.
                      <Badge variant="error">Pengumpulan ditutup guru</Badge>
                    )}
                    {!t.terkunci && activeFormId !== t.id && (
                      <Button size="sm" variant={t.status_pengerjaan === "sudah" ? "outline" : "primary"} onPress={() => bukaFormJawaban(t)}>
                        {t.status_pengerjaan === "sudah" ? <Pencil size={13} color={colors.primary} /> : <Send size={13} color={colors.primaryForeground} />}
                        {"  "}{t.status_pengerjaan === "sudah" ? "Ubah Jawaban" : "Isi Jawaban"}
                      </Button>
                    )}
                  </View>

                  {/* Jawaban yang sudah dikirim - tampil walau form tertutup */}
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

                  {/* Form isi/ubah jawaban */}
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
              )}

              {t.jenis === "tugas" && (t.nilai || t.catatan_guru) && (
                <View className="mt-3 pt-3 border-t border-border">
                  <View className="flex-row items-center gap-2">
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
    </ScrollView>
  );
}

import React, { useEffect, useState } from "react";
import { View, Text, Pressable, Alert, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import * as DocumentPicker from "expo-document-picker";
import { ClipboardList, BookOpen, Plus, Trash2, ChevronDown, ChevronUp, Lock, Unlock, Check, Save, Paperclip, X, FileText, Download } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Input } from "../ui/Input";
import { SimplePicker } from "../ui/SimplePicker";
import { SimpleCalendarPicker } from "../ui/SimpleCalendarPicker";
import { api, API_URL } from "../../services/api";
import { getTodayLocal } from "../../utils/formatters";
import { useThemeColors } from "../../context/ThemeContext";

interface KelasOption { id: number; nama: string; tingkat: string | null; }
interface TugasRow { id: number; jenis: "tugas" | "materi"; judul: string; deskripsi: string | null; tanggal: string; deadline: string | null; deadline_jam: string | null; kunci_otomatis: number; dibuka_manual: number; terkunci: boolean; kelas_nama: string; jumlah_selesai: number; jumlah_dinilai?: number; total_tugas_kelas?: number; lampiran_filename: string | null; lampiran_nama_asli: string | null; lampiran_ukuran: number | null; }
interface RekapSiswa { student_cache_id: number; nama: string; status: "belum" | "sudah"; nilai: string | null; catatan_guru: string | null; terlambat: number | null; dikerjakan_at: string | null; }

const JENIS_OPTIONS = [
  { value: "tugas", label: "Tugas (perlu dikerjakan siswa)" },
  { value: "materi", label: "Materi (catatan pembelajaran)" },
];

// Batas & format SAMA PERSIS dgn backend (routes/tugas.js ALLOWED_MIME_LAMPIRAN/
// MAX_LAMPIRAN_BYTES) - daftar di sini cuma penyaring di picker supaya user
// tidak salah pilih; penegakan SEBENARNYA tetap di server (2 tempat sengaja
// tidak disatukan lewat import - beda runtime, RN vs Node).
const MAX_LAMPIRAN_MB = 10;

function formatUkuranBerkas(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDateFull(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

// Guru/Guru Kelas - buat tugas atau materi utk 1 kelas. Port native dari
// webview BuatTugasScreen.tsx.
export function BuatTugasScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [kelasOptions, setKelasOptions] = useState<KelasOption[]>([]);
  const [tugasList, setTugasList] = useState<TugasRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [kelasId, setKelasId] = useState<string>("");
  const [jenis, setJenis] = useState<"tugas" | "materi">("tugas");
  const [judul, setJudul] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [tanggal, setTanggal] = useState(getTodayLocal());
  const [deadline, setDeadline] = useState("");
  const [deadlineJam, setDeadlineJam] = useState("");
  const [kunciOtomatis, setKunciOtomatis] = useState(false);
  const [lampiran, setLampiran] = useState<{ uri: string; name: string; mimeType: string; size: number } | null>(null);
  // Draf nilai/catatan per siswa, dikunci per (tugasId, siswaId) supaya
  // pengetikan di satu siswa tidak bocor ke siswa lain.
  const [draftNilai, setDraftNilai] = useState<Record<string, { nilai: string; catatan: string }>>({});
  const [menyimpanNilai, setMenyimpanNilai] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [rekapByTugas, setRekapByTugas] = useState<Record<number, RekapSiswa[]>>({});
  const [rekapLoading, setRekapLoading] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    const [kelasRes, mineRes] = await Promise.all([api.tugasKelasOptions(), api.tugasMine()]);
    if (kelasRes.success) {
      setKelasOptions(kelasRes.data);
      setKelasId((prev) => prev || String(kelasRes.data[0]?.id ?? ""));
    }
    if (mineRes.success) setTugasList(mineRes.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

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
      jenis,
      judul: judul.trim(),
      deskripsi: deskripsi.trim() || undefined,
      tanggal,
      deadline: jenis === "tugas" ? (deadline || undefined) : undefined,
      deadlineJam: jenis === "tugas" ? (deadlineJam || undefined) : undefined,
      kunciOtomatis: jenis === "tugas" ? kunciOtomatis : undefined,
      lampiran: lampiran ? { uri: lampiran.uri, name: lampiran.name, mimeType: lampiran.mimeType } : undefined,
    });
    setSaving(false);
    setMessage({ text: res.message ?? (res.success ? `${jenis === "tugas" ? "Tugas" : "Materi"} berhasil dibuat.` : "Gagal membuat."), ok: !!res.success });
    if (res.success) {
      setJudul(""); setDeskripsi(""); setDeadline(""); setDeadlineJam(""); setKunciOtomatis(false); setLampiran(null);
      load();
    }
  }

  /**
   * Buka/tutup pengumpulan. Yang di-toggle adalah `dibukaManual` (bukan
   * kunci otomatisnya) - niat guru saat membuat tugas tetap tersimpan, yang
   * berubah cuma "saya izinkan lagi untuk sekarang".
   */
  async function toggleKunci(t: TugasRow) {
    const res = await api.tugasSetKunci(t.id, { dibukaManual: !Number(t.dibuka_manual) });
    if (res.success) load();
    else setMessage({ text: res.message ?? "Gagal mengubah kunci.", ok: false });
  }

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
      // Muat ulang rekap tugas ini saja supaya nilai tersimpan terlihat
      // apa adanya dari server, bukan cuma dari draf lokal.
      const segar = await api.tugasRekap(tugasId);
      if (segar.success) setRekapByTugas((prev) => ({ ...prev, [tugasId]: segar.data.siswa }));
      load();
    } else {
      setMessage({ text: res.message ?? "Gagal menyimpan nilai.", ok: false });
    }
  }

  function handleDelete(id: number) {
    Alert.alert("Hapus Tugas/Materi", "Status pengerjaan siswa ikut terhapus. Lanjutkan?", [
      { text: "Batal", style: "cancel" },
      { text: "Hapus", style: "destructive", onPress: async () => { const res = await api.tugasDelete(id); if (res.success) load(); } },
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

  return (
    <KeyboardAwareScrollView className="flex-1 bg-background px-4 pt-5" contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 20 }} bottomOffset={20}>
      <Card padding="lg">
        <View className="flex-row items-center gap-1.5 mb-1">
          <ClipboardList size={16} color={colors.primary} />
          <Text className="text-sm font-semibold text-foreground">Buat Tugas / Materi</Text>
        </View>
        <Text className="text-xs text-muted-foreground mb-4">Terkirim ke semua Orang Tua siswa di kelas yang dipilih.</Text>

        {loading ? (
          <Text className="text-sm text-muted-foreground text-center py-4">Memuat...</Text>
        ) : kelasOptions.length === 0 ? (
          <Text className="text-sm text-muted-foreground text-center py-4">Akun ini belum tertaut data guru dari data master.</Text>
        ) : (
          <View className="gap-3">
            <View>
              <Text className="text-xs font-medium text-foreground mb-1.5">Kelas</Text>
              <SimplePicker value={kelasId} options={kelasOptions.map((k) => ({ value: String(k.id), label: `${k.nama}${k.tingkat ? ` (${k.tingkat})` : ""}` }))} onChange={setKelasId} />
            </View>
            <View>
              <Text className="text-xs font-medium text-foreground mb-1.5">Jenis</Text>
              <SimplePicker value={jenis} options={JENIS_OPTIONS} onChange={(v) => setJenis(v as "tugas" | "materi")} />
            </View>
            <View>
              <Text className="text-xs font-medium text-foreground mb-1.5">Judul</Text>
              <Input value={judul} onChangeText={setJudul} maxLength={200} placeholder={jenis === "tugas" ? "Contoh: PR Matematika Bab 3" : "Contoh: Rangkuman IPA"} />
            </View>
            <View>
              <Text className="text-xs font-medium text-foreground mb-1.5">Deskripsi / Catatan</Text>
              <Input value={deskripsi} onChangeText={setDeskripsi} placeholder="Detail tugas/materi..." multiline numberOfLines={3} style={{ minHeight: 80, textAlignVertical: "top", paddingTop: 12 }} />
            </View>
            <View>
              <Text className="text-xs font-medium text-foreground mb-1.5">Tanggal</Text>
              <SimpleCalendarPicker value={tanggal} onChange={setTanggal} />
            </View>
            {jenis === "tugas" && (
              <>
                <View>
                  <Text className="text-xs font-medium text-foreground mb-1.5">Batas Kumpul</Text>
                  <SimpleCalendarPicker value={deadline} onChange={setDeadline} />
                </View>
                {/* SEBELUMNYA disembunyikan sampai tanggal diisi dulu -
                    terbukti membingungkan (dilaporkan user 2026-09-03:
                    fieldnya dikira tidak ada sama sekali). Sekarang selalu
                    tampil begitu jenis="tugas", sama seperti Google
                    Classroom menampilkan tanggal & jam sekaligus. */}
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
                <Pressable
                  onPress={() => setKunciOtomatis((v) => !v)}
                  className="flex-row items-start gap-2.5 py-1"
                >
                  <View className={`w-5 h-5 rounded border items-center justify-center mt-0.5 ${kunciOtomatis ? "bg-primary border-primary" : "border-border"}`}>
                    {kunciOtomatis && <Check size={13} color={colors.primaryForeground} />}
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-medium text-foreground">Kunci pengumpulan setelah lewat batas</Text>
                    <Text className="text-[11px] text-muted-foreground mt-0.5">
                      Siswa tidak bisa mengumpulkan lagi setelah lewat jam batas. Anda tetap bisa membukanya
                      kembali kapan saja lewat daftar di bawah.
                    </Text>
                  </View>
                </Pressable>
              </>
            )}

            {/* Lampiran berkas (2026-09-03) - berlaku utk Tugas MAUPUN Materi,
                spt Google Classroom lampirkan worksheet/bahan ajar ke keduanya. */}
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
              <Plus size={14} color={colors.primaryForeground} />{"  "}{saving ? "Menyimpan..." : `Buat ${jenis === "tugas" ? "Tugas" : "Materi"}`}
            </Button>
            {message && <Text className={`text-xs text-center ${message.ok ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>{message.text}</Text>}
          </View>
        )}
      </Card>

      <View>
        <Text className="text-sm font-semibold text-foreground mb-3">Tugas & Materi Saya</Text>
        {tugasList.length === 0 ? (
          <Text className="text-sm text-muted-foreground text-center py-4">Belum ada tugas/materi yang dibuat.</Text>
        ) : (
          <View className="gap-2">
            {tugasList.map((t) => (
              <Card key={t.id} padding="sm">
                <View className="flex-row items-start justify-between gap-2">
                  <View className="flex-1">
                    <View className="flex-row items-center gap-1.5 mb-0.5 flex-wrap">
                      {t.jenis === "tugas" ? <ClipboardList size={13} color={colors.primary} /> : <BookOpen size={13} color={colors.primary} />}
                      <Text className="text-sm font-medium text-foreground">{t.judul}</Text>
                      <Badge variant={t.jenis === "tugas" ? "info" : "muted"}>{t.jenis === "tugas" ? "Tugas" : "Materi"}</Badge>
                    </View>
                    <Text className="text-xs text-muted-foreground">
                      Kelas {t.kelas_nama} · {formatDateFull(t.tanggal)}
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
                    {t.jenis === "tugas" && (
                      <>
                        <Text className="text-xs text-primary mt-0.5">
                          {t.jumlah_selesai} siswa sudah mengerjakan
                          {typeof t.jumlah_dinilai === "number" ? ` · ${t.jumlah_dinilai} dinilai` : ""}
                        </Text>
                        {typeof t.total_tugas_kelas === "number" && (
                          <Text className="text-[11px] text-muted-foreground mt-0.5">
                            Total {t.total_tugas_kelas} tugas Anda di kelas ini
                          </Text>
                        )}
                        {t.deadline ? (
                          <Pressable
                            onPress={() => toggleKunci(t)}
                            className="self-start mt-1.5 flex-row items-center gap-1.5 px-2 py-1 rounded-full bg-muted"
                          >
                            {t.terkunci ? <Lock size={11} color="#dc2626" /> : <Unlock size={11} color={colors.primary} />}
                            <Text className={`text-[10px] font-medium ${t.terkunci ? "text-red-600 dark:text-red-400" : "text-primary"}`}>
                              {t.terkunci ? "Terkunci - ketuk untuk buka" : Number(t.dibuka_manual) ? "Dibuka kembali - ketuk untuk tutup" : Number(t.kunci_otomatis) ? "Akan terkunci setelah batas" : "Tidak dikunci"}
                            </Text>
                          </Pressable>
                        ) : null}
                      </>
                    )}
                  </View>
                  <View className="flex-row items-center gap-1">
                    {t.jenis === "tugas" && (
                      <Pressable onPress={() => toggleRekap(t.id)} className="p-1.5">
                        {expandedId === t.id ? <ChevronUp size={16} color={colors.mutedForeground} /> : <ChevronDown size={16} color={colors.mutedForeground} />}
                      </Pressable>
                    )}
                    <Pressable onPress={() => handleDelete(t.id)} className="p-1.5">
                      <Trash2 size={15} color="#ef4444" />
                    </Pressable>
                  </View>
                </View>
                {t.jenis === "tugas" && expandedId === t.id && (
                  <View className="mt-3 pt-3 border-t border-border">
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

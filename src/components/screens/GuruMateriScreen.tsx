import React, { useEffect, useState } from "react";
import { View, Text, Pressable, Alert, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import * as DocumentPicker from "expo-document-picker";
import { BookOpen, Plus, Trash2, Paperclip, FileText, X } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
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
// webview GuruMateriScreen.tsx.
const SENTINEL_UMUM = "umum";

interface PengajaranOption {
  kelasId: number;
  kelasNama: string;
  tingkat: string | null;
  mataPelajaranSourceId: number | null;
  mataPelajaranNama: string;
}

interface MateriRow {
  id: number;
  judul: string;
  deskripsi: string | null;
  tanggal: string;
  kelas_nama: string;
  mata_pelajaran_source_id: number | null;
  mata_pelajaran_nama: string | null;
  lampiran_filename: string | null;
  lampiran_nama_asli: string | null;
  lampiran_ukuran: number | null;
}

function opsiMapelUntukKelas(pengajaranOptions: PengajaranOption[], kelasIdStr: string): { value: string; label: string }[] {
  return pengajaranOptions
    .filter((o) => String(o.kelasId) === kelasIdStr)
    .map((o) => ({
      value: o.mataPelajaranSourceId === null ? SENTINEL_UMUM : String(o.mataPelajaranSourceId),
      label: o.mataPelajaranNama || "Umum (Wali Kelas)",
    }));
}

// Guru - kelola Materi (catatan pembelajaran, TANPA deadline/kunci/nilai -
// bukan sesuatu yang "dikumpulkan"). Kelas & mapel yang muncul di form
// dibatasi ke kombinasi yang BENAR-BENAR diampu guru ini (tugasPengajaranOptions),
// dipisah dari GuruTugasScreen.tsx (poin 3 Fase 2, 2026-09-24). Port native
// dari webview GuruMateriScreen.tsx, gaya komponen dari BuatTugasScreen.tsx
// native lama.
export function GuruMateriScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  // Status Akun Alumni (guru purna bakti) - lihat catatan sama di
  // GuruTugasScreen.tsx.
  const isAlumni = getActiveSession()?.isAlumni === true;

  const [pengajaranOptions, setPengajaranOptions] = useState<PengajaranOption[]>([]);
  const [materiList, setMateriList] = useState<MateriRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);

  const [kelasId, setKelasId] = useState<string>("");
  const [mapelValue, setMapelValue] = useState<string>("");
  const [judul, setJudul] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [tanggal, setTanggal] = useState(getTodayLocal());
  const [lampiran, setLampiran] = useState<{ uri: string; name: string; mimeType: string; size: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const [filterKelasId, setFilterKelasId] = useState("");
  const [filterMapelValue, setFilterMapelValue] = useState("");

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
      jenis: "materi",
      kelasId: filterKelasId ? Number(filterKelasId) : undefined,
      mataPelajaranSourceId: filterMapelValue === "" ? undefined : filterMapelValue === SENTINEL_UMUM ? null : Number(filterMapelValue),
    });
    setListLoading(false);
    if (res.success) setMateriList(res.data);
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
      jenis: "materi",
      judul: judul.trim(),
      deskripsi: deskripsi.trim() || undefined,
      tanggal,
      lampiran: lampiran ? { uri: lampiran.uri, name: lampiran.name, mimeType: lampiran.mimeType } : undefined,
      mataPelajaranSourceId: mapelValue === SENTINEL_UMUM ? null : (mapelValue ? Number(mapelValue) : undefined),
      pengajaranModeBaru: true,
    });
    setSaving(false);
    setMessage({ text: res.message ?? (res.success ? "Materi berhasil dibuat." : "Gagal membuat materi."), ok: !!res.success });
    if (res.success) {
      setJudul("");
      setDeskripsi("");
      setLampiran(null);
      loadList();
    }
  }

  function handleDelete(id: number) {
    Alert.alert("Hapus Materi", "Hapus materi ini?", [
      { text: "Batal", style: "cancel" },
      { text: "Hapus", style: "destructive", onPress: async () => { const res = await api.tugasDelete(id); if (res.success) loadList(); } },
    ]);
  }

  return (
    <KeyboardAwareScrollView className="flex-1 bg-background px-4 pt-5" contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 20 }} bottomOffset={20}>
      {!isAlumni && (
        <Card padding="lg">
          <View className="flex-row items-center gap-1.5 mb-1">
            <BookOpen size={16} color={colors.primary} />
            <Text className="text-sm font-semibold text-foreground">Buat Materi</Text>
          </View>
          <Text className="text-xs text-muted-foreground mb-4">Catatan pembelajaran, tampil ke Orang Tua siswa di kelas yang dipilih (tanpa deadline).</Text>

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
                <Input value={judul} onChangeText={setJudul} maxLength={200} placeholder="Contoh: Rangkuman IPA - Sistem Pencernaan" />
              </View>
              <View>
                <Text className="text-xs font-medium text-foreground mb-1.5">Deskripsi / Catatan</Text>
                <Input value={deskripsi} onChangeText={setDeskripsi} placeholder="Detail materi..." multiline numberOfLines={3} style={{ minHeight: 80, textAlignVertical: "top", paddingTop: 12 }} />
              </View>
              <View>
                <Text className="text-xs font-medium text-foreground mb-1.5">Tanggal</Text>
                <SimpleCalendarPicker value={tanggal} onChange={setTanggal} />
              </View>

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
                <Plus size={14} color={colors.primaryForeground} />{"  "}{saving ? "Menyimpan..." : "Buat Materi"}
              </Button>
              {message && <Text className={`text-xs text-center ${message.ok ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>{message.text}</Text>}
            </View>
          )}
        </Card>
      )}

      <View>
        <Text className="text-sm font-semibold text-foreground mb-2">Materi Saya</Text>
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
        ) : materiList.length === 0 ? (
          <Text className="text-sm text-muted-foreground text-center py-4">Belum ada materi yang dibuat.</Text>
        ) : (
          <View className="gap-2">
            {materiList.map((m) => (
              <Card key={m.id} padding="sm">
                <View className="flex-row items-start justify-between gap-2">
                  <View className="flex-1">
                    <View className="flex-row items-center gap-1.5 mb-0.5">
                      <BookOpen size={13} color={colors.primary} />
                      <Text className="text-sm font-medium text-foreground" numberOfLines={1}>{m.judul}</Text>
                    </View>
                    <Text className="text-xs text-muted-foreground">
                      Kelas {m.kelas_nama} · {m.mata_pelajaran_nama || "Umum (Wali Kelas)"} · {formatDateFull(m.tanggal)}
                    </Text>
                    {m.lampiran_filename && (
                      <Pressable
                        onPress={() => Linking.openURL(`${API_URL}/uploads/tugas/${m.lampiran_filename}`)}
                        className="flex-row items-center gap-1.5 mt-1 self-start"
                      >
                        <Paperclip size={11} color={colors.primary} />
                        <Text className="text-[11px] text-primary underline" numberOfLines={1}>{m.lampiran_nama_asli}</Text>
                        {typeof m.lampiran_ukuran === "number" && (
                          <Text className="text-[10px] text-muted-foreground">({formatUkuranBerkas(m.lampiran_ukuran)})</Text>
                        )}
                      </Pressable>
                    )}
                  </View>
                  <Pressable onPress={() => handleDelete(m.id)} className="p-1.5">
                    <Trash2 size={15} color="#ef4444" />
                  </Pressable>
                </View>
              </Card>
            ))}
          </View>
        )}
      </View>
    </KeyboardAwareScrollView>
  );
}

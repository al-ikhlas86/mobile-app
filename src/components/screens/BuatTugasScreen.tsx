import React, { useEffect, useState } from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { ClipboardList, BookOpen, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Input } from "../ui/Input";
import { SimplePicker } from "../ui/SimplePicker";
import { SimpleCalendarPicker } from "../ui/SimpleCalendarPicker";
import { api } from "../../services/api";
import { getTodayLocal } from "../../utils/formatters";
import { useThemeColors } from "../../context/ThemeContext";

interface KelasOption { id: number; nama: string; tingkat: string | null; }
interface TugasRow { id: number; jenis: "tugas" | "materi"; judul: string; deskripsi: string | null; tanggal: string; deadline: string | null; kelas_nama: string; jumlah_selesai: number; }
interface RekapSiswa { student_cache_id: number; nama: string; status: "belum" | "sudah"; }

const JENIS_OPTIONS = [
  { value: "tugas", label: "Tugas (perlu dikerjakan siswa)" },
  { value: "materi", label: "Materi (catatan pembelajaran)" },
];

function formatDateFull(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

// Guru/Guru Kelas - buat tugas atau materi utk 1 kelas. Port native dari
// webview BuatTugasScreen.tsx - lihat catatan lengkap di sana (upload
// berkas SENGAJA belum ada, ditunda keputusan user 2026-08-30).
export function BuatTugasScreen() {
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
    });
    setSaving(false);
    setMessage({ text: res.message ?? (res.success ? `${jenis === "tugas" ? "Tugas" : "Materi"} berhasil dibuat.` : "Gagal membuat."), ok: !!res.success });
    if (res.success) {
      setJudul(""); setDeskripsi(""); setDeadline("");
      load();
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
    <KeyboardAwareScrollView className="flex-1 bg-background px-4 pt-5" contentContainerStyle={{ paddingBottom: 32, gap: 20 }} bottomOffset={20}>
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
              <View>
                <Text className="text-xs font-medium text-foreground mb-1.5">Batas Kumpul</Text>
                <SimpleCalendarPicker value={deadline} onChange={setDeadline} />
              </View>
            )}
            <Button onPress={handleSubmit} disabled={saving} loading={saving} className="mt-1">
              <Plus size={14} color={colors.primaryForeground} />{"  "}{saving ? "Menyimpan..." : `Buat ${jenis === "tugas" ? "Tugas" : "Materi"}`}
            </Button>
            {message && <Text className={`text-xs text-center ${message.ok ? "text-green-600" : "text-red-500"}`}>{message.text}</Text>}
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
                      Kelas {t.kelas_nama} · {formatDateFull(t.tanggal)}{t.deadline ? ` · batas ${formatDateFull(t.deadline)}` : ""}
                    </Text>
                    {t.jenis === "tugas" && <Text className="text-xs text-primary mt-0.5">{t.jumlah_selesai} siswa sudah mengerjakan</Text>}
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
                      <View className="gap-1">
                        {rekapByTugas[t.id].map((s) => (
                          <View key={s.student_cache_id} className="flex-row items-center justify-between py-1">
                            <Text className="text-xs text-foreground">{s.nama}</Text>
                            <Badge variant={s.status === "sudah" ? "success" : "muted"}>{s.status === "sudah" ? "Sudah" : "Belum"}</Badge>
                          </View>
                        ))}
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

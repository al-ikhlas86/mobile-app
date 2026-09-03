import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Pressable, Linking } from "react-native";
import { ClipboardList, BookOpen, CheckCircle, Paperclip, Award, AlertCircle } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { ChildSwitcher } from "../ChildSwitcher";
import { api, API_URL } from "../../services/api";
import { useThemeColors } from "../../context/ThemeContext";

interface ChildData { id: number; nama: string; kelas_nama: string | null; }
interface TugasRow { id: number; jenis: "tugas" | "materi"; judul: string; deskripsi: string | null; tanggal: string; deadline: string | null; deadline_jam: string | null; terkunci: boolean; guru_nama: string; status_pengerjaan: "belum" | "sudah"; nilai: string | null; catatan_guru: string | null; terlambat: number | null; lampiran_filename: string | null; lampiran_nama_asli: string | null; lampiran_ukuran: number | null; }

function formatDateFull(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function formatUkuranBerkas(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Orang Tua - lihat Tugas & Materi Pembelajaran utk kelas anaknya. Port
// native dari webview TugasAnakScreen.tsx - tombol "Upload Berkas" SENGAJA
// placeholder (nonaktif), lihat catatan lengkap di versi webview.
export function TugasAnakScreen() {
  const colors = useThemeColors();
  const [children, setChildren] = useState<ChildData[]>([]);
  const [activeChildId, setActiveChildId] = useState<number | null>(null);
  const [tugasList, setTugasList] = useState<TugasRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

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

  async function handleTandaiSelesai(tugasId: number) {
    if (!activeChildId) return;
    setBusyId(tugasId);
    const res = await api.tugasTandaiSelesai(tugasId, activeChildId);
    setBusyId(null);
    if (res.success) loadTugas(activeChildId);
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
    <ScrollView className="flex-1 bg-background px-4 pt-5" contentContainerStyle={{ paddingBottom: 32, gap: 12 }}>
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
                <View className="flex-row items-center gap-2 flex-wrap">
                  {t.status_pengerjaan === "sudah" ? (
                    <>
                      <Badge variant="success">Sudah Dikerjakan</Badge>
                      {Number(t.terlambat) === 1 && <Badge variant="warning">Terlambat</Badge>}
                    </>
                  ) : t.terkunci ? (
                    // Tombol disembunyikan HANYA sbg kejelasan utk ortu -
                    // penolakan sungguhannya ada di server (routes/tugas.js),
                    // jadi tidak bisa ditembus lewat permintaan langsung.
                    <Badge variant="error">Pengumpulan ditutup guru</Badge>
                  ) : (
                    <Button size="sm" onPress={() => handleTandaiSelesai(t.id)} disabled={busyId === t.id} loading={busyId === t.id}>
                      <CheckCircle size={13} color={colors.primaryForeground} />{"  "}Tandai Sudah Dikerjakan
                    </Button>
                  )}
                  <Button size="sm" variant="outline" disabled style={{ opacity: 0.6 }}>
                    <Paperclip size={13} color={colors.mutedForeground} />{"  "}Upload Berkas (Segera Hadir)
                  </Button>
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

import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, Pressable, Linking } from "react-native";
import { BookOpen, Paperclip, AlertCircle } from "lucide-react-native";
import { Card } from "../ui/Card";
import { SimplePicker } from "../ui/SimplePicker";
import { api, API_URL } from "../../services/api";
import { useThemeColors } from "../../context/ThemeContext";

// Batas & format SAMA PERSIS dgn SiswaTugasScreen.tsx/TugasAnakScreen.tsx
// (dipakai ulang cuma utk lampiran materi, view-only di layar ini).
function formatUkuranBerkas(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDateFull(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

interface MateriRow {
  id: number;
  judul: string;
  deskripsi: string | null;
  tanggal: string;
  guru_nama: string;
  mata_pelajaran_source_id: number | null;
  mata_pelajaran_nama: string | null;
  lampiran_filename: string | null;
  lampiran_nama_asli: string | null;
  lampiran_ukuran: number | null;
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

// Materi pembelajaran sisi siswa - VIEW ONLY, tanpa form isi jawaban/tombol
// kumpul (materi bukan sesuatu yg dikumpulkan, beda dgn SiswaTugasScreen).
// Port native dari webview SiswaMateriScreen.tsx (2026-09-24) -
// studentCacheId dari PROP (dikelola shell AkademikSiswaScreen), bukan
// ChildSwitcher/myChildren() sendiri di file ini.
export function SiswaMateriScreen({ studentCacheId, studentNama, kelasNama }: Props) {
  // allMateri = hasil fetch TANPA filter mapel, dipakai HANYA utk membangun
  // opsi dropdown (tidak ada endpoint daftar mapel terpisah sisi siswa).
  // materiList = data yang benar2 ditampilkan, hasil fetch dgn filter aktif.
  const [allMateri, setAllMateri] = useState<MateriRow[]>([]);
  const [materiList, setMateriList] = useState<MateriRow[]>([]);
  const [mapelFilter, setMapelFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const colors = useThemeColors();

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      setMapelFilter("all");
      const res = await api.tugasAnak(studentCacheId, { jenis: "materi" });
      if (res.success) {
        setAllMateri(res.data);
        setMateriList(res.data);
      } else {
        setError(res.message ?? "Gagal memuat materi.");
      }
      setLoading(false);
    })();
  }, [studentCacheId]);

  async function handleFilterChange(v: string) {
    setMapelFilter(v);
    setLoading(true);
    setError("");
    const mataPelajaranSourceId = v === "all" ? undefined : v === "null" ? null : Number(v);
    const res = await api.tugasAnak(studentCacheId, { jenis: "materi", mataPelajaranSourceId });
    if (res.success) setMateriList(res.data);
    else setError(res.message ?? "Gagal memuat materi.");
    setLoading(false);
  }

  // Pasangan unik {source_id, nama} dari data TANPA filter - source_id null
  // (mapel "Umum", tanpa mapel tertentu) dipetakan ke key khusus "null".
  const mapelMap = new Map<string, string>();
  for (const m of allMateri) {
    const key = m.mata_pelajaran_source_id === null ? "null" : String(m.mata_pelajaran_source_id);
    if (!mapelMap.has(key)) mapelMap.set(key, m.mata_pelajaran_nama ?? "Umum");
  }
  const mapelOptions: MapelOption[] = [
    { value: "all", label: "Semua Mata Pelajaran" },
    ...Array.from(mapelMap.entries()).map(([value, label]) => ({ value, label })),
  ];

  if (loading && allMateri.length === 0) {
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
        Materi pembelajaran untuk kelas {kelasNama ?? "-"} ({studentNama}).
      </Text>

      {mapelOptions.length > 1 && (
        <SimplePicker value={mapelFilter} options={mapelOptions} onChange={handleFilterChange} placeholder="Mata Pelajaran" />
      )}

      {materiList.length === 0 ? (
        <Text className="text-sm text-muted-foreground text-center py-8">Belum ada materi untuk kelas ini.</Text>
      ) : (
        <View className="gap-3">
          {materiList.map((m) => (
            <Card key={m.id} padding="md">
              <View className="flex-row items-center gap-1.5 mb-1">
                <BookOpen size={15} color={colors.primary} />
                <Text className="text-sm font-semibold text-foreground flex-1">{m.judul}</Text>
              </View>
              <Text className="text-xs text-muted-foreground mb-2">
                {m.guru_nama}
                {m.mata_pelajaran_nama ? ` · ${m.mata_pelajaran_nama}` : ""} · {formatDateFull(m.tanggal)}
              </Text>
              {!!m.deskripsi && <Text className="text-sm text-foreground mb-3">{m.deskripsi}</Text>}

              {m.lampiran_filename && (
                <Pressable
                  onPress={() => Linking.openURL(`${API_URL}/uploads/tugas/${m.lampiran_filename}`)}
                  className="flex-row items-center gap-2 bg-muted rounded-xl px-3 py-2 self-start"
                >
                  <Paperclip size={14} color={colors.primary} />
                  <Text className="text-xs font-medium text-primary underline" numberOfLines={1}>{m.lampiran_nama_asli}</Text>
                  {typeof m.lampiran_ukuran === "number" && (
                    <Text className="text-[10px] text-muted-foreground">({formatUkuranBerkas(m.lampiran_ukuran)})</Text>
                  )}
                </Pressable>
              )}
            </Card>
          ))}
        </View>
      )}
    </View>
  );
}

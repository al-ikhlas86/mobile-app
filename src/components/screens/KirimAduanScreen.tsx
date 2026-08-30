import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { AlertCircle, Send, Paperclip, MessageSquareWarning } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Input } from "../ui/Input";
import { SimplePicker } from "../ui/SimplePicker";
import { ChildSwitcher } from "../ChildSwitcher";
import { api } from "../../services/api";
import { getTodayLocal } from "../../utils/formatters";
import { useThemeColors } from "../../context/ThemeContext";

interface ChildData { id: number; nama: string; }
interface AduanRow { id: number; kategori: string; isi: string; bukti_foto_path: string | null; status: string; created_at: string; }

const KATEGORI_OPTIONS = [
  { value: "wali_kelas", label: "Wali Kelas" },
  { value: "admin_it", label: "Admin IT" },
  { value: "keuangan", label: "Keuangan" },
  { value: "tu", label: "Tata Usaha" },
];

function formatDateFull(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
function statusBadge(status: string): "success" | "warning" | "muted" {
  if (status === "selesai") return "success";
  if (status === "dibaca") return "warning";
  return "muted";
}
function statusLabel(status: string): string {
  if (status === "selesai") return "Selesai Ditindaklanjuti";
  if (status === "dibaca") return "Sudah Dibaca";
  return "Menunggu Dibaca";
}

export function KirimAduanScreen() {
  const colors = useThemeColors();
  const [children, setChildren] = useState<ChildData[]>([]);
  const [activeChildId, setActiveChildId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [riwayat, setRiwayat] = useState<AduanRow[]>([]);

  const [kategori, setKategori] = useState<"wali_kelas" | "admin_it" | "keuangan" | "tu">("wali_kelas");
  const [isi, setIsi] = useState("");
  const [foto, setFoto] = useState<{ uri: string; mimeType?: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function load() {
    setLoading(true);
    const [childrenRes, mineRes] = await Promise.all([api.myChildren(), api.aduanMine()]);
    if (childrenRes.success) {
      setChildren(childrenRes.data);
      setActiveChildId((prev) => (prev !== null && childrenRes.data.some((c: ChildData) => c.id === prev) ? prev : childrenRes.data[0]?.id ?? null));
    }
    if (mineRes.success) setRiwayat(mineRes.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const child = children.find((c) => c.id === activeChildId) ?? null;

  async function handlePickFoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setFoto({ uri: asset.uri, mimeType: asset.mimeType ?? "image/jpeg", name: asset.fileName ?? "bukti.jpg" });
  }

  async function handleSubmit() {
    if (!child) return;
    if (!isi.trim()) {
      setMessage({ text: "Isi aduan wajib diisi.", ok: false });
      return;
    }
    setBusy(true);
    setMessage(null);
    const res = await api.aduanSubmit({ studentCacheId: child.id, kategori, isi: isi.trim(), buktiFotoUri: foto?.uri, buktiFotoMime: foto?.mimeType });
    setBusy(false);
    setMessage({ text: res.message ?? (res.success ? "Aduan terkirim." : "Gagal mengirim aduan."), ok: !!res.success });
    if (res.success) {
      setIsi("");
      setFoto(null);
      load();
    }
  }

  if (loading) return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator color={colors.primary} /></View>;
  if (!child) {
    return (
      <View className="flex-1 items-center justify-center bg-background gap-3 px-8">
        <AlertCircle size={32} color={colors.mutedForeground} />
        <Text className="text-sm text-muted-foreground text-center">Belum ada data anak yang tertaut ke akun ini.</Text>
      </View>
    );
  }

  const alreadySentToday = riwayat.some((r) => r.created_at.slice(0, 10) === getTodayLocal());

  return (
    <ScrollView className="flex-1 bg-background px-4 pt-5" contentContainerStyle={{ paddingBottom: 32, gap: 20 }}>
      <ChildSwitcher children={children} activeId={activeChildId} onChange={setActiveChildId} />

      <Card padding="lg">
        <View className="flex-row items-center gap-1.5 mb-1">
          <MessageSquareWarning size={16} color={colors.primary} />
          <Text className="text-sm font-semibold text-foreground">Kirim Aduan untuk {child.nama}</Text>
        </View>
        <Text className="text-xs text-muted-foreground mb-4">Maksimal 1 aduan per hari untuk SELURUH akun (bukan per anak). Pilih tujuan yang paling sesuai.</Text>

        {alreadySentToday ? (
          <Text className="text-sm text-amber-600 text-center py-4">Anda sudah mengirim aduan hari ini. Coba lagi besok.</Text>
        ) : (
          <View className="gap-3">
            <View>
              <Text className="text-xs font-medium text-foreground mb-1.5">Kirim Ke</Text>
              <SimplePicker value={kategori} options={KATEGORI_OPTIONS} onChange={(v) => setKategori(v as typeof kategori)} />
            </View>
            <View>
              <Text className="text-xs font-medium text-foreground mb-1.5">Isi Aduan</Text>
              <Input value={isi} onChangeText={setIsi} placeholder="Tuliskan aduan Anda..." multiline numberOfLines={4} style={{ minHeight: 100, textAlignVertical: "top", paddingTop: 12 }} />
            </View>
            <View>
              <Text className="text-xs font-medium text-foreground mb-1.5">Lampiran Foto (opsional)</Text>
              <Pressable onPress={handlePickFoto} className="flex-row items-center gap-2 border border-dashed border-border rounded-xl px-3 py-3">
                <Paperclip size={15} color={colors.mutedForeground} />
                <Text className="text-sm text-muted-foreground flex-1" numberOfLines={1}>{foto ? foto.name : "Pilih file foto..."}</Text>
              </Pressable>
            </View>
            <Button onPress={handleSubmit} disabled={busy} loading={busy} className="mt-1">
              <Send size={14} color={colors.primaryForeground} />{"  "}Kirim Aduan
            </Button>
            {message && <Text className={`text-xs text-center ${message.ok ? "text-green-600" : "text-red-500"}`}>{message.text}</Text>}
          </View>
        )}
      </Card>

      <View>
        <Text className="text-sm font-semibold text-foreground mb-3">Riwayat Aduan Saya</Text>
        {riwayat.length === 0 ? (
          <Text className="text-sm text-muted-foreground text-center py-4">Belum pernah mengirim aduan.</Text>
        ) : (
          <View className="gap-2">
            {riwayat.map((r) => (
              <Card key={r.id} padding="sm">
                <View className="flex-row items-start justify-between gap-2 mb-1">
                  <Text className="text-xs text-muted-foreground flex-1">{formatDateFull(r.created_at.slice(0, 10))} · {KATEGORI_OPTIONS.find((k) => k.value === r.kategori)?.label ?? r.kategori}</Text>
                  <Badge variant={statusBadge(r.status)}>{statusLabel(r.status)}</Badge>
                </View>
                <Text className="text-sm text-foreground">{r.isi}</Text>
              </Card>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

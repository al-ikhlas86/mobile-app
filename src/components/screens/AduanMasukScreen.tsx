import React, { useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, Linking } from "react-native";
import { Image as ImageIcon, CheckCircle, Inbox } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { api, API_URL } from "../../services/api";
import { useThemeColors } from "../../context/ThemeContext";

interface AduanRow {
  id: number;
  kategori: string;
  isi: string;
  bukti_foto_path: string | null;
  status: string;
  created_at: string;
  student_nama: string;
  kelas_nama: string | null;
  pengirim_nama: string;
}

const KATEGORI_LABEL: Record<string, string> = { wali_kelas: "Wali Kelas", admin_it: "Admin IT", keuangan: "Keuangan", tu: "Tata Usaha" };

function formatDateFull(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
function statusBadge(status: string): "success" | "warning" | "muted" {
  if (status === "selesai") return "success";
  if (status === "dibaca") return "warning";
  return "muted";
}
function statusLabel(status: string): string {
  if (status === "selesai") return "Selesai";
  if (status === "dibaca") return "Dibaca";
  return "Baru";
}

export function AduanMasukScreen() {
  const colors = useThemeColors();
  const [rows, setRows] = useState<AduanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    const res = await api.aduanInbox();
    if (res.success) {
      setRows(res.data);
      // Sama pola dgn webview - isi sudah tampil penuh di daftar ini (bukan
      // "tap utk buka detail"), jadi begitu daftar dimuat = wajar dianggap
      // "dibaca". Tandai semua yg masih 'baru'.
      const unread = res.data.filter((r: AduanRow) => r.status === "baru");
      for (const r of unread) api.aduanMarkRead(r.id).catch(() => {});
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleResolve(id: number) {
    setBusyId(id);
    await api.aduanMarkResolved(id);
    setBusyId(null);
    load();
  }

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 pt-5 pb-2">
        <View className="flex-row items-center gap-2">
          <Inbox size={18} color={colors.primary} />
          <Text className="text-sm font-semibold text-foreground">Aduan Masuk</Text>
        </View>
      </View>

      <FlatList
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 32, gap: 12 }}
        data={rows}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={<Text className="text-sm text-muted-foreground text-center py-6">{loading ? "Memuat..." : "Belum ada aduan masuk."}</Text>}
        renderItem={({ item }) => (
          <Card padding="md">
            <View className="flex-row items-start justify-between gap-2 mb-2">
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground">{item.pengirim_nama}</Text>
                <Text className="text-xs text-muted-foreground">
                  Terkait {item.student_nama}{item.kelas_nama ? ` · Kelas ${item.kelas_nama}` : ""} · {formatDateFull(item.created_at.slice(0, 10))}
                </Text>
              </View>
              <Badge variant={statusBadge(item.status)}>{statusLabel(item.status)}</Badge>
            </View>
            <Text className="text-xs text-muted-foreground mb-1">Kategori: {KATEGORI_LABEL[item.kategori] ?? item.kategori}</Text>
            <Text className="text-sm text-foreground mb-2">{item.isi}</Text>
            {!!item.bukti_foto_path && (
              <Pressable onPress={() => Linking.openURL(`${API_URL}${item.bukti_foto_path}`)} className="flex-row items-center gap-1.5 mb-2">
                <ImageIcon size={14} color={colors.primary} />
                <Text className="text-xs text-primary font-medium">Lihat lampiran foto</Text>
              </Pressable>
            )}
            {item.status !== "selesai" && (
              <Button size="sm" onPress={() => handleResolve(item.id)} disabled={busyId === item.id} loading={busyId === item.id} className="mt-1">
                <CheckCircle size={14} color="#fff" />{"  "}Tandai Selesai
              </Button>
            )}
          </Card>
        )}
      />
    </View>
  );
}

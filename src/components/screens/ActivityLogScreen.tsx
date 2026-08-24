import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { ChevronLeft, ChevronRight, AlertTriangle, History } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { api } from "../../services/api";

const ACTION_LABELS: Record<string, string> = {
  buat_akun: "Buat Akun", edit_akun: "Edit Akun", ganti_role: "Ganti Role", hapus_akun: "Hapus Akun",
  putus_wa_bot: "Putus Koneksi WA", ganti_nomor_alarm: "Ganti Nomor Alarm", tautkan_akun_ganda: "Tautkan Akun Ganda",
  tolak_akun_ganda: "Tolak Akun Ganda", ganti_password: "Ganti Password",
};
interface LogItem { id: number; actor_user_id: number | null; actor_name: string | null; action: string; description: string | null; created_at: string; }
function formatTime(ts: string) { return new Date(ts).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }

export function ActivityLogScreen() {
  const [items, setItems] = useState<LogItem[] | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true); setError("");
      const res = await api.adminActivityLogs(page);
      if (!res.success || !res.data) setError("Gagal memuat riwayat aktivitas.");
      else { setItems(res.data); setTotalPages(res.totalPages); }
      setLoading(false);
    })();
  }, [page]);

  return (
    <ScrollView className="flex-1 bg-background px-4 pt-5" contentContainerStyle={{ paddingBottom: 32, gap: 12 }}>
      <Text className="text-xs text-muted-foreground">Riwayat aksi administratif sensitif (ganti role, hapus akun, ganti password, putus koneksi WA, dst).</Text>
      {loading ? (
        <Card padding="lg"><View className="items-center py-4"><ActivityIndicator color="#356447" /></View></Card>
      ) : error ? (
        <Card padding="lg"><View className="items-center py-4"><AlertTriangle size={40} color="#ef4444" /><Text className="text-sm text-muted-foreground mt-2">{error}</Text></View></Card>
      ) : items && items.length === 0 ? (
        <Card padding="lg"><View className="items-center py-6"><History size={40} color="#6E776F" /><Text className="text-sm text-muted-foreground mt-2">Belum ada aktivitas tercatat.</Text></View></Card>
      ) : (
        items?.map((item) => (
          <Card key={item.id} padding="md">
            <View className="flex-row items-start justify-between gap-2">
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground">{ACTION_LABELS[item.action] ?? item.action}</Text>
                <Text className="text-xs text-muted-foreground mt-0.5">{item.description}</Text>
              </View>
              <Text className="text-xs text-muted-foreground">{formatTime(item.created_at)}</Text>
            </View>
            <Text className="text-xs text-primary mt-1">oleh {item.actor_name ?? "(akun sudah dihapus)"}</Text>
          </Card>
        ))
      )}
      {!loading && !error && totalPages > 1 && (
        <View className="flex-row items-center justify-center gap-3 mt-2">
          <Button variant="outline" disabled={page <= 1} onPress={() => setPage((p) => p - 1)}><ChevronLeft size={16} color="#356447" /></Button>
          <Text className="text-xs text-muted-foreground">Halaman {page} / {totalPages}</Text>
          <Button variant="outline" disabled={page >= totalPages} onPress={() => setPage((p) => p + 1)}><ChevronRight size={16} color="#356447" /></Button>
        </View>
      )}
    </ScrollView>
  );
}

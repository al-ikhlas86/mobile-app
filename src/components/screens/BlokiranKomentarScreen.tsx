import React, { useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator } from "react-native";
import { Ban, UserX } from "lucide-react-native";
import { Card } from "../ui/Card";
import { api } from "../../services/api";
import { useThemeColors } from "../../context/ThemeContext";

interface BlockedUser { id: number; user_id: number; full_name: string; username: string; blocked_by_name: string; created_at: string; }
function formatDate(iso: string) { return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }); }

export function BlokiranKomentarScreen() {
  const colors = useThemeColors();
  const [items, setItems] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await api.beritaAcaraBlockedCommenters();
    setLoading(false);
    if (res.success) setItems(res.data);
    else setError(res.message ?? "Gagal memuat daftar blokiran.");
  };
  useEffect(() => { load(); }, []);

  async function handleUnblock(userId: number) {
    if (confirmId !== userId) { setConfirmId(userId); return; }
    setConfirmId(null);
    const res = await api.beritaAcaraUnblockCommenter(userId);
    if (res.success) setItems((prev) => prev.filter((i) => i.user_id !== userId));
  }

  if (loading) return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator color={colors.primary} /></View>;

  return (
    <FlatList
      className="flex-1 bg-background"
      contentContainerStyle={{ padding: 16, gap: 10 }}
      ListHeaderComponent={
        <View className="mb-4 gap-3">
          <Text className="text-xs text-muted-foreground">Akun di bawah ini diblokir dari memberi komentar baru di Berita Acara manapun (blokir global, bukan per-berita). Komentar lama mereka TIDAK ikut terhapus.</Text>
          {error ? <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3"><Text className="text-sm text-red-600">{error}</Text></View> : null}
        </View>
      }
      data={items}
      keyExtractor={(item) => String(item.id)}
      ListEmptyComponent={
        <View className="py-12 items-center gap-3">
          <View className="w-16 h-16 rounded-full bg-muted items-center justify-center"><Ban size={24} color={colors.mutedForeground} /></View>
          <Text className="text-muted-foreground text-sm">Belum ada akun yang diblokir.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <Card padding="md">
          <View className="flex-row items-center gap-3">
            <View className="w-10 h-10 rounded-full bg-red-100 items-center justify-center"><UserX size={18} color="#ef4444" /></View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-foreground">{item.full_name}</Text>
              <Text className="text-xs text-muted-foreground">{item.username}</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">Diblokir oleh {item.blocked_by_name} · {formatDate(item.created_at)}</Text>
            </View>
            <Pressable onPress={() => handleUnblock(item.user_id)} className={`px-3 py-1.5 rounded-full ${confirmId === item.user_id ? "bg-red-100" : "bg-muted"}`}>
              <Text className={`text-xs font-medium ${confirmId === item.user_id ? "text-red-600" : "text-foreground"}`}>{confirmId === item.user_id ? "Yakin?" : "Buka Blokir"}</Text>
            </Pressable>
          </View>
        </Card>
      )}
    />
  );
}

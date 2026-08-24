import React, { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, Image, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { Search, ChevronRight, FileText } from "lucide-react-native";
import { Input } from "../ui/Input";
import { api, resolveAvatarUrl } from "../../services/api";

interface Media { media_type: "thumbnail" | "activity"; url: string; }
interface BeritaItem { id: number; title: string; activity_date: string | null; created_by_name: string; author_name: string | null; media: Media[]; }
function formatDate(iso: string) { return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }); }

export function BeritaAcaraScreen({ onNavigate }: { onNavigate: (screen: string, params?: Record<string, unknown>) => void }) {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<BeritaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await api.beritaAcaraList();
    if (res.success) setItems(res.data ?? []);
    setLoading(false);
    setRefreshing(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = items.filter((item) => item.title.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator color="#356447" /></View>;

  return (
    <FlatList
      className="flex-1 bg-background"
      contentContainerStyle={{ padding: 16, gap: 12 }}
      data={filtered}
      keyExtractor={(item) => String(item.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      ListHeaderComponent={
        <View className="mb-3">
          <Input placeholder="Cari berita acara..." value={search} onChangeText={setSearch} icon={<Search size={18} color="#6E776F" />} />
        </View>
      }
      ListEmptyComponent={
        <View className="items-center py-16 gap-3">
          <View className="w-16 h-16 rounded-full bg-muted items-center justify-center"><FileText size={24} color="#6E776F" /></View>
          <Text className="text-sm text-muted-foreground">Belum ada berita yang diterbitkan.</Text>
        </View>
      }
      renderItem={({ item }) => {
        const thumb = item.media.find((m) => m.media_type === "thumbnail");
        return (
          <Pressable onPress={() => onNavigate("berita-acara-viewer", { newsId: item.id })} className="rounded-2xl overflow-hidden bg-card border border-border">
            <View className="h-40 bg-muted items-center justify-center">
              {thumb ? <Image source={{ uri: resolveAvatarUrl(thumb.url) ?? undefined }} className="w-full h-full" resizeMode="cover" /> : <FileText size={20} color="#6E776F" />}
            </View>
            <View className="p-4 gap-2">
              <Text numberOfLines={2} className="text-base font-bold text-foreground">{item.title}</Text>
              <Text numberOfLines={1} className="text-xs text-muted-foreground">
                {item.activity_date ? `${formatDate(item.activity_date)} · ` : ""}Oleh {item.author_name || item.created_by_name}
              </Text>
              <View className="flex-row items-center gap-1">
                <Text className="text-xs font-semibold text-primary">Baca selengkapnya</Text>
                <ChevronRight size={14} color="#356447" />
              </View>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

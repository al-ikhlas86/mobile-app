import React, { useState, useEffect } from "react";
import { View, Text, Image, Pressable, ScrollView } from "react-native";
import { Newspaper } from "lucide-react-native";
import { api, resolveAvatarUrl } from "../services/api";
import { useThemeColors } from "../context/ThemeContext";
import { useImageReloadGeneration } from "../services/networkService";

export interface NewsItem {
  id: number;
  title: string;
  category: string | null;
  approved_at: string | null;
  likes_count: number;
  media: { media_type: "thumbnail" | "activity"; url: string }[];
}

const CATEGORY_COLORS: Record<string, string> = {
  "Kegiatan Sekolah": "#059669",
  "Prestasi": "#eab308",
  "Pengumuman": "#a855f7",
  "Pendidikan": "#22c55e",
  "Olahraga": "#f97316",
  "Seni & Budaya": "#ec4899",
  "Lainnya": "#6b7280",
};
const MAX_ITEMS = 5;

export function useNewsList() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await api.beritaAcaraList();
      if (res.success) setItems(res.data);
      setLoading(false);
    })();
  }, []);

  const terbaru = items.slice(0, MAX_ITEMS);
  const terpopuler = [...items].sort((a, b) => (b.likes_count ?? 0) - (a.likes_count ?? 0)).slice(0, MAX_ITEMS);
  return { loading, terbaru, terpopuler };
}

function formatNewsDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

function NewsSlide({ news, onPress }: { news: NewsItem; onPress: () => void }) {
  const bgColor = CATEGORY_COLORS[news.category ?? ""] ?? "#356447";
  const initial = news.title.charAt(0).toUpperCase();
  const thumbnail = news.media.find((m) => m.media_type === "thumbnail");
  // Reload otomatis begitu online kembali (2026-09-05, W4E) - lihat
  // catatan lengkap di services/networkService.ts. `key` berubah = <Image>
  // di-remount dari nol = attempt request baru.
  const reloadGen = useImageReloadGeneration();

  return (
    <Pressable onPress={onPress} className="rounded-3xl overflow-hidden bg-card border border-border mr-3" style={{ width: 260 }}>
      <View className="h-32 items-center justify-center overflow-hidden" style={{ backgroundColor: thumbnail ? undefined : bgColor + "22" }}>
        {thumbnail ? (
          <Image key={reloadGen} source={{ uri: resolveAvatarUrl(thumbnail.url) ?? undefined }} className="w-full h-full" resizeMode="cover" />
        ) : (
          <View className="w-12 h-12 rounded-full items-center justify-center" style={{ backgroundColor: bgColor }}>
            <Text className="text-white font-bold text-xl">{initial}</Text>
          </View>
        )}
        {news.category && (
          <View className="absolute top-2 left-2 bg-black/50 rounded-full px-1.5 py-0.5">
            <Text className="text-white text-[10px]">{news.category}</Text>
          </View>
        )}
      </View>
      <View className="p-3">
        <Text numberOfLines={2} className="text-sm font-semibold text-foreground">{news.title}</Text>
        <Text className="text-xs text-muted-foreground mt-1">{news.approved_at ? formatNewsDate(news.approved_at) : ""}</Text>
      </View>
    </Pressable>
  );
}

export function NewsCarousel({ items, loading, onOpenNews }: { items: NewsItem[]; loading: boolean; onOpenNews: (newsId: string) => void }) {
  const colors = useThemeColors();
  if (loading) {
    return <View className="w-64 h-44 rounded-3xl bg-muted" />;
  }
  if (items.length === 0) {
    return (
      <View className="rounded-2xl bg-card border border-border p-5 items-center gap-2">
        <Newspaper size={24} color={colors.mutedForeground} />
        <Text className="text-sm text-muted-foreground">Belum ada berita yang diterbitkan.</Text>
      </View>
    );
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {items.map((item) => (
        <NewsSlide key={item.id} news={item} onPress={() => onOpenNews(String(item.id))} />
      ))}
    </ScrollView>
  );
}

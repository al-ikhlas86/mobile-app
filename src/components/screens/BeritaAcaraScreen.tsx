import React, { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, Image, Pressable, ActivityIndicator, RefreshControl, Share } from "react-native";
import { Search, FileText, Heart, MessageCircle, Share2 } from "lucide-react-native";
import { Input } from "../ui/Input";
import { api, resolveAvatarUrl } from "../../services/api";
import { useThemeColors } from "../../context/ThemeContext";
import { useImageReloadGeneration } from "../../services/networkService";

interface Media { media_type: "thumbnail" | "activity"; url: string; }
interface BeritaItem {
  id: number;
  title: string;
  description: string | null;
  activity_date: string | null;
  created_by_name: string;
  author_name: string | null;
  media: Media[];
  likes_count: number;
  liked_by_me: boolean;
  comments_count: number;
}
function formatDate(iso: string) { return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }); }

// Panjang caption sebelum dipotong+tombol "Baca Selengkapnya" (poin #13,
// SAMA persis versi webview - lihat catatan lengkap di sana).
const CAPTION_TRUNCATE_LENGTH = 180;
// Link publik webview (poin #13) - Share native TIDAK memakai skema deep-link
// khusus, cukup share link ini: siapapun yang buka (WA/browser apapun) akan
// diminta login dulu, lalu SERVER yang menegakkan visibilitas sesuai role
// akun itu (endpoint detail memang sudah authedFetch dari awal) - "kalau dia
// bisa lihat maka bisa, kalau tidak maka tidak", tanpa logika tambahan.
const PUBLIC_WEB_URL = "https://alikhlas86.duckdns.org";

function CaptionText({ text, colors }: { text: string; colors: { primary: string; foreground: string } }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > CAPTION_TRUNCATE_LENGTH;
  const shown = expanded || !isLong ? text : text.slice(0, CAPTION_TRUNCATE_LENGTH).trimEnd() + "...";
  return (
    <Text className="text-sm text-foreground leading-relaxed">
      {shown}
      {isLong && (
        <Text onPress={() => setExpanded((v) => !v)} style={{ color: colors.primary, fontWeight: "600" }}>
          {"  "}{expanded ? "Sembunyikan" : "Baca Selengkapnya"}
        </Text>
      )}
    </Text>
  );
}

export function BeritaAcaraScreen({ onNavigate }: { onNavigate: (screen: string, params?: Record<string, unknown>) => void }) {
  const colors = useThemeColors();
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<BeritaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [likeBusyId, setLikeBusyId] = useState<number | null>(null);
  // Reload gambar otomatis begitu online kembali (2026-09-05, W4E) - lihat
  // catatan lengkap di services/networkService.ts.
  const reloadGen = useImageReloadGeneration();

  const load = useCallback(async () => {
    const res = await api.beritaAcaraList();
    if (res.success) setItems(res.data ?? []);
    setLoading(false);
    setRefreshing(false);
  }, []);
  useEffect(() => { load(); }, [load, reloadGen]);

  async function handleToggleLike(id: number) {
    if (likeBusyId) return;
    setLikeBusyId(id);
    const res = await api.beritaAcaraToggleLike(id);
    setLikeBusyId(null);
    if (res.success) {
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, liked_by_me: res.data.liked, likes_count: res.data.likes_count } : it)));
    }
  }

  async function handleShare(item: BeritaItem) {
    const url = `${PUBLIC_WEB_URL}/?berita=${item.id}`;
    try {
      await Share.share({ message: `${item.title}\n${url}`, url, title: item.title });
    } catch {
      // dibatalkan pengguna - tidak apa2
    }
  }

  const filtered = items.filter((item) => item.title.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator color={colors.primary} /></View>;

  return (
    <FlatList
      className="flex-1 bg-background"
      contentContainerStyle={{ padding: 16, gap: 14 }}
      data={filtered}
      keyExtractor={(item) => String(item.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      ListHeaderComponent={
        <View className="mb-1">
          <Input placeholder="Cari berita acara..." value={search} onChangeText={setSearch} icon={<Search size={18} color={colors.mutedForeground} />} />
        </View>
      }
      ListEmptyComponent={
        <View className="items-center py-16 gap-3">
          <View className="w-16 h-16 rounded-full bg-muted items-center justify-center"><FileText size={24} color={colors.mutedForeground} /></View>
          <Text className="text-sm text-muted-foreground">Belum ada berita yang diterbitkan.</Text>
        </View>
      }
      // Kartu feed gaya Facebook (poin #13) - SEBELUMNYA kartu link sederhana
      // (judul+tanggal+"Baca Selengkapnya" doang, tanpa caption/Like/
      // Komentar/Bagikan terlihat di daftar sama sekali).
      renderItem={({ item }) => {
        const thumb = item.media.find((m) => m.media_type === "thumbnail");
        return (
          <View className="rounded-2xl overflow-hidden bg-card border border-border">
            <Pressable onPress={() => onNavigate("berita-acara-viewer", { newsId: item.id })} className="p-4 pb-1">
              <Text numberOfLines={2} className="text-base font-bold text-foreground">{item.title}</Text>
              <Text numberOfLines={1} className="text-xs text-muted-foreground mt-1">
                {item.activity_date ? `${formatDate(item.activity_date)} · ` : ""}Oleh {item.author_name || item.created_by_name}
              </Text>
            </Pressable>

            {item.description ? (
              <View className="px-4 pt-2">
                <CaptionText text={item.description} colors={colors} />
              </View>
            ) : null}

            <Pressable onPress={() => onNavigate("berita-acara-viewer", { newsId: item.id })} className="h-52 bg-muted items-center justify-center mt-3">
              {thumb ? (
                <Image key={reloadGen} source={{ uri: resolveAvatarUrl(thumb.url) ?? undefined }} className="w-full h-full" resizeMode="cover" />
              ) : (
                <FileText size={24} color={colors.mutedForeground} />
              )}
            </Pressable>

            {(item.likes_count > 0 || item.comments_count > 0) && (
              <View className="flex-row items-center justify-between px-4 pt-2">
                <Text className="text-xs text-muted-foreground">{item.likes_count > 0 ? `${item.likes_count} suka` : ""}</Text>
                <Text className="text-xs text-muted-foreground">{item.comments_count > 0 ? `${item.comments_count} komentar` : ""}</Text>
              </View>
            )}

            <View className="flex-row items-center border-t border-border mt-2 mx-2 py-1">
              <Pressable onPress={() => handleToggleLike(item.id)} disabled={likeBusyId === item.id} className="flex-1 flex-row items-center justify-center gap-1.5 py-2">
                <Heart size={17} color={item.liked_by_me ? "#ef4444" : colors.mutedForeground} fill={item.liked_by_me ? "#ef4444" : "none"} />
                <Text className={`text-sm font-medium ${item.liked_by_me ? "text-red-500" : "text-muted-foreground"}`}>Suka</Text>
              </Pressable>
              <Pressable onPress={() => onNavigate("berita-acara-viewer", { newsId: item.id })} className="flex-1 flex-row items-center justify-center gap-1.5 py-2">
                <MessageCircle size={17} color={colors.mutedForeground} />
                <Text className="text-sm font-medium text-muted-foreground">Komentar</Text>
              </Pressable>
              <Pressable onPress={() => handleShare(item)} className="flex-1 flex-row items-center justify-center gap-1.5 py-2">
                <Share2 size={17} color={colors.mutedForeground} />
                <Text className="text-sm font-medium text-muted-foreground">Bagikan</Text>
              </Pressable>
            </View>
          </View>
        );
      }}
    />
  );
}

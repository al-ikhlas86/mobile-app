import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { FileText, Heart, MessageCircle, Clock } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { SummaryCard } from "../SummaryCard";
import { api } from "../../services/api";

interface TopContent { id: number; title: string; status: string; activity_date: string | null; created_at: string; likes_count: number; comments_count: number; }
interface StatsData { total_berita: number; total_published: number; total_pending: number; total_likes: number; total_comments: number; top_content: TopContent[]; }
function formatDate(iso: string | null) { if (!iso) return "-"; return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }); }

export function StatistikKontenScreen({ onNavigate }: { onNavigate: (screen: string, params?: Record<string, unknown>) => void }) {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await api.beritaAcaraStats();
      if (res.success) setData(res.data);
      else setError(res.message ?? "Gagal memuat statistik.");
      setLoading(false);
    })();
  }, []);

  if (loading) return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator color="#356447" /></View>;
  if (error || !data) {
    return <View className="p-4 bg-background flex-1"><View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3"><Text className="text-sm text-red-600">{error || "Gagal memuat statistik."}</Text></View></View>;
  }

  return (
    <ScrollView className="flex-1 bg-background px-4 pt-5" contentContainerStyle={{ paddingBottom: 32, gap: 20 }}>
      <Text className="text-xs text-muted-foreground">Statistik keterlibatan (suka + komentar) berita acara di unit Anda. Cuma berita yang sudah terbit yang dihitung keterlibatannya.</Text>

      <View className="flex-row flex-wrap gap-3">
        <View style={{ width: "47%" }}><SummaryCard label="Berita Terbit" value={String(data.total_published)} icon={<FileText size={18} color="#047857" />} colorScheme="blue" subtitle={`${data.total_pending} menunggu/draft`} /></View>
        <View style={{ width: "47%" }}><SummaryCard label="Total Berita" value={String(data.total_berita)} icon={<FileText size={18} color="#6E776F" />} colorScheme="default" subtitle="semua status" /></View>
        <View style={{ width: "47%" }}><SummaryCard label="Total Suka" value={String(data.total_likes)} icon={<Heart size={18} color="#ef4444" />} colorScheme="red" subtitle="seluruh berita terbit" /></View>
        <View style={{ width: "47%" }}><SummaryCard label="Total Komentar" value={String(data.total_comments)} icon={<MessageCircle size={18} color="#16a34a" />} colorScheme="green" subtitle="seluruh berita terbit" /></View>
      </View>

      <View>
        <Text className="text-sm font-semibold text-muted-foreground mb-3 uppercase">Konten Paling Banyak Diminati</Text>
        {data.top_content.length === 0 ? (
          <Text className="text-sm text-muted-foreground">Belum ada berita terbit dengan suka/komentar.</Text>
        ) : (
          <View className="gap-2.5">
            {data.top_content.map((item, idx) => (
              <Card key={item.id} padding="md">
                <Pressable onPress={() => onNavigate("berita-acara-viewer", { newsId: item.id })} className="flex-row items-start gap-3">
                  <View className="w-7 h-7 rounded-full bg-muted items-center justify-center"><Text className="text-xs font-bold text-muted-foreground">{idx + 1}</Text></View>
                  <View className="flex-1">
                    <Text numberOfLines={2} className="text-sm font-semibold text-foreground">{item.title}</Text>
                    <View className="flex-row items-center gap-3 mt-1.5 flex-wrap">
                      <View className="flex-row items-center gap-1"><Heart size={13} color="#6E776F" /><Text className="text-xs text-muted-foreground">{item.likes_count}</Text></View>
                      <View className="flex-row items-center gap-1"><MessageCircle size={13} color="#6E776F" /><Text className="text-xs text-muted-foreground">{item.comments_count}</Text></View>
                      <View className="flex-row items-center gap-1"><Clock size={13} color="#6E776F" /><Text className="text-xs text-muted-foreground">{formatDate(item.activity_date ?? item.created_at)}</Text></View>
                    </View>
                  </View>
                  <Badge variant="success">Terbit</Badge>
                </Pressable>
              </Card>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

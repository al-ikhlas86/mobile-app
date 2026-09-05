import React, { useState, useCallback } from "react";
import { View, Text, FlatList, Pressable, RefreshControl, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { AlertCircle, CheckCircle, FileText, Clock, Bell, Heart, MessageCircle, Reply, Megaphone, X, Trash2 } from "lucide-react-native";
import { api } from "../../services/api";
import { resolveNavScreen } from "../../utils/navAlias";
import { useThemeColors } from "../../context/ThemeContext";

export interface NotifItem {
  id: number; type: string; title: string; message: string; is_read: 0 | 1;
  action_screen: string | null; action_params: Record<string, unknown> | null; created_at: string;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  payment: <AlertCircle size={20} color="#ef4444" />,
  attendance: <Clock size={20} color="#f59e0b" />,
  announcement: <Bell size={20} color="#a855f7" />,
  berita_acara: <FileText size={20} color="#059669" />,
  berita_like: <Heart size={20} color="#ec4899" fill="#ec4899" />,
  berita_comment: <MessageCircle size={20} color="#059669" />,
  berita_reply: <Reply size={20} color="#6366f1" />,
  pengumuman: <Megaphone size={20} color="#f97316" />,
  system: <CheckCircle size={20} color="#22c55e" />,
};
const TYPE_BG: Record<string, string> = {
  payment: "bg-red-50", attendance: "bg-amber-50", announcement: "bg-purple-50", berita_acara: "bg-emerald-50",
  berita_like: "bg-pink-50", berita_comment: "bg-emerald-50", berita_reply: "bg-indigo-50", pengumuman: "bg-orange-50", system: "bg-green-50",
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}

export function NotifikasiScreen({ onNavigate }: { onNavigate: (screen: string, params?: Record<string, unknown>) => void }) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [items, setItems] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<"pemberitahuan" | "pengumuman">("pemberitahuan");
  const [openLetter, setOpenLetter] = useState<NotifItem | null>(null);

  const load = useCallback(async () => {
    const res = await api.notifications();
    if (res.success) setItems(res.data ?? []);
    setLoading(false);
    setRefreshing(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pemberitahuan = items.filter((n) => n.type !== "pengumuman");
  const pengumuman = items.filter((n) => n.type === "pengumuman");
  const unreadPemberitahuan = pemberitahuan.filter((n) => !n.is_read).length;
  const unreadPengumuman = pengumuman.filter((n) => !n.is_read).length;
  const current = tab === "pemberitahuan" ? pemberitahuan : pengumuman;

  const markRead = (id: number) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)));
    api.markNotificationRead(id).catch(() => {});
  };
  const handleOpen = (item: NotifItem) => {
    if (!item.is_read) markRead(item.id);
    if (item.type === "pengumuman") { setOpenLetter(item); return; }
    if (item.action_screen) onNavigate(resolveNavScreen(item.action_screen), item.action_params ?? undefined);
  };
  const handleMarkAllRead = () => {
    const unread = current.filter((n) => !n.is_read);
    unread.forEach((n) => markRead(n.id));
  };

  const deleteOne = (id: number) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
    api.deleteNotification(id).catch(() => {});
  };

  // Per-grup (tab) - "Hapus Semua" di Pengumuman tidak boleh diam-diam ikut
  // menghapus Pemberitahuan, begitu juga sebaliknya (sama pola dgn webview).
  const handleClearGroup = () => {
    if (current.length === 0) return;
    const label = tab === "pemberitahuan" ? "pemberitahuan" : "pengumuman";
    Alert.alert(
      `Hapus semua ${label}?`,
      "Tindakan ini tidak bisa dibatalkan.",
      [
        { text: "Batal", style: "cancel" },
        { text: "Hapus", style: "destructive", onPress: () => current.forEach((n) => deleteOne(n.id)) },
      ]
    );
  };

  if (loading) return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator color={colors.primary} /></View>;

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row p-1 bg-muted rounded-xl mx-4 mt-4">
        <Pressable onPress={() => setTab("pemberitahuan")} className={`flex-1 py-2 rounded-lg items-center ${tab === "pemberitahuan" ? "bg-card" : ""}`}>
          <Text className={`text-sm font-medium ${tab === "pemberitahuan" ? "text-foreground" : "text-muted-foreground"}`}>Pemberitahuan{unreadPemberitahuan > 0 ? ` (${unreadPemberitahuan})` : ""}</Text>
        </Pressable>
        <Pressable onPress={() => setTab("pengumuman")} className={`flex-1 py-2 rounded-lg items-center ${tab === "pengumuman" ? "bg-card" : ""}`}>
          <Text className={`text-sm font-medium ${tab === "pengumuman" ? "text-foreground" : "text-muted-foreground"}`}>Pengumuman{unreadPengumuman > 0 ? ` (${unreadPengumuman})` : ""}</Text>
        </Pressable>
      </View>

      {current.length > 0 && (
        <View className="flex-row justify-end gap-4 mr-4 mt-3">
          {current.some((n) => !n.is_read) && (
            <Pressable onPress={handleMarkAllRead}>
              <Text className="text-sm text-primary font-medium">Tandai semua dibaca</Text>
            </Pressable>
          )}
          <Pressable onPress={handleClearGroup}>
            <Text className="text-sm text-red-500 font-medium">Hapus Semua</Text>
          </Pressable>
        </View>
      )}

      <FlatList
        className="flex-1 px-4 mt-3"
        contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 8 }}
        data={current}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={
          <View className="items-center py-16 gap-3">
            <View className="w-16 h-16 rounded-full bg-muted items-center justify-center"><Bell size={24} color={colors.mutedForeground} /></View>
            <Text className="text-sm text-muted-foreground">{tab === "pemberitahuan" ? "Belum ada pemberitahuan" : "Belum ada pengumuman dari admin"}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => handleOpen(item)} className={`rounded-2xl border border-border bg-card p-4 ${!item.is_read ? "border-l-4 border-l-primary" : ""}`}>
            <View className="flex-row items-start gap-3">
              <View className={`w-10 h-10 rounded-xl items-center justify-center ${TYPE_BG[item.type] ?? "bg-muted"}`}>
                {TYPE_ICON[item.type] ?? <Bell size={20} color={colors.mutedForeground} />}
              </View>
              <View className="flex-1">
                <View className="flex-row items-start justify-between gap-2">
                  <Text className={`text-sm flex-1 ${!item.is_read ? "font-bold" : "font-semibold"} text-foreground`}>{item.title}</Text>
                  {!item.is_read && <View className="w-2 h-2 rounded-full bg-primary mt-1.5" />}
                </View>
                <Text numberOfLines={2} className="text-xs text-muted-foreground mt-1">{item.message}</Text>
                <Text className="text-xs text-muted-foreground mt-1.5">{timeAgo(item.created_at)}</Text>
              </View>
              <Pressable onPress={() => deleteOne(item.id)} hitSlop={8} className="p-1">
                <Trash2 size={16} color={colors.mutedForeground} />
              </Pressable>
            </View>
          </Pressable>
        )}
      />

      {/* SENGAJA overlay biasa, BUKAN <Modal> - lihat catatan panjang di
          AccountSwitcher.tsx (window Modal Android bikin nav bar HP tidak
          konsisten). */}
      {!!openLetter && (
        <Pressable className="absolute inset-0 bg-black/50 items-center justify-center p-6" style={{ zIndex: 50, elevation: 50 }} onPress={() => setOpenLetter(null)}>
          <Pressable className="bg-card rounded-2xl p-5 w-full" onPress={(e) => e.stopPropagation()}>
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center gap-2 flex-1">
                <View className="w-9 h-9 rounded-xl bg-orange-50 items-center justify-center"><Megaphone size={18} color="#f97316" /></View>
                <Text className="text-base font-bold text-foreground flex-1">{openLetter?.title}</Text>
              </View>
              <Pressable onPress={() => setOpenLetter(null)}><X size={18} color={colors.mutedForeground} /></Pressable>
            </View>
            <Text className="text-xs text-muted-foreground mb-3">{openLetter ? timeAgo(openLetter.created_at) : ""}</Text>
            <Text className="text-sm text-foreground">{openLetter?.message}</Text>
          </Pressable>
        </Pressable>
      )}
    </View>
  );
}

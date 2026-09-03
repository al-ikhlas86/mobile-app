import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, Switch } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Search, Settings2, Eye, EyeOff, ChevronUp, ChevronDown, Check } from "lucide-react-native";
import { Input } from "./ui/Input";
import { QuickMenuButton, useBerandaPreferensi, type MenuCategory, type QuickMenuItem } from "./QuickMenuGrid";
import { useTheme, useThemeColors } from "../context/ThemeContext";

// Mode "Atur Tampilan Beranda" (2026-09-03, diminta user) - padanan native
// dari webview SemuaMenuView.tsx, lihat catatan lengkap di sana soal
// kenapa pengaturan ini ditaruh di sini (bukan layar Setting terpisah).
export function SemuaMenuView({ categories, onBack, hasBerita = false }: { categories: MenuCategory[]; onBack: () => void; hasBerita?: boolean }) {
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"lihat" | "atur">("lihat");
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const colors = useThemeColors();
  const backIconColor = isDark ? "#F1F1F2" : "#17201B";
  const { prefs, loading, simpan } = useBerandaPreferensi();

  const [draftItems, setDraftItems] = useState<QuickMenuItem[]>([]);
  const [draftHidden, setDraftHidden] = useState<Set<string>>(new Set());
  const [draftHideTerbaru, setDraftHideTerbaru] = useState(false);
  const [draftHideTerpopuler, setDraftHideTerpopuler] = useState(false);
  const [saving, setSaving] = useState(false);

  function bukaModeAtur() {
    const semua = categories.flatMap((c) => c.items);
    if (prefs.menuOrder.length > 0) {
      const posisi = new Map(prefs.menuOrder.map((label, idx) => [label, idx]));
      semua.sort((a, b) => {
        const pa = posisi.has(a.label) ? posisi.get(a.label)! : Infinity;
        const pb = posisi.has(b.label) ? posisi.get(b.label)! : Infinity;
        return pa - pb;
      });
    }
    setDraftItems(semua);
    setDraftHidden(new Set(prefs.hiddenMenu));
    setDraftHideTerbaru(prefs.hideBeritaTerbaru);
    setDraftHideTerpopuler(prefs.hideBeritaTerpopuler);
    setMode("atur");
  }

  function pindah(idx: number, arah: -1 | 1) {
    const target = idx + arah;
    if (target < 0 || target >= draftItems.length) return;
    const next = [...draftItems];
    [next[idx], next[target]] = [next[target], next[idx]];
    setDraftItems(next);
  }

  function toggleHidden(label: string) {
    setDraftHidden((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  }

  async function simpanPengaturan() {
    setSaving(true);
    await simpan({
      hiddenMenu: [...draftHidden],
      menuOrder: draftItems.map((i) => i.label),
      hideBeritaTerbaru: draftHideTerbaru,
      hideBeritaTerpopuler: draftHideTerpopuler,
    });
    setSaving(false);
    setMode("lihat");
  }

  const filtered = categories
    .map((c) => ({ ...c, items: c.items.filter((i) => i.label.toLowerCase().includes(search.toLowerCase())) }))
    .filter((c) => c.items.length > 0);

  if (mode === "atur") {
    return (
      <View className="flex-1 bg-background">
        <ScrollView className="flex-1 px-4 pt-14" contentContainerStyle={{ paddingBottom: insets.bottom + 96, gap: 12 }}>
          <View className="flex-row items-center gap-2 -ml-1">
            <Pressable onPress={() => setMode("lihat")} className="p-1.5 rounded-full">
              <ArrowLeft size={18} color={backIconColor} />
            </Pressable>
            <Text className="text-base font-bold text-foreground">Atur Tampilan Beranda</Text>
          </View>
          <Text className="text-xs text-muted-foreground -mt-2">
            Sembunyikan menu yang jarang dipakai dari beranda (tetap bisa dibuka lewat Semua Menu), atau ubah urutannya.
          </Text>

          {hasBerita && (
            <View className="rounded-xl border border-border bg-card p-3 gap-2">
              <Text className="text-xs font-semibold text-foreground">Berita Acara di Beranda</Text>
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-foreground">Berita Terbaru</Text>
                <Switch value={!draftHideTerbaru} onValueChange={(v) => setDraftHideTerbaru(!v)} trackColor={{ true: colors.primary }} />
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-foreground">Berita Terpopuler</Text>
                <Switch value={!draftHideTerpopuler} onValueChange={(v) => setDraftHideTerpopuler(!v)} trackColor={{ true: colors.primary }} />
              </View>
            </View>
          )}

          <View className="gap-2">
            {draftItems.map((item, idx) => {
              const hidden = draftHidden.has(item.label);
              return (
                <View key={item.label} className="flex-row items-center gap-2 rounded-xl border border-border bg-card px-3 py-2" style={{ opacity: hidden ? 0.5 : 1 }}>
                  <View className="items-center">
                    <Pressable onPress={() => pindah(idx, -1)} disabled={idx === 0} style={{ opacity: idx === 0 ? 0.3 : 1 }}>
                      <ChevronUp size={16} color={colors.mutedForeground} />
                    </Pressable>
                    <Pressable onPress={() => pindah(idx, 1)} disabled={idx === draftItems.length - 1} style={{ opacity: idx === draftItems.length - 1 ? 0.3 : 1 }}>
                      <ChevronDown size={16} color={colors.mutedForeground} />
                    </Pressable>
                  </View>
                  <Text className="flex-1 text-sm text-foreground" numberOfLines={1}>{item.label}</Text>
                  <Pressable onPress={() => toggleHidden(item.label)} className="p-1.5">
                    {hidden ? <EyeOff size={16} color={colors.mutedForeground} /> : <Eye size={16} color={colors.mutedForeground} />}
                  </Pressable>
                </View>
              );
            })}
          </View>
        </ScrollView>

        <View className="absolute left-0 right-0 bottom-0 p-4 bg-background border-t border-border" style={{ paddingBottom: insets.bottom + 12 }}>
          <Pressable
            onPress={simpanPengaturan}
            disabled={saving || loading}
            className="flex-row items-center justify-center gap-1.5 rounded-xl bg-primary py-3"
            style={{ opacity: saving || loading ? 0.6 : 1 }}
          >
            <Check size={16} color={colors.primaryForeground} />
            <Text className="text-sm font-semibold" style={{ color: colors.primaryForeground }}>{saving ? "Menyimpan..." : "Simpan Pengaturan Beranda"}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background px-4 pt-14" contentContainerStyle={{ paddingBottom: insets.bottom + 56 + 24, gap: 20 }}>
      <View className="flex-row items-center justify-between -ml-1">
        <View className="flex-row items-center gap-2">
          <Pressable onPress={onBack} className="p-1.5 rounded-full">
            <ArrowLeft size={18} color={backIconColor} />
          </Pressable>
          <Text className="text-base font-bold text-foreground">Semua Menu</Text>
        </View>
        <Pressable onPress={bukaModeAtur} className="flex-row items-center gap-1.5 px-2 py-1.5">
          <Settings2 size={14} color={colors.primary} />
          <Text className="text-xs font-medium" style={{ color: colors.primary }}>Atur Beranda</Text>
        </Pressable>
      </View>

      <Input placeholder="Cari menu..." value={search} onChangeText={setSearch} icon={<Search size={18} color={colors.mutedForeground} />} />

      {filtered.length === 0 ? (
        <Text className="text-sm text-muted-foreground text-center py-8">Menu tidak ditemukan.</Text>
      ) : (
        filtered.map((cat) => (
          <View key={cat.title}>
            <Text className="text-base font-bold text-foreground mb-3">{cat.title}</Text>
            <View className="flex-row flex-wrap gap-2.5">
              {cat.items.map((item, idx) => (
                <QuickMenuButton key={idx} item={item} />
              ))}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

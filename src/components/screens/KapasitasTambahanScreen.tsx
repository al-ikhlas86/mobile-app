import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Search, X, Trash2 } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { SimplePicker } from "../ui/SimplePicker";
import { api, ROLE_MAP } from "../../services/api";
import { useThemeColors } from "../../context/ThemeContext";

// Kapasitas Tambahan (2026-09-04) - lihat catatan lengkap di webview
// KapasitasTambahanScreen.tsx. Model PER-CAPABILITY (pilih 1 sistem, kelola
// siapa saja yg pegang) - pola sama Kelola Kelas WebArsipData.
const CAPABILITY_OPTIONS = ["admin_tu_sd", "admin_tu_tk", "admin_media_sd", "admin_media_tk", "keuangan", "supervisor"];
const CAPABILITY_SELECT_OPTIONS = CAPABILITY_OPTIONS.map((c) => ({ value: c, label: ROLE_MAP[c] ?? c }));

interface Holder { id: number; username: string; full_name: string; role: string; capabilities: string[]; }
function initials(name: string) { return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join(""); }

export function KapasitasTambahanScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [capability, setCapability] = useState(CAPABILITY_OPTIONS[0]);
  const [holders, setHolders] = useState<Holder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Holder[]>([]);
  const [searching, setSearching] = useState(false);

  const loadHolders = async (cap: string) => {
    setLoading(true); setError("");
    const res = await api.adminCapabilityHolders(cap);
    setLoading(false);
    if (res.success) setHolders(res.data); else setError(res.message ?? "Gagal memuat daftar.");
  };

  useEffect(() => {
    loadHolders(capability);
    setShowSearch(false); setQuery(""); setResults([]);
  }, [capability]);

  const handleSearch = async () => {
    if (query.trim().length < 1) { setResults([]); return; }
    setSearching(true);
    const res = await api.adminCariPegawai(query.trim());
    setSearching(false);
    if (res.success) setResults(res.data); else setError(res.message ?? "Gagal mencari.");
  };

  // Cari LANGSUNG begitu mengetik (2026-09-04) - lihat catatan lengkap di
  // webview KapasitasTambahanScreen.tsx.
  useEffect(() => {
    if (query.trim().length < 1) { setResults([]); return; }
    const timer = setTimeout(handleSearch, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const addToCapability = async (person: Holder) => {
    setBusyId(person.id);
    const next = [...new Set([...person.capabilities, capability])];
    const res = await api.adminUpdateCapabilities(person.id, next);
    setBusyId(null);
    if (res.success) { setResults((prev) => prev.filter((p) => p.id !== person.id)); loadHolders(capability); }
    else setError(res.message ?? "Gagal menambahkan.");
  };

  const removeFromCapability = async (person: Holder) => {
    setBusyId(person.id);
    const next = person.capabilities.filter((c) => c !== capability);
    const res = await api.adminUpdateCapabilities(person.id, next);
    setBusyId(null);
    if (res.success) setHolders((prev) => prev.filter((p) => p.id !== person.id));
    else setError(res.message ?? "Gagal menghapus.");
  };

  const holderIds = new Set(holders.map((h) => h.id));

  return (
    <KeyboardAwareScrollView className="flex-1 bg-background px-4 pt-5" contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 16 }} bottomOffset={20}>
      <Text className="text-xs text-muted-foreground">
        Pilih 1 sistem di bawah, lalu cari LANGSUNG nama guru/pegawai yang sudah ada di sistem sekolah (tidak
        perlu dibuat dulu di Manajemen Pengguna). Begitu ditambahkan, menu sistem itu otomatis muncul di akun
        mereka sendiri.
      </Text>

      <SimplePicker value={capability} options={CAPABILITY_SELECT_OPTIONS} onChange={setCapability} />

      {error ? <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3"><Text className="text-sm text-red-600">{error}</Text></View> : null}

      {!showSearch ? (
        <Button variant="outline" onPress={() => setShowSearch(true)}><Search size={16} color={colors.primary} />{"  "}Tambah Orang</Button>
      ) : (
        <Card padding="md">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-sm font-semibold text-foreground">Cari Orang</Text>
            <Pressable onPress={() => { setShowSearch(false); setQuery(""); setResults([]); }}><X size={16} color={colors.mutedForeground} /></Pressable>
          </View>
          <View className="flex-row gap-2 mb-3">
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSearch}
              placeholder="Cari nama..."
              className="flex-1 bg-input-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground"
            />
            <Button onPress={handleSearch} loading={searching}>Cari</Button>
          </View>
          {results.length === 0 && query.trim().length >= 1 && !searching ? (
            <Text className="text-xs text-muted-foreground">Tidak ada hasil.</Text>
          ) : null}
          <View className="gap-2">
            {results.map((p) => (
              <View key={p.id} className="flex-row items-center gap-3 border border-border rounded-xl p-2.5">
                <View className="w-8 h-8 rounded-full bg-muted items-center justify-center">
                  <Text className="text-xs font-bold text-muted-foreground">{initials(p.full_name)}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-medium text-foreground">{p.full_name}</Text>
                  <Text className="text-xs text-muted-foreground">{ROLE_MAP[p.role] ?? p.role}</Text>
                </View>
                {holderIds.has(p.id) ? (
                  <Text className="text-xs text-muted-foreground px-2">Sudah ditambahkan</Text>
                ) : (
                  <Button onPress={() => addToCapability(p)} loading={busyId === p.id}>Tambah</Button>
                )}
              </View>
            ))}
          </View>
        </Card>
      )}

      <View>
        <Text className="text-sm font-semibold text-muted-foreground mb-3 uppercase">
          {ROLE_MAP[capability] ?? capability} ({holders.length} orang)
        </Text>
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : holders.length === 0 ? (
          <Text className="text-sm text-muted-foreground text-center py-8">Belum ada yang memegang kapasitas ini.</Text>
        ) : (
          <View className="gap-2.5">
            {holders.map((h) => (
              <Card key={h.id} padding="sm">
                <View className="flex-row items-center gap-3">
                  <View className="w-9 h-9 rounded-full bg-primary items-center justify-center">
                    <Text className="text-xs font-bold text-white">{initials(h.full_name)}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-foreground">{h.full_name}</Text>
                    <Text className="text-xs text-muted-foreground">
                      {ROLE_MAP[h.role] ?? h.role}{h.capabilities.length > 1 ? ` + ${h.capabilities.length - 1} kapasitas lain` : ""}
                    </Text>
                  </View>
                  <Pressable onPress={() => removeFromCapability(h)} disabled={busyId === h.id} className="p-1.5 rounded-full">
                    <Trash2 size={15} color={colors.mutedForeground} />
                  </Pressable>
                </View>
              </Card>
            ))}
          </View>
        )}
      </View>
    </KeyboardAwareScrollView>
  );
}

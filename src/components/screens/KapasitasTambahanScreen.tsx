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
//
// Role Definitions (2026-09-15) - dirombak TOTAL dari versi Sistem Katalog
// (2026-09-14): dulu picker pertama role_type polos + picker katalog
// terpisah, bebas kombinasi apa saja ("tiba-tiba ada", laporan user).
// SEKARANG picker pertama isinya DAFTAR ROLE DEFINITION yang SUDAH
// didaftarkan lewat Manajemen Pengguna > Tambah Role - kombinasi Role+
// Katalog TIDAK BISA dipilih bebas lagi di sini, harus terdaftar dulu.
// 1 definisi bisa mengapit >1 katalog sekaligus (mis. "Keuangan - SD &
// TK") - menempelkan orang ke definisi itu menulis 1 baris capability PER
// katalog di definisinya sekaligus.
interface Catalog { id: number; kode: string; nama: string; }
interface RoleDefinition { id: number; role_type: string; label: string; catalogs: Catalog[]; }
interface CapabilityEntry { roleType: string; catalogId: number | null; }
interface Holder { id: number; username: string; full_name: string; role: string; capabilities: CapabilityEntry[]; }

function initials(name: string) { return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join(""); }

export function KapasitasTambahanScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [roleDefinitions, setRoleDefinitions] = useState<RoleDefinition[]>([]);
  const [roleDefinitionId, setRoleDefinitionId] = useState<number | null>(null);
  const [holders, setHolders] = useState<Holder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Holder[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    api.adminRoleDefinitions().then((res) => {
      if (res.success) {
        setRoleDefinitions(res.data);
        if (res.data.length > 0) setRoleDefinitionId((prev) => prev ?? res.data[0].id);
        else setLoading(false);
      }
    });
  }, []);

  const activeDef = roleDefinitions.find((d) => d.id === roleDefinitionId) ?? null;

  const loadHolders = async (defId: number) => {
    setLoading(true); setError("");
    const res = await api.adminRoleDefinitionHolders(defId);
    setLoading(false);
    if (res.success) setHolders(res.data); else setError(res.message ?? "Gagal memuat daftar pemegang role.");
  };

  useEffect(() => {
    if (roleDefinitionId != null) loadHolders(roleDefinitionId);
    setShowSearch(false); setQuery(""); setResults([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleDefinitionId]);

  const handleSearch = async () => {
    if (query.trim().length < 1) { setResults([]); return; }
    setSearching(true);
    const res = await api.adminCariPegawai(query.trim(), activeDef?.catalogs.map((c) => c.id));
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

  // Backend replace-all - toggle 1 definisi, kirim SELURUH himpunan orang
  // itu (supaya capability LAIN yang sudah dia pegang tidak ikut kehapus).
  // 1 definisi = N baris {roleType, catalogId} sekaligus (1 per katalog di
  // definisinya) - dedup by (roleType, catalogId) jaga2 orang ini SEBAGIAN
  // sudah pegang salah satu katalognya.
  const addToCapability = async (person: Holder) => {
    if (!activeDef) return;
    setBusyId(person.id);
    const newEntries = activeDef.catalogs.map((c) => ({ roleType: activeDef.role_type, catalogId: c.id }));
    const existingKeys = new Set(newEntries.map((e) => `${e.roleType}:${e.catalogId}`));
    const next = [...person.capabilities.filter((c) => !existingKeys.has(`${c.roleType}:${c.catalogId}`)), ...newEntries];
    const res = await api.adminUpdateCapabilities(person.id, next);
    setBusyId(null);
    if (res.success) { setResults((prev) => prev.filter((p) => p.id !== person.id)); loadHolders(activeDef.id); }
    else setError(res.message ?? "Gagal menambahkan.");
  };

  const removeFromCapability = async (person: Holder) => {
    if (!activeDef) return;
    setBusyId(person.id);
    const catalogIds = new Set(activeDef.catalogs.map((c) => c.id));
    const next = person.capabilities.filter((c) => !(c.roleType === activeDef.role_type && c.catalogId != null && catalogIds.has(c.catalogId)));
    const res = await api.adminUpdateCapabilities(person.id, next);
    setBusyId(null);
    if (res.success) setHolders((prev) => prev.filter((p) => p.id !== person.id));
    else setError(res.message ?? "Gagal menghapus.");
  };

  const holderIds = new Set(holders.map((h) => h.id));

  if (roleDefinitions.length === 0 && !loading) {
    return (
      <View className="flex-1 bg-background px-4 pt-5">
        <Text className="text-sm text-muted-foreground text-center py-8">
          Belum ada Role terdaftar - daftarkan dulu lewat Manajemen Pengguna &gt; Tambah Role, baru bisa
          ditempelkan ke orang di sini.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAwareScrollView className="flex-1 bg-background px-4 pt-5" contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 16 }} bottomOffset={20}>
      <Text className="text-xs text-muted-foreground">
        Pilih 1 role yang sudah didaftarkan di bawah, lalu cari LANGSUNG nama guru/pegawai yang sudah ada di
        sistem sekolah (tidak perlu dibuat dulu di Manajemen Pengguna). Begitu ditambahkan, menu sistem itu
        otomatis muncul di akun mereka sendiri. 1 orang boleh pegang lebih dari 1 role sekaligus.
      </Text>

      <SimplePicker
        value={roleDefinitionId != null ? String(roleDefinitionId) : ""}
        options={roleDefinitions.map((d) => ({ value: String(d.id), label: d.label }))}
        onChange={(v) => setRoleDefinitionId(Number(v))}
      />

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
          {activeDef?.label ?? ""} ({holders.length} orang)
        </Text>
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : holders.length === 0 ? (
          <Text className="text-sm text-muted-foreground text-center py-8">Belum ada yang memegang role ini.</Text>
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
                      {ROLE_MAP[h.role] ?? h.role}{h.capabilities.length > (activeDef?.catalogs.length ?? 1) ? ` + kapasitas lain` : ""}
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

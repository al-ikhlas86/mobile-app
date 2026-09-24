import React, { useEffect, useState } from "react";
import { View, Text, TextInput, ActivityIndicator, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Clock, ChevronDown, RotateCcw } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { useThemeColors } from "../../context/ThemeContext";
import { api } from "../../services/api";

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

type RoleKey = "siswa" | "guru" | "pegawai";
const ROLE_LABEL: Record<RoleKey, string> = { siswa: "Siswa", guru: "Guru", pegawai: "Pegawai" };

interface CutoffCatalog {
  catalogId: number;
  kode: string;
  nama: string;
  siswa: string | null;
  guru: string | null;
  pegawai: string | null;
}

function toInputValue(v: string | null) {
  return v ? v.slice(0, 5) : "";
}

// Jam Keterlambatan PER KATALOG (2026-09-24, Sistem Katalog - GANTI dari 1
// setting GLOBAL admin_it-only). Sistem ini sendiri TIDAK KENAL "SD"/"TK"
// sama sekali - yang dia kenal cuma Katalog (dibuat & diberi label lewat
// Manajemen Pengguna), jadi tampilan ini SELALU per-katalog: ketuk nama
// katalog -> baru muncul 3 jam (Siswa/Guru/Pegawai) milik katalog itu.
// Dipakai Admin IT (semua katalog muncul), Admin TU & Kepala Sekolah
// (backend cuma kirim katalog milik sendiri, lihat routes/attendanceSettings.js).
export function PengaturanJamKeterlambatanScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [catalogs, setCatalogs] = useState<CutoffCatalog[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [draft, setDraft] = useState<Record<number, Record<RoleKey, string>>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [savedId, setSavedId] = useState<number | null>(null);

  async function muat() {
    setLoading(true);
    setError("");
    const res = await api.lateCutoffGet();
    setLoading(false);
    if (!res.success) {
      setError(res.message ?? "Gagal memuat pengaturan.");
      return;
    }
    const data: CutoffCatalog[] = res.data ?? [];
    setCatalogs(data);
    setDraft(Object.fromEntries(data.map((c) => [c.catalogId, { siswa: toInputValue(c.siswa), guru: toInputValue(c.guru), pegawai: toInputValue(c.pegawai) }])));
  }

  useEffect(() => { muat(); }, []);

  function ubahDraft(catalogId: number, role: RoleKey, value: string) {
    setDraft((prev) => ({ ...prev, [catalogId]: { ...prev[catalogId], [role]: value } }));
  }

  async function simpan(catalogId: number) {
    const d = draft[catalogId];
    for (const role of ["siswa", "guru", "pegawai"] as const) {
      if (d[role] && !TIME_RE.test(d[role])) {
        setError(`Format jam ${ROLE_LABEL[role]} tidak valid - pakai HH:MM, atau kosongkan.`);
        return;
      }
    }
    setSavingId(catalogId);
    setError("");
    setSavedId(null);
    const res = await api.lateCutoffUpdate({
      catalogId,
      siswa: d.siswa || null,
      guru: d.guru || null,
      pegawai: d.pegawai || null,
    });
    setSavingId(null);
    if (!res.success) {
      setError(res.message ?? "Gagal menyimpan pengaturan.");
      return;
    }
    setSavedId(catalogId);
    setTimeout(() => setSavedId(null), 3000);
    await muat();
  }

  if (loading) return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator color={colors.primary} /></View>;

  return (
    <KeyboardAwareScrollView className="flex-1 bg-background px-4 pt-5" contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 12 }} bottomOffset={20}>
      <Text className="text-xs text-muted-foreground">
        Batas jam ini menentukan status "Terlambat" di seluruh statistik & rekap presensi, diatur TERPISAH per katalog
        (unit sekolah) dan per peran. Kosongkan jam kalau kelompok ini memang tidak perlu konsep "Terlambat" sama
        sekali - berlaku untuk peran/katalog manapun, bukan cuma bawaan tertentu.
      </Text>

      {error ? <View className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3"><Text className="text-sm text-red-600 dark:text-red-400">{error}</Text></View> : null}

      {catalogs.length === 0 ? (
        <Text className="text-sm text-muted-foreground text-center py-8">Belum ada katalog yang bisa diatur.</Text>
      ) : (
        catalogs.map((c) => {
          const isOpen = expanded === c.catalogId;
          const d = draft[c.catalogId] ?? { siswa: "", guru: "", pegawai: "" };
          return (
            <Card key={c.catalogId} padding="none">
              <Pressable onPress={() => setExpanded(isOpen ? null : c.catalogId)} className="flex-row items-center justify-between px-4 py-3">
                <View className="flex-row items-center gap-2 flex-1">
                  <Clock size={16} color={colors.primary} />
                  <Text className="text-sm font-semibold text-foreground flex-1" numberOfLines={1}>{c.nama}</Text>
                </View>
                <ChevronDown size={16} color={colors.mutedForeground} style={{ transform: [{ rotate: isOpen ? "180deg" : "0deg" }] }} />
              </Pressable>

              {isOpen ? (
                <View className="gap-3 px-4 pb-4">
                  {(["siswa", "guru", "pegawai"] as const).map((role) => (
                    <View key={role} className="flex-row items-end gap-2">
                      <View className="flex-1 gap-1.5">
                        <Text className="text-sm font-medium text-foreground">{ROLE_LABEL[role]}</Text>
                        <TextInput
                          value={d[role]}
                          onChangeText={(v) => ubahDraft(c.catalogId, role, v)}
                          placeholder="08:30"
                          keyboardType="numbers-and-punctuation"
                          maxLength={5}
                          className="bg-input-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground"
                        />
                      </View>
                      <Button variant="secondary" onPress={() => ubahDraft(c.catalogId, role, "")} disabled={!d[role]}>
                        <RotateCcw size={16} color={colors.mutedForeground} />
                      </Button>
                    </View>
                  ))}
                  <Text className="text-xs text-muted-foreground">
                    Jam yang dikosongkan berarti peran itu SELALU tercatat "Hadir" di katalog {c.nama}, berapa pun jam masuknya.
                  </Text>
                  {savedId === c.catalogId ? <Text className="text-sm text-green-700 dark:text-green-400">Tersimpan.</Text> : null}
                  <Button onPress={() => simpan(c.catalogId)} loading={savingId === c.catalogId} fullWidth>
                    {savingId === c.catalogId ? "Menyimpan..." : "Simpan"}
                  </Button>
                </View>
              ) : null}
            </Card>
          );
        })
      )}
    </KeyboardAwareScrollView>
  );
}

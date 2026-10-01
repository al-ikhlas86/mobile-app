// ============================================================
// SISWA TERDAFTAR (2026-09-05, W10) - Tab kedua "Pengenalan Wajah" KHUSUS
// wali kelas - daftar siswa KELASNYA SENDIRI (scoping dijamin backend, lihat
// routes/face.js::GET /class-status) beserta status pengenalan wajah masing2
// (belum/sebagian/lengkap). Redesain 2026-10-01: ringkasan jumlah + bilah
// progres, filter status, dan pencarian nama/NIS (sejajar dgn versi webview).
// ============================================================
import React, { useCallback, useMemo, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, RefreshControl, TextInput, Pressable } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { CheckCircle2, Circle, CircleDashed, Search } from "lucide-react-native";
import { Card } from "../ui/Card";
import { api } from "../../services/api";
import { useThemeColors } from "../../context/ThemeContext";

interface StudentFaceStatus {
  id: number;
  nama: string;
  nis: string;
  enrolled: boolean;
  complete: boolean;
}

type Filter = "semua" | "belum" | "sebagian" | "lengkap";
type Status = Exclude<Filter, "semua">;

function statusSiswa(s: StudentFaceStatus): Status {
  if (s.complete) return "lengkap";
  if (s.enrolled) return "sebagian";
  return "belum";
}

function StatusBadge({ status }: { status: Status }) {
  const colors = useThemeColors();
  if (status === "lengkap") {
    return (
      <View className="flex-row items-center gap-1.5">
        <CheckCircle2 size={16} color="#16a34a" />
        <Text className="text-xs font-medium text-green-600 dark:text-green-400">Lengkap</Text>
      </View>
    );
  }
  if (status === "sebagian") {
    return (
      <View className="flex-row items-center gap-1.5">
        <CircleDashed size={16} color="#d97706" />
        <Text className="text-xs font-medium text-amber-600 dark:text-amber-400">Sebagian</Text>
      </View>
    );
  }
  return (
    <View className="flex-row items-center gap-1.5">
      <Circle size={16} color={colors.mutedForeground} />
      <Text className="text-xs font-medium text-muted-foreground">Belum daftar</Text>
    </View>
  );
}

export function SiswaTerdaftarScreen() {
  const colors = useThemeColors();
  const [students, setStudents] = useState<StudentFaceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("semua");
  const [cari, setCari] = useState("");

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const res = await api.faceClassStatus();
      if (res.success) setStudents(res.data ?? []);
      else setError(res.message ?? "Gagal memuat data siswa.");
    } catch {
      setError("Gagal memuat data siswa. Periksa koneksi internet.");
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const hitung = useMemo(() => {
    const h = { lengkap: 0, sebagian: 0, belum: 0 };
    students.forEach((s) => { h[statusSiswa(s)] += 1; });
    return h;
  }, [students]);

  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return students.filter((s) => {
      if (filter !== "semua" && statusSiswa(s) !== filter) return false;
      if (!q) return true;
      return s.nama.toLowerCase().includes(q) || String(s.nis ?? "").toLowerCase().includes(q);
    });
  }, [students, filter, cari]);

  if (loading) return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator color={colors.primary} /></View>;

  const total = students.length;
  const persen = total > 0 ? Math.round((hitung.lengkap / total) * 100) : 0;
  const CHIPS: { key: Filter; label: string; jumlah: number }[] = [
    { key: "semua", label: "Semua", jumlah: total },
    { key: "belum", label: "Belum", jumlah: hitung.belum },
    { key: "sebagian", label: "Sebagian", jumlah: hitung.sebagian },
    { key: "lengkap", label: "Lengkap", jumlah: hitung.lengkap },
  ];

  const header = (
    <View style={{ gap: 12, marginBottom: 4 }}>
      {error ? (
        <View className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
          <Text className="text-sm text-red-600 dark:text-red-400">{error}</Text>
        </View>
      ) : null}

      <Card padding="md">
        <Text className="text-xs text-muted-foreground">Wajah terdaftar lengkap</Text>
        <Text className="text-2xl font-bold text-foreground">
          {hitung.lengkap}<Text className="text-base font-medium text-muted-foreground"> / {total} siswa</Text>
        </Text>
        <View className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
          <View className="h-full bg-green-500 rounded-full" style={{ width: `${persen}%` }} />
        </View>
        {hitung.belum + hitung.sebagian > 0 ? (
          <Text className="text-xs text-muted-foreground mt-2">
            {hitung.belum > 0 ? `${hitung.belum} belum daftar` : ""}
            {hitung.belum > 0 && hitung.sebagian > 0 ? " · " : ""}
            {hitung.sebagian > 0 ? `${hitung.sebagian} baru sebagian` : ""}
            {" - minta orang tuanya mendaftarkan lewat menu Pengenalan Wajah."}
          </Text>
        ) : null}
      </Card>

      <View className="flex-row items-center rounded-xl border border-border bg-card px-3" style={{ gap: 8 }}>
        <Search size={16} color={colors.mutedForeground} />
        <TextInput
          value={cari}
          onChangeText={setCari}
          placeholder="Cari nama atau NIS"
          placeholderTextColor={colors.mutedForeground}
          className="flex-1 py-2.5 text-sm text-foreground"
          autoCorrect={false}
        />
      </View>

      <View className="flex-row flex-wrap" style={{ gap: 8 }}>
        {CHIPS.map((c) => {
          const aktif = c.key === filter;
          return (
            <Pressable
              key={c.key}
              onPress={() => setFilter(c.key)}
              className={`px-3.5 py-1.5 rounded-full border ${aktif ? "bg-primary border-primary" : "bg-card border-border"}`}
            >
              <Text className={`text-xs font-medium ${aktif ? "text-primary-foreground" : "text-foreground"}`}>
                {c.label} <Text className={aktif ? "text-primary-foreground/80" : "text-muted-foreground"}>({c.jumlah})</Text>
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <FlatList
      className="flex-1 bg-background"
      contentContainerStyle={{ padding: 16, gap: 8 }}
      data={tampil}
      keyExtractor={(s) => String(s.id)}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <View className="items-center py-12">
          <Text className="text-sm text-muted-foreground text-center">
            {total === 0 ? "Belum ada data siswa di kelas Anda." : "Tidak ada siswa yang cocok dengan filter."}
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <Card padding="md" className="flex-row items-center justify-between">
          <View className="flex-1 min-w-0">
            <Text numberOfLines={1} className="text-sm font-semibold text-foreground">{item.nama}</Text>
            <Text className="text-xs text-muted-foreground mt-0.5">NIS {item.nis}</Text>
          </View>
          <StatusBadge status={statusSiswa(item)} />
        </Card>
      )}
    />
  );
}

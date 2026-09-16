// ============================================================
// SISWA TERDAFTAR (2026-09-05, W10) - BARU. Tab kedua "Pengenalan Wajah"
// KHUSUS wali kelas - daftar siswa KELASNYA SENDIRI (scoping dijamin
// backend, lihat routes/face.js::GET /class-status) beserta status
// pengenalan wajah masing2 (belum/sebagian/lengkap).
// ============================================================
import React, { useCallback, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { CheckCircle2, Circle, CircleDashed } from "lucide-react-native";
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

function StatusBadge({ enrolled, complete }: { enrolled: boolean; complete: boolean }) {
  const colors = useThemeColors();
  if (complete) {
    return (
      <View className="flex-row items-center gap-1.5">
        <CheckCircle2 size={16} color="#16a34a" />
        <Text className="text-xs font-medium text-green-600 dark:text-green-400">Lengkap</Text>
      </View>
    );
  }
  if (enrolled) {
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

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    const res = await api.faceClassStatus();
    if (res.success) setStudents(res.data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator color={colors.primary} /></View>;

  return (
    <FlatList
      className="flex-1 bg-background"
      contentContainerStyle={{ padding: 16, gap: 8 }}
      data={students}
      keyExtractor={(s) => String(s.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      ListEmptyComponent={
        <View className="items-center py-16">
          <Text className="text-sm text-muted-foreground">Belum ada data siswa di kelas Anda.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <Card padding="md" className="flex-row items-center justify-between">
          <View className="flex-1 min-w-0">
            <Text numberOfLines={1} className="text-sm font-semibold text-foreground">{item.nama}</Text>
            <Text className="text-xs text-muted-foreground mt-0.5">NIS {item.nis}</Text>
          </View>
          <StatusBadge enrolled={item.enrolled} complete={item.complete} />
        </Card>
      )}
    />
  );
}

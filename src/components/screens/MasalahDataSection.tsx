import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { AlertTriangle } from "lucide-react-native";
import { Card } from "../ui/Card";
import { api } from "../../services/api";
import { useThemeColors } from "../../context/ThemeContext";

// Masalah data yang terdeteksi saat sinkron Data Master (no. HP tidak valid dst).
// Hanya Admin IT: kalau backend membalas 403 section ini disembunyikan diam-diam.
interface DataIssue {
  id: number;
  entity: "pegawai" | "siswa";
  entity_id: number;
  nama: string;
  masalah: "no_hp_tidak_valid" | "hp_ortu_tidak_valid";
  nilai: string | null;
  first_seen: string;
  last_seen: string;
}

const LABEL_MASALAH: Record<DataIssue["masalah"], string> = {
  no_hp_tidak_valid: "No. HP pegawai tidak valid",
  hp_ortu_tidak_valid: "No. HP orang tua tidak valid",
};

function formatTanggal(ts: string | null) {
  if (!ts) return "Belum pernah";
  return new Date(ts).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function MasalahDataSection() {
  const colors = useThemeColors();
  const [issues, setIssues] = useState<DataIssue[] | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let alive = true;
    api.adminDataIssues().then((res: any) => {
      if (!alive) return;
      if (res.success) setIssues(res.data || []);
      else setHidden(true); // 403 (bukan Admin IT) / gagal muat: sembunyikan diam-diam
    }).catch(() => { if (alive) setHidden(true); });
    return () => { alive = false; };
  }, []);

  if (hidden) return null;

  return (
    <Card padding="lg">
      <View className="flex-row items-center gap-2 mb-1">
        <AlertTriangle size={18} color={issues && issues.length > 0 ? "#f59e0b" : colors.mutedForeground} />
        <Text className="font-semibold text-sm text-foreground">Masalah Data dari Data Master{issues && issues.length > 0 ? ` (${issues.length})` : ""}</Text>
      </View>
      <Text className="text-xs text-muted-foreground mb-3">Perbaiki di Data Master; hilang otomatis setelah data benar pada sinkron berikutnya.</Text>
      {!issues ? (
        <View className="items-center py-2"><ActivityIndicator color={colors.primary} /></View>
      ) : issues.length === 0 ? (
        <Text className="text-xs text-muted-foreground">Tidak ada masalah data.</Text>
      ) : (
        <View className="gap-3">
          {issues.map((i) => (
            <View key={i.id} className="border-b border-border pb-3">
              <Text className="text-sm font-medium text-foreground">{i.nama}</Text>
              <Text className="text-xs text-amber-600 dark:text-amber-400">{LABEL_MASALAH[i.masalah] ?? i.masalah}</Text>
              <Text className="text-xs text-muted-foreground">Isian: {i.nilai ? i.nilai : "(kosong)"}</Text>
              <Text className="text-xs text-muted-foreground">Terakhir terlihat: {formatTanggal(i.last_seen)}</Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

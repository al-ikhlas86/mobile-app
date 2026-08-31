import React, { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react-native";
import { Card } from "../ui/Card";
import { api } from "../../services/api";
import { useThemeColors } from "../../context/ThemeContext";

const POLL_MS = 10000;
interface SourceStatus { lastSuccessAt: string | null; lastAttemptAt: string | null; failStreak: number; lastError: string | null; healthy: boolean; }
function formatTime(ts: string | null) { if (!ts) return "Belum pernah"; return new Date(ts).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" }); }

function SourceCard({ title, status }: { title: string; status: SourceStatus }) {
  return (
    <Card padding="lg">
      <View className="flex-row items-center gap-3 mb-3">
        {status.healthy ? <CheckCircle2 size={22} color="#22c55e" /> : <AlertTriangle size={22} color="#ef4444" />}
        <View>
          <Text className="font-semibold text-sm text-foreground">{title}</Text>
          <Text className={`text-xs ${status.healthy ? "text-green-600" : "text-red-500"}`}>{status.healthy ? "Sehat" : `Gagal ${status.failStreak}x berturut-turut`}</Text>
        </View>
      </View>
      <View className="gap-1">
        <Text className="text-xs text-muted-foreground">Terakhir berhasil: {formatTime(status.lastSuccessAt)}</Text>
        <Text className="text-xs text-muted-foreground">Percobaan terakhir: {formatTime(status.lastAttemptAt)}</Text>
        {status.lastError ? <Text className="text-xs text-red-500 mt-2">Pesan error terakhir: {status.lastError}</Text> : null}
      </View>
    </Card>
  );
}

export function SyncStatusScreen() {
  const colors = useThemeColors();
  const [data, setData] = useState<{ hubApi: SourceStatus } | null>(null);
  const [error, setError] = useState("");
  const [lastCheck, setLastCheck] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = async () => {
    const res = await api.adminSyncStatus();
    if (!res.success || !res.data) { setError("Gagal memuat status sinkronisasi."); return; }
    setError(""); setData(res.data); setLastCheck(new Date().toLocaleTimeString("id-ID"));
  };

  useEffect(() => {
    poll();
    timerRef.current = setInterval(poll, POLL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  return (
    <ScrollView className="flex-1 bg-background px-4 pt-5" contentContainerStyle={{ paddingBottom: 32, gap: 16 }}>
      <Text className="text-xs text-muted-foreground">Kondisi sinkronisasi data terkini. "Sehat" berarti siklus terakhir berhasil. Setelah 3x gagal berturut-turut, alarm WA otomatis terkirim.</Text>
      {error ? (
        <Card padding="lg"><View className="items-center py-4"><AlertTriangle size={40} color="#ef4444" /><Text className="text-sm text-muted-foreground mt-2">{error}</Text></View></Card>
      ) : !data ? (
        <Card padding="lg"><View className="items-center py-4"><ActivityIndicator color={colors.primary} /><Text className="text-sm text-muted-foreground mt-2">Memuat...</Text></View></Card>
      ) : (
        <SourceCard title="Hub API (Data Master Siswa/Guru/Pegawai)" status={data.hubApi} />
      )}
      {lastCheck ? (
        <View className="flex-row items-center justify-center gap-1"><RefreshCw size={12} color={colors.mutedForeground} /><Text className="text-xs text-muted-foreground">Terakhir dicek: {lastCheck}</Text></View>
      ) : null}
    </ScrollView>
  );
}

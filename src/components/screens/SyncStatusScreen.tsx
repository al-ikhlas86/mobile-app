import React, { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckCircle2, AlertTriangle, RefreshCw, UserPlus, Check, X, Ban } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
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

// Unit Data Master (2026-09-14) - lihat catatan panjang di versi webview
// (src/app/components/screens/SyncStatusScreen.tsx), fungsinya sama persis.
interface HubUnit { id: number; name: string; unit_id: number | null; status: "pending" | "active" | "deactivated"; created_at: string; }
function formatTanggal(ts: string) { return new Date(ts).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }

function HubUnitsSection({ units, onChanged }: { units: HubUnit[]; onChanged: () => void }) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const pending = units.filter((u) => u.status === "pending");
  const aktif = units.filter((u) => u.status === "active");

  const jalankan = async (aksi: "approve" | "reject" | "deactivate", unit: HubUnit, judul: string, pesan: string) => {
    Alert.alert(judul, pesan, [
      { text: "Batal", style: "cancel" },
      {
        text: aksi === "approve" ? "Setujui" : aksi === "reject" ? "Tolak" : "Nonaktifkan",
        style: aksi === "approve" ? "default" : "destructive",
        onPress: async () => {
          setBusyId(unit.id);
          try {
            const fn = aksi === "approve" ? api.adminApproveHubUnit : aksi === "reject" ? api.adminRejectHubUnit : api.adminDeactivateHubUnit;
            const res = await fn(unit.id);
            if (!res.success) Alert.alert("Gagal", res.message || "Gagal memproses.");
            onChanged();
          } catch {
            Alert.alert("Gagal", "Gagal menghubungi server - cek koneksi internet.");
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  return (
    <>
      {pending.length > 0 && (
        <Card padding="lg">
          <View className="flex-row items-center gap-2 mb-3">
            <UserPlus size={20} color="#f59e0b" />
            <Text className="font-semibold text-sm text-foreground">Permintaan Sambungan Baru ({pending.length})</Text>
          </View>
          <View className="gap-3">
            {pending.map((u) => (
              <View key={u.id} className="border border-amber-200 bg-amber-50 rounded-xl p-3">
                <Text className="text-sm font-medium text-foreground">{u.name}</Text>
                <Text className="text-xs text-muted-foreground mb-2">Mendaftar: {formatTanggal(u.created_at)}</Text>
                <View className="flex-row gap-2">
                  <Button size="sm" variant="primary" disabled={busyId === u.id} onPress={() => jalankan("approve", u, "Setujui Unit", `Setujui unit "${u.name}"? Sinkronisasi akan mulai jalan otomatis.`)}>
                    <Check size={14} color="#fff" /><Text className="text-primary-foreground text-sm font-semibold ml-1">Setujui</Text>
                  </Button>
                  <Button size="sm" variant="destructive" disabled={busyId === u.id} onPress={() => jalankan("reject", u, "Tolak Pendaftaran", `Tolak & hapus pendaftaran "${u.name}"? Tidak bisa dibatalkan.`)}>
                    <X size={14} color="#fff" /><Text className="text-destructive-foreground text-sm font-semibold ml-1">Tolak</Text>
                  </Button>
                </View>
              </View>
            ))}
          </View>
        </Card>
      )}

      <Card padding="lg">
        <Text className="font-semibold text-sm text-foreground mb-3">Unit Terhubung ({aktif.length})</Text>
        {aktif.length === 0 ? (
          <Text className="text-xs text-muted-foreground">Belum ada unit aktif.</Text>
        ) : (
          <View className="gap-2">
            {aktif.map((u) => (
              <View key={u.id} className="flex-row items-center justify-between gap-2 border-b border-border pb-2">
                <View>
                  <Text className="text-sm font-medium text-foreground">{u.name}</Text>
                  <Text className="text-xs text-muted-foreground">Unit ID {u.unit_id}</Text>
                </View>
                <Button size="sm" variant="outline" disabled={busyId === u.id} onPress={() => jalankan("deactivate", u, "Nonaktifkan Unit", `Nonaktifkan unit "${u.name}"? Token lamanya tidak akan diterima lagi.`)}>
                  <Ban size={14} /><Text className="text-primary text-sm font-semibold ml-1">Nonaktifkan</Text>
                </Button>
              </View>
            ))}
          </View>
        )}
      </Card>
    </>
  );
}

export function SyncStatusScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [data, setData] = useState<{ hubApi: SourceStatus } | null>(null);
  const [units, setUnits] = useState<HubUnit[] | null>(null);
  const [error, setError] = useState("");
  const [lastCheck, setLastCheck] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const muatUnits = async () => {
    const res = await api.adminHubUnits();
    if (res.success && res.data) setUnits(res.data);
  };

  const poll = async () => {
    const res = await api.adminSyncStatus();
    if (!res.success || !res.data) { setError("Gagal memuat status sinkronisasi."); return; }
    setError(""); setData(res.data); setLastCheck(new Date().toLocaleTimeString("id-ID"));
  };

  useEffect(() => {
    poll();
    muatUnits();
    timerRef.current = setInterval(poll, POLL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  return (
    <ScrollView className="flex-1 bg-background px-4 pt-5" contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 16 }}>
      <Text className="text-xs text-muted-foreground">Kondisi sinkronisasi data terkini. "Sehat" berarti siklus terakhir berhasil. Setelah 3x gagal berturut-turut, alarm WA otomatis terkirim.</Text>
      {error ? (
        <Card padding="lg"><View className="items-center py-4"><AlertTriangle size={40} color="#ef4444" /><Text className="text-sm text-muted-foreground mt-2">{error}</Text></View></Card>
      ) : !data ? (
        <Card padding="lg"><View className="items-center py-4"><ActivityIndicator color={colors.primary} /><Text className="text-sm text-muted-foreground mt-2">Memuat...</Text></View></Card>
      ) : (
        <SourceCard title="Hub API (Data Master Siswa/Guru/Pegawai)" status={data.hubApi} />
      )}
      {units && <HubUnitsSection units={units} onChanged={muatUnits} />}
      {lastCheck ? (
        <View className="flex-row items-center justify-center gap-1"><RefreshCw size={12} color={colors.mutedForeground} /><Text className="text-xs text-muted-foreground">Terakhir dicek: {lastCheck}</Text></View>
      ) : null}
    </ScrollView>
  );
}

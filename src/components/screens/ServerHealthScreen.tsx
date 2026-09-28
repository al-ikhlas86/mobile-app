import React, { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckCircle2, AlertTriangle, HelpCircle, RefreshCw, Cpu, Database, HardDrive } from "lucide-react-native";
import { Card } from "../ui/Card";
import { api } from "../../services/api";
import { useThemeColors } from "../../context/ThemeContext";

// Kondisi VPS (2026-09-28) - port pola SyncStatusScreen.tsx (polling 10
// detik) - lihat services/serverHealth.js di backend utk kenapa fitur ini
// portabel begitu VPS diganti.
const POLL_MS = 10000;

type StatusTingkat = "sehat" | "perhatian" | "kritis" | "tidak diketahui";

interface ServerHealthData {
  cpu: { usagePercent: number; cores: number; status: StatusTingkat };
  ram: { usedPercent: number; usedMb: number; totalMb: number; status: StatusTingkat };
  disk: { tersedia?: false; usedPercent?: number; usedGb?: number; totalGb?: number; status: StatusTingkat };
  status: StatusTingkat;
  checkedAt: string;
}

const WARNA_STATUS: Record<StatusTingkat, string> = {
  sehat: "#16a34a",
  perhatian: "#b45309",
  kritis: "#dc2626",
  "tidak diketahui": "#6b7280",
};
const LABEL_STATUS: Record<StatusTingkat, string> = {
  sehat: "Sehat",
  perhatian: "Perlu Perhatian",
  kritis: "Kritis",
  "tidak diketahui": "Tidak Diketahui",
};

function IkonStatus({ status, size }: { status: StatusTingkat; size: number }) {
  const warna = WARNA_STATUS[status];
  if (status === "sehat") return <CheckCircle2 size={size} color={warna} />;
  if (status === "tidak diketahui") return <HelpCircle size={size} color={warna} />;
  return <AlertTriangle size={size} color={warna} />;
}

function formatTime(ts: string): string {
  return new Date(ts).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function ResourceCard({ title, icon, percent, status, subtitle }: { title: string; icon: React.ReactNode; percent: number | null; status: StatusTingkat; subtitle: string }) {
  return (
    <Card padding="lg">
      <View className="flex-row items-center gap-2 mb-2">
        {icon}
        <Text className="font-semibold text-sm text-foreground flex-1">{title}</Text>
        <Text className="text-xs font-semibold" style={{ color: WARNA_STATUS[status] }}>{LABEL_STATUS[status]}</Text>
      </View>
      {percent === null ? (
        <Text className="text-xs text-muted-foreground">Tidak tersedia di platform ini.</Text>
      ) : (
        <>
          <Text className="text-2xl font-bold text-foreground mb-1.5">{percent}%</Text>
          <View className="w-full h-2 rounded-full bg-muted overflow-hidden">
            <View style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: WARNA_STATUS[status] }} className="h-full rounded-full" />
          </View>
          <Text className="text-xs text-muted-foreground mt-1.5">{subtitle}</Text>
        </>
      )}
    </Card>
  );
}

export function ServerHealthScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [data, setData] = useState<ServerHealthData | null>(null);
  const [error, setError] = useState("");
  const [lastCheck, setLastCheck] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = async () => {
    try {
      const res = await api.adminServerHealth();
      if (!res.success || !res.data) { setError("Gagal memuat kondisi server."); return; }
      setError("");
      setData(res.data);
      setLastCheck(new Date().toLocaleTimeString("id-ID"));
    } catch {
      setError("Gagal menghubungi server - cek koneksi internet.");
    }
  };

  useEffect(() => {
    poll();
    timerRef.current = setInterval(poll, POLL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  return (
    <ScrollView className="flex-1 bg-background px-4 pt-5" contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 16 }}>
      <Text className="text-xs text-muted-foreground">
        Kondisi CPU/RAM/penyimpanan server SAAT INI (dicek ulang tiap ~10 detik). Fitur ini membaca kondisi mesin yang
        menjalankan aplikasi ini secara langsung, jadi tetap jalan otomatis walau suatu saat servernya dipindah.
      </Text>

      {error && !data ? (
        <Card padding="lg"><View className="items-center py-4"><AlertTriangle size={40} color="#ef4444" /><Text className="text-sm text-muted-foreground mt-2">{error}</Text></View></Card>
      ) : !data ? (
        <Card padding="lg"><View className="items-center py-4"><ActivityIndicator color={colors.primary} /><Text className="text-sm text-muted-foreground mt-2">Memuat...</Text></View></Card>
      ) : (
        <>
          <Card padding="lg">
            <View className="flex-row items-center gap-3">
              <IkonStatus status={data.status} size={28} />
              <View>
                <Text className="font-semibold text-base text-foreground">Status Server: {LABEL_STATUS[data.status]}</Text>
                <Text className="text-xs text-muted-foreground">Diperiksa: {formatTime(data.checkedAt)}</Text>
              </View>
            </View>
          </Card>

          <ResourceCard title="CPU" icon={<Cpu size={18} color="#0f766e" />} percent={data.cpu.usagePercent} status={data.cpu.status} subtitle={`${data.cpu.cores} inti`} />
          <ResourceCard title="RAM" icon={<Database size={18} color="#0f766e" />} percent={data.ram.usedPercent} status={data.ram.status} subtitle={`${data.ram.usedMb.toLocaleString("id-ID")} MB / ${data.ram.totalMb.toLocaleString("id-ID")} MB`} />
          <ResourceCard title="Penyimpanan" icon={<HardDrive size={18} color="#0f766e" />} percent={data.disk.usedPercent ?? null} status={data.disk.status} subtitle={data.disk.usedGb !== undefined ? `${data.disk.usedGb} GB / ${data.disk.totalGb} GB` : ""} />
        </>
      )}

      {lastCheck ? (
        <View className="flex-row items-center justify-center gap-1">
          <RefreshCw size={12} color={colors.mutedForeground} />
          <Text className="text-xs text-muted-foreground">Terakhir dicek: {lastCheck}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

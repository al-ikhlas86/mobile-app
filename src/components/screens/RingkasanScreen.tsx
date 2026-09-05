import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card } from "../ui/Card";
import { SimplePicker } from "../ui/SimplePicker";
import { useThemeColors } from "../../context/ThemeContext";
import { api } from "../../services/api";
import type { RoleName } from "../../services/authService";

interface RingkasanData {
  hariAktif: number;
  totalSiswa: number;
  totalKaryawan: number;
  rataKehadiranSiswa: number;
  rataKehadiranKaryawan: number;
  totalKeterlambatanSiswa: number;
  siswaPernahTelat: number;
  totalKeterlambatanKaryawan: number;
  karyawanPernahTelat: number;
  trendKeterlambatan: { tanggal: string; count: number }[];
  absensiBolongBulanan: { tanggal: string; count: number }[];
}

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card padding="md" className="flex-1">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <Text className="text-2xl font-bold text-foreground mt-1">{value}</Text>
      {sub ? <Text className="text-xs text-muted-foreground mt-0.5">{sub}</Text> : null}
    </Card>
  );
}

// Bar chart sederhana pakai View biasa (SENGAJA tidak pakai library chart
// baru - hindari dependency native baru yang butuh build ulang APK, lihat
// catatan proyek soal ini) - cukup utk lihat trend naik/turun per hari.
function SimpleBarRow({ data, color, colors }: { data: { tanggal: string; count: number }[]; color: string; colors: ReturnType<typeof useThemeColors> }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <View className="flex-row items-end gap-1" style={{ height: 90 }}>
      {data.map((d) => (
        <View key={d.tanggal} className="flex-1 items-center gap-1">
          <View style={{ width: "100%", height: Math.max(2, (d.count / max) * 70), backgroundColor: color, borderRadius: 3 }} />
          <Text style={{ fontSize: 8, color: colors.mutedForeground }}>{d.tanggal.slice(8, 10)}</Text>
        </View>
      ))}
    </View>
  );
}

// Ringkasan sekolah per bulan - fitur BARU (lihat routes/ringkasan.js Node
// & plan migrasi Absen). Admin IT/Supervisor bebas pilih unit; role lain
// (Admin TU, Guru Kelas) otomatis dikunci ke unitnya sendiri di server.
export function RingkasanScreen({ role }: { role: RoleName }) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const canPickUnit = role === "Admin IT" || role === "Supervisor";
  const [units, setUnits] = useState<{ id: number; label: string }[]>([]);
  const [unitId, setUnitId] = useState<number | undefined>(undefined);
  const now = new Date();
  const [year] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<RingkasanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!canPickUnit) return;
    (async () => {
      const res = await api.ringkasanUnits();
      if (res.success) {
        setUnits(res.data);
        if (res.data.length) setUnitId((prev) => prev ?? res.data[0].id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (canPickUnit && !unitId) return;
    (async () => {
      setLoading(true);
      setError("");
      const res = await api.ringkasan({ unitId, year, month });
      setLoading(false);
      if (res.success) setData(res);
      else setError(res.message ?? "Gagal memuat ringkasan.");
    })();
  }, [unitId, year, month, canPickUnit]);

  if (loading && !data) return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator color={colors.primary} /></View>;

  return (
    <ScrollView className="flex-1 bg-background px-4 pt-5" contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 16 }}>
      <View className="flex-row gap-2.5">
        {canPickUnit && units.length > 0 && (
          <View className="flex-1">
            <SimplePicker
              value={String(unitId ?? units[0].id)}
              options={units.map((u) => ({ value: String(u.id), label: u.label }))}
              onChange={(v) => setUnitId(Number(v))}
            />
          </View>
        )}
        <View className="flex-1">
          <SimplePicker
            value={String(month)}
            options={BULAN.map((b, i) => ({ value: String(i + 1), label: b }))}
            onChange={(v) => setMonth(Number(v))}
          />
        </View>
      </View>

      {error ? <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3"><Text className="text-sm text-red-600">{error}</Text></View> : null}

      {data ? (
        <>
          <View className="flex-row gap-3">
            <StatCard label="Hari Aktif" value={data.hariAktif} sub={`hari sekolah ${BULAN[month - 1]}`} />
            <StatCard label="Siswa & Pegawai" value={data.totalSiswa + data.totalKaryawan} sub={`${data.totalSiswa} siswa, ${data.totalKaryawan} pegawai`} />
          </View>
          <View className="flex-row gap-3">
            <StatCard label="Kehadiran Siswa" value={`${data.rataKehadiranSiswa}%`} sub={`${data.totalSiswa} siswa`} />
            <StatCard label="Kehadiran Pegawai" value={`${data.rataKehadiranKaryawan}%`} sub={`${data.totalKaryawan} pegawai`} />
          </View>
          <View className="flex-row gap-3">
            <StatCard label="Telat Siswa" value={`${data.totalKeterlambatanSiswa}x`} sub={`${data.siswaPernahTelat} siswa`} />
            <StatCard label="Telat Pegawai" value={`${data.totalKeterlambatanKaryawan}x`} sub={`${data.karyawanPernahTelat} pegawai`} />
          </View>

          <Card padding="md">
            <Text className="text-sm font-semibold text-foreground mb-2">Trend Keterlambatan</Text>
            <SimpleBarRow data={data.trendKeterlambatan} color="#f59e0b" colors={colors} />
          </Card>

          <Card padding="md">
            <Text className="text-sm font-semibold text-foreground mb-2">Absensi Bolong (Alfa) Bulanan</Text>
            <SimpleBarRow data={data.absensiBolongBulanan} color="#ef4444" colors={colors} />
          </Card>
        </>
      ) : null}
    </ScrollView>
  );
}

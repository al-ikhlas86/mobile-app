import React, { useState } from "react";
import { View, Text, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Search } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { SimplePicker } from "../ui/SimplePicker";
import { useThemeColors } from "../../context/ThemeContext";
import { api } from "../../services/api";

interface PerformaResult {
  person: { entityType: "siswa" | "karyawan"; nama: string; nis?: string; noHp?: string; jabatan?: string; kelasNama?: string };
  hariAktif: number;
  hadir: number;
  terlambat: number;
  izin: number;
  sakit: number;
  alfa: number;
  persentaseKehadiran: number;
  tanggalTidakHadir: string[];
  tanggalTerlambat: string[];
}

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <Card padding="md" className="flex-1">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <Text className="text-2xl font-bold mt-1" style={color ? { color } : undefined}>{value}</Text>
    </Card>
  );
}

// Cari performa presensi 1 orang - fitur BARU utk Admin/Guru Kelas (lihat
// routes/performa.js Node & plan migrasi Absen, Blocker 4). Endpoint
// /me & /anak yang sudah ada TIDAK terpengaruh sama sekali.
export function PerformaCariScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [identifier, setIdentifier] = useState("");
  const now = new Date();
  const [year] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<PerformaResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch() {
    if (!identifier.trim()) return;
    setLoading(true);
    setError("");
    setData(null);
    const res = await api.performaCari({ identifier: identifier.trim(), year, month });
    setLoading(false);
    if (res.success) setData(res);
    else setError(res.message ?? "Gagal mencari.");
  }

  return (
    <KeyboardAwareScrollView className="flex-1 bg-background px-4 pt-5" contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 16 }} bottomOffset={20}>
      <Text className="text-xs text-muted-foreground">Masukkan NIS siswa atau No HP guru/pegawai untuk melihat performa presensinya.</Text>

      <View className="gap-2.5">
        <TextInput
          value={identifier}
          onChangeText={setIdentifier}
          placeholder="NIS atau No HP"
          className="bg-input-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground"
          onSubmitEditing={handleSearch}
        />
        <SimplePicker
          value={String(month)}
          options={BULAN.map((b, i) => ({ value: String(i + 1), label: b }))}
          onChange={(v) => setMonth(Number(v))}
        />
        <Button onPress={handleSearch} loading={loading} fullWidth>
          <Search size={14} color="#fff" />{"  "}{loading ? "Mencari..." : "Cari"}
        </Button>
      </View>

      {error ? <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3"><Text className="text-sm text-red-600">{error}</Text></View> : null}

      {data ? (
        <>
          <Card padding="md">
            <Text className="text-sm font-semibold text-foreground">{data.person.nama}</Text>
            <Text className="text-xs text-muted-foreground">
              {data.person.entityType === "siswa"
                ? `NIS ${data.person.nis}${data.person.kelasNama ? ` · ${data.person.kelasNama}` : ""}`
                : `${data.person.jabatan ?? "Pegawai"} · ${data.person.noHp}`}
            </Text>
          </Card>

          <View className="flex-row gap-3">
            <StatCard label="Hari Aktif" value={data.hariAktif} />
            <StatCard label="Kehadiran" value={`${data.persentaseKehadiran}%`} />
          </View>
          <View className="flex-row gap-3">
            <StatCard label="Hadir" value={data.hadir} color="#16a34a" />
            <StatCard label="Terlambat" value={data.terlambat} color="#f97316" />
          </View>
          <View className="flex-row gap-3">
            <StatCard label="Izin/Sakit" value={data.izin + data.sakit} color="#3b82f6" />
            <StatCard label="Alfa" value={data.alfa} color="#dc2626" />
          </View>

          {data.tanggalTerlambat.length > 0 && (
            <Card padding="md">
              <Text className="text-sm font-semibold text-foreground mb-2">Tanggal Terlambat ({data.tanggalTerlambat.length}x)</Text>
              <View className="flex-row flex-wrap gap-1.5">
                {data.tanggalTerlambat.map((t) => (
                  <View key={t} className="px-2 py-1 rounded-lg bg-orange-50 border border-orange-200">
                    <Text className="text-xs text-orange-700">{t}</Text>
                  </View>
                ))}
              </View>
            </Card>
          )}

          {data.tanggalTidakHadir.length > 0 && (
            <Card padding="md">
              <Text className="text-sm font-semibold text-foreground mb-2">Tanggal Tidak Hadir/Alfa ({data.tanggalTidakHadir.length}x)</Text>
              <View className="flex-row flex-wrap gap-1.5">
                {data.tanggalTidakHadir.map((t) => (
                  <View key={t} className="px-2 py-1 rounded-lg bg-red-50 border border-red-200">
                    <Text className="text-xs text-red-700">{t}</Text>
                  </View>
                ))}
              </View>
            </Card>
          )}
        </>
      ) : null}
    </KeyboardAwareScrollView>
  );
}

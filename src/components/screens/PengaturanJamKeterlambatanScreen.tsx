import React, { useEffect, useState } from "react";
import { View, Text, TextInput, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Clock } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { useThemeColors } from "../../context/ThemeContext";
import { api } from "../../services/api";

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Admin IT saja - pengaturan jam cutoff keterlambatan, menggantikan
// SettingsController+jam_telat.php di Absen (lihat plan migrasi Absen,
// Node/system_settings sekarang jadi sumber kebenaran baru).
export function PengaturanJamKeterlambatanScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [siswa, setSiswa] = useState("");
  const [staff, setStaff] = useState("");
  const [tkPlayground, setTkPlayground] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await api.lateCutoffGet();
      setLoading(false);
      if (res.success) {
        setSiswa(res.late_cutoff_siswa?.slice(0, 5) ?? "08:30");
        setStaff(res.late_cutoff_staff?.slice(0, 5) ?? "08:35");
        setTkPlayground(res.late_cutoff_tk_playground?.slice(0, 5) ?? "08:00");
      } else {
        setError(res.message ?? "Gagal memuat pengaturan.");
      }
    })();
  }, []);

  async function handleSave() {
    for (const [label, value] of [["Siswa SD", siswa], ["Guru/Pegawai", staff], ["TK/Playground", tkPlayground]] as const) {
      if (!TIME_RE.test(value)) {
        setError(`Format jam ${label} tidak valid - pakai HH:MM, mis. 08:30.`);
        return;
      }
    }
    setSaving(true);
    setError("");
    setSaved(false);
    const res = await api.lateCutoffUpdate({
      late_cutoff_siswa: siswa,
      late_cutoff_staff: staff,
      late_cutoff_tk_playground: tkPlayground,
    });
    setSaving(false);
    if (res.success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      setError(res.message ?? "Gagal menyimpan pengaturan.");
    }
  }

  if (loading) return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator color={colors.primary} /></View>;

  return (
    <KeyboardAwareScrollView className="flex-1 bg-background px-4 pt-5" contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 16 }} bottomOffset={20}>
      <Text className="text-xs text-muted-foreground">
        Batas jam ini menentukan status "Terlambat" di seluruh statistik & rekap presensi - siapapun yang absen masuk
        SETELAH jam ini akan tercatat Terlambat, sebelum/sama dengan jam ini tercatat Hadir.
      </Text>

      {error ? <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3"><Text className="text-sm text-red-600">{error}</Text></View> : null}
      {saved ? <View className="bg-green-50 border border-green-200 rounded-xl px-4 py-3"><Text className="text-sm text-green-700">Tersimpan.</Text></View> : null}

      <Card padding="md">
        <View className="gap-3">
          <View className="flex-row items-center gap-2">
            <Clock size={16} color={colors.primary} />
            <Text className="text-sm font-semibold text-foreground">Jam Batas Keterlambatan</Text>
          </View>

          <View className="gap-1.5">
            <Text className="text-sm font-medium text-foreground">Siswa SD</Text>
            <TextInput value={siswa} onChangeText={setSiswa} placeholder="08:30" keyboardType="numbers-and-punctuation" maxLength={5}
              className="bg-input-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground" />
          </View>
          <View className="gap-1.5">
            <Text className="text-sm font-medium text-foreground">Guru / Pegawai</Text>
            <TextInput value={staff} onChangeText={setStaff} placeholder="08:35" keyboardType="numbers-and-punctuation" maxLength={5}
              className="bg-input-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground" />
          </View>
          <View className="gap-1.5">
            <Text className="text-sm font-medium text-foreground">TK / Playground</Text>
            <TextInput value={tkPlayground} onChangeText={setTkPlayground} placeholder="08:00" keyboardType="numbers-and-punctuation" maxLength={5}
              className="bg-input-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground" />
          </View>

          <Text className="text-xs text-muted-foreground">
            Khusus TK/Playground: nilai di atas TIDAK PERNAH dipakai untuk menandai Terlambat - siswa tingkat ini
            selalu tercatat Hadir berapa pun jam masuknya (kebijakan sekolah, disamakan dengan sistem lama).
          </Text>

          <Button onPress={handleSave} loading={saving} fullWidth>{saving ? "Menyimpan..." : "Simpan"}</Button>
        </View>
      </Card>
    </KeyboardAwareScrollView>
  );
}

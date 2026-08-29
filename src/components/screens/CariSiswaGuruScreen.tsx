import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, FlatList, Pressable, Linking, ActivityIndicator } from "react-native";
import { Search, GraduationCap, UserCog, Phone, AlertCircle } from "lucide-react-native";
import { Card } from "../ui/Card";
import { api } from "../../services/api";
import { useThemeColors } from "../../context/ThemeContext";

interface StudentRow { id: number; nama: string; nis: string; kelas_nama: string | null; tingkat: string | null; }
interface EmployeeRow { id: number; nama: string; jabatan: string; no_handphone: string | null; }

const JABATAN_LABEL: Record<string, string> = { guru_kelas: "Guru Kelas", guru_bidang: "Guru Bidang", karyawan: "Karyawan" };

// Direktori pencarian cepat READ-ONLY - lihat catatan lengkap di versi
// webview (CariSiswaGuruScreen.tsx), port 1:1.
export function CariSiswaGuruScreen() {
  const colors = useThemeColors();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"siswa" | "pegawai">("siswa");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [sRes, eRes] = await Promise.all([api.students(), api.employees()]);
      if (!sRes.success) { setError(sRes.message ?? "Gagal memuat data siswa."); setLoading(false); return; }
      if (!eRes.success) { setError(eRes.message ?? "Gagal memuat data pegawai."); setLoading(false); return; }
      setStudents(sRes.data);
      setEmployees(eRes.data);
      setLoading(false);
    })();
  }, []);

  const q = query.trim().toLowerCase();
  const filteredStudents = useMemo(
    () => (q ? students.filter((s) => s.nama.toLowerCase().includes(q) || s.nis?.toLowerCase().includes(q) || s.kelas_nama?.toLowerCase().includes(q)) : students),
    [students, q]
  );
  const filteredEmployees = useMemo(
    () => (q ? employees.filter((e) => e.nama.toLowerCase().includes(q) || e.no_handphone?.toLowerCase().includes(q)) : employees),
    [employees, q]
  );

  if (loading) return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator color={colors.primary} /></View>;
  if (error) return <View className="flex-1 items-center justify-center bg-background gap-3 px-8"><AlertCircle size={32} color={colors.mutedForeground} /><Text className="text-sm text-muted-foreground text-center">{error}</Text></View>;

  return (
    <View className="flex-1 bg-background px-4 pt-4">
      <View className="flex-row items-center bg-input-background border border-border rounded-xl px-3 mb-3">
        <Search size={18} color={colors.mutedForeground} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Cari nama, NIS, kelas, atau no HP..."
          placeholderTextColor={colors.mutedForeground}
          className="flex-1 py-3 px-2 text-sm text-foreground"
        />
      </View>

      <View className="flex-row p-1 bg-muted rounded-xl mb-3">
        <Pressable onPress={() => setTab("siswa")} className={`flex-1 py-2 rounded-lg items-center ${tab === "siswa" ? "bg-card" : ""}`}>
          <Text className={`text-sm font-medium ${tab === "siswa" ? "text-foreground" : "text-muted-foreground"}`}>Siswa ({filteredStudents.length})</Text>
        </Pressable>
        <Pressable onPress={() => setTab("pegawai")} className={`flex-1 py-2 rounded-lg items-center ${tab === "pegawai" ? "bg-card" : ""}`}>
          <Text className={`text-sm font-medium ${tab === "pegawai" ? "text-foreground" : "text-muted-foreground"}`}>Guru & Pegawai ({filteredEmployees.length})</Text>
        </Pressable>
      </View>

      {tab === "siswa" ? (
        <FlatList
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 32, gap: 8 }}
          data={filteredStudents}
          keyExtractor={(s) => String(s.id)}
          ListEmptyComponent={<Text className="text-sm text-muted-foreground text-center py-8">Tidak ada siswa ditemukan.</Text>}
          renderItem={({ item: s }) => (
            <Card padding="md">
              <View className="flex-row items-center gap-3">
                <View className="w-9 h-9 rounded-xl bg-blue-50 items-center justify-center"><GraduationCap size={16} color="#2563eb" /></View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>{s.nama}</Text>
                  <Text className="text-xs text-muted-foreground">NIS {s.nis}{s.kelas_nama ? ` · ${s.tingkat ? s.tingkat + " " : ""}${s.kelas_nama}` : ""}</Text>
                </View>
              </View>
            </Card>
          )}
        />
      ) : (
        <FlatList
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 32, gap: 8 }}
          data={filteredEmployees}
          keyExtractor={(e) => String(e.id)}
          ListEmptyComponent={<Text className="text-sm text-muted-foreground text-center py-8">Tidak ada guru/pegawai ditemukan.</Text>}
          renderItem={({ item: e }) => (
            <Card padding="md">
              <View className="flex-row items-center gap-3">
                <View className="w-9 h-9 rounded-xl bg-purple-50 items-center justify-center"><UserCog size={16} color="#7c3aed" /></View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>{e.nama}</Text>
                  <Text className="text-xs text-muted-foreground">{JABATAN_LABEL[e.jabatan] ?? e.jabatan}</Text>
                </View>
                {e.no_handphone && (
                  <Pressable onPress={() => Linking.openURL(`tel:${e.no_handphone}`)} className="p-2 rounded-full bg-muted">
                    <Phone size={14} color={colors.mutedForeground} />
                  </Pressable>
                )}
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}

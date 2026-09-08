import React, { useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckCircle, XCircle, Image as ImageIcon, ClipboardCheck } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Input } from "../ui/Input";
import { api } from "../../services/api";
import { useThemeColors } from "../../context/ThemeContext";

interface PendingRow {
  id: number;
  tanggal: string;
  jenis: "sakit" | "izin" | "terlambat";
  keterangan: string | null;
  bukti_foto_url: string | null;
  guru_nama: string;
  created_at: string;
}

function formatDateFull(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

// Kepala Sekolah saja - tinjau pengajuan Izin/Sakit GURU (guru_kelas/
// guru_bidang) di unitnya (LeaveRequestController::pendingGuru di Absen,
// dibatasi server-side via unit_id - lihat routes/leave.js). Port 1:1 dari
// PersetujuanIzinScreen (versi siswa), beda sumber data & endpoint approve/
// reject saja (otorisasi unit_id, bukan phone/employee - Kepala Sekolah
// akun administratif murni).
export function PersetujuanIzinGuruScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = async () => {
    setLoading(true);
    const res = await api.leavePendingGuru();
    if (res.success) setRows(res.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  async function handleApprove(id: number) {
    setBusyId(id);
    await api.leaveApproveGuru(id);
    setBusyId(null);
    load();
  }

  async function handleReject(id: number) {
    setBusyId(id);
    await api.leaveRejectGuru(id, rejectReason.trim() || undefined);
    setBusyId(null);
    setRejectingId(null);
    setRejectReason("");
    load();
  }

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 pt-5 pb-2">
        <View className="flex-row items-center gap-2">
          <ClipboardCheck size={18} color={colors.primary} />
          <Text className="text-sm font-semibold text-foreground">Persetujuan Izin/Sakit Guru</Text>
        </View>
        <Text className="text-xs text-muted-foreground mt-1">Berlaku untuk semua guru (wali kelas maupun bukan). Pegawai non-guru tidak melalui persetujuan ini.</Text>
      </View>

      <FlatList
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 12 }}
        data={rows}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={<Text className="text-sm text-muted-foreground text-center py-6">{loading ? "Memuat..." : "Tidak ada pengajuan yang menunggu persetujuan."}</Text>}
        renderItem={({ item }) => (
          <Card padding="md">
            <View className="flex-row items-start justify-between gap-2 mb-2">
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground">{item.guru_nama}</Text>
                <Text className="text-xs text-muted-foreground">{formatDateFull(item.tanggal)}</Text>
              </View>
              <Badge variant="info">{item.jenis === "sakit" ? "Sakit" : item.jenis === "terlambat" ? "Terlambat" : "Izin"}</Badge>
            </View>
            {!!item.keterangan && <Text className="text-sm text-foreground mb-2">{item.keterangan}</Text>}
            {!!item.bukti_foto_url && (
              <Pressable onPress={() => Linking.openURL(item.bukti_foto_url!)} className="flex-row items-center gap-1.5 mb-3">
                <ImageIcon size={14} color={colors.primary} />
                <Text className="text-xs text-primary font-medium">Lihat bukti foto</Text>
              </Pressable>
            )}

            {rejectingId === item.id ? (
              <View className="gap-2 mt-2">
                <Input value={rejectReason} onChangeText={setRejectReason} placeholder="Alasan penolakan (opsional)..." />
                <View className="flex-row gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onPress={() => { setRejectingId(null); setRejectReason(""); }}>Batal</Button>
                  <Button size="sm" variant="destructive" className="flex-1" onPress={() => handleReject(item.id)} disabled={busyId === item.id} loading={busyId === item.id}>Tolak</Button>
                </View>
              </View>
            ) : (
              <View className="flex-row gap-2 mt-2">
                <Button size="sm" variant="outline" className="flex-1" onPress={() => setRejectingId(item.id)} disabled={busyId === item.id}>
                  <XCircle size={14} color={colors.primary} />{"  "}Tolak
                </Button>
                <Button size="sm" className="flex-1" onPress={() => handleApprove(item.id)} disabled={busyId === item.id} loading={busyId === item.id}>
                  <CheckCircle size={14} color={colors.primaryForeground} />{"  "}Setujui
                </Button>
              </View>
            )}
          </Card>
        )}
      />
    </View>
  );
}

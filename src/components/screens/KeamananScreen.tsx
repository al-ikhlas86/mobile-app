import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, TextInput, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ShieldCheck, AlertTriangle, LogOut } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { api } from "../../services/api";
import { useThemeColors } from "../../context/ThemeContext";

// Pusat Keamanan (Admin IT): padanan layar web KeamananScreen (routes/keamanan.js, tanpa nilai rahasia).
interface Ringkasan {
  sertifikat: { host: string; berlakuSampai?: string; sisaHari?: number; galat?: string };
  perangkat: { absensi: { diblokir: number; menunggu: number }; keuangan: { diblokir: number; menunggu: number }; dataMaster: { diblokir: number; menunggu: number } | null };
  tokenKioskLamaAktif: boolean; adminItAktif: number;
  peristiwa: { id: number; actor_name: string; description: string; created_at: string }[];
}
interface Pengguna { id: number; username: string; full_name: string; role: string; is_active: number }
const waktu = (iso: string) => new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function Baris({ label, nilai, perhatian = false }: { label: string; nilai: string; perhatian?: boolean }) {
  return (
    <View className="flex-row items-start justify-between gap-3 py-2 border-b border-border">
      <Text className="text-sm text-muted-foreground flex-1">{label}</Text>
      <Text className={`text-sm font-medium text-right flex-1 ${perhatian ? "text-amber-700" : "text-foreground"}`}>{nilai}</Text>
    </View>
  );
}

export function KeamananScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [r, setR] = useState<Ringkasan | null>(null);
  const [galat, setGalat] = useState("");
  const [q, setQ] = useState("");
  const [hasil, setHasil] = useState<Pengguna[]>([]);
  const [sibuk, setSibuk] = useState<number | null>(null);
  const [pesan, setPesan] = useState("");
  const tunda = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const muat = useCallback(async () => {
    setGalat("");
    const res = await api.adminKeamananRingkasan();
    if (res.success && res.data) setR(res.data as Ringkasan); else setGalat(res.message || "Gagal memuat ringkasan keamanan.");
  }, []);
  useEffect(() => { void muat(); }, [muat]);

  useEffect(() => {
    if (tunda.current) clearTimeout(tunda.current);
    if (q.trim().length < 2) { setHasil([]); return undefined; }
    tunda.current = setTimeout(async () => {
      const res = await api.adminCariSesi(q.trim());
      setHasil(res.success && res.data ? (res.data as Pengguna[]) : []);
    }, 350);
    return () => { if (tunda.current) clearTimeout(tunda.current); };
  }, [q]);

  const cabut = (u: Pengguna) => Alert.alert("Cabut sesi login", `Cabut semua sesi login ${u.full_name} (${u.username})? Ia harus login ulang di semua perangkat.`, [
    { text: "Batal", style: "cancel" },
    { text: "Cabut", style: "destructive", onPress: async () => {
      setSibuk(u.id); setPesan("");
      const res = await api.adminCabutSesi(u.id);
      setPesan(res.message || (res.success ? "Sesi dicabut." : "Gagal mencabut sesi."));
      setSibuk(null);
      if (res.success) void muat();
    } },
  ]);

  if (galat) {
    return (
      <View className="flex-1 bg-background px-4 py-8 gap-3">
        <View className="flex-row items-center gap-2"><AlertTriangle size={16} color="#dc2626" /><Text className="text-sm text-red-600 flex-1">{galat}</Text></View>
        <View className="flex-row"><Button size="sm" variant="outline" onPress={() => void muat()}>Coba lagi</Button></View>
      </View>
    );
  }
  if (!r) return <View className="flex-1 bg-background items-center justify-center"><ActivityIndicator color={colors.primary} /></View>;

  const s = r.sertifikat; const p = r.perangkat;
  return (
    <ScrollView className="flex-1 bg-background px-4 pt-5" contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 16 }} keyboardShouldPersistTaps="handled">
      <Card padding="lg">
        <View className="flex-row items-center gap-2 mb-1"><ShieldCheck size={18} color={colors.primary} /><Text className="font-semibold text-sm text-foreground">Kondisi saat ini</Text></View>
        <Baris label={`Sertifikat HTTPS (${s.host})`} nilai={s.galat ? s.galat : `${s.sisaHari} hari lagi`} perhatian={s.sisaHari === undefined || s.sisaHari <= 14} />
        <Baris label="Perangkat Absensi" nilai={`${p.absensi.diblokir} diblokir · ${p.absensi.menunggu} menunggu`} perhatian={p.absensi.menunggu > 0} />
        <Baris label="Instalasi Keuangan" nilai={`${p.keuangan.diblokir} diblokir · ${p.keuangan.menunggu} menunggu`} perhatian={p.keuangan.menunggu > 0} />
        <Baris label="Unit Data Master" nilai={p.dataMaster ? `${p.dataMaster.diblokir} diblokir · ${p.dataMaster.menunggu} menunggu` : "Tidak terbaca (Hub API)"} perhatian={!p.dataMaster || p.dataMaster.menunggu > 0} />
        <Baris label="Token kiosk lama (bersama)" nilai={r.tokenKioskLamaAktif ? "Masih aktif" : "Nonaktif"} perhatian={r.tokenKioskLamaAktif} />
        <Baris label="Akun Admin IT aktif" nilai={String(r.adminItAktif)} perhatian={r.adminItAktif > 3} />
        <Text className="text-xs text-muted-foreground mt-2">Permintaan yang menunggu dan perangkat diblokir dikelola di menu Perangkat.</Text>
      </Card>

      <Card padding="lg">
        <Text className="font-semibold text-sm text-foreground mb-1">Cabut sesi login pengguna</Text>
        <Text className="text-xs text-muted-foreground mb-3">Untuk HP hilang atau akun dicurigai. Semua perangkat akun itu langsung keluar. Kata sandi tidak diubah.</Text>
        <TextInput value={q} onChangeText={setQ} placeholder="Cari nama atau username (min. 2 huruf)" placeholderTextColor={colors.mutedForeground} maxLength={60} accessibilityLabel="Cari pengguna"
          className="bg-input-background border border-border rounded-lg px-3 py-2 text-sm text-foreground" />
        {q.trim().length >= 2 && hasil.length === 0 ? <Text className="text-xs text-muted-foreground mt-2">Tidak ada pengguna yang cocok.</Text> : null}
        <View className="mt-2">
          {hasil.map((u) => (
            <View key={u.id} className="flex-row items-center justify-between gap-3 py-2 border-b border-border">
              <View className="flex-1"><Text className="text-sm font-medium text-foreground">{u.full_name}</Text><Text className="text-xs text-muted-foreground">{u.username} · {u.role}{u.is_active ? "" : " · nonaktif"}</Text></View>
              <Button size="sm" variant="outline" disabled={sibuk === u.id} onPress={() => cabut(u)}><LogOut size={14} color={colors.foreground} /> Cabut</Button>
            </View>
          ))}
        </View>
        {pesan ? <Text className="text-sm text-foreground mt-2">{pesan}</Text> : null}
      </Card>

      <Card padding="lg">
        <Text className="font-semibold text-sm text-foreground mb-2">Peristiwa penting terbaru</Text>
        {r.peristiwa.length === 0 ? <Text className="text-xs text-muted-foreground">Belum ada.</Text> : r.peristiwa.map((e) => (
          <View key={e.id} className="py-2 border-b border-border">
            <Text className="text-sm text-foreground">{e.description}</Text>
            <Text className="text-xs text-muted-foreground">{e.actor_name} · {waktu(e.created_at)}</Text>
          </View>
        ))}
        <Text className="text-xs text-muted-foreground mt-2">Riwayat lengkap ada di menu Log Aktivitas.</Text>
      </Card>
    </ScrollView>
  );
}

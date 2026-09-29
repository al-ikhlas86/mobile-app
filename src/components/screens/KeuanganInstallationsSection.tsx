import React, { useEffect, useState } from "react";
import { View, Text, Alert, Pressable } from "react-native";
import { UserPlus, Check, X, Ban, Pencil, AlertTriangle } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { api } from "../../services/api";
import { useThemeColors } from "../../context/ThemeContext";

// Instalasi Keuangan desktop (al-ikhlas86/keuangan) - 2026-09-29. Versi mobile
// dari KeuanganInstallationsSection di webview (fungsi sama persis): permintaan
// izin dari POST /api/keuangan/register muncul di sini; Admin IT menyetujui dan
// menentukan katalog (SD/TK, boleh >1) yang datanya boleh ditarik Keuangan.
export interface KeuanganInstallation {
  id: number;
  label: string;
  is_approved: number;
  approved_at: string | null;
  approved_by_name: string | null;
  last_sync_at: string | null;
  last_sync_unauthorized_at: string | null;
  created_at: string;
  catalogs: { id: number; kode: string; nama: string }[];
}

interface Catalog { id: number; kode: string; nama: string; }

function formatTanggal(ts: string | null) {
  if (!ts) return "Belum pernah";
  return new Date(ts).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Terhubung kalau sinkron terakhir < 5 menit lalu (klien menarik tiap ~1 menit).
function terhubung(ts: string | null) {
  return !!ts && Date.now() - new Date(ts).getTime() < 5 * 60 * 1000;
}

export function KeuanganInstallationsSection({ installations, onChanged }: { installations: KeuanganInstallation[]; onChanged: () => void }) {
  const colors = useThemeColors();
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [panelId, setPanelId] = useState<number | null>(null);
  const [mode, setMode] = useState<"approve" | "edit">("approve");
  const [picked, setPicked] = useState<number[]>([]);

  useEffect(() => {
    api.adminCatalogs().then((res) => { if (res.success) setCatalogs(res.data); });
  }, []);

  const pending = installations.filter((i) => !i.is_approved && !i.approved_at);
  const dicabut = installations.filter((i) => !i.is_approved && i.approved_at);
  const aktif = installations.filter((i) => !!i.is_approved);

  const bukaPanel = (inst: KeuanganInstallation, m: "approve" | "edit") => {
    setPanelId(inst.id);
    setMode(m);
    setPicked(inst.catalogs.map((c) => c.id));
  };

  const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const simpanPanel = (inst: KeuanganInstallation) => {
    if (picked.length === 0) {
      Alert.alert("Gagal", "Pilih minimal 1 katalog.");
      return;
    }
    const nama = catalogs.filter((c) => picked.includes(c.id)).map((c) => c.nama).join(" + ");
    const pesan = mode === "approve"
      ? `Setujui "${inst.label}" menarik data siswa & pegawai dari: ${nama}?`
      : `Ubah katalog "${inst.label}" menjadi: ${nama}?`;
    Alert.alert(mode === "approve" ? "Setujui Keuangan" : "Ubah Katalog", pesan, [
      { text: "Batal", style: "cancel" },
      {
        text: mode === "approve" ? "Setujui" : "Simpan",
        onPress: async () => {
          setBusyId(inst.id);
          try {
            const res = mode === "approve"
              ? await api.adminKeuanganApprove(inst.id, picked)
              : await api.adminKeuanganSetCatalogs(inst.id, picked);
            if (!res.success) Alert.alert("Gagal", res.message || "Gagal memproses.");
            else setPanelId(null);
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

  const jalankan = (aksi: "revoke" | "delete", inst: KeuanganInstallation, judul: string, pesan: string, tombol: string) => {
    Alert.alert(judul, pesan, [
      { text: "Batal", style: "cancel" },
      {
        text: tombol,
        style: "destructive",
        onPress: async () => {
          setBusyId(inst.id);
          try {
            const res = aksi === "revoke" ? await api.adminKeuanganRevoke(inst.id) : await api.adminKeuanganDelete(inst.id);
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

  const renderPanel = (inst: KeuanganInstallation) => (
    <View className="gap-2 bg-card rounded-lg p-2.5 border border-border mt-2">
      <Text className="text-xs font-medium text-foreground">Ambil data dari katalog mana? (boleh lebih dari 1)</Text>
      <View className="gap-2">
        {catalogs.map((c) => {
          const on = picked.includes(c.id);
          return (
            <Pressable key={c.id} onPress={() => toggle(c.id)} className="flex-row items-center gap-2 py-1">
              <View
                style={{ borderColor: on ? colors.primary : colors.mutedForeground, backgroundColor: on ? colors.primary : "transparent" }}
                className="w-5 h-5 rounded border-2 items-center justify-center"
              >
                {on ? <Check size={12} color="#fff" /> : null}
              </View>
              <Text className="text-sm text-foreground">{c.nama} <Text className="text-xs text-muted-foreground">({c.kode})</Text></Text>
            </Pressable>
          );
        })}
      </View>
      <View className="flex-row gap-2 mt-1">
        <Button size="sm" variant="primary" disabled={busyId === inst.id} loading={busyId === inst.id} onPress={() => simpanPanel(inst)}>
          {mode === "approve" ? "Konfirmasi Setujui" : "Simpan Katalog"}
        </Button>
        <Button size="sm" variant="outline" disabled={busyId === inst.id} onPress={() => setPanelId(null)}>Batal</Button>
      </View>
    </View>
  );

  return (
    <>
      <Text className="text-xs text-muted-foreground">
        Aplikasi Keuangan (desktop) yang pertama kali dijalankan otomatis meminta izin ke sini. Setelah disetujui, Keuangan menarik data siswa & pegawai dari katalog yang Anda pilih dan otomatis mengikuti update Data Master.
      </Text>

      {pending.length > 0 && (
        <Card padding="lg">
          <View className="flex-row items-center gap-2 mb-3">
            <UserPlus size={20} color="#f59e0b" />
            <Text className="font-semibold text-sm text-foreground">Permintaan Izin Keuangan ({pending.length})</Text>
          </View>
          <View className="gap-3">
            {pending.map((i) => (
              <View key={i.id} className="border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 rounded-xl p-3">
                <Text className="text-sm font-medium text-foreground">{i.label}</Text>
                <Text className="text-xs text-muted-foreground mb-2">Meminta izin: {formatTanggal(i.created_at)}</Text>
                {panelId !== i.id ? (
                  <View className="flex-row gap-2">
                    <Button size="sm" variant="primary" disabled={busyId === i.id} onPress={() => bukaPanel(i, "approve")}>
                      <Check size={14} color="#fff" /><Text className="text-primary-foreground text-sm font-semibold ml-1">Setujui</Text>
                    </Button>
                    <Button size="sm" variant="destructive" disabled={busyId === i.id} onPress={() => jalankan("delete", i, "Tolak Permintaan", `Tolak & hapus permintaan "${i.label}"? Tidak bisa dibatalkan.`, "Tolak")}>
                      <X size={14} color="#fff" /><Text className="text-destructive-foreground text-sm font-semibold ml-1">Tolak</Text>
                    </Button>
                  </View>
                ) : renderPanel(i)}
              </View>
            ))}
          </View>
        </Card>
      )}

      <Card padding="lg">
        <Text className="font-semibold text-sm text-foreground mb-3">Keuangan Terhubung ({aktif.length})</Text>
        {aktif.length === 0 ? (
          <Text className="text-xs text-muted-foreground">Belum ada instalasi Keuangan yang aktif.</Text>
        ) : (
          <View className="gap-3">
            {aktif.map((i) => (
              <View key={i.id} className="border-b border-border pb-3">
                <Text className="text-sm font-medium text-foreground">{i.label}</Text>
                <Text className="text-xs text-muted-foreground">
                  Katalog: {i.catalogs.length ? i.catalogs.map((c) => c.kode).join(" + ") : "belum ada"}
                </Text>
                <Text className={`text-xs ${terhubung(i.last_sync_at) ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>
                  {terhubung(i.last_sync_at) ? "● Terhubung" : "● Tidak aktif"}
                  <Text className="text-muted-foreground"> · sinkron terakhir: {formatTanggal(i.last_sync_at)}</Text>
                </Text>
                {panelId !== i.id ? (
                  <View className="flex-row gap-2 mt-2">
                    <Button size="sm" variant="outline" disabled={busyId === i.id} onPress={() => bukaPanel(i, "edit")}>
                      <Pencil size={14} color={colors.primary} /><Text className="text-primary text-sm font-semibold ml-1">Ubah katalog</Text>
                    </Button>
                    <Button size="sm" variant="outline" disabled={busyId === i.id} onPress={() => jalankan("revoke", i, "Cabut Akses", `Cabut akses "${i.label}"? Sinkronisasi Keuangan berhenti sampai Anda setujui lagi.`, "Cabut")}>
                      <Ban size={14} color={colors.primary} /><Text className="text-primary text-sm font-semibold ml-1">Cabut akses</Text>
                    </Button>
                  </View>
                ) : renderPanel(i)}
              </View>
            ))}
          </View>
        )}
      </Card>

      {dicabut.length > 0 && (
        <Card padding="lg">
          <View className="flex-row items-center gap-2 mb-3">
            <AlertTriangle size={18} color={colors.mutedForeground} />
            <Text className="font-semibold text-sm text-foreground">Akses Dicabut ({dicabut.length})</Text>
          </View>
          <View className="gap-3">
            {dicabut.map((i) => (
              <View key={i.id} className="border-b border-border pb-3">
                <Text className="text-sm font-medium text-foreground">{i.label}</Text>
                {panelId !== i.id ? (
                  <View className="flex-row gap-2 mt-2">
                    <Button size="sm" variant="primary" disabled={busyId === i.id} onPress={() => bukaPanel(i, "approve")}>
                      <Check size={14} color="#fff" /><Text className="text-primary-foreground text-sm font-semibold ml-1">Aktifkan lagi</Text>
                    </Button>
                    <Button size="sm" variant="destructive" disabled={busyId === i.id} onPress={() => jalankan("delete", i, "Hapus Instalasi", `Hapus "${i.label}" permanen? Token-nya tidak akan bisa dipakai lagi.`, "Hapus")}>
                      <X size={14} color="#fff" /><Text className="text-destructive-foreground text-sm font-semibold ml-1">Hapus</Text>
                    </Button>
                  </View>
                ) : renderPanel(i)}
              </View>
            ))}
          </View>
        </Card>
      )}
    </>
  );
}

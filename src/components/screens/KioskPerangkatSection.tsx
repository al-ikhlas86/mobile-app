import React, { useEffect, useState } from "react";
import { View, Text, Alert, TextInput, Switch, Share, ActivityIndicator } from "react-native";
import { Plus, Ban, Check, Trash2, Tablet, Share2, KeyRound } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { SimplePicker } from "../ui/SimplePicker";
import { api } from "../../services/api";
import { useThemeColors } from "../../context/ThemeContext";

// Perangkat Kiosk Presensi (khusus Admin IT). Tiap perangkat punya token sendiri
// (bisa dicabut satuan, opsional dibatasi ke 1 katalog). Token ASLI hanya
// dikembalikan SEKALI oleh POST - ditampilkan di kotak sampai user menutupnya.
interface KioskDevice {
  id: number;
  nama: string;
  catalog_id: number | null;
  catalog_nama: string | null;
  is_active: number | boolean;
  created_at: string;
  last_used_at: string | null;
}

interface Catalog { id: number; kode: string; nama: string; }

const SEMUA = "";

function formatTanggal(ts: string | null) {
  if (!ts) return "belum pernah";
  return new Date(ts).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function KioskPerangkatSection() {
  const colors = useThemeColors();
  const [devices, setDevices] = useState<KioskDevice[] | null>(null);
  const [tokenLamaAktif, setTokenLamaAktif] = useState(false);
  const [tokenLamaAda, setTokenLamaAda] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [busyLama, setBusyLama] = useState(false);
  const [adding, setAdding] = useState(false);
  const [nama, setNama] = useState("");
  const [catalogId, setCatalogId] = useState<string>(SEMUA);
  const [saving, setSaving] = useState(false);
  const [newToken, setNewToken] = useState<{ nama: string; token: string } | null>(null);

  const muat = async () => {
    try {
      const res = await api.adminKioskDevices();
      if (res.success) {
        setDevices(res.data || []);
        setTokenLamaAktif(!!res.tokenLamaAktif);
        setTokenLamaAda(!!res.tokenLamaAda);
      } else {
        setHidden(true); // 403 (bukan Admin IT) / gagal muat: sembunyikan diam-diam
      }
    } catch {
      setHidden(true);
    }
  };

  useEffect(() => {
    muat();
    api.adminCatalogs().then((res) => { if (res.success) setCatalogs(res.data); });
  }, []);

  if (hidden) return null;

  const tambah = async () => {
    if (!nama.trim()) {
      Alert.alert("Gagal", "Nama perangkat wajib diisi.");
      return;
    }
    setSaving(true);
    try {
      const res = await api.adminCreateKioskDevice({ nama: nama.trim(), ...(catalogId ? { catalog_id: Number(catalogId) } : {}) });
      if (!res.success) {
        Alert.alert("Gagal", res.message || "Gagal membuat perangkat.");
      } else {
        setNewToken({ nama: res.data.nama, token: res.data.token });
        setAdding(false);
        setNama("");
        setCatalogId(SEMUA);
        await muat();
      }
    } catch {
      Alert.alert("Gagal", "Gagal menghubungi server - cek koneksi internet.");
    } finally {
      setSaving(false);
    }
  };

  const bagikanToken = async () => {
    if (!newToken) return;
    try {
      await Share.share({ message: newToken.token, title: `Token kiosk ${newToken.nama}` });
    } catch {
      Alert.alert("Gagal", "Tidak bisa membuka menu bagikan. Tekan lama tokennya untuk menyalin.");
    }
  };

  const ubahAktif = async (d: KioskDevice, aktif: boolean) => {
    setBusyId(d.id);
    try {
      const res = await api.adminSetKioskDeviceActive(d.id, aktif);
      if (!res.success) Alert.alert("Gagal", res.message || "Gagal memproses.");
      await muat();
    } catch {
      Alert.alert("Gagal", "Gagal menghubungi server - cek koneksi internet.");
    } finally {
      setBusyId(null);
    }
  };

  const cabut = (d: KioskDevice) => {
    Alert.alert("Cabut Perangkat", `Cabut akses "${d.nama}"? Kiosk dengan token ini berhenti bisa presensi sampai Anda aktifkan lagi.`, [
      { text: "Batal", style: "cancel" },
      { text: "Cabut", style: "destructive", onPress: () => ubahAktif(d, false) },
    ]);
  };

  const hapus = (d: KioskDevice) => {
    Alert.alert("Hapus Perangkat", `Hapus "${d.nama}" permanen? Token-nya tidak akan bisa dipakai lagi.`, [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          setBusyId(d.id);
          try {
            const res = await api.adminDeleteKioskDevice(d.id);
            if (!res.success) Alert.alert("Gagal", res.message || "Gagal memproses.");
            await muat();
          } catch {
            Alert.alert("Gagal", "Gagal menghubungi server - cek koneksi internet.");
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const ubahTokenLama = async (aktif: boolean) => {
    setBusyLama(true);
    try {
      const res = await api.adminSetKioskTokenLama(aktif);
      if (!res.success) Alert.alert("Gagal", res.message || "Gagal memproses.");
      await muat();
    } catch {
      Alert.alert("Gagal", "Gagal menghubungi server - cek koneksi internet.");
    } finally {
      setBusyLama(false);
    }
  };

  const onToggleTokenLama = (aktif: boolean) => {
    if (aktif) {
      ubahTokenLama(true);
      return;
    }
    Alert.alert("Matikan Token Lama", "Kiosk yang masih memakai token kiosk lama (bersama) akan berhenti bisa presensi. Pastikan semua kiosk sudah memakai token perangkat.", [
      { text: "Batal", style: "cancel" },
      { text: "Matikan", style: "destructive", onPress: () => ubahTokenLama(false) },
    ]);
  };

  return (
    <>
      {newToken && (
        <Card padding="lg">
          <View className="border-2 border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/10 rounded-xl p-3 gap-2">
            <View className="flex-row items-center gap-2">
              <KeyRound size={18} color="#f59e0b" />
              <Text className="flex-1 text-sm font-semibold text-foreground">Token untuk "{newToken.nama}"</Text>
            </View>
            <Text className="text-xs font-semibold text-red-600 dark:text-red-400">Simpan sekarang, tidak akan ditampilkan lagi.</Text>
            <Text selectable className="text-xs font-mono text-foreground bg-card border border-border rounded-lg p-2.5">{newToken.token}</Text>
            <Text className="text-xs text-muted-foreground">Tekan lama pada token untuk menyalin, atau gunakan Bagikan.</Text>
            <View className="flex-row gap-2">
              <Button size="sm" variant="primary" onPress={bagikanToken}>
                <Share2 size={14} color="#fff" /><Text className="text-primary-foreground text-sm font-semibold ml-1">Salin / Bagikan</Text>
              </Button>
              <Button size="sm" variant="outline" onPress={() => setNewToken(null)}>Tutup</Button>
            </View>
          </View>
        </Card>
      )}

      <Card padding="lg">
        <View className="flex-row items-center gap-2 mb-1">
          <Tablet size={18} color={colors.primary} />
          <Text className="font-semibold text-sm text-foreground">Perangkat Kiosk Presensi{devices ? ` (${devices.length})` : ""}</Text>
        </View>
        <Text className="text-xs text-muted-foreground mb-3">
          Tiap kiosk presensi memakai token perangkatnya sendiri sehingga bisa dicabut satuan dan dibatasi ke satu katalog.
        </Text>

        {!devices ? (
          <View className="items-center py-2"><ActivityIndicator color={colors.primary} /></View>
        ) : devices.length === 0 ? (
          <Text className="text-xs text-muted-foreground mb-3">Belum ada perangkat kiosk.</Text>
        ) : (
          <View className="gap-3 mb-3">
            {devices.map((d) => {
              const aktif = !!d.is_active;
              return (
                <View key={d.id} className="border-b border-border pb-3">
                  <Text className="text-sm font-medium text-foreground">{d.nama}</Text>
                  <Text className="text-xs text-muted-foreground">Katalog: {d.catalog_nama || "Semua"}</Text>
                  <Text className={`text-xs ${aktif ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>
                    {aktif ? "● Aktif" : "● Dicabut"}
                    <Text className="text-muted-foreground"> · terakhir dipakai: {formatTanggal(d.last_used_at)}</Text>
                  </Text>
                  <View className="flex-row gap-2 mt-2">
                    {aktif ? (
                      <Button size="sm" variant="outline" disabled={busyId === d.id} onPress={() => cabut(d)}>
                        <Ban size={14} color={colors.primary} /><Text className="text-primary text-sm font-semibold ml-1">Cabut</Text>
                      </Button>
                    ) : (
                      <Button size="sm" variant="primary" disabled={busyId === d.id} onPress={() => ubahAktif(d, true)}>
                        <Check size={14} color="#fff" /><Text className="text-primary-foreground text-sm font-semibold ml-1">Aktifkan</Text>
                      </Button>
                    )}
                    <Button size="sm" variant="destructive" disabled={busyId === d.id} onPress={() => hapus(d)}>
                      <Trash2 size={14} color="#fff" /><Text className="text-destructive-foreground text-sm font-semibold ml-1">Hapus</Text>
                    </Button>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {!adding ? (
          <Button size="sm" variant="primary" onPress={() => setAdding(true)}>
            <Plus size={14} color="#fff" /><Text className="text-primary-foreground text-sm font-semibold ml-1">Tambah Perangkat</Text>
          </Button>
        ) : (
          <View className="gap-2 bg-card rounded-lg p-2.5 border border-border">
            <Text className="text-xs font-medium text-foreground">Nama perangkat</Text>
            <TextInput
              value={nama}
              onChangeText={setNama}
              placeholder="Mis. Kiosk Gerbang Depan"
              maxLength={100}
              className="bg-input-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground"
            />
            <Text className="text-xs font-medium text-foreground">Katalog</Text>
            <SimplePicker
              value={catalogId}
              options={[{ value: SEMUA, label: "Semua katalog (tanpa batas)" }, ...catalogs.map((c) => ({ value: String(c.id), label: c.nama }))]}
              onChange={setCatalogId}
            />
            <View className="flex-row gap-2 mt-1">
              <Button size="sm" variant="primary" disabled={saving} loading={saving} onPress={tambah}>Buat Perangkat</Button>
              <Button size="sm" variant="outline" disabled={saving} onPress={() => { setAdding(false); setNama(""); setCatalogId(SEMUA); }}>Batal</Button>
            </View>
          </View>
        )}
      </Card>

      {tokenLamaAda && (
        <Card padding="lg">
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1">
              <Text className="text-sm font-medium text-foreground">Token kiosk lama (bersama)</Text>
              <Text className="text-xs text-muted-foreground">
                Token tunggal lama yang dipakai bersama semua kiosk. Matikan setelah semua kiosk memakai token perangkat.
              </Text>
            </View>
            <Switch
              value={tokenLamaAktif}
              disabled={busyLama}
              onValueChange={onToggleTokenLama}
              trackColor={{ true: colors.primary }}
            />
          </View>
        </Card>
      )}
    </>
  );
}

import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { MapPin, Plus, X, Power } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { SimplePicker } from "../ui/SimplePicker";
import { useThemeColors } from "../../context/ThemeContext";
import { api } from "../../services/api";

interface LocationRow {
  id: number;
  nama: string;
  lat: number;
  lng: number;
  radius_meter: number;
  is_active: 0 | 1;
  catalog_id: number | null;
  catalog_nama: string | null;
}

interface Catalog { id: number; kode: string; nama: string; }

// Kelola lokasi+radius presensi GPS PER KATALOG (2026-09-24, BUG NYATA
// diperbaiki - audit Sistem Katalog: SEBELUMNYA gak ada konsep katalog sama
// sekali, "1 titik lokasi aktif" dianggap berlaku semua sekolah - siswa/
// pegawai 1 katalog bisa lolos absen di lokasi katalog lain). Admin IT lihat
// semua katalog, Admin TU/Kepala Sekolah cuma katalog sendiri (backend yang
// validasi). Desain fail-closed PER KATALOG: kalau 0 lokasi aktif di suatu
// katalog, SEMUA check-in GPS di katalog itu ditolak (bukan fail-open) -
// disampaikan jelas lewat peringatan di UI.
export function PengaturanLokasiScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [rows, setRows] = useState<LocationRow[]>([]);
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newNama, setNewNama] = useState("");
  const [newLat, setNewLat] = useState("");
  const [newLng, setNewLng] = useState("");
  const [newRadius, setNewRadius] = useState("100");
  const [newCatalogId, setNewCatalogId] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    const res = await api.attendanceLocations();
    setLoading(false);
    if (res.success) {
      setRows(res.data);
      setCatalogs(res.catalogs ?? []);
      setNewCatalogId((prev) => prev || (res.catalogs?.[0]?.id ? String(res.catalogs[0].id) : ""));
    } else {
      setError(res.message ?? "Gagal memuat daftar lokasi.");
    }
  };

  useEffect(() => { load(); }, []);

  const emptyCatalogs = catalogs.filter((c) => !rows.some((r) => r.catalog_id === c.id && r.is_active));

  const resetAddForm = () => {
    setNewNama(""); setNewLat(""); setNewLng(""); setNewRadius("100"); setAddError(""); setShowAddForm(false);
  };

  async function handleAdd() {
    const lat = parseFloat(newLat);
    const lng = parseFloat(newLng);
    const radius = parseInt(newRadius, 10);
    if (!newNama.trim()) { setAddError("Nama lokasi wajib diisi."); return; }
    if (!newCatalogId) { setAddError("Pilih katalog dulu."); return; }
    if (Number.isNaN(lat) || lat < -90 || lat > 90) { setAddError("Latitude tidak valid (-90 s/d 90)."); return; }
    if (Number.isNaN(lng) || lng < -180 || lng > 180) { setAddError("Longitude tidak valid (-180 s/d 180)."); return; }
    if (Number.isNaN(radius) || radius < 5 || radius > 5000) { setAddError("Radius tidak valid (5 s/d 5000 meter)."); return; }
    setAddSaving(true); setAddError("");
    const res = await api.attendanceLocationCreate({ nama: newNama.trim(), lat, lng, radius_meter: radius, catalog_id: Number(newCatalogId) });
    setAddSaving(false);
    if (res.success) { resetAddForm(); load(); }
    else setAddError(res.message ?? "Gagal menambah lokasi.");
  }

  async function handleToggleActive(row: LocationRow) {
    setBusyId(row.id);
    const res = await api.attendanceLocationUpdate(row.id, { is_active: !row.is_active });
    setBusyId(null);
    if (res.success) load();
    else setError(res.message ?? "Gagal mengubah status lokasi.");
  }

  function handleDelete(row: LocationRow) {
    Alert.alert("Hapus Lokasi", `Hapus lokasi "${row.nama}"? Tindakan ini tidak bisa dibatalkan.`, [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus", style: "destructive", onPress: async () => {
          setBusyId(row.id);
          const res = await api.attendanceLocationDelete(row.id);
          setBusyId(null);
          if (res.success) load();
          else setError(res.message ?? "Gagal menghapus lokasi.");
        },
      },
    ]);
  }

  if (loading) return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator color={colors.primary} /></View>;

  return (
    <KeyboardAwareScrollView className="flex-1 bg-background px-4 pt-5" contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 16 }} bottomOffset={20}>
      <Text className="text-xs text-muted-foreground">
        Presensi GPS (check-in/check-out) hanya diterima kalau lokasi HP berada di dalam radius salah satu titik milik
        KATALOG yang sama dengan orang yang absen. Tiap katalog (unit sekolah) diatur terpisah.
      </Text>

      {emptyCatalogs.length > 0 && (
        <Card padding="md" className="border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10">
          <View className="flex-row items-start gap-2">
            <MapPin size={16} color="#dc2626" style={{ marginTop: 2 }} />
            <Text className="text-sm text-red-700 dark:text-red-400 flex-1">
              <Text className="font-semibold">Katalog {emptyCatalogs.map((c) => c.nama).join(", ")} belum punya lokasi aktif.</Text> Semua
              presensi GPS di katalog itu akan DITOLAK sampai minimal 1 lokasi diaktifkan.
            </Text>
          </View>
        </Card>
      )}

      {error ? <View className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3"><Text className="text-sm text-red-600 dark:text-red-400">{error}</Text></View> : null}

      {!showAddForm ? (
        <Button variant="outline" onPress={() => setShowAddForm(true)}><Plus size={16} color={colors.primary} />{"  "}Tambah Lokasi</Button>
      ) : (
        <Card padding="md">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-sm font-semibold text-foreground">Tambah Lokasi Baru</Text>
            <Pressable onPress={resetAddForm}><X size={16} color={colors.mutedForeground} /></Pressable>
          </View>
          <View className="gap-2.5">
            {catalogs.length > 1 && (
              <SimplePicker
                value={newCatalogId}
                onChange={setNewCatalogId}
                placeholder="Pilih katalog..."
                options={catalogs.map((c) => ({ value: String(c.id), label: c.nama }))}
              />
            )}
            <TextInput value={newNama} onChangeText={setNewNama} placeholder="Nama lokasi (mis. Gedung SD)" className="bg-input-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground" />
            <View className="flex-row gap-2.5">
              <TextInput value={newLat} onChangeText={setNewLat} placeholder="Latitude" keyboardType="numbers-and-punctuation" className="flex-1 bg-input-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground" />
              <TextInput value={newLng} onChangeText={setNewLng} placeholder="Longitude" keyboardType="numbers-and-punctuation" className="flex-1 bg-input-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground" />
            </View>
            <TextInput value={newRadius} onChangeText={setNewRadius} placeholder="Radius (meter)" keyboardType="number-pad" className="bg-input-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground" />
            {addError ? <Text className="text-xs text-red-500">{addError}</Text> : null}
            <Button onPress={handleAdd} loading={addSaving} fullWidth>{addSaving ? "Menyimpan..." : "Simpan Lokasi"}</Button>
          </View>
        </Card>
      )}

      {rows.length === 0 ? (
        <Text className="text-sm text-muted-foreground text-center py-8">Belum ada lokasi presensi.</Text>
      ) : (
        rows.map((row) => (
          <Card key={row.id} padding="md">
            <View className="flex-row items-start justify-between gap-2">
              <View className="flex-row items-start gap-2 flex-1">
                <MapPin size={16} color={colors.primary} style={{ marginTop: 2 }} />
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground">{row.nama}</Text>
                  <Text className="text-xs text-muted-foreground">{row.lat}, {row.lng} · radius {row.radius_meter}m</Text>
                  {row.catalog_nama ? <Text className="text-xs text-primary font-medium mt-0.5">Katalog {row.catalog_nama}</Text> : null}
                </View>
              </View>
              <Badge variant={row.is_active ? "success" : "muted"}>{row.is_active ? "Aktif" : "Nonaktif"}</Badge>
            </View>
            <View className="flex-row gap-2 mt-3">
              <Button size="sm" variant="outline" className="flex-1" disabled={busyId === row.id} onPress={() => handleToggleActive(row)}>
                <Power size={13} color={colors.primary} />{"  "}{row.is_active ? "Nonaktifkan" : "Aktifkan"}
              </Button>
              <Button size="sm" variant="destructive" className="flex-1" disabled={busyId === row.id} onPress={() => handleDelete(row)}>Hapus</Button>
            </View>
          </Card>
        ))
      )}
    </KeyboardAwareScrollView>
  );
}

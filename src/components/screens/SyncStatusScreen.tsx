import React, { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Alert, TextInput, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckCircle2, AlertTriangle, RefreshCw, UserPlus, Check, X, Ban } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { SimplePicker } from "../ui/SimplePicker";
import { api } from "../../services/api";
import { useThemeColors } from "../../context/ThemeContext";

const POLL_MS = 10000;
interface SourceStatus { lastSuccessAt: string | null; lastAttemptAt: string | null; failStreak: number; lastError: string | null; healthy: boolean; }
function formatTime(ts: string | null) { if (!ts) return "Belum pernah"; return new Date(ts).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" }); }

function SourceCard({ title, status }: { title: string; status: SourceStatus }) {
  return (
    <Card padding="lg">
      <View className="flex-row items-center gap-3 mb-3">
        {status.healthy ? <CheckCircle2 size={22} color="#22c55e" /> : <AlertTriangle size={22} color="#ef4444" />}
        <View>
          <Text className="font-semibold text-sm text-foreground">{title}</Text>
          <Text className={`text-xs ${status.healthy ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>{status.healthy ? "Sehat" : `Gagal ${status.failStreak}x berturut-turut`}</Text>
        </View>
      </View>
      <View className="gap-1">
        <Text className="text-xs text-muted-foreground">Terakhir berhasil: {formatTime(status.lastSuccessAt)}</Text>
        <Text className="text-xs text-muted-foreground">Percobaan terakhir: {formatTime(status.lastAttemptAt)}</Text>
        {status.lastError ? <Text className="text-xs text-red-500 mt-2">Pesan error terakhir: {status.lastError}</Text> : null}
      </View>
    </Card>
  );
}

// Unit Data Master (2026-09-14) - lihat catatan panjang di versi webview
// (src/app/components/screens/SyncStatusScreen.tsx), fungsinya sama persis.
// catalog (2026-09-15, diminta user - "unit ID nya lebih jelas, dari
// Katalog mana, dan namanya apa") - null kalau unit_id belum/tidak
// terpetakan ke katalog manapun (GET /hub-units sekarang JOIN
// unit_catalog_map, lihat routes/admin.js).
interface HubUnit { id: number; name: string; unit_id: number | null; status: "pending" | "active" | "deactivated"; created_at: string; catalog: { id: number; kode: string; nama: string } | null; }
interface Catalog { id: number; kode: string; nama: string; }
function formatTanggal(ts: string) { return new Date(ts).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }

function HubUnitsSection({ units, onChanged }: { units: HubUnit[]; onChanged: () => void }) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const pending = units.filter((u) => u.status === "pending");
  const aktif = units.filter((u) => u.status === "active");

  // Sistem Katalog (2026-09-14) - approve SEKARANG WAJIB sekalian tentukan
  // katalog mana yg dipetakan ke unit ini (menutup celah lama: unit baru
  // yang di-approve TIDAK PERNAH "didaftarkan" katalognya di mana pun,
  // env var terpisah diisi manual lewat SSH). approvingId = unit yg SEDANG
  // menampilkan panel pilih-katalog (bukan langsung Alert.alert spt reject/
  // deactivate, krn butuh 1 keputusan tambahan sebelum bisa lanjut).
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [pickCatalogId, setPickCatalogId] = useState<string>("");
  const [makingNewCatalog, setMakingNewCatalog] = useState(false);
  const [newCatalogKode, setNewCatalogKode] = useState("");
  const [newCatalogNama, setNewCatalogNama] = useState("");

  useEffect(() => {
    api.adminCatalogs().then((res) => { if (res.success) setCatalogs(res.data); });
  }, []);

  const jalankan = async (aksi: "reject" | "deactivate", unit: HubUnit, judul: string, pesan: string) => {
    Alert.alert(judul, pesan, [
      { text: "Batal", style: "cancel" },
      {
        text: aksi === "reject" ? "Tolak" : "Nonaktifkan",
        style: "destructive",
        onPress: async () => {
          setBusyId(unit.id);
          try {
            const fn = aksi === "reject" ? api.adminRejectHubUnit : api.adminDeactivateHubUnit;
            const res = await fn(unit.id);
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

  const bukaPanelApprove = (unit: HubUnit) => {
    setApprovingId(unit.id);
    setPickCatalogId(catalogs[0] ? String(catalogs[0].id) : "");
    setMakingNewCatalog(catalogs.length === 0);
    setNewCatalogKode("");
    setNewCatalogNama("");
  };

  const konfirmasiApprove = (unit: HubUnit) => {
    if (!unit.unit_id) {
      Alert.alert("Gagal", "Unit ini belum punya unit_id dari Hub API - hubungi developer.");
      return;
    }
    if (makingNewCatalog && (!newCatalogKode.trim() || !newCatalogNama.trim())) {
      Alert.alert("Gagal", "Kode dan nama katalog baru wajib diisi.");
      return;
    }
    if (!makingNewCatalog && !pickCatalogId) {
      Alert.alert("Gagal", "Pilih katalog dulu.");
      return;
    }
    const pesan = makingNewCatalog
      ? `Setujui unit "${unit.name}" sbg katalog baru "${newCatalogNama.trim()}"? Sinkronisasi akan mulai jalan otomatis.`
      : `Setujui unit "${unit.name}" masuk katalog "${catalogs.find((c) => String(c.id) === pickCatalogId)?.nama}"? Sinkronisasi akan mulai jalan otomatis.`;
    Alert.alert("Setujui Unit", pesan, [
      { text: "Batal", style: "cancel" },
      {
        text: "Setujui",
        onPress: async () => {
          setBusyId(unit.id);
          try {
            const res = await api.adminApproveHubUnit(unit.id, {
              unitId: unit.unit_id!,
              unitName: unit.name,
              ...(makingNewCatalog
                ? { newCatalogKode: newCatalogKode.trim(), newCatalogNama: newCatalogNama.trim() }
                : { catalogId: Number(pickCatalogId) }),
            });
            if (!res.success) Alert.alert("Gagal", res.message || "Gagal memproses.");
            else setApprovingId(null);
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

  return (
    <>
      {pending.length > 0 && (
        <Card padding="lg">
          <View className="flex-row items-center gap-2 mb-3">
            <UserPlus size={20} color="#f59e0b" />
            <Text className="font-semibold text-sm text-foreground">Permintaan Sambungan Baru ({pending.length})</Text>
          </View>
          <View className="gap-3">
            {pending.map((u) => (
              <View key={u.id} className="border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 rounded-xl p-3">
                <Text className="text-sm font-medium text-foreground">{u.name}</Text>
                <Text className="text-xs text-muted-foreground mb-2">Mendaftar: {formatTanggal(u.created_at)}</Text>

                {approvingId !== u.id ? (
                  <View className="flex-row gap-2">
                    <Button size="sm" variant="primary" disabled={busyId === u.id} onPress={() => bukaPanelApprove(u)}>
                      <Check size={14} color="#fff" /><Text className="text-primary-foreground text-sm font-semibold ml-1">Setujui</Text>
                    </Button>
                    <Button size="sm" variant="destructive" disabled={busyId === u.id} onPress={() => jalankan("reject", u, "Tolak Pendaftaran", `Tolak & hapus pendaftaran "${u.name}"? Tidak bisa dibatalkan.`)}>
                      <X size={14} color="#fff" /><Text className="text-destructive-foreground text-sm font-semibold ml-1">Tolak</Text>
                    </Button>
                  </View>
                ) : (
                  <View className="gap-2 bg-card rounded-lg p-2.5 border border-amber-300 dark:border-amber-700">
                    <Text className="text-xs font-medium text-foreground">Masuk katalog mana?</Text>
                    {!makingNewCatalog ? (
                      <>
                        <SimplePicker
                          value={pickCatalogId}
                          options={catalogs.map((c) => ({ value: String(c.id), label: c.nama }))}
                          onChange={setPickCatalogId}
                          placeholder="Pilih katalog..."
                        />
                        <Pressable onPress={() => setMakingNewCatalog(true)}>
                          <Text className="text-xs text-primary font-medium">+ Buat katalog baru</Text>
                        </Pressable>
                      </>
                    ) : (
                      <>
                        <View className="flex-row gap-2">
                          <TextInput
                            value={newCatalogKode}
                            onChangeText={setNewCatalogKode}
                            placeholder="Kode (mis. SMP)"
                            maxLength={20}
                            className="w-24 bg-input-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground"
                          />
                          <TextInput
                            value={newCatalogNama}
                            onChangeText={setNewCatalogNama}
                            placeholder="Nama (mis. SMP Al-Ikhlas 86)"
                            maxLength={100}
                            className="flex-1 bg-input-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground"
                          />
                        </View>
                        {catalogs.length > 0 && (
                          <Pressable onPress={() => setMakingNewCatalog(false)}>
                            <Text className="text-xs text-primary font-medium">Pilih katalog yang sudah ada saja</Text>
                          </Pressable>
                        )}
                      </>
                    )}
                    <View className="flex-row gap-2 mt-1">
                      <Button size="sm" variant="primary" disabled={busyId === u.id} loading={busyId === u.id} onPress={() => konfirmasiApprove(u)}>
                        Konfirmasi Setujui
                      </Button>
                      <Button size="sm" variant="outline" disabled={busyId === u.id} onPress={() => setApprovingId(null)}>
                        Batal
                      </Button>
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>
        </Card>
      )}

      <Card padding="lg">
        <Text className="font-semibold text-sm text-foreground mb-3">Unit Terhubung ({aktif.length})</Text>
        {aktif.length === 0 ? (
          <Text className="text-xs text-muted-foreground">Belum ada unit aktif.</Text>
        ) : (
          <View className="gap-2">
            {aktif.map((u) => (
              <View key={u.id} className="flex-row items-center justify-between gap-2 border-b border-border pb-2">
                <View className="flex-1">
                  <Text className="text-sm font-medium text-foreground">{u.name}</Text>
                  <Text className="text-xs text-muted-foreground">
                    Unit ID {u.unit_id}
                    {u.catalog ? ` · Katalog ${u.catalog.kode} (${u.catalog.nama})` : ""}
                  </Text>
                  {!u.catalog && <Text className="text-xs text-amber-600 dark:text-amber-400">Belum terpetakan ke katalog manapun</Text>}
                </View>
                <Button size="sm" variant="outline" disabled={busyId === u.id} onPress={() => jalankan("deactivate", u, "Nonaktifkan Unit", `Nonaktifkan unit "${u.name}"? Token lamanya tidak akan diterima lagi.`)}>
                  <Ban size={14} /><Text className="text-primary text-sm font-semibold ml-1">Nonaktifkan</Text>
                </Button>
              </View>
            ))}
          </View>
        )}
      </Card>
    </>
  );
}

export function SyncStatusScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [data, setData] = useState<{ hubApi: SourceStatus } | null>(null);
  const [units, setUnits] = useState<HubUnit[] | null>(null);
  const [error, setError] = useState("");
  const [lastCheck, setLastCheck] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const muatUnits = async () => {
    const res = await api.adminHubUnits();
    if (res.success && res.data) setUnits(res.data);
  };

  const poll = async () => {
    const res = await api.adminSyncStatus();
    if (!res.success || !res.data) { setError("Gagal memuat status sinkronisasi."); return; }
    setError(""); setData(res.data); setLastCheck(new Date().toLocaleTimeString("id-ID"));
  };

  useEffect(() => {
    poll();
    muatUnits();
    timerRef.current = setInterval(poll, POLL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  return (
    <ScrollView className="flex-1 bg-background px-4 pt-5" contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 16 }}>
      <Text className="text-xs text-muted-foreground">Kondisi sinkronisasi data terkini. "Sehat" berarti siklus terakhir berhasil. Setelah 3x gagal berturut-turut, alarm WA otomatis terkirim.</Text>
      {error ? (
        <Card padding="lg"><View className="items-center py-4"><AlertTriangle size={40} color="#ef4444" /><Text className="text-sm text-muted-foreground mt-2">{error}</Text></View></Card>
      ) : !data ? (
        <Card padding="lg"><View className="items-center py-4"><ActivityIndicator color={colors.primary} /><Text className="text-sm text-muted-foreground mt-2">Memuat...</Text></View></Card>
      ) : (
        <SourceCard title="Hub API (Data Master Siswa/Guru/Pegawai)" status={data.hubApi} />
      )}
      {units && <HubUnitsSection units={units} onChanged={muatUnits} />}
      {lastCheck ? (
        <View className="flex-row items-center justify-center gap-1"><RefreshCw size={12} color={colors.mutedForeground} /><Text className="text-xs text-muted-foreground">Terakhir dicek: {lastCheck}</Text></View>
      ) : null}
    </ScrollView>
  );
}

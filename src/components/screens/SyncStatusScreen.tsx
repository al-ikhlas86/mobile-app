import React, { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Alert, TextInput, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckCircle2, AlertTriangle, RefreshCw, UserPlus, Check, X, Ban, Database, Wallet, MonitorSmartphone, ShieldOff, ShieldCheck, Type } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { SimplePicker } from "../ui/SimplePicker";
import { api } from "../../services/api";
import { useThemeColors } from "../../context/ThemeContext";
import { KeuanganInstallationsSection, type KeuanganInstallation } from "./KeuanganInstallationsSection";
import { MasalahDataSection } from "./MasalahDataSection";
import { KioskPerangkatSection, type KioskDevice, type KioskMeta } from "./KioskPerangkatSection";

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
interface HubUnit { id: number; name: string; unit_id: number | null; status: "pending" | "active" | "deactivated" | "blocked"; punya_pengenal?: boolean; created_at: string; catalog: { id: number; kode: string; nama: string } | null; }
interface Catalog { id: number; kode: string; nama: string; }
function formatTanggal(ts: string) { return new Date(ts).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }

function HubUnitsSection({ units, onChanged }: { units: HubUnit[]; onChanged: () => void }) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const pending = units.filter((u) => u.status === "pending");
  const aktif = units.filter((u) => u.status === "active");
  const diblokir = units.filter((u) => u.status === "blocked");
  const colors = useThemeColors();

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

  // Blokir BEDA dari Tolak: unit tetap tersimpan, tokennya tidak berlaku, dan PC-nya (bila sudah mengirim pengenal, Data Master >= 1.8.4)
  // tidak bisa mendaftar lagi sampai blokir dibuka.
  const [renameId, setRenameId] = useState<number | null>(null);
  const [namaBaru, setNamaBaru] = useState("");
  const aksiBiasa = async (unit: HubUnit, panggil: () => Promise<{ success: boolean; message?: string }>) => {
    setBusyId(unit.id);
    try {
      const res = await panggil();
      if (!res.success) Alert.alert("Gagal", res.message || "Gagal memproses.");
      else { setRenameId(null); if (res.message) Alert.alert("Berhasil", res.message); }
      onChanged();
    } catch {
      Alert.alert("Gagal", "Gagal menghubungi server - cek koneksi internet.");
    } finally {
      setBusyId(null);
    }
  };
  const blokir = (unit: HubUnit) => {
    const catatan = unit.punya_pengenal ? "" : "\n\nCatatan: PC ini belum mengirim pengenal (versi lama), jadi blokir hanya berlaku pada tokennya sampai aplikasinya diperbarui.";
    Alert.alert("Blokir unit", `Blokir unit "${unit.name}"? Sinkronisasi berhenti dan PC ini tidak bisa mendaftar lagi sampai blokir dibuka. (Untuk sekadar menolak agar boleh mendaftar lagi, pakai Tolak.)${catatan}`, [
      { text: "Batal", style: "cancel" },
      { text: "Blokir", style: "destructive", onPress: () => void aksiBiasa(unit, () => api.adminBlockHubUnit(unit.id)) },
    ]);
  };
  const bukaBlokir = (unit: HubUnit) => Alert.alert("Buka blokir", `Buka blokir "${unit.name}"? Statusnya kembali menunggu persetujuan.`, [
    { text: "Batal", style: "cancel" },
    { text: "Buka blokir", onPress: () => void aksiBiasa(unit, () => api.adminUnblockHubUnit(unit.id)) },
  ]);
  const renderRename = (u: HubUnit) => (
    <View className="gap-2 mt-2">
      <TextInput value={namaBaru} onChangeText={setNamaBaru} maxLength={100} accessibilityLabel="Nama unit" className="bg-input-background border border-border rounded-lg px-2.5 py-2 text-sm text-foreground" placeholderTextColor={colors.mutedForeground} />
      <View className="flex-row gap-2">
        <Button size="sm" variant="primary" disabled={busyId === u.id || !namaBaru.trim()} onPress={() => void aksiBiasa(u, () => api.adminRenameHubUnit(u.id, namaBaru.trim()))}>Simpan nama</Button>
        <Button size="sm" variant="outline" onPress={() => setRenameId(null)}>Batal</Button>
      </View>
    </View>
  );
  const tombolNama = (u: HubUnit) => (
    <Button size="sm" variant="outline" disabled={busyId === u.id} onPress={() => { setRenameId(u.id); setNamaBaru(u.name); }}>
      <Type size={14} color={colors.primary} /><Text className="text-primary text-sm font-semibold ml-1">Ubah nama</Text>
    </Button>
  );
  const tombolBlokir = (u: HubUnit) => (
    <Button size="sm" variant="outline" disabled={busyId === u.id} onPress={() => blokir(u)}>
      <ShieldOff size={14} color={colors.primary} /><Text className="text-primary text-sm font-semibold ml-1">Blokir</Text>
    </Button>
  );

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
                    {tombolBlokir(u)}
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
              <View key={u.id} className="border-b border-border pb-2">
              <View className="flex-row items-center justify-between gap-2">
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
            <View className="flex-row gap-2 mt-2">{tombolNama(u)}{tombolBlokir(u)}</View>
            {renameId === u.id ? renderRename(u) : null}
              </View>
            ))}
          </View>
        )}
      </Card>

      {diblokir.length > 0 && (
        <Card padding="lg">
          <View className="flex-row items-center gap-2 mb-1">
            <ShieldOff size={18} color="#dc2626" />
            <Text className="font-semibold text-sm text-foreground">Diblokir ({diblokir.length})</Text>
          </View>
          <Text className="text-xs text-muted-foreground mb-3">Tidak bisa sinkron atau mendaftar lagi sampai blokir dibuka.</Text>
          <View className="gap-3">
            {diblokir.map((u) => (
              <View key={u.id} className="border-b border-border pb-3">
                <Text className="text-sm font-medium text-foreground">{u.name}</Text>
                <View className="flex-row flex-wrap gap-2 mt-2">
                  <Button size="sm" variant="primary" disabled={busyId === u.id} onPress={() => bukaBlokir(u)}>
                    <ShieldCheck size={14} color="#fff" /><Text className="text-primary-foreground text-sm font-semibold ml-1">Buka blokir</Text>
                  </Button>
                  {renameId !== u.id ? tombolNama(u) : null}
                </View>
                {renameId === u.id ? renderRename(u) : null}
              </View>
            ))}
          </View>
        </Card>
      )}
    </>
  );
}

export function SyncStatusScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [data, setData] = useState<{ hubApi: SourceStatus } | null>(null);
  const [units, setUnits] = useState<HubUnit[] | null>(null);
  const [keuangan, setKeuangan] = useState<KeuanganInstallation[] | null>(null);
  const [kiosk, setKiosk] = useState<KioskDevice[] | null>(null);
  const [kioskMeta, setKioskMeta] = useState<KioskMeta>({ tokenLamaAktif: false, tokenLamaAda: false, tokenLamaTerakhirDipakai: null });
  const [activeTab, setActiveTab] = useState<"datamaster" | "keuangan" | "absensi">("datamaster");
  const [error, setError] = useState("");
  const [lastCheck, setLastCheck] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const muatUnits = async () => {
    const res = await api.adminHubUnits();
    if (res.success && res.data) setUnits(res.data);
  };

  const muatKeuangan = async () => {
    const res = await api.adminKeuanganInstallations();
    if (res.success && res.data) setKeuangan(res.data);
  };

  const muatKiosk = async () => {
    const res = await api.adminKioskDevices();
    if (res.success && res.data) {
      setKiosk(res.data);
      setKioskMeta({ tokenLamaAktif: !!res.tokenLamaAktif, tokenLamaAda: !!res.tokenLamaAda, tokenLamaTerakhirDipakai: res.tokenLamaTerakhirDipakai ?? null });
    }
  };

  const poll = async () => {
    const res = await api.adminSyncStatus();
    if (!res.success || !res.data) { setError("Gagal memuat status sinkronisasi."); return; }
    setError(""); setData(res.data); setLastCheck(new Date().toLocaleTimeString("id-ID"));
  };

  // Permintaan izin Keuangan ikut disegarkan tiap siklus polling.
  const siklus = async () => {
    await poll();
    await muatKeuangan();
    await muatKiosk();
  };

  useEffect(() => {
    poll();
    muatUnits();
    muatKeuangan();
    muatKiosk();
    timerRef.current = setInterval(siklus, POLL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const pendingKeuangan = (keuangan ?? []).filter((i) => !i.is_approved && !i.approved_at && !i.is_blocked).length;
  const pendingAbsensi = (kiosk ?? []).filter((d) => !d.is_approved && !d.is_blocked).length;

  const tabBtn = (key: "datamaster" | "keuangan" | "absensi", label: string, icon: React.ReactNode, badge = 0) => (
    <Pressable
      onPress={() => setActiveTab(key)}
      className={`flex-1 min-w-0 px-1.5 py-2.5 rounded-lg flex-row items-center justify-center gap-1 ${activeTab === key ? "bg-card" : ""}`}
    >
      {icon}
      <Text numberOfLines={1} className={`text-xs font-medium ${activeTab === key ? "text-foreground" : "text-muted-foreground"}`}>{label}</Text>
      {badge > 0 ? (
        <View className="bg-amber-500 rounded-full min-w-[18px] h-[18px] px-1 items-center justify-center">
          <Text className="text-white text-[10px] font-semibold">{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );

  return (
    <ScrollView className="flex-1 bg-background px-4 pt-5" contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 16 }}>
      <View className="flex-row gap-2 p-1 bg-muted rounded-xl">
        {tabBtn("datamaster", "Data Master", <Database size={15} color={activeTab === "datamaster" ? colors.primary : colors.mutedForeground} />)}
        {tabBtn("keuangan", "Keuangan", <Wallet size={15} color={activeTab === "keuangan" ? colors.primary : colors.mutedForeground} />, pendingKeuangan)}
        {tabBtn("absensi", "Absensi", <MonitorSmartphone size={15} color={activeTab === "absensi" ? colors.primary : colors.mutedForeground} />, pendingAbsensi)}
      </View>

      {activeTab === "absensi" ? (
        kiosk ? (
          <KioskPerangkatSection devices={kiosk} meta={kioskMeta} onChanged={muatKiosk} />
        ) : (
          <Card padding="lg"><View className="items-center py-4"><ActivityIndicator color={colors.primary} /><Text className="text-sm text-muted-foreground mt-2">Memuat...</Text></View></Card>
        )
      ) : activeTab === "keuangan" ? (
        keuangan ? (
          <KeuanganInstallationsSection installations={keuangan} onChanged={muatKeuangan} />
        ) : (
          <Card padding="lg"><View className="items-center py-4"><ActivityIndicator color={colors.primary} /><Text className="text-sm text-muted-foreground mt-2">Memuat...</Text></View></Card>
        )
      ) : (
      <>
      <Text className="text-xs text-muted-foreground">Kondisi sinkronisasi data terkini. "Sehat" berarti siklus terakhir berhasil. Setelah 3x gagal berturut-turut, alarm WA otomatis terkirim.</Text>
      {error ? (
        <Card padding="lg"><View className="items-center py-4"><AlertTriangle size={40} color="#ef4444" /><Text className="text-sm text-muted-foreground mt-2">{error}</Text></View></Card>
      ) : !data ? (
        <Card padding="lg"><View className="items-center py-4"><ActivityIndicator color={colors.primary} /><Text className="text-sm text-muted-foreground mt-2">Memuat...</Text></View></Card>
      ) : (
        <SourceCard title="Hub API (Data Master Siswa/Guru/Pegawai)" status={data.hubApi} />
      )}
      {units && <HubUnitsSection units={units} onChanged={muatUnits} />}
      <MasalahDataSection />
      </>
      )}
      {lastCheck ? (
        <View className="flex-row items-center justify-center gap-1"><RefreshCw size={12} color={colors.mutedForeground} /><Text className="text-xs text-muted-foreground">Terakhir dicek: {lastCheck}</Text></View>
      ) : null}
    </ScrollView>
  );
}

// ============================================================
// TITIK SCAN (admin) - kelola QR pintu kelas (KLS) dan checkpoint (CHK), lihat QR, rekap scan. Port dari webview TitikScanScreen.tsx
// (jaga keduanya sejajar). Admin IT semua katalog; Admin TU / Kepala Sekolah katalog sendiri (divalidasi server, routes/scan.js).
// Cetak QR dilakukan dari webview (web); di HP QR bisa ditampilkan lalu dibagikan lewat tangkapan layar.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, Image, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import * as Location from "expo-location";
import { Plus, X, MapPin, QrCode, RefreshCw, Power, Trash2, School } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { SimplePicker } from "../ui/SimplePicker";
import { useThemeColors } from "../../context/ThemeContext";
import { api } from "../../services/api";

interface Titik { id: number; tipe: "KLS" | "CHK"; nama: string; catalog_id: number; catalog_nama: string; kelas_nama: string | null; lat: number | null; lng: number | null; radius_meter: number; versi: number; is_active: 0 | 1 }
interface Katalog { id: number; kode: string; nama: string }
interface Kelas { id: number; nama: string; tingkat: string | null; catalog_id: number }
interface BarisRekap { id: number; scanned_at: string; sesuai_jadwal: number | null; jarak_meter: number | null; tipe: string; titik: string; pegawai: string | null }

const hariIni = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10); // WIB
const input = "bg-input-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground";

export function TitikScanScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [tab, setTab] = useState<"titik" | "rekap">("titik");
  const [titik, setTitik] = useState<Titik[]>([]);
  const [katalog, setKatalog] = useState<Katalog[]>([]);
  const [kelas, setKelas] = useState<Kelas[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [form, setForm] = useState(false);
  const [tipe, setTipe] = useState<"KLS" | "CHK">("KLS");
  const [nama, setNama] = useState("");
  const [katalogId, setKatalogId] = useState("");
  const [kelasId, setKelasId] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [radius, setRadius] = useState("50");
  const [menyimpan, setMenyimpan] = useState(false);
  const [galatForm, setGalatForm] = useState("");
  const [qr, setQr] = useState<{ nama: string; tipe: string; dataUrl: string } | null>(null);
  const [tanggal, setTanggal] = useState(hariIni());
  const [rekap, setRekap] = useState<BarisRekap[] | null>(null);

  const muat = useCallback(async () => {
    setMemuat(true);
    const r = await api.scanAdminTitik();
    setMemuat(false);
    if (!r.success) { setGalat(r.message ?? "Gagal memuat titik scan."); return; }
    setGalat("");
    setTitik(r.data as Titik[]);
    setKatalog(r.catalogs as Katalog[]);
    setKelas(r.kelas as Kelas[]);
    setKatalogId((k) => k || String((r.catalogs as Katalog[])[0]?.id ?? ""));
  }, []);
  useEffect(() => { void muat(); }, [muat]);

  const muatRekap = useCallback(async () => {
    setRekap(null);
    const r = await api.scanAdminRekap(tanggal);
    setRekap(r.success ? (r.data as BarisRekap[]) : []);
    if (!r.success) setGalat(r.message ?? "Gagal memuat rekap.");
  }, [tanggal]);
  useEffect(() => { if (tab === "rekap") void muatRekap(); }, [tab, muatRekap]);

  const kelasKatalog = kelas.filter((k) => String(k.catalog_id) === katalogId);
  const reset = () => { setForm(false); setNama(""); setKelasId(""); setLat(""); setLng(""); setRadius("50"); setGalatForm(""); };

  const simpan = async () => {
    setGalatForm("");
    if (!nama.trim() || !katalogId) { setGalatForm("Nama dan katalog wajib diisi."); return; }
    const data: Record<string, unknown> = { tipe, nama: nama.trim(), catalog_id: Number(katalogId) };
    if (tipe === "KLS") {
      if (!kelasId) { setGalatForm("Pilih kelasnya."); return; }
      data.kelas_id = Number(kelasId);
    } else {
      const la = Number(lat.replace(",", ".")); const ln = Number(lng.replace(",", ".")); const rd = Number(radius);
      if (!lat.trim() || !lng.trim() || !Number.isFinite(la) || !Number.isFinite(ln)) { setGalatForm("Isi koordinat (atau tekan Pakai lokasi saya)."); return; }
      data.lat = la; data.lng = ln; data.radius_meter = Number.isInteger(rd) ? rd : 50;
    }
    setMenyimpan(true);
    const r = await api.scanAdminBuat(data);
    setMenyimpan(false);
    if (!r.success) { setGalatForm(r.message ?? "Gagal menyimpan."); return; }
    reset();
    void muat();
  };

  const pakaiLokasi = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") { setGalatForm("Izin lokasi ditolak. Aktifkan di Pengaturan HP atau isi manual."); return; }
    try {
      const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLat(p.coords.latitude.toFixed(7)); setLng(p.coords.longitude.toFixed(7)); setGalatForm("");
    } catch { setGalatForm("Lokasi tidak didapat. Coba di area terbuka atau isi manual."); }
  };

  const lihatQr = async (t: Titik) => {
    const r = await api.scanAdminQr(t.id);
    if (r.success) setQr({ nama: r.data.nama, tipe: r.data.tipe, dataUrl: r.data.dataUrl });
    else setGalat(r.message ?? "Gagal membuat QR.");
  };
  const tanya = (judul: string, pesan: string, aksi: () => void, destruktif = false) =>
    Alert.alert(judul, pesan, [{ text: "Batal", style: "cancel" }, { text: "Ya", style: destruktif ? "destructive" : "default", onPress: aksi }]);
  const ubah = async (t: Titik, data: Record<string, unknown>) => {
    const r = await api.scanAdminUbah(t.id, data);
    if (!r.success) setGalat(r.message ?? "Gagal mengubah.");
    void muat();
  };
  const hapus = (t: Titik) => tanya("Hapus titik?", `"${t.nama}" beserta riwayat scannya akan dihapus. Tidak bisa dibatalkan.`, async () => {
    const r = await api.scanAdminHapus(t.id);
    if (!r.success) setGalat(r.message ?? "Gagal menghapus.");
    void muat();
  }, true);
  const buatUlang = (t: Titik) => tanya("Buat QR baru?", `QR lama "${t.nama}" yang sudah ditempel langsung tidak berlaku. Cetak dan tempel yang baru.`, async () => {
    const r = await api.scanAdminBuatUlang(t.id);
    if (!r.success) setGalat(r.message ?? "Gagal membuat QR baru.");
    void muat();
  });

  if (memuat && titik.length === 0 && !galat) return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator color={colors.primary} /></View>;

  return (
    <>
      <KeyboardAwareScrollView className="flex-1 bg-background px-4 pt-5" contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 16 }} bottomOffset={20}>
        <Text className="text-xs text-muted-foreground">
          QR kelas (KLS) ditempel di pintu kelas untuk presensi mengajar guru. QR checkpoint (CHK) untuk shift malam atau rombongan dan hanya sah di dalam radiusnya.
          Setiap QR bertanda tangan; &quot;QR baru&quot; mematikan kode lama.
        </Text>

        <View className="flex-row rounded-xl bg-muted self-start" style={{ padding: 4 }}>
          {(["titik", "rekap"] as const).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} className={`px-4 py-1.5 rounded-lg ${tab === t ? "bg-card" : ""}`}>
              <Text className={`text-sm font-medium ${tab === t ? "text-foreground" : "text-muted-foreground"}`}>{t === "titik" ? "Titik" : "Rekap"}</Text>
            </Pressable>
          ))}
        </View>

        {galat ? <View className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3"><Text className="text-sm text-red-600 dark:text-red-400">{galat}</Text></View> : null}

        {tab === "titik" && (
          <>
            {!form ? (
              <Button variant="outline" onPress={() => setForm(true)}><Plus size={16} color={colors.primary} />{"  "}Tambah Titik</Button>
            ) : (
              <Card padding="md">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-sm font-semibold text-foreground">Titik Baru</Text>
                  <Pressable onPress={reset} accessibilityLabel="Tutup formulir"><X size={16} color={colors.mutedForeground} /></Pressable>
                </View>
                <View className="gap-2.5">
                  <View className="flex-row gap-2">
                    {(["KLS", "CHK"] as const).map((x) => (
                      <Pressable key={x} onPress={() => setTipe(x)} className={`flex-1 rounded-xl px-3 py-2 items-center ${tipe === x ? "bg-primary" : "bg-muted"}`}>
                        <Text className={`text-sm ${tipe === x ? "text-primary-foreground" : "text-foreground"}`}>{x === "KLS" ? "Kelas (KLS)" : "Checkpoint (CHK)"}</Text>
                      </Pressable>
                    ))}
                  </View>
                  {katalog.length > 1 && (
                    <SimplePicker value={katalogId} onChange={(v) => { setKatalogId(v); setKelasId(""); }} placeholder="Pilih katalog..." options={katalog.map((k) => ({ value: String(k.id), label: k.nama }))} />
                  )}
                  <TextInput value={nama} onChangeText={setNama} placeholder={tipe === "KLS" ? "Nama titik (mis. Kelas 1A)" : "Nama titik (mis. Pos Gerbang Belakang)"} className={input} placeholderTextColor={colors.mutedForeground} />
                  {tipe === "KLS" ? (
                    <SimplePicker value={kelasId} onChange={setKelasId} placeholder="Pilih kelas..." options={kelasKatalog.map((k) => ({ value: String(k.id), label: k.nama }))} />
                  ) : (
                    <>
                      <View className="flex-row gap-2.5">
                        <TextInput value={lat} onChangeText={setLat} placeholder="Latitude" keyboardType="numbers-and-punctuation" className={`flex-1 ${input}`} placeholderTextColor={colors.mutedForeground} />
                        <TextInput value={lng} onChangeText={setLng} placeholder="Longitude" keyboardType="numbers-and-punctuation" className={`flex-1 ${input}`} placeholderTextColor={colors.mutedForeground} />
                      </View>
                      <TextInput value={radius} onChangeText={setRadius} placeholder="Radius (meter, 10 sampai 500)" keyboardType="number-pad" className={input} placeholderTextColor={colors.mutedForeground} />
                      <Button variant="outline" onPress={pakaiLokasi}><MapPin size={15} color={colors.primary} />{"  "}Pakai lokasi saya</Button>
                    </>
                  )}
                  {galatForm ? <Text className="text-xs text-red-500">{galatForm}</Text> : null}
                  <Button onPress={simpan} loading={menyimpan} fullWidth>{menyimpan ? "Menyimpan..." : "Simpan Titik"}</Button>
                </View>
              </Card>
            )}

            {titik.length === 0 ? <Text className="text-sm text-muted-foreground text-center py-6">Belum ada titik scan.</Text> : titik.map((t) => (
              <Card key={t.id} padding="md">
                <View className="flex-row items-start justify-between" style={{ gap: 8 }}>
                  <View className="flex-row items-start flex-1" style={{ gap: 8 }}>
                    {t.tipe === "KLS" ? <School size={16} color={colors.primary} style={{ marginTop: 2 }} /> : <MapPin size={16} color={colors.primary} style={{ marginTop: 2 }} />}
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-foreground">{t.nama}</Text>
                      <Text className="text-xs text-muted-foreground">{t.tipe === "KLS" ? `Kelas ${t.kelas_nama ?? "-"}` : `${t.lat}, ${t.lng} · radius ${t.radius_meter} m`} · QR v{t.versi}</Text>
                      <Text className="text-xs font-medium mt-0.5" style={{ color: colors.primary }}>Katalog {t.catalog_nama}</Text>
                    </View>
                  </View>
                  <Badge variant={t.is_active ? "success" : "muted"}>{t.is_active ? "Aktif" : "Nonaktif"}</Badge>
                </View>
                <View className="flex-row flex-wrap mt-3" style={{ gap: 8 }}>
                  <Button variant="outline" size="sm" onPress={() => lihatQr(t)}><QrCode size={14} color={colors.primary} />{"  "}Lihat QR</Button>
                  <Button variant="outline" size="sm" onPress={() => buatUlang(t)}><RefreshCw size={14} color={colors.primary} />{"  "}QR baru</Button>
                  <Button variant="outline" size="sm" onPress={() => ubah(t, { is_active: !t.is_active })}><Power size={14} color={colors.primary} />{"  "}{t.is_active ? "Nonaktifkan" : "Aktifkan"}</Button>
                  <Button variant="outline" size="sm" onPress={() => hapus(t)}><Trash2 size={14} color="#dc2626" />{"  "}Hapus</Button>
                </View>
              </Card>
            ))}
          </>
        )}

        {tab === "rekap" && (
          <>
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <TextInput value={tanggal} onChangeText={setTanggal} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" className={`flex-1 ${input}`} placeholderTextColor={colors.mutedForeground} />
              <Button variant="outline" onPress={muatRekap}>Muat</Button>
            </View>
            {rekap === null ? <ActivityIndicator color={colors.primary} /> : rekap.length === 0 ? (
              <Text className="text-sm text-muted-foreground text-center py-6">Tidak ada scan pada tanggal ini.</Text>
            ) : (
              <Card padding="md">
                {rekap.map((b) => (
                  <View key={b.id} className="flex-row justify-between py-2" style={{ gap: 8 }}>
                    <Text className="flex-1 text-sm text-foreground"><Text className="font-medium">{b.pegawai ?? "-"}</Text> · {b.titik}{b.tipe === "KLS" && b.sesuai_jadwal === 0 ? " (di luar jadwal)" : ""}{b.jarak_meter !== null ? ` · ${b.jarak_meter} m` : ""}</Text>
                    <Text className="text-sm text-muted-foreground">{String(b.scanned_at).replace("T", " ").slice(11, 16)}</Text>
                  </View>
                ))}
              </Card>
            )}
          </>
        )}
      </KeyboardAwareScrollView>

      <Modal visible={qr !== null} transparent animationType="fade" onRequestClose={() => setQr(null)}>
        <Pressable onPress={() => setQr(null)} className="flex-1 items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.6)", padding: 16 }}>
          <Pressable className="bg-card rounded-2xl items-center" style={{ padding: 20, width: "100%", maxWidth: 320 }}>
            <Text className="font-semibold text-foreground mb-1">{qr?.nama}</Text>
            <Text className="text-xs text-muted-foreground mb-3">{qr?.tipe === "KLS" ? "Tempel di pintu kelas" : "Tempel di titik checkpoint"}</Text>
            {qr ? <Image source={{ uri: qr.dataUrl }} style={{ width: 240, height: 240, backgroundColor: "#fff", borderRadius: 12 }} /> : null}
            <View style={{ marginTop: 16, width: "100%" }}><Button fullWidth onPress={() => setQr(null)}>Tutup</Button></View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

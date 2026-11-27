// ============================================================
// SCAN - satu kamera, hasil bergantung isi QR (tombol tengah di bottom bar). Port dari webview ScanScreen.tsx (jaga keduanya sejajar).
//   KLS-... = presensi mengajar guru   CHK-... = checkpoint (wajib dalam radius)
//   "Wajah Siswa" (khusus guru) = cadangan presensi siswa, wajib GPS di area sekolah
// Keputusan sah/tidak ada di server (routes/scan.js). Kamera hanya aktif selagi tab Scan terlihat (useIsFocused).
// ============================================================
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Vibration } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import * as Location from "expo-location";
import { useIsFocused } from "@react-navigation/native";
import { CheckCircle2, AlertCircle, MapPin, ScanFace, QrCode } from "lucide-react-native";
import { Card } from "../ui/Card";
import { api, type ScanLokasi } from "../../services/api";
import { getActiveSession } from "../../services/authService";
import { useThemeColors } from "../../context/ThemeContext";

type Mode = "qr" | "wajah";
interface Hasil { ok: boolean; teks: string; sejak: number }
interface Riwayat { id: number; scanned_at: string; tipe: string; titik: string; sesuai_jadwal: number | null }

const POLA_TITIK = /^(KLS|CHK)-\d{1,9}-\d{1,5}-[0-9a-f]{12}$/;
const JEDA_WAJAH_MS = 1800; // takePictureAsync lebih berat dari snapshot web
const JEDA_QR_SAMA_MS = 6000;

export function ScanScreen() {
  const colors = useThemeColors();
  const fokus = useIsFocused();
  const bisaWajah = getActiveSession()?.role === "Guru";
  const [izin, mintaIzin] = useCameraPermissions();
  const [mode, setMode] = useState<Mode>("qr");
  const [jenisWajah, setJenisWajah] = useState<"masuk" | "pulang">("masuk");
  const [lokasi, setLokasi] = useState<ScanLokasi | null>(null);
  const [galatLokasi, setGalatLokasi] = useState("");
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [riwayat, setRiwayat] = useState<Riwayat[]>([]);
  const [dikenali, setDikenali] = useState<{ nama: string; jam: string }[]>([]);

  const kameraRef = useRef<CameraView>(null);
  const lokasiRef = useRef<ScanLokasi | null>(null);
  const sibukRef = useRef(false);
  const terakhirRef = useRef<{ payload: string; at: number }>({ payload: "", at: 0 });
  lokasiRef.current = lokasi;

  useEffect(() => { if (!izin?.granted && izin?.canAskAgain !== false) void mintaIzin(); }, [izin, mintaIzin]);

  // ---- GPS selagi tab terlihat ----
  useEffect(() => {
    if (!fokus) return;
    let langganan: Location.LocationSubscription | null = null;
    let batal = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (batal) return;
      if (status !== "granted") { setGalatLokasi("Izin lokasi ditolak. Aktifkan lokasi untuk aplikasi ini di Pengaturan HP."); return; }
      langganan = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 0 }, (p) => {
        setGalatLokasi("");
        setLokasi({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy ?? undefined, location_timestamp: p.timestamp, is_mocked: p.mocked === true });
      });
      if (batal) langganan.remove();
    })().catch(() => setGalatLokasi("Lokasi belum didapat, tunggu atau pindah ke area terbuka."));
    return () => { batal = true; langganan?.remove(); };
  }, [fokus]);

  const muatRiwayat = useCallback(async () => {
    const r = await api.scanRiwayat();
    if (r.success && Array.isArray(r.data)) setRiwayat((r.data as Riwayat[]).slice(0, 6));
  }, []);
  useEffect(() => { if (fokus) void muatRiwayat(); }, [fokus, muatRiwayat]);

  const tampilkan = useCallback((ok: boolean, teks: string) => {
    setHasil({ ok, teks, sejak: Date.now() });
    Vibration.vibrate(ok ? 60 : [0, 40, 60, 40]);
  }, []);

  // ---- QR ----
  const saatQr = useCallback(async ({ data }: { data: string }) => {
    if (mode !== "qr" || sibukRef.current) return;
    const payload = (data ?? "").trim();
    const t = terakhirRef.current;
    if (payload === t.payload && Date.now() - t.at < JEDA_QR_SAMA_MS) return;
    terakhirRef.current = { payload, at: Date.now() };
    if (!POLA_TITIK.test(payload)) { tampilkan(false, "Kode QR ini bukan titik scan Al-Ikhlas 86."); return; }
    const lok = lokasiRef.current;
    if (!lok) { tampilkan(false, galatLokasi || "Lokasi belum didapat. Tunggu sebentar lalu arahkan lagi."); terakhirRef.current = { payload: "", at: 0 }; return; }
    sibukRef.current = true; setSibuk(true);
    try {
      const res = await api.scanTitik(payload, lok);
      tampilkan(Boolean(res.success), res.message ?? (res.success ? "Tercatat." : "Gagal mencatat."));
      if (res.success) void muatRiwayat();
      else terakhirRef.current = { payload: "", at: 0 };
    } finally { sibukRef.current = false; setSibuk(false); }
  }, [mode, galatLokasi, tampilkan, muatRiwayat]);

  // ---- Wajah Siswa ----
  useEffect(() => {
    if (!fokus || mode !== "wajah" || !izin?.granted) return;
    const timer = setInterval(async () => {
      if (sibukRef.current || !kameraRef.current) return;
      const lok = lokasiRef.current;
      if (!lok) { setHasil({ ok: false, teks: galatLokasi || "Menunggu lokasi GPS...", sejak: Date.now() }); return; }
      sibukRef.current = true; setSibuk(true);
      try {
        const foto = await kameraRef.current.takePictureAsync({ skipProcessing: true, shutterSound: false });
        if (!foto?.uri) return;
        const kecil = await ImageManipulator.manipulateAsync(foto.uri, [{ resize: { width: 800 } }], { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true });
        if (!kecil.base64) return;
        const res = await api.scanWajahSiswa(`data:image/jpeg;base64,${kecil.base64}`, jenisWajah, lok);
        const nama = (res as { person_name?: string }).person_name ?? (res.data as { person_name?: string } | undefined)?.person_name;
        if (res.success) {
          tampilkan(true, res.message ?? `${nama ?? "Siswa"} tercatat ${jenisWajah}.`);
          if (nama) setDikenali((d) => [{ nama, jam: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) }, ...d].slice(0, 6));
        } else if (/tidak dikenal|belum terdaftar|belum enroll/i.test(res.message ?? "")) {
          setHasil({ ok: false, teks: "Arahkan wajah siswa ke kamera depan...", sejak: Date.now() });
        } else {
          tampilkan(false, res.message ?? "Gagal memproses wajah.");
        }
      } catch { /* kamera sibuk: coba lagi di putaran berikut */ } finally { sibukRef.current = false; setSibuk(false); }
    }, JEDA_WAJAH_MS);
    return () => clearInterval(timer);
  }, [fokus, mode, izin?.granted, jenisWajah, galatLokasi, tampilkan]);

  useEffect(() => {
    if (!hasil) return;
    const t = setTimeout(() => setHasil((h) => (h && h.sejak === hasil.sejak ? null : h)), 5000);
    return () => clearTimeout(t);
  }, [hasil]);

  const akurasi = lokasi?.accuracy !== undefined ? Math.round(lokasi.accuracy) : null;

  return (
    <View className="flex-1 bg-background" style={{ paddingHorizontal: 16, paddingTop: 12, gap: 12 }}>
      {bisaWajah && (
        <View className="flex-row rounded-xl bg-muted" style={{ padding: 4 }}>
          <Pressable onPress={() => setMode("qr")} className={`flex-1 flex-row items-center justify-center rounded-lg py-2 ${mode === "qr" ? "bg-card" : ""}`} style={{ gap: 6 }}>
            <QrCode size={16} color={mode === "qr" ? colors.foreground : colors.mutedForeground} />
            <Text className={`text-sm font-medium ${mode === "qr" ? "text-foreground" : "text-muted-foreground"}`}>Scan QR</Text>
          </Pressable>
          <Pressable onPress={() => setMode("wajah")} className={`flex-1 flex-row items-center justify-center rounded-lg py-2 ${mode === "wajah" ? "bg-card" : ""}`} style={{ gap: 6 }}>
            <ScanFace size={16} color={mode === "wajah" ? colors.foreground : colors.mutedForeground} />
            <Text className={`text-sm font-medium ${mode === "wajah" ? "text-foreground" : "text-muted-foreground"}`}>Wajah Siswa</Text>
          </Pressable>
        </View>
      )}

      <View className="w-full self-center rounded-3xl overflow-hidden bg-black" style={{ maxWidth: 384, aspectRatio: 3 / 4 }}>
        {fokus && izin?.granted ? (
          <CameraView
            key={mode}
            ref={kameraRef}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            facing={mode === "qr" ? "back" : "front"}
            animateShutter={false}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={mode === "qr" ? saatQr : undefined}
          />
        ) : null}
        <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
          <View style={{ width: mode === "qr" ? 224 : 240, height: mode === "qr" ? 224 : 240, borderRadius: mode === "qr" ? 24 : 120, borderWidth: 4, borderColor: "rgba(255,255,255,0.8)" }} />
        </View>
        {(sibuk || !izin?.granted) && (
          <View className="absolute inset-0 items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.3)", gap: 8 }}>
            {izin?.granted === false ? <Text className="text-sm text-center px-6" style={{ color: "#fff" }}>Izin kamera diperlukan untuk Scan. Aktifkan di Pengaturan HP.</Text> : <ActivityIndicator size="large" color="#ffffff" />}
          </View>
        )}
      </View>

      <View className="w-full self-center" style={{ maxWidth: 384, gap: 8 }}>
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <MapPin size={14} color={lokasi ? colors.mutedForeground : "#d97706"} />
          <Text className={`text-xs ${lokasi ? "text-muted-foreground" : ""}`} style={lokasi ? undefined : { color: "#d97706" }}>
            {lokasi ? `Lokasi didapat${akurasi !== null ? ` (±${akurasi} m)` : ""}` : galatLokasi || "Mencari lokasi..."}
          </Text>
        </View>

        {mode === "wajah" && (
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <Text className="text-sm text-muted-foreground">Catat sebagai</Text>
            {(["masuk", "pulang"] as const).map((j) => (
              <Pressable key={j} onPress={() => setJenisWajah(j)} className={`px-3 py-1 rounded-full ${jenisWajah === j ? "bg-primary" : "bg-muted"}`}>
                <Text className={`text-sm ${jenisWajah === j ? "text-primary-foreground" : "text-foreground"}`}>{j === "masuk" ? "Masuk" : "Pulang"}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={{ minHeight: 52 }}>
          {hasil ? (
            <View className={`flex-row items-start rounded-xl px-3 py-2.5 ${hasil.ok ? "bg-green-100 dark:bg-green-900/30" : "bg-amber-100 dark:bg-amber-900/30"}`} style={{ gap: 8 }}>
              {hasil.ok ? <CheckCircle2 size={18} color="#16a34a" /> : <AlertCircle size={18} color="#d97706" />}
              <Text className={`flex-1 text-sm font-medium ${hasil.ok ? "text-green-800 dark:text-green-300" : "text-amber-800 dark:text-amber-300"}`}>{hasil.teks}</Text>
            </View>
          ) : (
            <Text className="text-sm text-muted-foreground text-center" style={{ paddingTop: 8 }}>{mode === "qr" ? "Arahkan kamera ke QR kelas atau checkpoint." : "Arahkan wajah siswa ke kamera depan."}</Text>
          )}
        </View>

        {mode === "wajah" && dikenali.length > 0 && (
          <Card padding="md">
            <Text className="text-xs font-semibold text-muted-foreground mb-1">Tercatat barusan</Text>
            {dikenali.map((d, i) => (
              <View key={i} className="flex-row justify-between"><Text className="text-sm text-foreground">{d.nama}</Text><Text className="text-sm text-muted-foreground">{d.jam}</Text></View>
            ))}
          </Card>
        )}

        {mode === "qr" && riwayat.length > 0 && (
          <Card padding="md">
            <Text className="text-xs font-semibold text-muted-foreground mb-1">Riwayat scan saya</Text>
            {riwayat.map((r) => (
              <View key={r.id} className="flex-row justify-between" style={{ gap: 8 }}>
                <Text numberOfLines={1} className="flex-1 text-sm text-foreground">{r.titik}{r.tipe === "KLS" && r.sesuai_jadwal === 0 ? " (di luar jadwal)" : ""}</Text>
                <Text className="text-sm text-muted-foreground">{String(r.scanned_at).replace("T", " ").slice(5, 16)}</Text>
              </View>
            ))}
          </Card>
        )}
      </View>
    </View>
  );
}

// ============================================================
// PENGENALAN WAJAH - Daftarkan wajah lewat kamera. Gaya CINCIN (2026-11-27, port dari webview FaceEnrollmentScreen.tsx - JAGA KEDUANYA
// TETAP SEJAJAR): tidak ada lagi geser kepala kiri/kanan. Pengguna cukup menaruh wajah di dalam lingkaran; cincin tanda-tanda terisi
// hijau seiring tiga foto depan (front_1..front_3) tersimpan otomatis. Semua muat satu layar tanpa scroll.
//   1. MENU    - status terdaftar/belum + tombol "Mulai"/"Lanjutkan" atau "Daftar Ulang"
//   2. PINDAI  - lingkaran + cincin progres + petunjuk satu kalimat
//   3. BERHASIL - layar sukses
//
// Aturan KUALITAS sama dgn server/kiosk/web: |yaw| <= 12, lebar wajah >= 120 px, ketajaman >= 30. Letak/ukuran terhadap lingkaran memakai
// cx, cy, w dari /analyze. Petunjuk arah geser horizontal sengaja netral ("Pusatkan wajah"): arah cermin hasil foto kamera depan
// bergantung perangkat dan belum diuji di HP nyata.
// ============================================================
import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, ActivityIndicator, Animated, Vibration, Pressable } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import Svg, { Defs, Mask, Rect, Circle as SvgCircle, Line } from "react-native-svg";
import { CheckCircle2, Camera, AlertCircle, ScanFace, X } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { ChildSwitcher, type ChildOption } from "../ChildSwitcher";
import { api } from "../../services/api";
import { pilihAnak, useAnakTerpilih } from "../../services/anakTerpilihService";
import { useThemeColors } from "../../context/ThemeContext";

interface Props {
  onNavigate: (screen: string, params?: Record<string, unknown>) => void;
  target?: "self" | "child";
}

const TOTAL_FOTO = 3;
const ANALYZE_INTERVAL_MS = 600; // lebih longgar dari web (300ms): takePictureAsync jauh lebih berat drpd snapshot canvas
const COOLDOWN_MS = 900;
const HOLD_MS = 700;
const YAW_MAKS = 12;
const UKURAN_MIN_PX = 120;
const BLUR_MIN = 30;
const PUSAT_X_TOL = 0.13;
const PUSAT_Y_TARGET = 0.46;
const PUSAT_Y_TOL = 0.15;
const LEBAR_MIN = 0.2;
const LEBAR_MAKS = 0.52;
const TIK = 60;

type StatusKind = "idle" | "warn" | "ok" | "busy" | "error";
interface StatusInfo { kind: StatusKind; text: string }

const WARNA: Record<StatusKind, string> = {
  idle: "rgba(255,255,255,0.55)",
  warn: "#f59e0b",
  ok: "#22c55e",
  busy: "#22c55e",
  error: "#ef4444",
};

const CHIP: Record<StatusKind, { box: string; txt: string }> = {
  idle: { box: "bg-muted", txt: "text-muted-foreground" },
  warn: { box: "bg-amber-100 dark:bg-amber-900/30", txt: "text-amber-700 dark:text-amber-300" },
  ok: { box: "bg-green-100 dark:bg-green-900/30", txt: "text-green-700 dark:text-green-300" },
  busy: { box: "bg-green-100 dark:bg-green-900/30", txt: "text-green-700 dark:text-green-300" },
  error: { box: "bg-red-100 dark:bg-red-900/30", txt: "text-red-700 dark:text-red-300" },
};

export function FaceEnrollmentScreen({ onNavigate: _onNavigate, target = "self" }: Props) {
  const colors = useThemeColors();
  const isChild = target === "child";
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const [terkumpul, setTerkumpul] = useState(0); // foto depan tersimpan (0..TOTAL_FOTO)
  const [cameraActive, setCameraActive] = useState(false);
  // `starting` = tombol sudah ditekan tapi kamera belum aktif (izin kamera dsb): layar pindai langsung tampil, tanpa berkedip ke menu lama.
  const [starting, setStarting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [status, setStatus] = useState<StatusInfo>({ kind: "idle", text: "Posisikan wajah di dalam lingkaran" });
  const [isiHold, setIsiHold] = useState(0);
  const [ukuranKamera, setUkuranKamera] = useState({ w: 0, h: 0 });
  const [children, setChildren] = useState<ChildOption[]>([]);
  const [activeChildId, setActiveChildId] = useState<number | null>(null);

  const cameraRef = useRef<CameraView>(null);
  const busyRef = useRef(false);
  const conditionMetSinceRef = useRef(0);
  const lastCaptureTimeRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const terkumpulRef = useRef(0);
  terkumpulRef.current = terkumpul;

  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (showSuccess) {
      pop.setValue(0);
      Animated.spring(pop, { toValue: 1, friction: 5, useNativeDriver: true }).start();
    }
  }, [showSuccess, pop]);

  // setStatus hanya memicu render kalau isinya benar2 berubah (polling jalan terus).
  const ubahStatus = useCallback((kind: StatusKind, text: string) => {
    setStatus((prev) => (prev.kind === kind && prev.text === text ? prev : { kind, text }));
  }, []);

  const loadStatus = async (childId?: number) => {
    setLoading(true);
    const res = isChild ? await api.faceChildStatus(childId) : await api.faceStatus();
    setLoading(false);
    if (res.success && res.data) {
      setComplete(res.data.complete);
      setTerkumpul(Math.min(TOTAL_FOTO, (res.data.samples as string[]).filter((s) => /^front_\d+$/.test(s)).length));
    } else {
      setError(res.message ?? "Gagal memuat status.");
    }
  };

  useEffect(() => {
    (async () => {
      if (isChild) {
        const childrenRes = await api.myChildren();
        if (childrenRes.success) {
          setChildren(childrenRes.data);
          const firstId = pilihAnak(childrenRes.data, null);
          setActiveChildId(firstId);
          if (firstId) await loadStatus(firstId);
          else setLoading(false);
          return;
        }
      }
      await loadStatus();
    })();
  }, []);
  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  // Ganti anak aktif - progres TERPISAH per anak; kamera ditutup dulu supaya foto anak A tidak tersubmit atas nama anak B.
  async function handleSelectChild(id: number) {
    stopCamera();
    setShowSuccess(false);
    setActiveChildId(id);
    setComplete(false);
    setTerkumpul(0);
    setError("");
    await loadStatus(id);
  }

  // Anak dipilih di layar lain / lewat notifikasi -> pendaftaran wajah ikut anak yang sama.
  const anakTerpilih = useAnakTerpilih();
  useEffect(() => {
    if (!isChild || anakTerpilih === null || anakTerpilih === activeChildId) return;
    if (children.some((c) => c.id === anakTerpilih)) void handleSelectChild(anakTerpilih);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anakTerpilih, children]);

  const masihAda = terkumpul < TOTAL_FOTO;

  // Mengembalikan true kalau kamera berhasil diaktifkan.
  async function startCamera(): Promise<boolean> {
    setError("");
    setShowSuccess(false);
    setStarting(true);
    ubahStatus("idle", "Posisikan wajah di dalam lingkaran");
    setIsiHold(0);
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        setStarting(false);
        setError("Izin kamera ditolak. Aktifkan izin kamera utk aplikasi ini di Pengaturan HP.");
        return false;
      }
    }
    setCameraActive(true);
    setStarting(false);
    return true;
  }

  function stopCamera() {
    setCameraActive(false);
    setStarting(false);
    conditionMetSinceRef.current = 0;
    setIsiHold(0);
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }

  // Downscale ke max 800px sisi terpanjang SEBELUM base64 - takePictureAsync skipProcessing menangkap resolusi SENSOR ASLI (12MP+).
  const captureFrame = useCallback(async (): Promise<string | null> => {
    if (!cameraRef.current) return null;
    try {
      // shutterSound:false - dipanggil berulang selama auto-scan, bunyi jepret mengganggu.
      const photo = await cameraRef.current.takePictureAsync({ skipProcessing: true, shutterSound: false });
      if (!photo?.uri) return null;
      const manipulated = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 800 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      return manipulated.base64 ? `data:image/jpeg;base64,${manipulated.base64}` : null;
    } catch {
      return null;
    }
  }, []);

  const submitSample = useCallback(async (imageBase64: string) => {
    const nomor = terkumpulRef.current + 1; // front_1, front_2, front_3
    setCapturing(true);
    ubahStatus("busy", "Menyimpan foto...");
    const res = isChild ? await api.faceChildEnrollSample("front", nomor, imageBase64, activeChildId ?? undefined) : await api.faceEnrollSample("front", nomor, imageBase64);
    setCapturing(false);
    if (res.success) {
      setTerkumpul((n) => Math.max(n, nomor));
      ubahStatus("ok", "Bagus!");
      Vibration.vibrate(40);
    } else {
      const reason = res.data?.reason || res.data?.detail || res.data?.message || res.message || "Foto tidak memenuhi syarat, coba lagi.";
      ubahStatus("error", `Ditolak: ${reason}`);
    }
  }, [isChild, activeChildId, ubahStatus]);

  // Semua foto selesai -> tutup kamera & tampilkan layar BERHASIL (dari progres LOKAL sesi ini, bukan tanya server).
  useEffect(() => {
    if (cameraActive && terkumpul >= TOTAL_FOTO) {
      setComplete(true);
      stopCamera();
      setShowSuccess(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terkumpul, cameraActive]);

  async function handleReenroll() {
    // Status lama disimpan: kalau izin kamera ditolak, pendaftaran yang SUDAH ADA tidak boleh tampak hilang.
    const cadangan = { complete, terkumpul };
    setTerkumpul(0);
    setComplete(false);
    const ok = await startCamera();
    if (!ok) {
      setComplete(cadangan.complete);
      setTerkumpul(cadangan.terkumpul);
    }
  }

  // Polling otomatis - logika sama dgn versi web (lihat komentar di sana).
  useEffect(() => {
    if (!cameraActive || !masihAda || complete) return;
    const reset = () => { conditionMetSinceRef.current = 0; setIsiHold(0); };
    intervalRef.current = setInterval(async () => {
      if (busyRef.current) return;
      const now = Date.now();
      if (now - lastCaptureTimeRef.current < COOLDOWN_MS) return;
      busyRef.current = true;
      try {
        const frame = await captureFrame();
        if (!frame) return;
        const res = await api.faceAnalyze(frame);
        const data = res.data;

        if (!res.success) { reset(); ubahStatus("error", res.message ?? "Gagal menghubungi server, mencoba lagi..."); return; }
        if (!data?.face_detected) { reset(); ubahStatus("warn", "Wajah belum terlihat - masuk ke lingkaran"); return; }
        if (data.face_count > 1) { reset(); ubahStatus("warn", "Hanya satu wajah dalam lingkaran"); return; }

        const yaw = data.yaw ?? 0;
        const faceSize = data.face_size ?? 0;
        const blur = data.blur;
        const cx = data.cx as number | undefined;
        const cy = data.cy as number | undefined;
        const lebar = data.w as number | undefined;

        let petunjuk = "";
        if (faceSize < UKURAN_MIN_PX || (lebar !== undefined && lebar < LEBAR_MIN)) petunjuk = "Dekatkan wajah";
        else if (lebar !== undefined && lebar > LEBAR_MAKS) petunjuk = "Mundur sedikit";
        else if (cx !== undefined && Math.abs(cx - 0.5) > PUSAT_X_TOL) petunjuk = "Pusatkan wajah di dalam lingkaran";
        else if (cy !== undefined && cy < PUSAT_Y_TARGET - PUSAT_Y_TOL) petunjuk = "Turunkan sedikit";
        else if (cy !== undefined && cy > PUSAT_Y_TARGET + PUSAT_Y_TOL) petunjuk = "Naikkan sedikit";
        else if (Math.abs(yaw) > YAW_MAKS) petunjuk = "Hadap lurus ke kamera";
        else if (blur !== null && blur !== undefined && blur < BLUR_MIN) petunjuk = "Diam sebentar";

        if (petunjuk) { reset(); ubahStatus("warn", petunjuk); return; }

        ubahStatus("ok", "Tahan posisi...");
        if (conditionMetSinceRef.current === 0) conditionMetSinceRef.current = Date.now();
        const lama = Date.now() - conditionMetSinceRef.current;
        setIsiHold(Math.min(1, lama / HOLD_MS));
        if (lama >= HOLD_MS) {
          conditionMetSinceRef.current = 0;
          lastCaptureTimeRef.current = Date.now();
          await submitSample(frame);
          setIsiHold(0);
        }
      } finally {
        busyRef.current = false;
      }
    }, ANALYZE_INTERVAL_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [cameraActive, masihAda, complete, captureFrame, submitSample, ubahStatus]);

  if (loading) {
    return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator color={colors.primary} /></View>;
  }

  const childLabel = children.find((c) => c.id === activeChildId)?.nama ?? "anak Anda";
  const subjek = isChild ? childLabel : "Anda";
  const sebagian = !complete && terkumpul > 0;

  // ============================ TAHAP 2 - PINDAI ============================
  if (cameraActive || starting) {
    const warna = WARNA[status.kind];
    const { w, h } = ukuranKamera;
    const cx = w / 2;
    const cy = h * 0.46;
    const r = Math.max(10, Math.min(w, h) * 0.36);
    const progres = Math.min(1, (terkumpul + (masihAda ? isiHold : 0)) / TOTAL_FOTO);
    const terisi = Math.round(progres * TIK);

    return (
      <View className="flex-1 bg-background" style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, gap: 12 }}>
        <View className="flex-row items-center" style={{ gap: 12 }}>
          <Text className="flex-1 text-sm text-foreground">
            <Text className="font-bold">Foto {Math.min(terkumpul + 1, TOTAL_FOTO)} dari {TOTAL_FOTO}</Text>
            <Text className="text-muted-foreground"> · taruh wajah di dalam lingkaran</Text>
          </Text>
          <Pressable onPress={stopCamera} accessibilityLabel="Batal" className="p-1.5 rounded-full bg-muted">
            <X size={16} color={colors.mutedForeground} />
          </Pressable>
        </View>

        {/* Kamera + lingkaran - mengisi seluruh sisa tinggi layar */}
        <View
          className="flex-1 w-full self-center rounded-3xl overflow-hidden bg-black"
          style={{ maxWidth: 384 }}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setUkuranKamera((p) => (Math.round(p.w) === Math.round(width) && Math.round(p.h) === Math.round(height) ? p : { w: width, h: height }));
          }}
        >
          {/* animateShutter=false - akar masalah layar "kedip-kedip": expo-camera menyalakan animasi kilat tiap takePictureAsync(). */}
          {cameraActive && <CameraView ref={cameraRef} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} facing="front" animateShutter={false} />}
          {w > 0 && (
            <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", top: 0, left: 0 }} pointerEvents="none">
              <Defs>
                <Mask id="fe-lingkar-mask">
                  <Rect width={w} height={h} fill="white" />
                  <SvgCircle cx={cx} cy={cy} r={r} fill="black" />
                </Mask>
              </Defs>
              <Rect width={w} height={h} fill="rgba(0,0,0,0.55)" mask="url(#fe-lingkar-mask)" />
              <SvgCircle cx={cx} cy={cy} r={r} fill="none" stroke={warna} strokeWidth="3" />
              {Array.from({ length: TIK }, (_, i) => {
                const a = (i / TIK) * Math.PI * 2 - Math.PI / 2;
                return (
                  <Line key={i} x1={cx + Math.cos(a) * (r + 8)} y1={cy + Math.sin(a) * (r + 8)} x2={cx + Math.cos(a) * (r + 20)} y2={cy + Math.sin(a) * (r + 20)}
                    stroke={i < terisi ? "#22c55e" : "rgba(255,255,255,0.35)"} strokeWidth="3" strokeLinecap="round" />
                );
              })}
            </Svg>
          )}

          {(capturing || !cameraActive) && (
            <View className="absolute inset-0 items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.3)", gap: 8 }}>
              <ActivityIndicator size="large" color="#ffffff" />
              {!cameraActive ? <Text className="text-xs" style={{ color: "rgba(255,255,255,0.9)" }}>Menyiapkan kamera...</Text> : null}
            </View>
          )}
        </View>

        {/* Petunjuk satu kalimat */}
        <View className="w-full self-center items-center" style={{ maxWidth: 384, gap: 8 }}>
          <View className={`max-w-full px-3.5 py-1.5 rounded-full flex-row items-center ${CHIP[status.kind].box}`} style={{ gap: 6 }}>
            {status.kind === "ok" || status.kind === "busy"
              ? <CheckCircle2 size={14} color="#16a34a" />
              : status.kind === "idle" ? <ScanFace size={14} color={colors.mutedForeground} /> : <AlertCircle size={14} color={status.kind === "error" ? "#dc2626" : "#d97706"} />}
            <Text numberOfLines={1} className={`text-sm font-medium shrink ${CHIP[status.kind].txt}`}>{cameraActive ? status.text : "Menyiapkan kamera..."}</Text>
          </View>
        </View>
      </View>
    );
  }

  // ============================ TAHAP 3 - BERHASIL ============================
  if (showSuccess) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-6" style={{ gap: 16 }}>
        <Animated.View
          className="w-24 h-24 rounded-full bg-green-100 dark:bg-green-900/30 items-center justify-center"
          style={{ transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }], opacity: pop }}
        >
          <CheckCircle2 size={56} color="#22c55e" />
        </Animated.View>
        <View className="items-center">
          <Text className="text-xl font-bold text-foreground">Berhasil!</Text>
          <Text className="text-sm text-muted-foreground mt-1.5 text-center" style={{ maxWidth: 300 }}>
            Wajah {subjek} sudah terdaftar dan siap dikenali presensi otomatis.
          </Text>
        </View>
        <View className="w-full mt-2" style={{ maxWidth: 320 }}>
          <Button fullWidth onPress={() => setShowSuccess(false)}>Selesai</Button>
        </View>
      </View>
    );
  }

  // ============================ TAHAP 1 - MENU ============================
  return (
    <View className="flex-1 bg-background" style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, gap: 12 }}>
      {isChild ? <ChildSwitcher children={children} activeId={activeChildId} onChange={handleSelectChild} /> : null}

      {error ? (
        <View className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2">
          <Text className="text-xs text-red-600 dark:text-red-400">{error}</Text>
        </View>
      ) : null}

      <Card padding="lg" className="flex-1 items-center justify-center" >
        <View className="items-center" style={{ gap: 12 }}>
          <View className={`w-20 h-20 rounded-full items-center justify-center ${complete ? "bg-green-100 dark:bg-green-900/30" : "bg-amber-100 dark:bg-amber-900/30"}`}>
            {complete ? <CheckCircle2 size={44} color="#22c55e" /> : <ScanFace size={44} color="#f59e0b" />}
          </View>
          <View className="items-center">
            <Text className="text-lg font-bold text-foreground text-center">
              {complete ? "Wajah Sudah Terdaftar" : sebagian ? "Pendaftaran Belum Lengkap" : "Wajah Belum Terdaftar"}
            </Text>
            <Text className="text-sm text-muted-foreground mt-1 text-center" style={{ maxWidth: 300 }}>
              {complete
                ? `Wajah ${subjek} sudah bisa dikenali presensi otomatis.`
                : sebagian
                  ? `Baru ${terkumpul} dari ${TOTAL_FOTO} foto untuk ${subjek}.`
                  : `Cukup taruh wajah ${subjek} di dalam lingkaran, foto diambil otomatis.`}
            </Text>
          </View>
        </View>
      </Card>

      {complete ? (
        <Button fullWidth variant="outline" onPress={handleReenroll}>
          <Camera size={16} color={colors.primary} />{"  "}Daftar Ulang
        </Button>
      ) : (
        <Button fullWidth onPress={startCamera}>
          <Camera size={16} color={colors.primaryForeground} />{"  "}{sebagian ? "Lanjutkan" : "Mulai"}
        </Button>
      )}
    </View>
  );
}

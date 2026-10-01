// ============================================================
// PENGENALAN WAJAH - Daftarkan wajah lewat kamera. Alur 3 tahap (redesain
// 2026-10-01, port dari webview FaceEnrollmentScreen.tsx - JAGA KEDUANYA
// TETAP SEJAJAR), SEMUA MUAT SATU LAYAR TANPA SCROLL:
//   1. MENU    - status terdaftar/belum + tombol "Mulai"/"Lanjutkan" atau "Daftar Ulang"
//   2. PINDAI  - kamera mengisi sisa layar dgn PANDUAN: bingkai oval + siku, panah
//                arah putar kepala, indikator langkah, meter putaran, status langsung
//   3. BERHASIL - layar sukses, "Selesai" kembali ke MENU
//
// LOGIKA DETEKSI TIDAK DIUBAH (hanya tampilan): polling /api/face/analyze, ambang
// yaw/ukuran/ketajaman, tanda yaw, cooldown, penyimpanan sampel PERSIS seperti
// versi yang dikalibrasi lewat pengujian nyata. Tombol "Ambil Manual" DIHAPUS
// (permintaan user) setelah bug kontrak /analyze diperbaiki di backend.
// ============================================================
import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, ActivityIndicator, Animated, Vibration, Pressable } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import Svg, { Defs, Mask, Rect, Ellipse, G, Path } from "react-native-svg";
import { CheckCircle2, Circle, Camera, AlertCircle, ScanFace, ArrowLeft, ArrowRight, X } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { ChildSwitcher, type ChildOption } from "../ChildSwitcher";
import { api } from "../../services/api";
import { useThemeColors } from "../../context/ThemeContext";
import { geometriOval } from "../../utils/faceOverlay";

interface Props {
  onNavigate: (screen: string, params?: Record<string, unknown>) => void;
  target?: "self" | "child";
}

// `angle` = ID internal yg dikirim ke server (left/right dicek thresholdnya);
// label/instruction = teks utk user. Step ber-`angle:"left"` SECARA FISIK
// berhasil begitu user menoleh ke KANAN (preview kamera depan di-mirror).
// `arah` = panah petunjuk di layar. Kalau diubah lagi, PERCAYA pengujian nyata
// di HP, JANGAN nebak dari nama field.
const STEPS: { angle: string; label: string; instruction: string; arah: "depan" | "kanan" | "kiri" }[] = [
  { angle: "front", label: "Hadap Depan", instruction: "Lihat lurus ke kamera", arah: "depan" },
  { angle: "left", label: "Hadap Kanan", instruction: "Putar wajah sedikit ke kanan", arah: "kanan" },
  { angle: "right", label: "Hadap Kiri", instruction: "Putar wajah sedikit ke kiri", arah: "kiri" },
];

const ANALYZE_INTERVAL_MS = 600; // sedikit lebih longgar dari web (300ms) - takePictureAsync jauh lebih berat drpd snapshot canvas dari stream langsung
const COOLDOWN_MS = 800;
const HOLD_MS = 200;
const YAW_TARGET = 12; // derajat - sama dgn validator server (check_quality_acceptable)

type StatusKind = "idle" | "warn" | "ok" | "busy" | "error";
interface StatusInfo { kind: StatusKind; text: string }

const WARNA_CINCIN: Record<StatusKind, string> = {
  idle: "rgba(255,255,255,0.92)",
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
  const [doneAngles, setDoneAngles] = useState<Set<string>>(new Set());
  const [cameraActive, setCameraActive] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [status, setStatus] = useState<StatusInfo>({ kind: "idle", text: "Posisikan wajah di dalam bingkai" });
  const [yaw, setYaw] = useState<number | null>(null);
  const [ukuranKamera, setUkuranKamera] = useState({ w: 0, h: 0 });
  const [children, setChildren] = useState<ChildOption[]>([]);
  const [activeChildId, setActiveChildId] = useState<number | null>(null);

  const cameraRef = useRef<CameraView>(null);
  const busyRef = useRef(false);
  const conditionMetSinceRef = useRef(0);
  const lastCaptureTimeRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animasi panah (native driver - tidak membebani JS thread yang sedang sibuk polling).
  const nudge = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!cameraActive) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(nudge, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(nudge, { toValue: 0, duration: 500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [cameraActive, nudge]);
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
      setDoneAngles(new Set((res.data.samples as string[]).map((s) => s.split("_")[0])));
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
          const firstId = childrenRes.data[0]?.id ?? null;
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

  // Ganti anak aktif - progres pendaftaran wajah TERPISAH per anak, jadi
  // status/langkah lokal dimuat ulang dari nol. Kamera ditutup dulu kalau
  // sedang aktif - cegah foto anak A tersubmit atas nama anak B.
  async function handleSelectChild(id: number) {
    stopCamera();
    setShowSuccess(false);
    setActiveChildId(id);
    setComplete(false);
    setDoneAngles(new Set());
    setError("");
    await loadStatus(id);
  }

  const nextStep = STEPS.find((s) => !doneAngles.has(s.angle));

  async function startCamera() {
    setError("");
    setShowSuccess(false);
    ubahStatus("idle", "Posisikan wajah di dalam bingkai");
    setYaw(null);
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        setError("Izin kamera ditolak. Aktifkan izin kamera utk aplikasi ini di Pengaturan HP.");
        return;
      }
    }
    setCameraActive(true);
  }

  function stopCamera() {
    setCameraActive(false);
    conditionMetSinceRef.current = 0;
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }

  // Downscale ke max 800px sisi terpanjang SEBELUM base64 - takePictureAsync
  // skipProcessing:true menangkap resolusi SENSOR ASLI (12MP+), payload base64
  // bisa tembus ~5MB tanpa ini.
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

  const submitSample = useCallback(async (angle: string, imageBase64: string) => {
    setCapturing(true);
    ubahStatus("busy", "Menyimpan foto...");
    const res = isChild ? await api.faceChildEnrollSample(angle, 1, imageBase64, activeChildId ?? undefined) : await api.faceEnrollSample(angle, 1, imageBase64);
    setCapturing(false);
    if (res.success) {
      setDoneAngles((prev) => new Set(prev).add(angle));
      ubahStatus("ok", "Berhasil!");
      Vibration.vibrate(40);
    } else {
      const reason = res.data?.reason || res.data?.detail || res.data?.message || res.message || "Foto tidak memenuhi syarat, coba lagi.";
      ubahStatus("error", `Ditolak: ${reason}`);
    }
  }, [isChild, activeChildId, ubahStatus]);

  // Semua langkah selesai -> tutup kamera & tampilkan layar BERHASIL. Lengkap/
  // tidaknya dari progres LOKAL sesi ini, bukan tanya server lagi (saat "Daftar
  // Ulang" sampel lama masih ada di server & akan dilaporkan "lengkap" lebih awal).
  useEffect(() => {
    if (cameraActive && doneAngles.size >= STEPS.length) {
      setComplete(true);
      stopCamera();
      setShowSuccess(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneAngles, cameraActive]);

  function handleReenroll() {
    setDoneAngles(new Set());
    setComplete(false);
    startCamera();
  }

  // Polling otomatis - sama persis logikanya dgn versi web (lihat komentar di
  // sana soal tanda yaw yang sudah dikalibrasi ke validator server ASLI).
  useEffect(() => {
    if (!cameraActive || !nextStep || complete) return;
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

        // Gagal jaringan/server dibedakan dari "memang tidak ada wajah".
        if (!res.success) {
          conditionMetSinceRef.current = 0;
          setYaw(null);
          ubahStatus("error", res.message ?? "Gagal menghubungi server, mencoba lagi...");
          return;
        }
        if (!data?.face_detected) {
          conditionMetSinceRef.current = 0;
          setYaw(null);
          ubahStatus("warn", "Wajah tidak terdeteksi - posisikan di tengah bingkai");
          return;
        }
        if (data.face_count > 1) {
          conditionMetSinceRef.current = 0;
          setYaw(null);
          ubahStatus("warn", "Terdeteksi lebih dari 1 wajah");
          return;
        }

        const yawNow = data.yaw ?? 0;
        setYaw(yawNow);
        const faceSize = data.face_size ?? 0;
        const blur = data.blur;

        let angleOk = false;
        if (nextStep.angle === "front" && Math.abs(yawNow) <= YAW_TARGET) angleOk = true;
        if (nextStep.angle === "left" && yawNow <= -YAW_TARGET) angleOk = true;
        if (nextStep.angle === "right" && yawNow >= YAW_TARGET) angleOk = true;

        const sizeOk = faceSize >= 120;
        const blurOk = blur === null || blur === undefined || blur >= 30;

        if (angleOk && sizeOk && blurOk) {
          ubahStatus("ok", "Tahan posisi...");
          if (conditionMetSinceRef.current === 0) conditionMetSinceRef.current = Date.now();
          if (Date.now() - conditionMetSinceRef.current >= HOLD_MS) {
            conditionMetSinceRef.current = 0;
            lastCaptureTimeRef.current = Date.now();
            await submitSample(nextStep.angle, frame);
          }
        } else {
          conditionMetSinceRef.current = 0;
          const hints: string[] = [];
          if (!angleOk) hints.push(nextStep.instruction);
          if (!sizeOk) hints.push("Dekatkan wajah");
          if (!blurOk) hints.push("Diam sebentar");
          ubahStatus("warn", hints.join(" • "));
        }
      } finally {
        busyRef.current = false;
      }
    }, ANALYZE_INTERVAL_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [cameraActive, nextStep, complete, captureFrame, submitSample, ubahStatus]);

  if (loading) {
    return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator color={colors.primary} /></View>;
  }

  const childLabel = children.find((c) => c.id === activeChildId)?.nama ?? "anak Anda";
  const subjek = isChild ? childLabel : "Anda";
  const sebagian = !complete && doneAngles.size > 0;

  // ============================ TAHAP 2 - PINDAI ============================
  if (cameraActive) {
    const langkahKe = nextStep ? STEPS.findIndex((s) => s.angle === nextStep.angle) : STEPS.length - 1;
    const warna = WARNA_CINCIN[status.kind];
    let meter = 0;
    if (nextStep && yaw !== null) {
      if (nextStep.angle === "left") meter = Math.max(0, Math.min(1, -yaw / YAW_TARGET));
      if (nextStep.angle === "right") meter = Math.max(0, Math.min(1, yaw / YAW_TARGET));
    }
    const arahTranslasi = nudge.interpolate({ inputRange: [0, 1], outputRange: [0, nextStep?.arah === "kiri" ? -8 : 8] });
    const arahOpacity = nudge.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
    const { w, h } = ukuranKamera;
    const g = geometriOval(w, h);

    return (
      <View className="flex-1 bg-background" style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, gap: 12 }}>
        {/* Indikator langkah + tombol batal */}
        <View className="flex-row items-start" style={{ gap: 12 }}>
          <View className="flex-1 flex-row" style={{ gap: 8 }}>
            {STEPS.map((s, i) => (
              <View key={s.angle} className="flex-1">
                <View className={`h-1.5 rounded-full ${doneAngles.has(s.angle) ? "bg-green-500" : i === langkahKe ? "bg-primary" : "bg-muted"}`} />
                <Text className={`mt-1 text-[10px] text-center ${i === langkahKe ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{s.label}</Text>
              </View>
            ))}
          </View>
          <Pressable onPress={stopCamera} accessibilityLabel="Batal" className="p-1.5 rounded-full bg-muted" style={{ marginTop: -4 }}>
            <X size={16} color={colors.mutedForeground} />
          </Pressable>
        </View>

        {/* Kamera + panduan oval - mengisi seluruh sisa tinggi layar */}
        <View
          className="flex-1 w-full self-center rounded-3xl overflow-hidden bg-black"
          style={{ maxWidth: 384 }}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setUkuranKamera((p) => (Math.round(p.w) === Math.round(width) && Math.round(p.h) === Math.round(height) ? p : { w: width, h: height }));
          }}
        >
          {/* animateShutter=false - akar masalah layar "kedip-kedip": expo-camera
              menyalakan animasi kilat tiap takePictureAsync() (default true) dan
              captureFrame() dipanggil berulang selama auto-scan. */}
          <CameraView ref={cameraRef} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} facing="front" animateShutter={false} />
          {w > 0 && (
            <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", top: 0, left: 0 }} pointerEvents="none">
              <Defs>
                <Mask id="fe-oval-mask">
                  <Rect width={w} height={h} fill="white" />
                  <Ellipse cx={g.cx} cy={g.cy} rx={g.rx} ry={g.ry} fill="black" />
                </Mask>
              </Defs>
              <Rect width={w} height={h} fill="rgba(0,0,0,0.5)" mask="url(#fe-oval-mask)" />
              <Ellipse cx={g.cx} cy={g.cy} rx={g.rx} ry={g.ry} fill="none" stroke={warna} strokeWidth="4" />
              <G fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                <Path d={`M ${g.pad} ${g.pad + g.panjang} V ${g.pad} H ${g.pad + g.panjang}`} />
                <Path d={`M ${w - g.pad - g.panjang} ${g.pad} H ${w - g.pad} V ${g.pad + g.panjang}`} />
                <Path d={`M ${g.pad} ${h - g.pad - g.panjang} V ${h - g.pad} H ${g.pad + g.panjang}`} />
                <Path d={`M ${w - g.pad - g.panjang} ${h - g.pad} H ${w - g.pad} V ${h - g.pad - g.panjang}`} />
              </G>
            </Svg>
          )}

          {nextStep?.arah === "kanan" && (
            <Animated.View pointerEvents="none" style={{ position: "absolute", right: 12, top: "50%", marginTop: -17, opacity: arahOpacity, transform: [{ translateX: arahTranslasi }] }}>
              <ArrowRight size={34} color="#ffffff" strokeWidth={3} />
            </Animated.View>
          )}
          {nextStep?.arah === "kiri" && (
            <Animated.View pointerEvents="none" style={{ position: "absolute", left: 12, top: "50%", marginTop: -17, opacity: arahOpacity, transform: [{ translateX: arahTranslasi }] }}>
              <ArrowLeft size={34} color="#ffffff" strokeWidth={3} />
            </Animated.View>
          )}

          {capturing && (
            <View className="absolute inset-0 items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.3)" }}>
              <ActivityIndicator size="large" color="#ffffff" />
            </View>
          )}
        </View>

        {/* Instruksi + status (ringkas) */}
        <View className="w-full self-center items-center" style={{ maxWidth: 384, gap: 8 }}>
          {nextStep && (
            <Text className="text-sm text-foreground text-center">
              <Text className="font-bold">{nextStep.label}</Text>
              <Text className="text-muted-foreground"> · {nextStep.instruction}</Text>
            </Text>
          )}
          {nextStep && nextStep.arah !== "depan" && (
            <View className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
              <View className="h-full bg-primary rounded-full" style={{ width: `${Math.round(meter * 100)}%` }} />
            </View>
          )}
          <View className={`max-w-full px-3.5 py-1.5 rounded-full flex-row items-center ${CHIP[status.kind].box}`} style={{ gap: 6 }}>
            {status.kind === "ok" || status.kind === "busy"
              ? <CheckCircle2 size={14} color="#16a34a" />
              : status.kind === "idle" ? <ScanFace size={14} color={colors.mutedForeground} /> : <AlertCircle size={14} color={status.kind === "error" ? "#dc2626" : "#d97706"} />}
            <Text numberOfLines={1} className={`text-xs font-medium shrink ${CHIP[status.kind].txt}`}>{status.text}</Text>
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
                  ? `Baru ${doneAngles.size} dari 3 sudut untuk ${subjek}.`
                  : `Daftarkan wajah ${subjek} dari 3 sudut agar bisa dikenali presensi otomatis.`}
            </Text>
          </View>
          <View className="flex-row" style={{ gap: 20 }}>
            {STEPS.map((s) => (
              <View key={s.angle} className="items-center" style={{ gap: 4 }}>
                {doneAngles.has(s.angle) ? <CheckCircle2 size={20} color="#22c55e" /> : <Circle size={20} color={colors.mutedForeground} />}
                <Text className={`text-[11px] ${doneAngles.has(s.angle) ? "text-foreground" : "text-muted-foreground"}`}>{s.label.replace("Hadap ", "")}</Text>
              </View>
            ))}
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

// ============================================================
// PENGENALAN WAJAH — port native dari webview FaceEnrollmentScreen.tsx.
// Kamera pakai expo-camera (CameraView) - izin kamera NATIF asli (dialog
// sistem Android/iOS), bukan getUserMedia() di dalam WebView yang di
// banyak device diam-diam gagal/tidak pernah muncul (akar masalah "scan
// wajah gabisa" yang jadi alasan utama aplikasi native ini dibuat).
// Semua konstanta (threshold yaw/blur/faceSize, interval, cooldown, hold)
// DISALIN PERSIS dari versi webview yang sudah diuji nyata & dikalibrasi
// terhadap validator server (face-service) - JANGAN diubah tanpa data uji
// nyata di HP, lihat catatan panjang di versi webview-nya.
// ============================================================
import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, ActivityIndicator, ScrollView } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import { CheckCircle2, Circle, Camera, AlertCircle } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { ChildSwitcher, type ChildOption } from "../ChildSwitcher";
import { api } from "../../services/api";
import { useThemeColors } from "../../context/ThemeContext";

interface Props {
  onNavigate: (screen: string, params?: Record<string, unknown>) => void;
  target?: "self" | "child";
}

const STEPS: { angle: string; label: string; instruction: string }[] = [
  { angle: "front", label: "Hadap Depan", instruction: "Lihat lurus ke kamera" },
  { angle: "left", label: "Hadap Kanan", instruction: "Putar wajah sedikit ke kanan" },
  { angle: "right", label: "Hadap Kiri", instruction: "Putar wajah sedikit ke kiri" },
];

const ANALYZE_INTERVAL_MS = 600; // sedikit lebih longgar dari web (300ms) - takePictureAsync jauh lebih berat drpd snapshot canvas dari stream langsung
const COOLDOWN_MS = 800;
const HOLD_MS = 200;

export function FaceEnrollmentScreen({ onNavigate, target = "self" }: Props) {
  const colors = useThemeColors();
  const isChild = target === "child";
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const [doneAngles, setDoneAngles] = useState<Set<string>>(new Set());
  const [cameraActive, setCameraActive] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [message, setMessage] = useState("");
  // Toast hijau "Berhasil" di layar atas (2026-09-11, poin #10) - PISAH dari
  // `message` (teks kecil di dalam kartu kamera, tetap dipertahankan apa
  // adanya) - ini popup singkat yang lebih menonjol, auto-hilang ~1,8 detik,
  // MURNI di dalam app (bukan push notification asli ke luar app, sesuai
  // permintaan eksplisit).
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [autoStatus, setAutoStatus] = useState("");
  const [children, setChildren] = useState<ChildOption[]>([]);
  const [activeChildId, setActiveChildId] = useState<number | null>(null);

  const cameraRef = useRef<CameraView>(null);
  const busyRef = useRef(false);
  const conditionMetSinceRef = useRef(0);
  const lastCaptureTimeRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  // Ganti anak aktif - progres pendaftaran wajah TERPISAH per anak, jadi
  // status/langkah lokal harus dimuat ulang dari nol (bukan melanjutkan
  // progres anak sebelumnya). Kamera ditutup dulu kalau sedang aktif -
  // cegah foto yang sudah diambil utk anak A ikut tersubmit atas nama anak
  // B di tengah alur.
  async function handleSelectChild(id: number) {
    stopCamera();
    setActiveChildId(id);
    setComplete(false);
    setDoneAngles(new Set());
    setMessage("");
    setError("");
    await loadStatus(id);
  }

  const nextStep = STEPS.find((s) => !doneAngles.has(s.angle));

  async function startCamera() {
    setMessage(""); setError("");
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
    setAutoStatus("");
    conditionMetSinceRef.current = 0;
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }

  // Downscale ke max 800px sisi terpanjang SEBELUM base64 (2026-08-25) -
  // takePictureAsync skipProcessing:true menangkap resolusi SENSOR ASLI
  // (bisa 12MP+), deteksi yaw/pitch/liveness sama sekali tidak butuh itu.
  // Ditemukan lewat log produksi: payload base64 tembus 4.5-4.9MB tanpa
  // ini, sempat bikin request ditolak server (PayloadTooLargeError) -
  // limit body sudah dinaikkan sbg mitigasi cepat, TAPI downscale di sini
  // solusi akar-masalahnya (payload jauh lebih kecil, tiap poll ~600ms
  // jadi lebih ringan jg, bukan cuma menghindari batas).
  const captureFrame = useCallback(async (): Promise<string | null> => {
    if (!cameraRef.current) return null;
    try {
      // shutterSound:false (2026-08-29) - dipanggil berulang tiap
      // ANALYZE_INTERVAL_MS selama auto-scan, bunyi jepret berulang2
      // mengganggu kalau tidak dimatikan. Tidak mempengaruhi hasil deteksi.
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

  const submitSample = useCallback(async (angle: string, label: string, imageBase64: string) => {
    setCapturing(true); setMessage("");
    const res = isChild ? await api.faceChildEnrollSample(angle, 1, imageBase64, activeChildId ?? undefined) : await api.faceEnrollSample(angle, 1, imageBase64);
    setCapturing(false);
    if (res.success) {
      setDoneAngles((prev) => new Set(prev).add(angle));
      setMessage(`"${label}" berhasil disimpan.`);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      setToast(`✓ ${label} berhasil direkam`);
      toastTimerRef.current = setTimeout(() => setToast(null), 1800);
    } else {
      const reason = res.data?.reason || res.data?.detail || res.data?.message || res.message || "Foto tidak memenuhi syarat, coba lagi.";
      setMessage(`Ditolak: ${reason}`);
    }
  }, [isChild, activeChildId]);

  useEffect(() => {
    if (cameraActive && doneAngles.size >= STEPS.length) {
      setComplete(true);
      stopCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneAngles, cameraActive]);

  function handleReenroll() {
    setDoneAngles(new Set());
    setComplete(false);
    setMessage("");
    startCamera();
  }

  async function handleManualCapture() {
    if (!nextStep || capturing) return;
    const frame = await captureFrame();
    if (!frame) return;
    await submitSample(nextStep.angle, nextStep.label, frame);
  }

  // Polling otomatis - sama persis logikanya dgn versi web (lihat komentar
  // panjang di sana soal tanda yaw yang sudah dikalibrasi ke validator
  // server ASLI, bukan ditebak ulang di sini).
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

        if (!res.success || !data?.face_detected) {
          conditionMetSinceRef.current = 0;
          setAutoStatus("Wajah tidak terdeteksi - posisikan wajah di tengah kamera");
          return;
        }
        if (data.face_count > 1) {
          conditionMetSinceRef.current = 0;
          setAutoStatus("Terdeteksi lebih dari 1 wajah");
          return;
        }

        const yaw = data.yaw ?? 0;
        const faceSize = data.face_size ?? 0;
        const blur = data.blur;

        let angleOk = false;
        if (nextStep.angle === "front" && Math.abs(yaw) <= 12) angleOk = true;
        if (nextStep.angle === "left" && yaw <= -12) angleOk = true;
        if (nextStep.angle === "right" && yaw >= 12) angleOk = true;

        const sizeOk = faceSize >= 120;
        const blurOk = blur === null || blur === undefined || blur >= 30;

        if (angleOk && sizeOk && blurOk) {
          setAutoStatus("Posisi OK - menangkap...");
          if (conditionMetSinceRef.current === 0) conditionMetSinceRef.current = Date.now();
          if (Date.now() - conditionMetSinceRef.current >= HOLD_MS) {
            conditionMetSinceRef.current = 0;
            lastCaptureTimeRef.current = Date.now();
            setAutoStatus("Mengambil foto...");
            await submitSample(nextStep.angle, nextStep.label, frame);
          }
        } else {
          conditionMetSinceRef.current = 0;
          const hints: string[] = [];
          if (!angleOk) hints.push(nextStep.instruction);
          if (!sizeOk) hints.push("Dekatkan wajah");
          if (!blurOk) hints.push("Diam sebentar");
          setAutoStatus(hints.join(" • "));
        }
      } finally {
        busyRef.current = false;
      }
    }, ANALYZE_INTERVAL_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [cameraActive, nextStep, complete, captureFrame, submitSample]);

  if (loading) {
    return <View className="flex-1 items-center justify-center"><ActivityIndicator color={colors.primary} /></View>;
  }

  const childLabel = children.find((c) => c.id === activeChildId)?.nama ?? "anak Anda";

  return (
    <View className="flex-1 bg-background">
      {/* Toast "Berhasil" (poin #10) - overlay tetap di layar atas walau
          discroll, auto-hilang sendiri, murni in-app (bukan push notif
          asli keluar app). */}
      {toast ? (
        <View
          pointerEvents="none"
          className="absolute top-3 left-4 right-4 z-50 bg-green-600 rounded-xl px-4 py-3 flex-row items-center gap-2"
          style={{ elevation: 6, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }}
        >
          <CheckCircle2 size={18} color="#ffffff" />
          <Text className="text-sm font-semibold text-white">{toast}</Text>
        </View>
      ) : null}

      {/* ScrollView (2026-09-11, poin #10) - SEBELUMNYA View biasa tanpa
          scroll sama sekali: begitu kamera aktif, kartu Progres Pendaftaran
          (3 checklist depan/kanan/kiri) bisa terdorong keluar layar di HP
          layar kecil TANPA CARA melihatnya lagi - dilaporkan user langsung
          ("gabisa scroll kebawah tadi buat cek berhasil/tidak"). */}
      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 24, gap: 20 }}>
      {isChild ? <ChildSwitcher children={children} activeId={activeChildId} onChange={handleSelectChild} /> : null}

      {error ? (
        <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <Text className="text-sm text-red-600">{error}</Text>
        </View>
      ) : null}

      <Card padding="lg">
        <View className="flex-row items-center gap-3 mb-1">
          {complete ? <CheckCircle2 size={22} color="#22c55e" /> : <AlertCircle size={22} color="#f59e0b" />}
          <Text className="text-base font-bold text-foreground">{complete ? "Wajah Sudah Terdaftar" : "Wajah Belum Terdaftar Lengkap"}</Text>
        </View>
        <Text className="text-xs text-muted-foreground">
          {complete
            ? `Wajah ${isChild ? childLabel : "Anda"} sudah bisa dikenali sistem presensi otomatis di sekolah.`
            : `Daftarkan wajah ${isChild ? childLabel : "Anda"} dari 3 sudut supaya bisa dikenali sistem presensi otomatis di sekolah.`}
        </Text>
      </Card>

      {complete && !cameraActive && (
        <Card padding="md">
          <Button fullWidth variant="outline" onPress={handleReenroll}>
            <Camera size={16} color={colors.primary} />{"  "}Daftar Ulang Wajah
          </Button>
          <Text className="text-xs text-muted-foreground text-center mt-2">Foto lama akan diganti otomatis dengan yang baru, bukan menumpuk data.</Text>
        </Card>
      )}

      {/* Kartu kamera DIPINDAH ke atas kartu Progres (poin #10, permintaan
          eksplisit "tuker posisi kamera di atas") - urutan sekarang: kamera
          dulu, checklist 3 poin di bawahnya. */}
      {(!complete || cameraActive) && (
        <Card padding="md">
          {!cameraActive ? (
            <Button fullWidth onPress={startCamera}>
              <Camera size={16} color={colors.primaryForeground} />{"  "}Buka Kamera
            </Button>
          ) : (
            <View className="flex flex-col gap-3">
              <View className="relative w-full max-w-xs self-center aspect-square rounded-xl overflow-hidden bg-black">
                {/* animateShutter=false (2026-08-29) - AKAR MASALAH layar/HP
                    "kedip-kedip" saat pendaftaran wajah: expo-camera
                    menyalakan animasi kilat layar tiap takePictureAsync()
                    dipanggil (default true), dan captureFrame() dipanggil
                    berulang tiap ANALYZE_INTERVAL_MS selama auto-scan -
                    murni animasi visual, tidak mempengaruhi hasil foto. */}
                <CameraView ref={cameraRef} style={{ flex: 1 }} facing="front" animateShutter={false} />
              </View>

              {nextStep && (
                <Text className="text-sm font-medium text-foreground text-center">Langkah: {nextStep.label} — {nextStep.instruction}</Text>
              )}
              {autoStatus && !message ? <Text className="text-xs text-primary text-center">{autoStatus}</Text> : null}
              {message ? (
                <Text className={`text-xs text-center ${message.startsWith("Ditolak") ? "text-red-500" : "text-green-600"}`}>{message}</Text>
              ) : null}
              <Text className="text-xs text-muted-foreground text-center">
                Foto diambil otomatis begitu wajah menghadap arah yang benar. Kalau sulit terdeteksi, gunakan tombol manual di bawah.
              </Text>

              <Button fullWidth variant="outline" onPress={handleManualCapture} disabled={capturing || !nextStep}>
                {capturing ? <ActivityIndicator size="small" color={colors.primary} /> : <Camera size={16} color={colors.primary} />}
                {"  "}{capturing ? "Memproses..." : "Ambil Manual"}
              </Button>
              <Button fullWidth variant="ghost" onPress={stopCamera}>Tutup Kamera</Button>
            </View>
          )}
        </Card>
      )}

      <Card padding="md">
        <Text className="text-sm font-semibold text-foreground mb-3">Progres Pendaftaran</Text>
        <View className="flex flex-col gap-2">
          {STEPS.map((s) => (
            <View key={s.angle} className="flex-row items-center gap-2.5">
              {doneAngles.has(s.angle) ? <CheckCircle2 size={18} color="#22c55e" /> : <Circle size={18} color={colors.mutedForeground} />}
              <Text className={`text-sm ${doneAngles.has(s.angle) ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</Text>
            </View>
          ))}
        </View>
      </Card>
      </ScrollView>
    </View>
  );
}

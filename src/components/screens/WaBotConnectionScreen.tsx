import React, { useEffect, useRef, useState } from "react";
import { View, Text, Image, ActivityIndicator, AppState } from "react-native";
import { CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { api } from "../../services/api";
import { useThemeColors } from "../../context/ThemeContext";

const POLL_MS_WAITING = 1200;
const POLL_MS_READY = 5000;
// Jatah reconnect otomatis bot (config.reconnect.maxAttempts di botwa, default
// 10) - auto-regenerate QR HANYA sah kalau bot benar2 sudah menyerah sebanyak
// ini. Sebelum 2026-09-29 kondisinya cuma `attempts > 0`, jadi layar langsung
// menghancurkan klien bot & QR yang sedang aktif begitu dibuka (bug nyata).
const BOT_MAX_RECONNECT = 10;
// Lewat batas ini di fase "menyambungkan" layar menawarkan Refresh QR.
const CONNECTING_SLOW_MS = 90000;

interface WaStatusBody {
  ok: boolean;
  error?: string;
  whatsapp?: {
    ready: boolean;
    isReconnecting?: boolean;
    reconnectAttempts?: number;
    hasQr?: boolean;
    authenticated?: boolean;
    loadingPercent?: number | null;
  };
}

export function WaBotConnectionScreen() {
  const colors = useThemeColors();
  const [ready, setReady] = useState<boolean | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [disconnecting, setDisconnecting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyRef = useRef(false);
  const autoRegenTriedRef = useRef(false);
  // Fase "menyambungkan" - QR sudah discan tapi bot belum ready (10-30 detik).
  // Sebelumnya jendela ini cuma tampil "Menunggu QR..." tanpa tanda apa pun.
  const [connecting, setConnecting] = useState<{ percent: number | null; lambat: boolean } | null>(null);
  const connectingSinceRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const cancelledRef = useRef(false);
  const regenAtRef = useRef(0);

  const regenerateQr = async (isAuto: boolean) => {
    setRegenerating(true);
    regenAtRef.current = Date.now();
    const res = await api.adminWaRegenerateQr();
    if (!res.ok) {
      setRegenerating(false);
      if (!isAuto) setError(res.error || res.message || "Gagal membuat QR baru. Coba lagi sebentar.");
      return;
    }
    // Bot membalas langsung & membuat QR di background (~12 detik) - spinner
    // dipertahankan sampai QR baru muncul (dimatikan di poll), maks 20 detik.
    setTimeout(() => setRegenerating(false), 20000);
  };

  const poll = async () => {
    const statusRes = await api.adminWaStatus();
    if (!statusRes.ok) { setError(statusRes.error || "Gagal memuat status."); return; }
    setError("");
    const w = (statusRes as WaStatusBody).whatsapp;
    const isReady = !!w?.ready;
    readyRef.current = isReady;
    setReady(isReady);
    if (isReady) {
      setQrDataUrl(null); setConnecting(null); connectingSinceRef.current = null;
      autoRegenTriedRef.current = false;
      return;
    }

    // Sedang menyambung: tampilkan progres, JANGAN ambil QR/auto-regenerate
    // (keduanya akan menghancurkan koneksi yang sedang berjalan).
    const menyambung = !!w?.authenticated || typeof w?.loadingPercent === "number";
    if (menyambung) {
      if (connectingSinceRef.current === null) connectingSinceRef.current = Date.now();
      setConnecting({
        percent: typeof w?.loadingPercent === "number" ? w.loadingPercent : null,
        lambat: Date.now() - connectingSinceRef.current > CONNECTING_SLOW_MS,
      });
      setQrDataUrl(null);
      return;
    }
    connectingSinceRef.current = null;
    setConnecting(null);

    const isReconnecting = !!w?.isReconnecting;
    const attempts = w?.reconnectAttempts ?? 0;
    if (!isReconnecting && w?.hasQr === false && attempts >= BOT_MAX_RECONNECT && !autoRegenTriedRef.current) {
      autoRegenTriedRef.current = true;
      await regenerateQr(true);
      return;
    }

    // QR hanya diambil kalau bot melaporkan ada QR (hemat ~50% request).
    if (w?.hasQr === false) { setQrDataUrl(null); return; }
    const qrRes = await api.adminWaQr();
    const qrBaru = qrRes.ok ? qrRes.qrDataUrl ?? null : null;
    setQrDataUrl(qrBaru);
    // Matikan spinner "Membuat QR baru" begitu QR baru tiba (>3 detik sejak
    // klik, supaya QR lama dari klien yang belum dihancurkan tidak lolos).
    if (qrBaru && Date.now() - regenAtRef.current > 3000) setRegenerating(false);
  };

  useEffect(() => {
    cancelledRef.current = false;
    const loop = async () => {
      if (cancelledRef.current || busyRef.current) return;
      busyRef.current = true;
      try {
        await poll();
      } catch {
        // 1 siklus error tidak boleh mematikan polling selamanya.
      } finally {
        busyRef.current = false;
      }
      if (cancelledRef.current) return;
      timerRef.current = setTimeout(loop, readyRef.current ? POLL_MS_READY : POLL_MS_WAITING);
    };
    loop();

    // Aplikasi yang sempat di background (timer ditahan OS) - begitu kembali
    // aktif, langsung segarkan status.
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active" || busyRef.current) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      loop();
    });

    return () => {
      cancelledRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRegenerateQr() {
    autoRegenTriedRef.current = true;
    await regenerateQr(false);
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const res = await api.adminWaDisconnect();
      if (!res.ok) throw new Error(res.error || "Gagal memutuskan koneksi.");
      setReady(false); setQrDataUrl(null); autoRegenTriedRef.current = false; poll();
    } catch { /* pesan sudah ditangani via error state di poll berikutnya */ } finally {
      setDisconnecting(false);
    }
  }

  return (
    <View className="flex-1 bg-background px-4 pt-6 gap-5">
      <Text className="text-xs text-muted-foreground">
        Bot ini dipakai utk kirim kode OTP aktivasi/lupa password (bukan kirim notifikasi presensi/berita).
      </Text>
      <Card padding="lg">
        <View className="items-center py-6 gap-3">
          {error ? (
            <>
              <AlertTriangle size={40} color="#ef4444" />
              <Text className="font-semibold text-foreground">Tidak Bisa Menghubungi Bot</Text>
              <Text className="text-sm text-muted-foreground text-center">{error}</Text>
            </>
          ) : ready === null ? (
            <ActivityIndicator color={colors.primary} />
          ) : ready ? (
            <>
              <CheckCircle2 size={44} color="#22c55e" />
              <Text className="font-semibold text-foreground">Terhubung</Text>
              <Text className="text-sm text-muted-foreground text-center">Bot WhatsApp aktif dan siap mengirim OTP.</Text>
              <Button variant="destructive" onPress={handleDisconnect} loading={disconnecting}>Putuskan Koneksi</Button>
            </>
          ) : connecting ? (
            <>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text className="font-semibold text-foreground text-center">QR terdeteksi - sedang menyambungkan...</Text>
              <Text className="text-sm text-muted-foreground text-center">
                WhatsApp sedang menyelesaikan koneksi{connecting.percent !== null ? ` (${connecting.percent}%)` : ""}. Biasanya 10-30 detik - layar ini otomatis berubah begitu bot siap.
              </Text>
              {connecting.lambat ? (
                <>
                  <Text className="text-xs text-amber-600 text-center">Lebih lama dari biasanya. Kalau tidak selesai juga, buat QR baru lalu scan ulang.</Text>
                  <Button variant="secondary" onPress={handleRegenerateQr} disabled={regenerating}>
                    <RefreshCw size={14} color="#274D36" />{"  "}{regenerating ? "Membuat QR baru..." : "Refresh QR"}
                  </Button>
                </>
              ) : null}
            </>
          ) : (
            <>
              <Text className="font-semibold text-foreground">Perangkat Belum Terhubung</Text>
              <Text className="text-sm text-muted-foreground text-center">Scan QR dari WhatsApp (Perangkat Tertaut → Tautkan Perangkat).</Text>
              {regenerating ? (
                <View className="w-56 h-56 rounded-lg border border-border items-center justify-center">
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : qrDataUrl ? (
                <Image source={{ uri: qrDataUrl }} className="w-56 h-56 rounded-lg border border-border" />
              ) : (
                <View className="w-56 h-56 rounded-lg border border-border items-center justify-center">
                  <Text className="text-sm text-muted-foreground">Menunggu QR...</Text>
                </View>
              )}
              <Button variant="secondary" onPress={handleRegenerateQr} disabled={regenerating}>
                <RefreshCw size={14} color="#274D36" />{"  "}{regenerating ? "Membuat QR baru..." : "Refresh QR"}
              </Button>
            </>
          )}
        </View>
      </Card>
    </View>
  );
}

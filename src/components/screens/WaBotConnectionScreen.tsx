import React, { useEffect, useRef, useState } from "react";
import { View, Text, Image, ActivityIndicator } from "react-native";
import { CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { api } from "../../services/api";
import { useThemeColors } from "../../context/ThemeContext";

const POLL_MS_WAITING = 1200;
const POLL_MS_READY = 5000;

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

  const regenerateQr = async (isAuto: boolean) => {
    setRegenerating(true);
    try {
      await api.adminWaRegenerateQr();
    } catch {
      if (!isAuto) setError("Gagal membuat QR baru. Coba lagi sebentar.");
    } finally {
      setRegenerating(false);
    }
  };

  const poll = async () => {
    const statusRes = await api.adminWaStatus();
    if (!statusRes.ok) { setError(statusRes.error || "Gagal memuat status."); return; }
    setError("");
    const isReady = !!statusRes.whatsapp?.ready;
    readyRef.current = isReady;
    setReady(isReady);
    if (isReady) { setQrDataUrl(null); autoRegenTriedRef.current = false; return; }

    const isReconnecting = !!statusRes.whatsapp?.isReconnecting;
    const attempts = statusRes.whatsapp?.reconnectAttempts ?? 0;
    if (!isReconnecting && attempts > 0 && !autoRegenTriedRef.current) {
      autoRegenTriedRef.current = true;
      await regenerateQr(true);
      return;
    }

    const qrRes = await api.adminWaQr();
    setQrDataUrl(qrRes.ok ? qrRes.qrDataUrl ?? null : null);
  };

  useEffect(() => {
    let cancelled = false;
    const loop = async () => {
      if (cancelled) return;
      await poll();
      if (cancelled) return;
      timerRef.current = setTimeout(loop, readyRef.current ? POLL_MS_READY : POLL_MS_WAITING);
    };
    loop();
    return () => { cancelled = true; if (timerRef.current) clearTimeout(timerRef.current); };
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

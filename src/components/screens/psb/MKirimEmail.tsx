import React, { useEffect, useRef, useState } from "react";
import { View, Text, Alert } from "react-native";
import { Button } from "../../ui/Button";
import { api } from "../../../services/api";
import type { Res } from "./mShared";

// Tombol kirim email untuk jadwal/pengumuman PSB (HP): tanda terkirim, "kirim ke yang belum", dan "kirim ulang semua".
export interface RingkasanEmail { terkirim: number; gagal: number; terakhir: string | null; sedang: boolean }
interface Props { jenis: "jadwal" | "pengumuman"; id: number; email: RingkasanEmail; bolehKirim: boolean; alasanNonaktif?: string; onSelesai: () => void }

export function KirimEmail({ jenis, id, email, bolehKirim, alasanNonaktif, onSelesai }: Props) {
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState<{ ok: boolean; t: string } | null>(null);
  const pantau = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    if (!email.sedang) return undefined;
    let n = 0;
    pantau.current = setInterval(() => { n += 1; onSelesai(); if (n > 60 && pantau.current) clearInterval(pantau.current); }, 3000);
    return () => { if (pantau.current) clearInterval(pantau.current); };
  }, [email.sedang, onSelesai]);

  const jalankan = async (semua: boolean) => {
    setSibuk(true); setPesan(null);
    const res = (await (jenis === "jadwal" ? api.psbJadwalKirim(id, semua) : api.psbPengumumanKirim(id, semua))) as Res<{ antrian: number }>;
    setSibuk(false);
    if (!res.success) { setPesan({ ok: false, t: res.message || "Gagal mengirim." }); return; }
    const n = res.data?.antrian ?? 0;
    setPesan(n === 0 ? { ok: true, t: semua ? "Tidak ada penerima dengan email." : "Semua penerima sudah menerima email. Pakai Kirim ulang semua bila perlu." } : { ok: true, t: `Mengirim ke ${n} penerima... status diperbarui otomatis.` });
    onSelesai();
  };
  const kirim = (semua: boolean) => {
    if (!semua) { void jalankan(false); return; }
    Alert.alert("Kirim ulang", "Kirim ulang email ke SEMUA penerima, termasuk yang sudah menerima? Orang tua akan menerima email yang sama sekali lagi.", [{ text: "Batal", style: "cancel" }, { text: "Kirim ulang", onPress: () => void jalankan(true) }]);
  };

  const adaRiwayat = email.terkirim + email.gagal > 0;
  const status = email.sedang ? "Sedang mengirim email..."
    : adaRiwayat ? `Email: ${email.terkirim} terkirim${email.gagal ? `, ${email.gagal} gagal` : ""}${email.terakhir ? ` · ${new Date(email.terakhir).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}`
      : "Email belum dikirim";
  return (
    <View className="gap-1.5 mt-1">
      <Text className={`text-xs ${email.gagal ? "text-amber-700" : adaRiwayat && !email.sedang ? "text-green-700" : "text-muted-foreground"}`}>{adaRiwayat && !email.sedang && !email.gagal ? "✓ " : ""}{status}</Text>
      {bolehKirim && !email.sedang ? (
        <View className="flex-row flex-wrap gap-2">
          <Button size="sm" variant={adaRiwayat ? "outline" : "primary"} disabled={sibuk} loading={sibuk} onPress={() => kirim(false)}>{adaRiwayat ? "Kirim ke yang belum" : "Kirim email"}</Button>
          {adaRiwayat ? <Button size="sm" variant="outline" disabled={sibuk} onPress={() => kirim(true)}>Kirim ulang semua</Button> : null}
        </View>
      ) : null}
      {!bolehKirim && alasanNonaktif ? <Text className="text-xs text-muted-foreground">{alasanNonaktif} untuk mengirim email.</Text> : null}
      {pesan ? <Text className={`text-xs ${pesan.ok ? "text-green-700" : "text-red-600"}`}>{pesan.t}</Text> : null}
    </View>
  );
}

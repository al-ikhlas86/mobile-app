import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { Receipt, AlertCircle, ChevronDown } from "lucide-react-native";
import { Card } from "../ui/Card";
import { api } from "../../services/api";
import { useThemeColors } from "../../context/ThemeContext";
import { formatRupiah, formatTanggal, formatPeriodeBulan, formatWaktuPerbarui, tahunAjaranDariPeriode, tahunAjaranBerjalan } from "../../utils/keuanganFormat";

interface Baris { nama: string; bagian: string; jumlah: number; qty: number | null }
interface Slip {
  id: string; periode: string; nomor_slip: string | null; hari_masuk: number | null; tanggal_bayar: string | null;
  pendapatan: Baris[]; potongan: Baris[]; total_pendapatan: number; total_potongan: number; gaji_bersih: number; diperbarui: string;
}

// Slip Gaji guru/pegawai (2026-10-01) - port dari webview (SlipGajiScreen.tsx).
// Hanya slip yang SUDAH DIBAYAR yang pernah dikirim aplikasi Keuangan, dan
// endpoint server dibatasi ke pemilik akun sendiri. Semua slip tersimpan di server; layar
// menampilkan PER TAHUN AJARAN (Juli-Juni) - default tahun ajaran berjalan, yang lama dipilih
// lewat chip di atas daftar.
export function SlipGajiScreen() {
  const colors = useThemeColors();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [slips, setSlips] = useState<Slip[]>([]);
  const [terbuka, setTerbuka] = useState<string | null>(null);
  const [tahunAjaran, setTahunAjaran] = useState<string | null>(null);

  useEffect(() => {
    let batal = false;
    api.keuanganSlip().then((res: any) => {
      if (batal) return;
      if (!res?.success) { setError(res?.message ?? "Gagal memuat slip gaji."); setLoading(false); return; }
      const urut = ([...(res.data ?? [])] as Slip[]).sort((a, b) => b.periode.localeCompare(a.periode));
      setSlips(urut);
      // Default: tahun ajaran berjalan kalau punya slip, kalau tidak -> tahun ajaran terbaru yang punya slip.
      const daftar = [...new Set(urut.map((x) => tahunAjaranDariPeriode(x.periode)))];
      const awal = daftar.includes(tahunAjaranBerjalan()) ? tahunAjaranBerjalan() : (daftar[0] ?? null);
      setTahunAjaran(awal);
      setTerbuka(urut.find((x) => tahunAjaranDariPeriode(x.periode) === awal)?.id ?? null);
      setLoading(false);
    }).catch(() => { if (!batal) { setError("Gagal memuat slip gaji. Periksa koneksi internet."); setLoading(false); } });
    return () => { batal = true; };
  }, []);

  const daftarTahun = useMemo(() => {
    const hitung = new Map<string, number>();
    slips.forEach((x) => hitung.set(tahunAjaranDariPeriode(x.periode), (hitung.get(tahunAjaranDariPeriode(x.periode)) ?? 0) + 1));
    return [...hitung.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [slips]);
  const slipTampil = tahunAjaran ? slips.filter((x) => tahunAjaranDariPeriode(x.periode) === tahunAjaran) : slips;

  if (loading) {
    return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator color={colors.primary} /></View>;
  }
  if (error) {
    return (
      <View className="flex-1 bg-background p-4">
        <Card><View className="flex-row items-start gap-2.5">
          <AlertCircle size={16} color="#dc2626" /><Text className="text-sm text-foreground flex-1">{error}</Text>
        </View></Card>
      </View>
    );
  }
  if (slips.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-background gap-4 px-8">
        <View className="w-20 h-20 rounded-2xl bg-primary/10 items-center justify-center"><Receipt size={36} color={colors.primary} /></View>
        <View>
          <Text className="text-lg font-bold text-foreground text-center">Belum Ada Slip Gaji</Text>
          <Text className="text-sm text-muted-foreground mt-2 text-center">Slip gaji muncul di sini setelah gaji bulan tersebut dibayarkan oleh bagian keuangan sekolah.</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 12 }}>
      {daftarTahun.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ flexGrow: 0 }}>
          {daftarTahun.map(([ta, jumlah]) => {
            const aktif = ta === tahunAjaran;
            return (
              <Pressable
                key={ta}
                onPress={() => { setTahunAjaran(ta); setTerbuka(slips.find((x) => tahunAjaranDariPeriode(x.periode) === ta)?.id ?? null); }}
                className={`px-3.5 py-2 rounded-xl border ${aktif ? "bg-primary border-primary" : "bg-card border-border"}`}
              >
                <Text className={`text-sm font-medium ${aktif ? "text-primary-foreground" : "text-foreground"}`}>{ta}</Text>
                <Text className={`text-[10px] ${aktif ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{jumlah} slip</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      {slipTampil.map((s) => {
        const buka = terbuka === s.id;
        return (
          <Card key={s.id} padding="none">
            <Pressable onPress={() => setTerbuka(buka ? null : s.id)} className="flex-row items-center justify-between gap-3 p-4">
              <View>
                <Text className="text-sm font-semibold text-foreground">{formatPeriodeBulan(s.periode)}</Text>
                <Text className="text-xs text-muted-foreground">Dibayar {formatTanggal(s.tanggal_bayar)}</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Text className="text-sm font-bold text-green-600 dark:text-green-400">{formatRupiah(s.gaji_bersih)}</Text>
                <View style={{ transform: [{ rotate: buka ? "180deg" : "0deg" }] }}><ChevronDown size={16} color={colors.mutedForeground ?? "#6b7280"} /></View>
              </View>
            </Pressable>
            {buka && (
              <View className="px-4 pb-4 pt-3 border-t border-border" style={{ gap: 16 }}>
                {s.nomor_slip ? <Text className="text-[11px] text-muted-foreground">No. slip {s.nomor_slip}{s.hari_masuk != null ? ` · ${s.hari_masuk} hari masuk` : ""}</Text> : null}
                <Bagian judul="Pendapatan" baris={s.pendapatan} total={s.total_pendapatan} />
                {s.potongan.length > 0 && <Bagian judul="Potongan" baris={s.potongan} total={s.total_potongan} negatif />}
                <View className="flex-row justify-between items-center rounded-xl bg-primary/10 px-3 py-2.5">
                  <Text className="text-sm font-semibold text-foreground">Gaji bersih</Text>
                  <Text className="text-sm font-bold text-foreground">{formatRupiah(s.gaji_bersih)}</Text>
                </View>
                <Text className="text-[11px] text-muted-foreground">Data dari bagian keuangan sekolah · diperbarui {formatWaktuPerbarui(s.diperbarui)}</Text>
              </View>
            )}
          </Card>
        );
      })}
    </ScrollView>
  );
}

function Bagian({ judul, baris, total, negatif = false }: { judul: string; baris: Baris[]; total: number; negatif?: boolean }) {
  return (
    <View>
      <Text className="text-xs font-semibold text-muted-foreground mb-1.5">{judul}</Text>
      <View style={{ gap: 6 }}>
        {baris.map((b, i) => (
          <View key={`${b.nama}-${i}`} className="flex-row justify-between gap-3">
            <Text className="text-sm text-foreground flex-1">{b.nama}{b.qty != null && b.qty !== 0 ? <Text className="text-muted-foreground"> × {b.qty}</Text> : null}</Text>
            <Text className={`text-sm ${negatif ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>{negatif ? "−" : ""}{formatRupiah(b.jumlah)}</Text>
          </View>
        ))}
      </View>
      <View className="flex-row justify-between border-t border-border mt-2 pt-2">
        <Text className="text-sm font-semibold text-foreground">Total {judul.toLowerCase()}</Text>
        <Text className="text-sm font-semibold text-foreground">{formatRupiah(total)}</Text>
      </View>
    </View>
  );
}

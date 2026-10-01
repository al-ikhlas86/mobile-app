import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { Wallet, AlertCircle } from "lucide-react-native";
import { Card } from "../ui/Card";
import { ChildSwitcher, type ChildOption } from "../ChildSwitcher";
import { api } from "../../services/api";
import { useThemeColors } from "../../context/ThemeContext";
import { formatRupiah, formatTanggal, formatWaktuPerbarui } from "../../utils/keuanganFormat";

interface Tagihan {
  id: string; kode: string; jenis: string; periode: string; jumlah: number; terbayar: number; sisa: number;
  jatuh_tempo: string | null; status: "BelumDibayar" | "Sebagian" | "Lunas"; cicilan_ke: number | null; cicilan_dari: number | null; diperbarui: string;
}
interface Pembayaran { id: string; kode: string; jenis: string; periode: string; tanggal: string; metode: string; jumlah: number; keterangan: string | null; diperbarui: string }
interface DataAnak {
  anak: { id: number; nama: string; nis: string; kelas: string | null };
  tagihan: Tagihan[];
  pembayaran: Pembayaran[];
  saldo: { saldo: number; diperbarui: string } | null;
}

const BADGE: Record<Tagihan["status"], { teks: string; box: string; txt: string }> = {
  BelumDibayar: { teks: "Belum dibayar", box: "bg-red-100 dark:bg-red-900/30", txt: "text-red-700 dark:text-red-300" },
  Sebagian: { teks: "Dibayar sebagian", box: "bg-amber-100 dark:bg-amber-900/30", txt: "text-amber-700 dark:text-amber-300" },
  Lunas: { teks: "Lunas", box: "bg-green-100 dark:bg-green-900/30", txt: "text-green-700 dark:text-green-300" },
};

// Rincian Biaya orang tua (2026-10-01) - port dari webview (DetailPembayaran.tsx).
// HANYA membaca salinan data yang dikirim aplikasi Keuangan sekolah (sumber
// kebenaran ada di sana); "diperbarui" selalu tampil karena PC Keuangan bisa
// sempat offline. Nominal tidak pernah masuk ke chatbot AI.
export function DetailPembayaran() {
  const colors = useThemeColors();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<DataAnak[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [semua, setSemua] = useState(false);

  useEffect(() => {
    let batal = false;
    api.keuanganAnak().then((res: any) => {
      if (batal) return;
      if (!res?.success) { setError(res?.message ?? "Gagal memuat rincian biaya."); setLoading(false); return; }
      setData(res.data ?? []);
      setActiveId(res.data?.[0]?.anak.id ?? null);
      setLoading(false);
    }).catch(() => { if (!batal) { setError("Gagal memuat rincian biaya. Periksa koneksi internet."); setLoading(false); } });
    return () => { batal = true; };
  }, []);

  const pilihan: ChildOption[] = data.map((d) => ({ id: d.anak.id, nama: d.anak.nama, kelas_nama: d.anak.kelas }));
  const aktif = data.find((d) => d.anak.id === activeId) ?? null;

  const { belumLunas, lunas, totalSisa, terbaru } = useMemo(() => {
    const t = aktif?.tagihan ?? [];
    const urut = (a: Tagihan, b: Tagihan) => (a.jatuh_tempo ?? "9999").localeCompare(b.jatuh_tempo ?? "9999");
    const belum = t.filter((x) => x.status !== "Lunas").sort(urut);
    const sudah = t.filter((x) => x.status === "Lunas").sort((a, b) => urut(b, a));
    const stempel = [...t.map((x) => x.diperbarui), ...(aktif?.pembayaran ?? []).map((x) => x.diperbarui), aktif?.saldo?.diperbarui ?? ""]
      .filter(Boolean).sort().pop() ?? null;
    return { belumLunas: belum, lunas: sudah, totalSisa: belum.reduce((n, x) => n + x.sisa, 0), terbaru: stempel };
  }, [aktif]);

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
  if (!aktif) {
    return (
      <View className="flex-1 items-center justify-center bg-background gap-4 px-8">
        <View className="w-20 h-20 rounded-2xl bg-primary/10 items-center justify-center"><Wallet size={36} color={colors.primary} /></View>
        <View>
          <Text className="text-lg font-bold text-foreground text-center">Belum Ada Anak Tertaut</Text>
          <Text className="text-sm text-muted-foreground mt-2 text-center">Akun ini belum tertaut ke data anak, jadi rincian biaya belum bisa ditampilkan.</Text>
        </View>
      </View>
    );
  }

  const kosong = aktif.tagihan.length === 0 && aktif.pembayaran.length === 0 && !aktif.saldo;
  const tagihanTampil = semua ? [...belumLunas, ...lunas] : belumLunas;

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 16 }}>
      <ChildSwitcher children={pilihan} activeId={activeId} onChange={setActiveId} />

      {kosong ? (
        <Card>
          <Text className="text-sm text-foreground font-medium">Belum ada data keuangan untuk {aktif.anak.nama}.</Text>
          <Text className="text-xs text-muted-foreground mt-1.5">
            Data tagihan dan pembayaran dikirim otomatis dari bagian keuangan sekolah. Kalau Anda merasa sudah ada tagihan, mohon cek lagi nanti atau hubungi sekolah.
          </Text>
        </Card>
      ) : (
        <>
          <Card>
            <Text className="text-xs text-muted-foreground">Total belum dibayar · {aktif.anak.nama}</Text>
            <Text className={`text-2xl font-bold mt-1 ${totalSisa > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>{formatRupiah(totalSisa)}</Text>
            {aktif.saldo && aktif.saldo.saldo !== 0 && (
              <Text className="text-xs text-muted-foreground mt-2">Saldo titipan di sekolah: <Text className="font-semibold text-foreground">{formatRupiah(aktif.saldo.saldo)}</Text></Text>
            )}
            {terbaru && <Text className="text-[11px] text-muted-foreground mt-2">Data dari bagian keuangan sekolah · diperbarui {formatWaktuPerbarui(terbaru)}</Text>}
          </Card>

          <View>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-sm font-semibold text-foreground">{semua ? "Semua Tagihan" : "Tagihan Belum Lunas"}</Text>
              {lunas.length > 0 && (
                <Pressable onPress={() => setSemua((v) => !v)}>
                  <Text className="text-xs text-primary font-medium">{semua ? "Hanya yang belum lunas" : `Lihat yang lunas (${lunas.length})`}</Text>
                </Pressable>
              )}
            </View>
            {tagihanTampil.length === 0 ? (
              <Card><Text className="text-sm text-muted-foreground">Tidak ada tagihan yang belum dibayar. 🎉</Text></Card>
            ) : (
              <View style={{ gap: 8 }}>
                {tagihanTampil.map((t) => (
                  <Card key={t.id}>
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-foreground">{t.jenis}</Text>
                        <Text className="text-xs text-muted-foreground">
                          {t.periode}{t.cicilan_ke && t.cicilan_dari ? ` · cicilan ${t.cicilan_ke}/${t.cicilan_dari}` : ""}
                          {t.jatuh_tempo ? ` · jatuh tempo ${formatTanggal(t.jatuh_tempo)}` : ""}
                        </Text>
                      </View>
                      <View className={`px-2 py-1 rounded-full ${BADGE[t.status].box}`}>
                        <Text className={`text-[10px] font-semibold ${BADGE[t.status].txt}`}>{BADGE[t.status].teks}</Text>
                      </View>
                    </View>
                    <View className="flex-row justify-between mt-3">
                      <Text className="text-xs text-muted-foreground">Tagihan {formatRupiah(t.jumlah)}</Text>
                      <Text className="text-xs text-foreground font-medium">{t.status === "Lunas" ? "Lunas" : `Sisa ${formatRupiah(t.sisa)}`}</Text>
                    </View>
                  </Card>
                ))}
              </View>
            )}
          </View>

          <View>
            <Text className="text-sm font-semibold text-foreground mb-2">Riwayat Pembayaran</Text>
            {aktif.pembayaran.length === 0 ? (
              <Card><Text className="text-sm text-muted-foreground">Belum ada pembayaran tercatat.</Text></Card>
            ) : (
              <View style={{ gap: 8 }}>
                {aktif.pembayaran.slice(0, 30).map((p) => (
                  <Card key={p.id}>
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-foreground">{p.jenis}</Text>
                        <Text className="text-xs text-muted-foreground">{p.periode} · {formatTanggal(p.tanggal)} · {p.metode}</Text>
                        {p.keterangan ? <Text className="text-xs text-muted-foreground mt-0.5">{p.keterangan}</Text> : null}
                      </View>
                      <Text className="text-sm font-semibold text-green-600 dark:text-green-400">{formatRupiah(p.jumlah)}</Text>
                    </View>
                  </Card>
                ))}
              </View>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

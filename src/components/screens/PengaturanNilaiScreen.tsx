import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, Switch, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { AlertCircle, CheckCircle2, Plus, Trash2 } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { SimplePicker } from "../ui/SimplePicker";
import { api } from "../../services/api";
import { useTheme, useThemeColors } from "../../context/ThemeContext";
import { konfirmasi } from "../../utils/konfirmasi";
import type { KomponenNilai } from "../../utils/nilaiRaport";

// Pengaturan Nilai (2026-10-02) - port native dari webview PengaturanNilaiScreen.tsx.
// Admin TU/Admin IT mengatur komponen nilai, bobot, dan KKM per mata pelajaran (atau bawaan
// semua mapel), plus saklar fitur untuk Admin IT. Template Excel nanti dibuat dari pengaturan
// ini, jadi tidak ada angka yang ditulis ganda. Checkbox web -> <Switch> bawaan RN.

interface Konf { kkm: number; komponen: KomponenNilai[] }
interface MapelKonf extends Konf { mapelSourceId: number; nama: string; khusus: boolean }
interface DataKonf { units: { unitId: number; label: string }[]; unitId: number; bawaan: Konf & { sumber: string }; mapel: MapelKonf[] }
interface Baris { nama: string; bobot: string }

export function PengaturanNilaiScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { isDark } = useTheme();
  const [aktif, setAktif] = useState<boolean | null>(null);
  const [bisaMengatur, setBisaMengatur] = useState(false);
  const [mengubahSaklar, setMengubahSaklar] = useState(false);
  const [data, setData] = useState<DataKonf | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [error, setError] = useState("");
  const [sunting, setSunting] = useState<{ mapelSourceId: number; nama: string; khusus: boolean } | null>(null);
  const [baris, setBaris] = useState<Baris[]>([]);
  const [kkm, setKkm] = useState("70");
  const [menyimpan, setMenyimpan] = useState(false);
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null);

  const muat = useCallback(async (u?: number) => {
    setMemuat(true);
    setError("");
    const [st, res]: any[] = await Promise.all([api.raportStatus(), api.raportKonfigurasi(u)]);
    if (st?.success) { setAktif(st.data.aktif); setBisaMengatur(st.data.bisaMengatur); }
    if (!res?.success) { setError(res?.message ?? "Gagal memuat pengaturan."); setMemuat(false); return; }
    setData(res.data);
    setMemuat(false);
  }, []);
  useEffect(() => { muat(); }, [muat]);

  async function gantiSaklar(nilai: boolean) {
    if (!(await konfirmasi(
      nilai ? "Nyalakan fitur Nilai" : "Matikan fitur Nilai",
      nilai ? "Nyalakan fitur Nilai? Guru dan orang tua akan melihat menu Nilai." : "Matikan fitur Nilai? Menu Nilai disembunyikan dari guru dan orang tua (data tetap tersimpan).",
      nilai ? "Nyalakan" : "Matikan"
    ))) return;
    setMengubahSaklar(true);
    const res: any = await api.raportSetAktif(nilai);
    if (res?.success) setAktif(nilai);
    else setPesan({ ok: false, teks: res?.message ?? "Gagal mengubah saklar." });
    setMengubahSaklar(false);
  }

  function mulaiSunting(t: { mapelSourceId: number; nama: string; khusus: boolean }, konf: Konf) {
    setSunting(t);
    setBaris(konf.komponen.map((k) => ({ nama: k.nama, bobot: String(k.bobot) })));
    setKkm(String(konf.kkm));
    setPesan(null);
  }

  const total = baris.reduce((a, b) => a + (Number(b.bobot.replace(",", ".")) || 0), 0);
  const totalPas = Math.abs(total - 100) < 0.001;

  async function simpan() {
    if (!sunting || !data) return;
    setMenyimpan(true);
    setPesan(null);
    const res: any = await api.raportSimpanKonfigurasi({
      unitId: data.unitId, mapelSourceId: sunting.mapelSourceId, kkm: Number(kkm),
      komponen: baris.map((b) => ({ nama: b.nama.trim(), bobot: Number(b.bobot.replace(",", ".")) })),
    });
    setMenyimpan(false);
    if (!res?.success) { setPesan({ ok: false, teks: res?.message ?? "Gagal menyimpan." }); return; }
    setPesan({ ok: true, teks: res.data.peringatan ? `Tersimpan. ${res.data.peringatan}` : "Tersimpan." });
    setSunting(null);
    await muat(data.unitId);
  }

  async function kembalikan() {
    if (!sunting || !data || sunting.mapelSourceId === 0) return;
    if (!(await konfirmasi("Kembalikan ke bawaan", `Kembalikan ${sunting.nama} ke pengaturan bawaan?`, "Kembalikan"))) return;
    setMenyimpan(true);
    const res: any = await api.raportHapusKonfigurasi(data.unitId, sunting.mapelSourceId);
    setMenyimpan(false);
    if (!res?.success) { setPesan({ ok: false, teks: res?.message ?? "Gagal." }); return; }
    setSunting(null);
    setPesan({ ok: true, teks: "Dikembalikan ke bawaan." });
    await muat(data.unitId);
  }

  if (memuat && !data) {
    return <View className="flex-1 bg-background items-center justify-center"><ActivityIndicator color={colors.primary} /></View>;
  }
  if (error && !data) {
    return (
      <View className="flex-1 bg-background px-4 pt-5">
        <Card padding="md"><View className="flex-row items-start gap-2.5"><AlertCircle size={16} color="#dc2626" /><Text className="text-sm text-foreground flex-1">{error}</Text></View></Card>
      </View>
    );
  }
  if (!data) return null;

  const ringkasKomponen = (k: Konf) => k.komponen.map((x) => `${x.nama} ${x.bobot}%`).join(" · ");

  return (
    <KeyboardAwareScrollView
      className="flex-1 bg-background px-4 pt-5"
      contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 16 }}
      bottomOffset={20}
      keyboardShouldPersistTaps="handled"
    >
      {bisaMengatur && (
        <Card padding="md" className="flex-row items-center justify-between gap-3">
          <View className="flex-1">
            <Text className="text-sm font-semibold text-foreground">Fitur Nilai untuk guru dan orang tua</Text>
            <Text className="text-xs text-muted-foreground">{aktif ? "Menyala: menu Nilai tampil." : "Mati: hanya Admin IT yang bisa mencoba."}</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Switch
              value={Boolean(aktif)} disabled={mengubahSaklar || aktif === null} onValueChange={gantiSaklar}
              trackColor={{ false: isDark ? "#3f3f46" : "#d1d5db", true: colors.primary }}
              thumbColor="#ffffff"
            />
            <Text className="text-sm text-foreground">{aktif ? "Aktif" : "Nonaktif"}</Text>
          </View>
        </Card>
      )}

      {data.units.length > 1 && (
        <View style={{ zIndex: 30 }}>
          <Text className="text-xs text-muted-foreground mb-1">Unit</Text>
          <SimplePicker value={String(data.unitId)} options={data.units.map((u) => ({ value: String(u.unitId), label: u.label }))} onChange={(v) => { setSunting(null); muat(Number(v)); }} />
        </View>
      )}

      {pesan && !sunting && (
        <Card padding="md"><View className="flex-row items-start gap-2.5">
          {pesan.ok ? <CheckCircle2 size={16} color="#16a34a" /> : <AlertCircle size={16} color="#dc2626" />}
          <Text className="text-sm text-foreground flex-1">{pesan.teks}</Text>
        </View></Card>
      )}

      {sunting ? (
        <Card padding="md" className="gap-3">
          <Text className="text-sm font-semibold text-foreground">{sunting.mapelSourceId === 0 ? "Bawaan semua mata pelajaran" : sunting.nama}</Text>
          <View className="gap-2">
            {baris.map((b, i) => (
              <View key={i} className="flex-row items-center gap-2">
                <View className="flex-1">
                  <Input value={b.nama} onChangeText={(t) => setBaris((x) => x.map((y, j) => (j === i ? { ...y, nama: t } : y)))} placeholder="Nama komponen" maxLength={50} />
                </View>
                <View style={{ width: 70 }}>
                  <Input value={b.bobot} onChangeText={(t) => setBaris((x) => x.map((y, j) => (j === i ? { ...y, bobot: t } : y)))} placeholder="Bobot" keyboardType="decimal-pad" className="text-center px-2" />
                </View>
                <Text className="text-sm text-muted-foreground">%</Text>
                <Pressable accessibilityLabel="Hapus komponen" disabled={baris.length <= 1} onPress={() => setBaris((x) => x.filter((_, j) => j !== i))} className={`p-2 ${baris.length <= 1 ? "opacity-40" : ""}`}>
                  <Trash2 size={16} color={colors.mutedForeground} />
                </Pressable>
              </View>
            ))}
          </View>
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <Button size="sm" variant="outline" disabled={baris.length >= 8} onPress={() => setBaris((x) => [...x, { nama: "", bobot: "" }])}>
              <Plus size={14} color={colors.primary} />{" "}Tambah komponen
            </Button>
            <Text className={`text-sm font-semibold ${totalPas ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>Total bobot {Math.round(total * 100) / 100}% {totalPas ? "" : "(harus 100%)"}</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Text className="text-sm text-foreground">KKM</Text>
            <View style={{ width: 80 }}>
              <Input value={kkm} onChangeText={setKkm} keyboardType="number-pad" maxLength={3} className="text-center px-2" />
            </View>
          </View>
          {pesan ? <Text className={`text-xs ${pesan.ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{pesan.teks}</Text> : null}
          <View className="flex-row flex-wrap gap-2">
            <Button size="sm" disabled={menyimpan || !totalPas} loading={menyimpan} onPress={simpan}>{menyimpan ? "Menyimpan..." : "Simpan"}</Button>
            <Button size="sm" variant="ghost" disabled={menyimpan} onPress={() => { setSunting(null); setPesan(null); }}>Batal</Button>
            {sunting.mapelSourceId !== 0 && sunting.khusus && <Button size="sm" variant="outline" disabled={menyimpan} onPress={kembalikan}>Kembalikan ke bawaan</Button>}
          </View>
          <Text className="text-[11px] text-muted-foreground leading-4">Mengubah komponen tidak menghapus nilai lama, tetapi nilai pada komponen yang dihapus tidak ikut dihitung lagi. Sebaiknya atur sebelum guru mulai mengisi.</Text>
        </Card>
      ) : (
        <>
          <Card padding="md" className="gap-1">
            <View className="flex-row items-center justify-between gap-2">
              <Text className="text-sm font-semibold text-foreground flex-1">Bawaan semua mata pelajaran</Text>
              <Button size="sm" variant="outline" onPress={() => mulaiSunting({ mapelSourceId: 0, nama: "Bawaan", khusus: true }, data.bawaan)}>Atur</Button>
            </View>
            <Text className="text-xs text-muted-foreground">{ringkasKomponen(data.bawaan)} · KKM {data.bawaan.kkm}</Text>
            {data.bawaan.sumber === "bawaan" && <Text className="text-[11px] text-muted-foreground">Belum diatur: memakai pengaturan bawaan sistem.</Text>}
          </Card>
          <View className="gap-2">
            <Text className="text-xs font-semibold text-muted-foreground">Per mata pelajaran</Text>
            {data.mapel.map((m) => (
              <Card key={m.mapelSourceId} padding="md" className="gap-1">
                <View className="flex-row items-center justify-between gap-2">
                  <View className="flex-1 flex-row items-center gap-2">
                    <Text className="text-sm font-medium text-foreground flex-shrink" numberOfLines={1}>{m.nama}</Text>
                    <Badge variant={m.khusus ? "warning" : "muted"}>{m.khusus ? "Khusus" : "Bawaan"}</Badge>
                  </View>
                  <Button size="sm" variant="ghost" onPress={() => mulaiSunting({ mapelSourceId: m.mapelSourceId, nama: m.nama, khusus: m.khusus }, m)}>Atur</Button>
                </View>
                <Text className="text-xs text-muted-foreground">{ringkasKomponen(m)} · KKM {m.kkm}</Text>
              </Card>
            ))}
            {data.mapel.length === 0 && <Text className="text-sm text-muted-foreground">Belum ada mata pelajaran dari Data Master.</Text>}
          </View>
        </>
      )}
    </KeyboardAwareScrollView>
  );
}

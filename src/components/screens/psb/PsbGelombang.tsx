import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Alert, Pressable, Share, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, AlertTriangle } from "lucide-react-native";
import { Card } from "../../ui/Card";
import { Button } from "../../ui/Button";
import { api } from "../../../services/api";
import { useThemeColors } from "../../../context/ThemeContext";
import { Lencana, LABEL_GELOMBANG, rupiah, Isian, Kolom, type GelombangDetail, type Izin, type Res } from "./mShared";
import { FormGelombang } from "./MFormGelombang";
import { TabPendaftar } from "./MPendaftar";
import { TabFormulir } from "./MFormulir";
import { TabJadwal } from "./MJadwal";
import { TabPengumuman } from "./MPengumuman";

// Detail satu gelombang di HP: tab Pendaftar, Formulir, Jadwal, Pengumuman, Pengaturan.
type Tab = "pendaftar" | "formulir" | "jadwal" | "pengumuman" | "pengaturan";
const TABS: { id: Tab; teks: string }[] = [{ id: "pendaftar", teks: "Pendaftar" }, { id: "formulir", teks: "Formulir" }, { id: "jadwal", teks: "Jadwal" }, { id: "pengumuman", teks: "Pengumuman" }, { id: "pengaturan", teks: "Pengaturan" }];
const hariIni = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

function TabPengaturan({ g, bisaGoPublik, onChanged, onHapus }: { g: GelombangDetail; bisaGoPublik: boolean; onChanged: () => void; onHapus: () => void }) {
  const [mode, setMode] = useState<"lihat" | "ubah" | "salin" | "perpanjang">("lihat");
  const [sibuk, setSibuk] = useState(false);
  const [tampilQr, setTampilQr] = useState(false);
  const [tglBaru, setTglBaru] = useState("");
  const [salinan, setSalinan] = useState({ nama: "", tanggalBuka: "", tanggalTutup: "" });
  const [galat, setGalat] = useState("");
  const [hapusPenuh_, setHapusPenuh] = useState(false);
  const [konfirmasiHapus, setKonfirmasiHapus] = useState("");
  const tautan = g.tautan ?? "";
  const arsip = g.status === "ditutup";

  const jalankan = async (fn: () => Promise<unknown>) => {
    setSibuk(true); const res = (await fn()) as Res; setSibuk(false);
    if (!res.success) { Alert.alert("Gagal", res.message || "Gagal."); return false; }
    onChanged(); return true;
  };
  const konfirmasi = (judul: string, isi: string, aksi: string, fn: () => Promise<unknown>, merusak = false) => Alert.alert(judul, isi, [
    { text: "Batal", style: "cancel" }, { text: aksi, style: merusak ? "destructive" : "default", onPress: () => void jalankan(fn) },
  ]);
  const terbit = (nilai: boolean) => konfirmasi(nilai ? "Terbitkan gelombang" : "Tarik dari publik", nilai ? "Setelah GO PUBLIK dibuka, orang tua bisa mendaftar selama masa pendaftaran." : "Tautan pendaftaran langsung mati; data pendaftar tetap ada.", nilai ? "Terbitkan" : "Tarik", () => api.psbGelombangTerbit(g.id, nilai));
  const saklar = (judul: string, isi: string, aksi: string, d: { goPublik?: boolean; daftarOnline?: boolean }, merusak = false) => konfirmasi(judul, isi, aksi, () => api.psbSaklar(g.id, d), merusak);
  const tutup = () => konfirmasi("Tutup lebih awal", "Tautan pendaftaran langsung mati. Bisa dibuka lagi lewat Perpanjang.", "Tutup", () => api.psbGelombangTutup(g.id), true);
  const hapus = () => Alert.alert("Hapus gelombang", `Hapus "${g.nama}" beserta formulirnya? Tidak bisa dibatalkan.`, [
    { text: "Batal", style: "cancel" },
    { text: "Hapus", style: "destructive", onPress: async () => {
      setSibuk(true); const res = (await api.psbGelombangHapus(g.id)) as Res; setSibuk(false);
      if (res.success) { onHapus(); return; }
      if (res.code === "ADA_PENDAFTAR") { setHapusPenuh(true); setGalat(res.message || ""); return; }
      Alert.alert("Gagal", res.message || "Gagal menghapus.");
    } },
  ]);
  const hapusPenuh = async () => {
    setSibuk(true); const res = (await api.psbGelombangHapus(g.id, konfirmasiHapus)) as Res; setSibuk(false);
    if (!res.success) { setGalat(res.message || "Gagal menghapus."); return; }
    onHapus();
  };
  const simpanPerpanjang = async () => { setGalat(""); setSibuk(true); const res = (await api.psbGelombangPerpanjang(g.id, tglBaru.trim())) as Res; setSibuk(false); if (!res.success) { setGalat(res.message || "Gagal."); return; } setMode("lihat"); onChanged(); };
  const simpanSalinan = async () => {
    setGalat(""); setSibuk(true);
    const res = (await api.psbGelombangSalin(g.id, salinan)) as Res<{ id: number }>;
    setSibuk(false);
    if (!res.success) { setGalat(res.message || "Gagal menyalin."); return; }
    Alert.alert("Tersalin", "Gelombang disalin sebagai draf. Buka dari daftar gelombang untuk memeriksa lalu menerbitkannya.");
    setMode("lihat"); onHapus();
  };

  if (hapusPenuh_) {
    return (
      <View className="gap-3">
        <Text className="font-semibold text-sm text-red-600">Hapus gelombang beserta seluruh datanya</Text>
        <Text className="text-xs text-muted-foreground">{galat}</Text>
        <Text className="text-xs text-foreground">SEMUA pendaftar dan berkas di gelombang ini dihapus permanen. Ketik nama gelombang untuk melanjutkan.</Text>
        <Isian label={`Ketik: ${g.nama}`}><Kolom value={konfirmasiHapus} onChangeText={setKonfirmasiHapus} maxLength={120} autoCapitalize="none" /></Isian>
        <View className="flex-row gap-2"><Button size="sm" variant="outline" disabled={sibuk || konfirmasiHapus !== g.nama} loading={sibuk} onPress={() => void hapusPenuh()}>Hapus permanen</Button><Button size="sm" variant="outline" disabled={sibuk} onPress={() => { setHapusPenuh(false); setGalat(""); setKonfirmasiHapus(""); }}>Batal</Button></View>
      </View>
    );
  }
  if (mode === "ubah") return <FormGelombang awal={g} onBatal={() => setMode("lihat")} onSelesai={() => { setMode("lihat"); onChanged(); }} />;
  if (mode === "perpanjang") {
    return (
      <View className="gap-3">
        <Text className="font-semibold text-sm text-foreground">{arsip ? "Buka kembali / perpanjang" : "Perpanjang"}</Text>
        <Isian label="Tanggal tutup baru" bantuan="Format TTTT-BB-HH. Gelombang dibuka kembali sampai tanggal itu."><Kolom value={tglBaru} onChangeText={setTglBaru} maxLength={10} keyboardType="numbers-and-punctuation" /></Isian>
        {galat ? <Text className="text-sm text-red-600">{galat}</Text> : null}
        <View className="flex-row gap-2"><Button size="sm" variant="primary" disabled={sibuk} loading={sibuk} onPress={() => void simpanPerpanjang()}>Simpan</Button><Button size="sm" variant="outline" disabled={sibuk} onPress={() => { setMode("lihat"); setGalat(""); }}>Batal</Button></View>
      </View>
    );
  }
  if (mode === "salin") {
    return (
      <View className="gap-3">
        <Text className="font-semibold text-sm text-foreground">Salin gelombang</Text>
        <Text className="text-xs text-muted-foreground">Formulir, biaya, kuota, petunjuk bayar, dan jenis akses ikut disalin. Pendaftar tidak ikut. Hasilnya berstatus draf.</Text>
        <Isian label="Nama gelombang baru"><Kolom value={salinan.nama} onChangeText={(v) => setSalinan({ ...salinan, nama: v })} maxLength={120} placeholder={`${g.nama} (salinan)`} /></Isian>
        <Isian label="Tanggal buka" bantuan="Format TTTT-BB-HH."><Kolom value={salinan.tanggalBuka} onChangeText={(v) => setSalinan({ ...salinan, tanggalBuka: v })} maxLength={10} keyboardType="numbers-and-punctuation" /></Isian>
        <Isian label="Tanggal tutup"><Kolom value={salinan.tanggalTutup} onChangeText={(v) => setSalinan({ ...salinan, tanggalTutup: v })} maxLength={10} keyboardType="numbers-and-punctuation" /></Isian>
        {galat ? <Text className="text-sm text-red-600">{galat}</Text> : null}
        <View className="flex-row gap-2"><Button size="sm" variant="primary" disabled={sibuk} loading={sibuk} onPress={() => void simpanSalinan()}>Salin</Button><Button size="sm" variant="outline" disabled={sibuk} onPress={() => { setMode("lihat"); setGalat(""); }}>Batal</Button></View>
      </View>
    );
  }
  return (
    <View className="gap-3">
      <View className="flex-row flex-wrap items-center gap-2"><Text className="text-sm font-semibold text-foreground">Status:</Text><Lencana jenis={g.status} teks={LABEL_GELOMBANG[g.status]} /><Lencana jenis={g.terbit ? "terbuka" : "draft"} teks={g.terbit ? "Diterbitkan" : "Belum diterbitkan"} /><Lencana jenis={g.akses === "privat" ? "belum_buka" : "baru"} teks={g.akses === "privat" ? "Privat" : "Publik"} /></View>
      {arsip ? <Text className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">Gelombang ini sudah berakhir atau ditutup (arsip): tautan pendaftarannya mati. Untuk membuka lagi, pakai Perpanjang.</Text> : null}
      {g.bisaKelola ? (
        <View className="flex-row flex-wrap gap-2">
          <Button size="sm" variant={g.terbit ? "outline" : "primary"} disabled={sibuk} onPress={() => terbit(!g.terbit)}>{g.terbit ? "Tarik dari publik" : "Terbitkan"}</Button>
          {g.terbit && !arsip ? <Button size="sm" variant="outline" disabled={sibuk} onPress={tutup}>Tutup lebih awal</Button> : null}
          {arsip || g.terbit ? <Button size="sm" variant={arsip ? "primary" : "outline"} disabled={sibuk} onPress={() => { setTglBaru(g.tanggalTutup < hariIni() ? "" : g.tanggalTutup); setMode("perpanjang"); }}>{arsip ? "Buka kembali / perpanjang" : "Perpanjang"}</Button> : null}
          <Button size="sm" variant="outline" disabled={sibuk} onPress={() => setMode("ubah")}>Ubah data</Button>
          <Button size="sm" variant="outline" disabled={sibuk} onPress={() => setMode("salin")}>Salin gelombang</Button>
          <Button size="sm" variant="outline" disabled={sibuk} onPress={hapus}>Hapus</Button>
        </View>
      ) : <Text className="text-xs text-muted-foreground">Anda hanya bisa melihat gelombang ini.</Text>}
      {g.akses === "publik" ? (
        <View className="rounded-lg border border-border p-3 gap-3">
          <View className="gap-1">
            <Text className="text-sm font-semibold text-foreground">Halaman pendaftaran umum</Text>
            <Lencana jenis={g.goPublik ? "terbuka" : "draft"} teks={g.goPublik ? "GO PUBLIK" : "Belum GO PUBLIK"} />
            <Text className="text-xs text-muted-foreground">{g.goPublik ? "Gelombang ini tampil di halaman pendaftaran umum selama diterbitkan dan masih berlaku." : "Selama belum GO PUBLIK, gelombang ini tidak tampil di halaman umum dan tautannya hanya menampilkan 'belum dibuka'. Gelombang lain tidak terpengaruh."}</Text>
            {g.bisaKelola && bisaGoPublik ? (
              <View className="flex-row mt-1"><Button size="sm" variant={g.goPublik ? "outline" : "primary"} disabled={sibuk || (!g.goPublik && !g.terbit)} onPress={() => (g.goPublik
                ? saklar("Tutup dari halaman umum", "Data pendaftar yang sudah masuk tetap aman.", "Tutup", { goPublik: false }, true)
                : saklar("GO PUBLIK", "Gelombang ini akan tampil dan bisa dibuka SIAPA PUN yang punya tautan halaman pendaftaran. Lanjutkan?", "GO PUBLIK", { goPublik: true }))}>{g.goPublik ? "Tutup dari halaman umum" : "GO PUBLIK"}</Button></View>
            ) : null}
            {g.bisaKelola && !bisaGoPublik ? <Text className="text-xs text-muted-foreground">GO PUBLIK hanya bisa ditekan Admin IT.</Text> : null}
            {g.bisaKelola && bisaGoPublik && !g.goPublik && !g.terbit ? <Text className="text-xs text-muted-foreground">Terbitkan gelombang dulu sebelum GO PUBLIK.</Text> : null}
          </View>
          <View className="gap-1 border-t border-border pt-3">
            <Text className="text-sm font-semibold text-foreground">Daftar online</Text>
            <Lencana jenis={g.daftarOnline ? "terbuka" : "penuh"} teks={g.daftarOnline ? "Terbuka" : "Terkunci"} />
            <Text className="text-xs text-muted-foreground">{g.daftarOnline ? "Orang tua bisa mendaftar dan membayar lewat halaman gelombang ini." : "Terkunci: halaman gelombang ini hanya menampilkan informasi dan nomor admin, belum bisa mendaftar. Buka kunci setelah urusan pembayaran siap."}</Text>
            {g.bisaKelola ? (
              <View className="flex-row mt-1"><Button size="sm" variant={g.daftarOnline ? "outline" : "primary"} disabled={sibuk} onPress={() => (g.daftarOnline
                ? saklar("Kunci daftar online", "Orang tua tidak bisa mendaftar baru (yang sudah mendaftar tetap bisa melanjutkan).", "Kunci", { daftarOnline: false }, true)
                : saklar("Buka kunci daftar online", "Orang tua bisa mendaftar dan membayar lewat halaman gelombang ini.", "Buka kunci", { daftarOnline: true }))}>{g.daftarOnline ? "Kunci daftar online" : "Buka kunci daftar online"}</Button></View>
            ) : null}
          </View>
        </View>
      ) : <Text className="text-xs text-muted-foreground">Gelombang privat tidak memakai GO PUBLIK dan kunci daftar online: cukup bagikan tautan berkodenya.</Text>}
      <Text className="text-sm text-foreground">Periode {g.tanggalBuka} s.d. {g.tanggalTutup} · Kuota {g.kuota ?? "tanpa batas"} · Biaya {g.biaya > 0 ? rupiah(g.biaya) : "gratis"}</Text>
      {g.deskripsi ? <Text className="text-sm text-muted-foreground">{g.deskripsi}</Text> : null}
      {g.instruksiBayar ? <Text className="text-sm text-foreground"><Text className="font-semibold">Petunjuk pembayaran: </Text>{g.instruksiBayar}</Text> : null}
      <View className="gap-1">
        <Text className="text-sm font-semibold text-foreground">Tautan formulir {g.akses === "privat" ? "(privat: bagikan hanya ke yang berhak)" : "publik"}</Text>
        <Text selectable className="bg-muted rounded-lg px-2.5 py-2 text-xs text-foreground" style={{ fontFamily: "monospace" }}>{tautan}</Text>
        <View className="flex-row flex-wrap gap-2"><Button size="sm" variant="outline" onPress={() => void Share.share({ message: tautan })}>Bagikan tautan</Button><Button size="sm" variant="outline" onPress={() => setTampilQr((x) => !x)}>{tampilQr ? "Sembunyikan QR" : "Tampilkan QR"}</Button></View>
        {tampilQr ? <Image source={api.psbQrSumber(g.id)} accessibilityLabel="QR formulir pendaftaran" style={{ width: 220, height: 220, backgroundColor: "#fff", borderRadius: 8, marginTop: 8 }} resizeMode="contain" /> : null}
        <Text className="text-xs text-muted-foreground">Gelombang publik bisa dibuka setelah diterbitkan, GO PUBLIK ditekan Admin IT, dan daftar online dibuka (keduanya di gelombang ini). Gelombang privat tidak bergantung pada kedua saklar itu.</Text>
      </View>
    </View>
  );
}

export function PsbGelombang({ id, izin, onKembali }: { id: number; izin?: Izin; onKembali: () => void }) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [g, setG] = useState<GelombangDetail | null>(null);
  const [galat, setGalat] = useState("");
  const [tab, setTab] = useState<Tab>("pendaftar");

  const muat = useCallback(async () => {
    setGalat("");
    const res = (await api.psbGelombang(id)) as Res<GelombangDetail>;
    if (res.success && res.data) setG(res.data); else setGalat(res.message || "Gagal memuat gelombang.");
  }, [id]);
  useEffect(() => { void muat(); }, [muat]);

  if (galat) {
    return (
      <View className="flex-1 bg-background px-4 py-8 gap-3">
        <View className="flex-row items-center gap-2"><AlertTriangle size={16} color="#dc2626" /><Text className="text-sm text-red-600 flex-1">{galat}</Text></View>
        <View className="flex-row gap-2"><Button size="sm" variant="outline" onPress={() => void muat()}>Coba lagi</Button><Button size="sm" variant="outline" onPress={onKembali}>Kembali</Button></View>
      </View>
    );
  }
  if (!g) return <View className="flex-1 bg-background items-center justify-center"><ActivityIndicator color={colors.primary} /></View>;

  return (
    <ScrollView className="flex-1 bg-background px-4 pt-4" contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 12 }} keyboardShouldPersistTaps="handled">
      <Pressable onPress={onKembali} accessibilityRole="button" className="flex-row items-center gap-1.5 self-start"><ArrowLeft size={14} color={colors.primary} /><Text className="text-sm font-medium text-primary">Semua gelombang</Text></Pressable>
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1"><Text className="text-lg font-semibold text-foreground">{g.nama}</Text><Text className="text-xs text-muted-foreground">{g.katalog?.nama} · Tahun ajaran {g.tahunAjaran}</Text></View>
        <Lencana jenis={g.status} teks={LABEL_GELOMBANG[g.status]} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }} accessibilityRole="tablist">
        {TABS.map((t) => (
          <Pressable key={t.id} onPress={() => setTab(t.id)} accessibilityRole="tab" accessibilityState={{ selected: tab === t.id }} className={`px-3 py-2 rounded-full border ${tab === t.id ? "bg-primary border-primary" : "border-border"}`}>
            <Text className={`text-sm font-medium ${tab === t.id ? "text-primary-foreground" : "text-foreground"}`}>{t.teks}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Card padding="lg">
        {tab === "pendaftar" ? <TabPendaftar g={g} onChanged={() => void muat()} /> : null}
        {tab === "formulir" ? <TabFormulir g={g} onChanged={() => void muat()} /> : null}
        {tab === "jadwal" ? <TabJadwal g={g} /> : null}
        {tab === "pengumuman" ? <TabPengumuman g={g} /> : null}
        {tab === "pengaturan" ? <TabPengaturan g={g} bisaGoPublik={izin?.semua ?? false} onChanged={() => void muat()} onHapus={onKembali} /> : null}
      </Card>
    </ScrollView>
  );
}

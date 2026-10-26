// ============================================================
// KELOLA WEBSITE (2026-10-26) - port native dari webview (src/app/components/screens/KelolaWebsiteScreen.tsx).
// Admin IT / Admin Media mengedit landing page yayasan (https://yayasanalikhlas86.sch.id). Isi disimpan backend sebagai
// commit ke repo GitHub `web`; situs dibangun ulang otomatis (±2-4 menit) dan tetap tayang walau VPS mati.
// Aturan izin SESUNGGUHNYA ada di server (services/websiteContent.js); layar ini hanya mengunci/menyembunyikan.
// ============================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, Image, ActivityIndicator, Alert, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { ChevronDown, ChevronUp, ExternalLink, ImageIcon, Lock, Plus, RotateCcw, Save, Trash2, Upload, X, AlertTriangle, CheckCircle } from "lucide-react-native";
import { api } from "../../services/api";
import { SimplePicker } from "../ui/SimplePicker";
import { useThemeColors } from "../../context/ThemeContext";

interface Kartu { id: string; title: string; subtitle: string; description: string; detail: string; katalog: string }
interface Jenjang extends Kartu { shortTitle: string; image: string }
type KategoriGaleri = "Pembelajaran" | "Kegiatan" | "Fasilitas";
interface FotoGaleri { id: string; label: string; category: KategoriGaleri; image: string; katalog: string }
interface Isi {
  heroImage: string; aboutImage: string; benefitsImage: string; registrationImages: string[];
  education: Jenjang[]; programs: Kartu[]; gallery: FotoGaleri[]; articles: unknown[];
  contact: { address: string; phone: string; email: string; whatsapp: string; registrationUrl: string; mapUrl: string; lokasiSingkat: string; namaKontak: string };
  socials: { label: string; url: string }[];
  teks: {
    hero: { eyebrow: string; slides: { judul: string; paragraf: string }[]; levels: string[]; captionJudul: string; captionLokasi: string };
    tentang: { judul: string; subjudul: string; paragraf: string[]; ribbonJudul: string; ribbonTeks: string };
    profil: { pembuka: string; arah: string };
    nilai: { judul: string; deskripsi: string }[];
    jenjang: { judul: string; deskripsi: string };
    keunggulan: { judul: string; butir: string[] };
    program: { judul: string; deskripsi: string };
    pendaftaran: { judul: string; deskripsi: string; catatan: string };
    galeri: { judul: string; deskripsi: string };
    banner: { judul: string; slogan: string };
    berita: { judul: string; deskripsi: string };
    footer: { judul: string; slogan: string };
  };
}
interface Izin { global: boolean; katalog: string[] }
interface KatalogInfo { kode: string; nama: string }
interface StatusBuild { id: number; status: string; hasil: string | null }
interface Riwayat { id: number; nama: string; peran: string; aksi: string; bagian: string; commit: string | null; waktu: string; bisaDikembalikan: boolean }

const KATEGORI: KategoriGaleri[] = ["Pembelajaran", "Kegiatan", "Fasilitas"];
const inputCls = "bg-input-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground";
const idBaru = (awalan: string) => `${awalan}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const waktuLokal = (ts: string) => new Date(ts).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const PETUNJUK_SOROTAN = "Enter = baris baru. Apit kata dengan dua bintang (**seperti ini**) agar tampil berwarna.";

// Alert bergaya "confirm" yang mengembalikan Promise<boolean>.
const konfirmasi = (judul: string, pesan: string, ya = "Ya") =>
  new Promise<boolean>((resolve) => {
    Alert.alert(judul, pesan, [{ text: "Batal", style: "cancel", onPress: () => resolve(false) }, { text: ya, onPress: () => resolve(true) }], { cancelable: true, onDismiss: () => resolve(false) });
  });

// ---------- komponen kecil ----------
function Teks({ label, value, onChange, ro, max = 300, hint, keyboard }: { label: string; value: string; onChange: (v: string) => void; ro?: boolean; max?: number; hint?: string; keyboard?: "default" | "phone-pad" | "email-address" | "url" | "number-pad" }) {
  return (
    <View className="gap-1">
      <Text className="text-sm font-medium text-foreground">{label}</Text>
      <TextInput value={value} onChangeText={onChange} maxLength={max} editable={!ro} autoCapitalize="none" keyboardType={keyboard} className={`${inputCls} ${ro ? "opacity-60" : ""}`} />
      {hint ? <Text className="text-xs text-muted-foreground">{hint}</Text> : null}
    </View>
  );
}

function Area({ label, value, onChange, ro, max = 1500, rows = 3, hint }: { label: string; value: string; onChange: (v: string) => void; ro?: boolean; max?: number; rows?: number; hint?: string }) {
  return (
    <View className="gap-1">
      <Text className="text-sm font-medium text-foreground">{label}</Text>
      <TextInput value={value} onChangeText={onChange} maxLength={max} editable={!ro} multiline textAlignVertical="top" className={`${inputCls} ${ro ? "opacity-60" : ""}`} style={{ minHeight: 24 * rows + 16 }} />
      {hint ? <Text className="text-xs text-muted-foreground">{hint}</Text> : null}
    </View>
  );
}

function Foto({ label, value, onChange, ro, wajib, tampil, unggah }: {
  label: string; value: string; onChange: (v: string) => void; ro?: boolean; wajib?: boolean;
  tampil: (p: string) => string; unggah: () => Promise<string | null>;
}) {
  const colors = useThemeColors();
  const [sibuk, setSibuk] = useState(false);
  const pilih = async () => {
    setSibuk(true);
    const path = await unggah();
    setSibuk(false);
    if (path) onChange(path);
  };
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-foreground">{label}</Text>
      <View className="flex-row items-center gap-3">
        {value ? <Image source={{ uri: tampil(value) }} className="w-24 h-16 rounded-lg bg-muted" resizeMode="cover" /> : (
          <View className="w-24 h-16 rounded-lg border border-dashed border-border bg-muted items-center justify-center"><ImageIcon size={20} color={colors.mutedForeground} /></View>
        )}
        {!ro ? (
          <View className="flex-1 flex-row flex-wrap gap-2">
            <Pressable onPress={pilih} disabled={sibuk} className="flex-row items-center gap-1.5 px-3 py-2 rounded-xl border border-border">
              {sibuk ? <ActivityIndicator size="small" /> : <Upload size={14} color={colors.foreground} />}
              <Text className="text-sm font-medium text-foreground">{sibuk ? "Mengunggah..." : value ? "Ganti foto" : "Pilih foto"}</Text>
            </Pressable>
            {value && !wajib ? (
              <Pressable onPress={() => onChange("")} disabled={sibuk} className="flex-row items-center gap-1.5 px-3 py-2 rounded-xl border border-border"><X size={14} color={colors.foreground} /><Text className="text-sm font-medium text-foreground">Hapus</Text></Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function Bagian({ judul, ringkas, terbuka, onToggle, kunci, children }: { judul: string; ringkas?: string; terbuka: boolean; onToggle: () => void; kunci?: boolean; children: React.ReactNode }) {
  const colors = useThemeColors();
  return (
    <View className="bg-card border border-border rounded-2xl overflow-hidden">
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: terbuka }} className="flex-row items-center gap-3 px-4 py-3.5">
        <View className="flex-1">
          <Text className="font-semibold text-sm text-foreground">{judul}</Text>
          {ringkas ? <Text numberOfLines={1} className="text-xs text-muted-foreground">{ringkas}</Text> : null}
        </View>
        {kunci ? <Lock size={15} color={colors.mutedForeground} /> : null}
        {terbuka ? <ChevronUp size={18} color={colors.mutedForeground} /> : <ChevronDown size={18} color={colors.mutedForeground} />}
      </Pressable>
      {terbuka ? <View className="px-4 pb-4 pt-3 gap-4 border-t border-border">{children}</View> : null}
    </View>
  );
}

function CatatanKunci() {
  const colors = useThemeColors();
  return <View className="flex-row items-center gap-2 bg-muted rounded-xl px-3 py-2"><Lock size={13} color={colors.mutedForeground} /><Text className="text-xs text-muted-foreground flex-1">Bagian ini hanya bisa diubah Admin IT.</Text></View>;
}

function KartuItem({ judul, katalog, namaKatalog, boleh, bisaHapus, onNaik, onTurun, onHapus, children }: {
  judul: string; katalog: string; namaKatalog: string; boleh: boolean; bisaHapus: boolean;
  onNaik?: () => void; onTurun?: () => void; onHapus?: () => void; children: React.ReactNode;
}) {
  const colors = useThemeColors();
  const [buka, setBuka] = useState(false);
  return (
    <View className={`border border-border rounded-xl ${boleh ? "" : "opacity-70"}`}>
      <View className="flex-row items-center gap-2 px-3 py-2.5">
        <Pressable onPress={() => setBuka(!buka)} accessibilityState={{ expanded: buka }} className="flex-1 flex-row items-center gap-2">
          <Text numberOfLines={1} className="text-sm font-medium text-foreground flex-shrink">{judul || "(tanpa judul)"}</Text>
          <View className="bg-muted rounded-full px-2 py-0.5"><Text className="text-[11px] text-muted-foreground">{katalog ? namaKatalog : "Yayasan"}</Text></View>
          {!boleh ? <Lock size={13} color={colors.mutedForeground} /> : null}
        </Pressable>
        {boleh && onNaik ? <Pressable onPress={onNaik} accessibilityLabel="Naikkan urutan" className="p-1.5"><ChevronUp size={16} color={colors.foreground} /></Pressable> : null}
        {boleh && onTurun ? <Pressable onPress={onTurun} accessibilityLabel="Turunkan urutan" className="p-1.5"><ChevronDown size={16} color={colors.foreground} /></Pressable> : null}
        {boleh && bisaHapus && onHapus ? <Pressable onPress={onHapus} accessibilityLabel="Hapus" className="p-1.5"><Trash2 size={16} color="#dc2626" /></Pressable> : null}
      </View>
      {buka ? <View className="px-3 pb-3 pt-3 gap-3 border-t border-border">{boleh ? children : <Text className="text-xs text-muted-foreground">Milik {katalog ? namaKatalog : "yayasan"}. Hanya bisa dilihat.</Text>}</View> : null}
    </View>
  );
}

function PilihKatalog({ value, onChange, pilihan }: { value: string; onChange: (v: string) => void; pilihan: { kode: string; nama: string }[] }) {
  if (pilihan.length === 1 && value === pilihan[0].kode) return null;
  return (
    <View className="gap-1">
      <Text className="text-sm font-medium text-foreground">Milik katalog</Text>
      <SimplePicker value={value} options={pilihan.map((p) => ({ value: p.kode, label: p.nama }))} onChange={onChange} />
    </View>
  );
}

function TombolKecil({ onPress, disabled, icon, children }: { onPress: () => void; disabled?: boolean; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} className={`flex-row items-center gap-1.5 self-start px-3 py-2 rounded-xl border border-border ${disabled ? "opacity-50" : ""}`}>
      {icon}<Text className="text-sm font-medium text-foreground">{children}</Text>
    </Pressable>
  );
}

// ---------- layar ----------
export function KelolaWebsiteScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [fase, setFase] = useState<"muat" | "ok" | "gagal">("muat");
  const [galat, setGalat] = useState("");
  const [asli, setAsli] = useState<Isi | null>(null);
  const [draft, setDraft] = useState<Isi | null>(null);
  const [sha, setSha] = useState("");
  const [izin, setIzin] = useState<Izin>({ global: false, katalog: [] });
  const [semuaKatalog, setSemuaKatalog] = useState<KatalogInfo[]>([]);
  const [urlSitus, setUrlSitus] = useState("https://yayasanalikhlas86.sch.id");
  const [buka, setBuka] = useState("");
  const [menyimpan, setMenyimpan] = useState(false);
  const [pesan, setPesan] = useState<{ jenis: "ok" | "info" | "galat"; teks: string } | null>(null);
  const [riwayat, setRiwayat] = useState<Riwayat[] | null>(null);
  const [previewLokal, setPreviewLokal] = useState<Record<string, string>>({});
  const penayanganRef = useRef(0);

  const muat = useCallback(async () => {
    setFase("muat");
    const res = await api.websiteGet();
    if (!res.success) { setGalat(res.message || "Gagal memuat isi website."); setFase("gagal"); return; }
    const d = res.data as { isi: Isi; sha: string; izin: Izin; semuaKatalog: KatalogInfo[]; urlSitus: string };
    setAsli(d.isi); setDraft(JSON.parse(JSON.stringify(d.isi))); setSha(d.sha); setIzin(d.izin); setSemuaKatalog(d.semuaKatalog); setUrlSitus(d.urlSitus);
    setFase("ok");
  }, []);
  useEffect(() => { void muat(); }, [muat]);
  useEffect(() => () => { penayanganRef.current += 1; }, []);

  const dirty = useMemo(() => draft !== null && asli !== null && JSON.stringify(draft) !== JSON.stringify(asli), [draft, asli]);

  const ubah = (fn: (d: Isi) => void) => setDraft((d) => { if (!d) return d; const c = JSON.parse(JSON.stringify(d)) as Isi; fn(c); return c; });
  const namaKatalog = (kode: string) => (kode ? semuaKatalog.find((k) => k.kode === kode)?.nama ?? kode : "Yayasan");
  const milik = (kode: string) => izin.global || izin.katalog.includes(kode);
  const pilihanKatalog = useMemo(
    () => (izin.global ? [{ kode: "", nama: "Yayasan (umum)" }, ...semuaKatalog] : semuaKatalog.filter((k) => izin.katalog.includes(k.kode))),
    [izin, semuaKatalog],
  );
  const katalogDefault = izin.global ? "" : izin.katalog[0] ?? "";
  const tampil = (p: string) => previewLokal[p] ?? (p.startsWith("/") ? `${urlSitus}${p}` : p);

  const unggah = async (): Promise<string | null> => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Izin galeri ditolak", "Izinkan akses galeri di pengaturan HP untuk memilih foto."); return null; }
    const hasil = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: false, quality: 0.9 });
    if (hasil.canceled || hasil.assets.length === 0) return null;
    const asset = hasil.assets[0];
    let uri = asset.uri; let mime = asset.mimeType ?? "image/jpeg";
    try {
      const kecil = await ImageManipulator.manipulateAsync(asset.uri, [{ resize: { width: 1600 } }], { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG });
      uri = kecil.uri; mime = "image/jpeg";
    } catch { /* gagal mengecilkan: kirim apa adanya */ }
    const res = await api.websiteFoto(uri, mime);
    if (!res.success) { Alert.alert("Gagal mengunggah foto", res.message || "Coba lagi."); return null; }
    const path = (res.data as { path: string }).path;
    setPreviewLokal((m) => ({ ...m, [path]: uri }));
    return path;
  };

  const pantauPenayangan = async (idSebelum: number) => {
    const token = ++penayanganRef.current;
    const mulai = Date.now();
    while (penayanganRef.current === token && Date.now() - mulai < 8 * 60 * 1000) {
      await new Promise((r) => setTimeout(r, 10000));
      if (penayanganRef.current !== token) return;
      const s = await api.websiteStatus();
      const st = s.success ? (s.data as StatusBuild | null) : null;
      if (st && st.id !== idSebelum) {
        if (st.status === "completed") {
          setPesan(st.hasil === "success"
            ? { jenis: "ok", teks: "Perubahan sudah tayang di website." }
            : { jenis: "galat", teks: "Perubahan tersimpan tetapi website GAGAL dibangun ulang. Website lama tetap tampil. Hubungi Admin IT untuk memeriksa." });
          return;
        }
        setPesan({ jenis: "info", teks: "Tersimpan. Website sedang dibangun ulang (sekitar 2-4 menit)..." });
      }
    }
    if (penayanganRef.current === token) setPesan({ jenis: "info", teks: "Tersimpan. Belum terkonfirmasi tayang; cek website beberapa menit lagi." });
  };

  const simpan = async () => {
    if (!draft || !dirty || menyimpan) return;
    if (!(await konfirmasi("Simpan perubahan", "Simpan perubahan dan tayangkan ke website?", "Simpan"))) return;
    setMenyimpan(true); setPesan(null);
    const sebelum = await api.websiteStatus();
    const idSebelum = sebelum.success && sebelum.data ? (sebelum.data as StatusBuild).id : 0;
    const res = await api.websiteSave(draft, sha);
    setMenyimpan(false);
    if (!res.success) {
      setPesan({ jenis: "galat", teks: res.message || "Gagal menyimpan." });
      if ((res as { kode?: string }).kode === "BENTROK" && (await konfirmasi("Ada perubahan lebih baru", "Muat ulang isi terbaru? (perubahan Anda di layar ini akan hilang)", "Muat ulang"))) await muat();
      return;
    }
    const d = res.data as { tidakBerubah: boolean };
    if (d.tidakBerubah) { setPesan({ jenis: "info", teks: "Tidak ada perubahan untuk disimpan." }); return; }
    setPesan({ jenis: "info", teks: "Tersimpan. Menunggu website dibangun ulang (sekitar 2-4 menit)..." });
    await muat();
    setRiwayat(null);
    void pantauPenayangan(idSebelum);
  };

  const batal = async () => { if (asli && (await konfirmasi("Buang perubahan", "Buang semua perubahan yang belum disimpan?", "Buang"))) setDraft(JSON.parse(JSON.stringify(asli))); };

  const muatRiwayat = async () => {
    const res = await api.websiteRiwayat();
    setRiwayat(res.success ? (res.data as Riwayat[]) : []);
  };
  const kembalikan = async (r: Riwayat) => {
    if (!r.commit || !(await konfirmasi("Kembalikan versi", `Kembalikan isi website ke versi hasil perubahan ${waktuLokal(r.waktu)} oleh ${r.nama}? Perubahan sesudahnya akan ditimpa (tetap tercatat, bisa dikembalikan lagi).`, "Kembalikan"))) return;
    setMenyimpan(true);
    const res = await api.websiteKembalikan(r.commit, sha);
    setMenyimpan(false);
    if (!res.success) { Alert.alert("Gagal mengembalikan", res.message || "Coba lagi."); return; }
    await muat(); setRiwayat(null);
    setPesan({ jenis: "info", teks: "Versi dikembalikan. Website sedang dibangun ulang (sekitar 2-4 menit)." });
  };

  const toggle = (k: string) => { setBuka(buka === k ? "" : k); if (k === "riwayat" && riwayat === null) void muatRiwayat(); };

  if (fase === "muat") return <View className="flex-1 bg-background items-center justify-center gap-2"><ActivityIndicator /><Text className="text-sm text-muted-foreground">Memuat isi website...</Text></View>;
  if (fase === "gagal" || !draft || !asli) {
    return (
      <View className="flex-1 bg-background px-4 py-8 gap-3">
        <View className="flex-row items-center gap-2"><AlertTriangle size={16} color="#dc2626" /><Text className="text-sm text-red-600 flex-1">{galat}</Text></View>
        <TombolKecil onPress={() => void muat()}>Coba lagi</TombolKecil>
      </View>
    );
  }

  const g = !izin.global;
  const t = draft.teks;
  const kartuProps = (k: string) => ({ katalog: k, namaKatalog: namaKatalog(k), boleh: milik(k) });
  const geser = <T,>(arr: T[], i: number, arah: number) => { const j = i + arah; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; };
  const hapusDgnKonfirmasi = async (nama: string, lakukan: () => void) => { if (await konfirmasi("Hapus", `Hapus "${nama}"?`, "Hapus")) lakukan(); };
  const warnaPesan = pesan?.jenis === "ok" ? "bg-green-50" : pesan?.jenis === "galat" ? "bg-red-50" : "bg-blue-50";
  const warnaTeksPesan = pesan?.jenis === "ok" ? "text-green-800" : pesan?.jenis === "galat" ? "text-red-700" : "text-blue-800";

  return (
    <View className="flex-1 bg-background">
      <KeyboardAwareScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: (dirty || menyimpan ? 96 : 32) + insets.bottom, gap: 14 }} bottomOffset={20}>
        <View className="bg-card border border-border rounded-2xl p-4 gap-2">
          <Text className="text-sm text-foreground">
            Mengubah isi website yayasan. Perubahan <Text className="font-bold">langsung tayang</Text> sekitar 2-4 menit setelah disimpan, dan tercatat siapa yang mengubah.
            {g ? ` Anda dapat mengubah kartu milik: ${izin.katalog.map(namaKatalog).join(", ")}.` : " Anda dapat mengubah semua bagian."}
          </Text>
          <Pressable onPress={() => void Linking.openURL(urlSitus)} className="flex-row items-center gap-1.5 self-start"><ExternalLink size={14} color={colors.primary} /><Text className="text-sm text-primary">Buka website</Text></Pressable>
          <Text className="text-xs text-muted-foreground">Info Terbaru di website otomatis diambil dari Berita Acara yang diterbitkan dan dicentang “Tampilkan di website”; tidak diatur di sini.</Text>
        </View>

        {pesan ? (
          <View accessibilityRole="alert" className={`${warnaPesan} rounded-2xl px-4 py-3 flex-row items-start gap-2`}>
            {pesan.jenis === "ok" ? <CheckCircle size={16} color="#166534" /> : pesan.jenis === "galat" ? <AlertTriangle size={16} color="#b91c1c" /> : <ActivityIndicator size="small" />}
            <Text className={`text-sm flex-1 ${warnaTeksPesan}`}>{pesan.teks}</Text>
            <Pressable onPress={() => setPesan(null)} accessibilityLabel="Tutup pesan"><X size={14} color={colors.mutedForeground} /></Pressable>
          </View>
        ) : null}

        <Bagian judul="Banner utama" ringkas={t.hero.slides[0]?.judul.replace(/\*\*|\n/g, " ")} terbuka={buka === "hero"} onToggle={() => toggle("hero")} kunci={g}>
          {g ? <CatatanKunci /> : null}
          <Foto label="Foto utama (gedung sekolah)" value={draft.heroImage} wajib ro={g} tampil={tampil} unggah={unggah} onChange={(v) => ubah((d) => { d.heroImage = v; })} />
          <Teks label="Teks kecil di atas judul" value={t.hero.eyebrow} ro={g} onChange={(v) => ubah((d) => { d.teks.hero.eyebrow = v; })} />
          {t.hero.slides.map((s, i) => (
            <View key={i} className="border border-border rounded-xl p-3 gap-3">
              <View className="flex-row items-center justify-between"><Text className="text-sm font-semibold text-foreground">Banner {i + 1}</Text>
                {!g && t.hero.slides.length > 1 ? <Pressable onPress={() => ubah((d) => { d.teks.hero.slides.splice(i, 1); })}><Text className="text-xs text-red-600">Hapus banner</Text></Pressable> : null}</View>
              <Area label="Judul" rows={3} max={300} ro={g} hint={PETUNJUK_SOROTAN} value={s.judul} onChange={(v) => ubah((d) => { d.teks.hero.slides[i].judul = v; })} />
              <Area label="Kalimat pengantar" rows={2} ro={g} value={s.paragraf} onChange={(v) => ubah((d) => { d.teks.hero.slides[i].paragraf = v; })} />
            </View>
          ))}
          {!g && t.hero.slides.length < 4 ? <TombolKecil icon={<Plus size={14} color={colors.foreground} />} onPress={() => ubah((d) => { d.teks.hero.slides.push({ judul: "Judul baru", paragraf: "Kalimat pengantar." }); })}>Tambah banner</TombolKecil> : null}
          <View className="gap-2">
            <Text className="text-sm font-medium text-foreground">Label jenjang di banner</Text>
            {t.hero.levels.map((l, i) => (
              <View key={i} className="flex-row gap-2 items-center">
                <TextInput accessibilityLabel={`Label jenjang ${i + 1}`} value={l} maxLength={300} editable={!g} onChangeText={(v) => ubah((d) => { d.teks.hero.levels[i] = v; })} className={`${inputCls} flex-1 ${g ? "opacity-60" : ""}`} />
                {!g ? <Pressable onPress={() => ubah((d) => { d.teks.hero.levels.splice(i, 1); })} accessibilityLabel="Hapus label" className="p-2"><Trash2 size={16} color="#dc2626" /></Pressable> : null}
              </View>
            ))}
            {!g && t.hero.levels.length < 4 ? <TombolKecil icon={<Plus size={14} color={colors.foreground} />} onPress={() => ubah((d) => { d.teks.hero.levels.push("LABEL BARU"); })}>Tambah label</TombolKecil> : null}
          </View>
          <Teks label="Teks di bawah foto: judul" value={t.hero.captionJudul} ro={g} onChange={(v) => ubah((d) => { d.teks.hero.captionJudul = v; })} />
          <Teks label="Teks di bawah foto: lokasi" value={t.hero.captionLokasi} ro={g} onChange={(v) => ubah((d) => { d.teks.hero.captionLokasi = v; })} />
        </Bagian>

        <Bagian judul="Tentang & profil yayasan" ringkas={t.tentang.subjudul} terbuka={buka === "tentang"} onToggle={() => toggle("tentang")} kunci={g}>
          {g ? <CatatanKunci /> : null}
          <Foto label="Foto bagian Tentang" value={draft.aboutImage} ro={g} tampil={tampil} unggah={unggah} onChange={(v) => ubah((d) => { d.aboutImage = v; })} />
          <Teks label="Judul bagian" value={t.tentang.judul} ro={g} onChange={(v) => ubah((d) => { d.teks.tentang.judul = v; })} />
          <Teks label="Sub-judul" value={t.tentang.subjudul} ro={g} onChange={(v) => ubah((d) => { d.teks.tentang.subjudul = v; })} />
          {t.tentang.paragraf.map((p, i) => <Area key={i} label={`Paragraf ${i + 1}`} value={p} ro={g} onChange={(v) => ubah((d) => { d.teks.tentang.paragraf[i] = v; })} />)}
          {!g ? (
            <View className="flex-row gap-2 flex-wrap">
              {t.tentang.paragraf.length < 4 ? <TombolKecil icon={<Plus size={14} color={colors.foreground} />} onPress={() => ubah((d) => { d.teks.tentang.paragraf.push("Paragraf baru."); })}>Tambah paragraf</TombolKecil> : null}
              {t.tentang.paragraf.length > 1 ? <TombolKecil icon={<Trash2 size={14} color={colors.foreground} />} onPress={() => ubah((d) => { d.teks.tentang.paragraf.pop(); })}>Hapus paragraf terakhir</TombolKecil> : null}
            </View>
          ) : null}
          <Teks label="Pita di foto: judul" value={t.tentang.ribbonJudul} ro={g} onChange={(v) => ubah((d) => { d.teks.tentang.ribbonJudul = v; })} />
          <Teks label="Pita di foto: tulisan" value={t.tentang.ribbonTeks} ro={g} onChange={(v) => ubah((d) => { d.teks.tentang.ribbonTeks = v; })} />
          <Area label="Jendela “Lihat Profil Yayasan”: pembuka" value={t.profil.pembuka} ro={g} onChange={(v) => ubah((d) => { d.teks.profil.pembuka = v; })} />
          <Area label="Jendela “Lihat Profil Yayasan”: arah pendidikan" value={t.profil.arah} ro={g} onChange={(v) => ubah((d) => { d.teks.profil.arah = v; })} />
        </Bagian>

        <Bagian judul="Empat nilai pendidikan" ringkas={t.nilai.map((n) => n.judul).join(" · ")} terbuka={buka === "nilai"} onToggle={() => toggle("nilai")} kunci={g}>
          {g ? <CatatanKunci /> : null}
          {t.nilai.map((n, i) => (
            <View key={i} className="border border-border rounded-xl p-3 gap-3">
              <Teks label={`Nilai ${i + 1}: judul`} value={n.judul} ro={g} onChange={(v) => ubah((d) => { d.teks.nilai[i].judul = v; })} />
              <Area label="Keterangan" rows={2} value={n.deskripsi} ro={g} onChange={(v) => ubah((d) => { d.teks.nilai[i].deskripsi = v; })} />
            </View>
          ))}
        </Bagian>

        <Bagian judul="Jenjang pendidikan" ringkas={draft.education.map((e) => e.shortTitle).join(" · ")} terbuka={buka === "jenjang"} onToggle={() => toggle("jenjang")}>
          {g ? <Text className="text-xs text-muted-foreground">Judul bagian dikunci (Admin IT). Anda dapat mengubah kartu jenjang milik katalog Anda.</Text> : (
            <>
              <Teks label="Judul bagian" value={t.jenjang.judul} onChange={(v) => ubah((d) => { d.teks.jenjang.judul = v; })} />
              <Area label="Keterangan bagian" rows={2} value={t.jenjang.deskripsi} onChange={(v) => ubah((d) => { d.teks.jenjang.deskripsi = v; })} />
            </>
          )}
          {draft.education.map((e, i) => (
            <KartuItem key={e.id} judul={e.title} {...kartuProps(e.katalog)} bisaHapus={!g && draft.education.length > 1}
              onNaik={() => ubah((d) => geser(d.education, i, -1))} onTurun={() => ubah((d) => geser(d.education, i, 1))}
              onHapus={() => void hapusDgnKonfirmasi(`jenjang ${e.title}`, () => ubah((d) => { d.education.splice(i, 1); }))}>
              <Foto label="Foto jenjang" value={e.image} tampil={tampil} unggah={unggah} onChange={(v) => ubah((d) => { d.education[i].image = v; })} />
              <Teks label="Nama lengkap" value={e.title} onChange={(v) => ubah((d) => { d.education[i].title = v; })} />
              <Teks label="Nama singkat" value={e.shortTitle} onChange={(v) => ubah((d) => { d.education[i].shortTitle = v; })} />
              <Teks label="Moto singkat" value={e.subtitle} onChange={(v) => ubah((d) => { d.education[i].subtitle = v; })} />
              <Area label="Ringkasan di kartu" rows={2} max={500} value={e.description} onChange={(v) => ubah((d) => { d.education[i].description = v; })} />
              <Area label="Penjelasan lengkap (saat kartu dibuka)" rows={5} max={5000} value={e.detail} onChange={(v) => ubah((d) => { d.education[i].detail = v; })} />
              {izin.global ? <PilihKatalog value={e.katalog} pilihan={pilihanKatalog} onChange={(v) => ubah((d) => { d.education[i].katalog = v; })} /> : null}
            </KartuItem>
          ))}
          {!g && draft.education.length < 6 ? (
            <TombolKecil icon={<Plus size={14} color={colors.foreground} />} onPress={() => ubah((d) => { d.education.push({ id: idBaru("jenjang"), title: "Jenjang baru", shortTitle: "Jenjang", subtitle: "Moto singkat", description: "Ringkasan.", detail: "Penjelasan lengkap.", image: "", katalog: "" }); })}>Tambah jenjang</TombolKecil>
          ) : null}
        </Bagian>

        <Bagian judul="Mengapa memilih Al Ikhlas 86" ringkas={`${t.keunggulan.butir.length} butir`} terbuka={buka === "unggul"} onToggle={() => toggle("unggul")} kunci={g}>
          {g ? <CatatanKunci /> : null}
          <Foto label="Foto bagian ini" value={draft.benefitsImage} ro={g} tampil={tampil} unggah={unggah} onChange={(v) => ubah((d) => { d.benefitsImage = v; })} />
          <Area label="Judul" rows={2} max={300} ro={g} hint={PETUNJUK_SOROTAN} value={t.keunggulan.judul} onChange={(v) => ubah((d) => { d.teks.keunggulan.judul = v; })} />
          {t.keunggulan.butir.map((b, i) => (
            <View key={i} className="flex-row gap-2 items-center">
              <TextInput accessibilityLabel={`Butir ${i + 1}`} value={b} maxLength={300} editable={!g} onChangeText={(v) => ubah((d) => { d.teks.keunggulan.butir[i] = v; })} className={`${inputCls} flex-1 ${g ? "opacity-60" : ""}`} />
              {!g && t.keunggulan.butir.length > 1 ? <Pressable onPress={() => ubah((d) => { d.teks.keunggulan.butir.splice(i, 1); })} accessibilityLabel="Hapus butir" className="p-2"><Trash2 size={16} color="#dc2626" /></Pressable> : null}
            </View>
          ))}
          {!g && t.keunggulan.butir.length < 10 ? <TombolKecil icon={<Plus size={14} color={colors.foreground} />} onPress={() => ubah((d) => { d.teks.keunggulan.butir.push("Butir baru."); })}>Tambah butir</TombolKecil> : null}
        </Bagian>

        <Bagian judul="Program unggulan" ringkas={`${draft.programs.length} program`} terbuka={buka === "program"} onToggle={() => toggle("program")}>
          {g ? <Text className="text-xs text-muted-foreground">Judul bagian dikunci (Admin IT). Anda dapat mengubah, menambah, dan menghapus program milik katalog Anda.</Text> : (
            <>
              <Teks label="Judul bagian" value={t.program.judul} onChange={(v) => ubah((d) => { d.teks.program.judul = v; })} />
              <Area label="Keterangan bagian" rows={2} value={t.program.deskripsi} onChange={(v) => ubah((d) => { d.teks.program.deskripsi = v; })} />
            </>
          )}
          {draft.programs.map((p, i) => (
            <KartuItem key={p.id} judul={p.title} {...kartuProps(p.katalog)} bisaHapus
              onNaik={() => ubah((d) => geser(d.programs, i, -1))} onTurun={() => ubah((d) => geser(d.programs, i, 1))}
              onHapus={() => void hapusDgnKonfirmasi(`program ${p.title}`, () => ubah((d) => { d.programs.splice(i, 1); }))}>
              <Teks label="Nama program" value={p.title} onChange={(v) => ubah((d) => { d.programs[i].title = v; })} />
              <Teks label="Moto singkat" value={p.subtitle} onChange={(v) => ubah((d) => { d.programs[i].subtitle = v; })} />
              <Area label="Ringkasan di kartu" rows={2} max={500} value={p.description} onChange={(v) => ubah((d) => { d.programs[i].description = v; })} />
              <Area label="Penjelasan lengkap (saat kartu dibuka)" rows={5} max={5000} value={p.detail} onChange={(v) => ubah((d) => { d.programs[i].detail = v; })} />
              {izin.global || pilihanKatalog.length > 1 ? <PilihKatalog value={p.katalog} pilihan={pilihanKatalog} onChange={(v) => ubah((d) => { d.programs[i].katalog = v; })} /> : null}
            </KartuItem>
          ))}
          {draft.programs.length < 12 ? (
            <TombolKecil icon={<Plus size={14} color={colors.foreground} />} onPress={() => ubah((d) => { d.programs.push({ id: idBaru("prog"), title: "Program baru", subtitle: "Moto singkat", description: "Ringkasan program.", detail: "Penjelasan lengkap program.", katalog: katalogDefault }); })}>Tambah program</TombolKecil>
          ) : null}
        </Bagian>

        <Bagian judul="Pendaftaran" ringkas={t.pendaftaran.deskripsi} terbuka={buka === "daftar"} onToggle={() => toggle("daftar")} kunci={g}>
          {g ? <CatatanKunci /> : null}
          <Area label="Judul" rows={3} max={300} ro={g} hint={PETUNJUK_SOROTAN} value={t.pendaftaran.judul} onChange={(v) => ubah((d) => { d.teks.pendaftaran.judul = v; })} />
          <Area label="Kalimat pengantar" rows={2} ro={g} value={t.pendaftaran.deskripsi} onChange={(v) => ubah((d) => { d.teks.pendaftaran.deskripsi = v; })} />
          <Area label="Catatan kecil di bawah tombol" rows={2} ro={g} value={t.pendaftaran.catatan} onChange={(v) => ubah((d) => { d.teks.pendaftaran.catatan = v; })} />
          {draft.registrationImages.map((p, i) => <Foto key={i} label={`Foto kolase ${i + 1}`} value={p} ro={g} tampil={tampil} unggah={unggah} onChange={(v) => ubah((d) => { d.registrationImages[i] = v; })} />)}
        </Bagian>

        <Bagian judul="Galeri kegiatan" ringkas={`${draft.gallery.length} foto`} terbuka={buka === "galeri"} onToggle={() => toggle("galeri")}>
          {g ? <Text className="text-xs text-muted-foreground">Judul bagian dikunci (Admin IT). Anda dapat menambah, mengganti, dan menghapus foto milik katalog Anda.</Text> : (
            <>
              <Teks label="Judul bagian" value={t.galeri.judul} onChange={(v) => ubah((d) => { d.teks.galeri.judul = v; })} />
              <Area label="Keterangan bagian" rows={2} value={t.galeri.deskripsi} onChange={(v) => ubah((d) => { d.teks.galeri.deskripsi = v; })} />
            </>
          )}
          {draft.gallery.map((f, i) => (
            <KartuItem key={f.id} judul={f.label} {...kartuProps(f.katalog)} bisaHapus
              onNaik={() => ubah((d) => geser(d.gallery, i, -1))} onTurun={() => ubah((d) => geser(d.gallery, i, 1))}
              onHapus={() => void hapusDgnKonfirmasi(`foto ${f.label}`, () => ubah((d) => { d.gallery.splice(i, 1); }))}>
              <Foto label="Foto" value={f.image} tampil={tampil} unggah={unggah} onChange={(v) => ubah((d) => { d.gallery[i].image = v; })} />
              <Teks label="Keterangan foto" value={f.label} onChange={(v) => ubah((d) => { d.gallery[i].label = v; })} />
              <View className="gap-1"><Text className="text-sm font-medium text-foreground">Kategori</Text><SimplePicker value={f.category} options={KATEGORI.map((k) => ({ value: k, label: k }))} onChange={(v) => ubah((d) => { d.gallery[i].category = v as KategoriGaleri; })} /></View>
              {izin.global || pilihanKatalog.length > 1 ? <PilihKatalog value={f.katalog} pilihan={pilihanKatalog} onChange={(v) => ubah((d) => { d.gallery[i].katalog = v; })} /> : null}
            </KartuItem>
          ))}
          {draft.gallery.length < 48 ? (
            <TombolKecil icon={<Plus size={14} color={colors.foreground} />} onPress={() => ubah((d) => { d.gallery.push({ id: idBaru("foto"), label: "Foto baru", category: "Kegiatan", image: "", katalog: katalogDefault }); })}>Tambah foto</TombolKecil>
          ) : null}
        </Bagian>

        <Bagian judul="Kontak & media sosial" ringkas={`${draft.contact.phone} · ${draft.contact.email}`} terbuka={buka === "kontak"} onToggle={() => toggle("kontak")} kunci={g}>
          {g ? <CatatanKunci /> : null}
          <Area label="Alamat" rows={2} max={500} ro={g} value={draft.contact.address} onChange={(v) => ubah((d) => { d.contact.address = v; })} />
          <Teks label="Lokasi singkat (di header)" value={draft.contact.lokasiSingkat} ro={g} onChange={(v) => ubah((d) => { d.contact.lokasiSingkat = v; })} />
          <Teks label="Nama kontak (mis. Administrasi SDIT Al Ikhlas)" value={draft.contact.namaKontak} ro={g} onChange={(v) => ubah((d) => { d.contact.namaKontak = v; })} />
          <Teks label="Telepon" value={draft.contact.phone} max={25} ro={g} keyboard="phone-pad" onChange={(v) => ubah((d) => { d.contact.phone = v; })} />
          <Teks label="Email" value={draft.contact.email} max={200} ro={g} keyboard="email-address" onChange={(v) => ubah((d) => { d.contact.email = v; })} />
          <Teks label="WhatsApp (angka saja, awali 62)" value={draft.contact.whatsapp} max={16} ro={g} keyboard="number-pad" hint="Contoh: 6281234567890. Kosongkan bila tidak ada." onChange={(v) => ubah((d) => { d.contact.whatsapp = v.replace(/[^0-9]/g, ""); })} />
          <Teks label="Tautan formulir pendaftaran (https://...)" value={draft.contact.registrationUrl} max={2000} ro={g} keyboard="url" hint="Kosongkan bila tidak ada. Bila kosong, tombol pendaftaran memakai WhatsApp, lalu email." onChange={(v) => ubah((d) => { d.contact.registrationUrl = v; })} />
          <Teks label="Tautan peta Google Maps (https://...)" value={draft.contact.mapUrl} max={2000} ro={g} keyboard="url" onChange={(v) => ubah((d) => { d.contact.mapUrl = v; })} />
          <View className="gap-2">
            <Text className="text-sm font-medium text-foreground">Media sosial (maks. 6)</Text>
            {draft.socials.map((s, i) => (
              <View key={i} className="gap-2 border border-border rounded-xl p-3">
                <TextInput accessibilityLabel={`Nama media sosial ${i + 1}`} placeholder="Nama (mis. Instagram)" value={s.label} maxLength={300} editable={!g} onChangeText={(v) => ubah((d) => { d.socials[i].label = v; })} className={`${inputCls} ${g ? "opacity-60" : ""}`} />
                <TextInput accessibilityLabel={`Tautan media sosial ${i + 1}`} placeholder="https://..." value={s.url} maxLength={2000} editable={!g} autoCapitalize="none" keyboardType="url" onChangeText={(v) => ubah((d) => { d.socials[i].url = v; })} className={`${inputCls} ${g ? "opacity-60" : ""}`} />
                {!g ? <Pressable onPress={() => ubah((d) => { d.socials.splice(i, 1); })} className="flex-row items-center gap-1.5 self-start"><Trash2 size={14} color="#dc2626" /><Text className="text-xs text-red-600">Hapus</Text></Pressable> : null}
              </View>
            ))}
            {!g && draft.socials.length < 6 ? <TombolKecil icon={<Plus size={14} color={colors.foreground} />} onPress={() => ubah((d) => { d.socials.push({ label: "", url: "https://" }); })}>Tambah media sosial</TombolKecil> : null}
          </View>
        </Bagian>

        <Bagian judul="Spanduk, Info Terbaru & footer" ringkas={t.footer.judul.replace(/\n/g, " ")} terbuka={buka === "footer"} onToggle={() => toggle("footer")} kunci={g}>
          {g ? <CatatanKunci /> : null}
          <Area label="Spanduk hijau: judul" rows={1} max={300} ro={g} hint={PETUNJUK_SOROTAN} value={t.banner.judul} onChange={(v) => ubah((d) => { d.teks.banner.judul = v; })} />
          <Area label="Spanduk hijau: slogan" rows={2} max={300} ro={g} hint="Enter = baris baru." value={t.banner.slogan} onChange={(v) => ubah((d) => { d.teks.banner.slogan = v; })} />
          <Teks label="Info Terbaru: judul bagian" value={t.berita.judul} ro={g} onChange={(v) => ubah((d) => { d.teks.berita.judul = v; })} />
          <Area label="Info Terbaru: keterangan" rows={2} ro={g} value={t.berita.deskripsi} onChange={(v) => ubah((d) => { d.teks.berita.deskripsi = v; })} />
          <Area label="Footer: judul" rows={2} max={300} ro={g} hint="Enter = baris baru." value={t.footer.judul} onChange={(v) => ubah((d) => { d.teks.footer.judul = v; })} />
          <Area label="Footer: slogan" rows={2} max={300} ro={g} hint="Enter = baris baru." value={t.footer.slogan} onChange={(v) => ubah((d) => { d.teks.footer.slogan = v; })} />
        </Bagian>

        <Bagian judul="Riwayat perubahan" ringkas="Siapa mengubah apa" terbuka={buka === "riwayat"} onToggle={() => toggle("riwayat")}>
          {riwayat === null ? <Text className="text-sm text-muted-foreground">Memuat...</Text> : riwayat.length === 0 ? <Text className="text-sm text-muted-foreground">Belum ada perubahan tercatat.</Text> : (
            <View className="gap-2">
              {riwayat.map((r) => (
                <View key={r.id} className="border border-border rounded-xl px-3 py-2.5 gap-2">
                  <Text className="text-sm text-foreground">{r.aksi === "foto" ? "Unggah foto" : r.aksi === "kembalikan" ? `Kembalikan ${r.bagian}` : r.bagian}</Text>
                  <Text className="text-xs text-muted-foreground">{r.nama} ({r.peran}) · {waktuLokal(r.waktu)}</Text>
                  {r.bisaDikembalikan ? <TombolKecil icon={<RotateCcw size={14} color={colors.foreground} />} disabled={menyimpan || dirty} onPress={() => void kembalikan(r)}>Kembalikan</TombolKecil> : null}
                </View>
              ))}
            </View>
          )}
          {izin.global ? <Text className="text-xs text-muted-foreground">“Kembalikan” memulihkan isi website seperti sesudah perubahan itu (foto yang sudah diunggah tetap ada). Simpan atau buang perubahan Anda dulu. Pengembalian juga tercatat dan bisa dikembalikan lagi.</Text> : null}
        </Bagian>
      </KeyboardAwareScrollView>

      {dirty || menyimpan ? (
        <View className="absolute left-3 right-3 bg-card border border-border rounded-2xl px-4 py-3 flex-row items-center gap-3" style={{ bottom: 10 + insets.bottom, elevation: 6 }}>
          <Text className="text-xs text-muted-foreground flex-1">Ada perubahan yang belum disimpan</Text>
          <Pressable onPress={() => void batal()} disabled={menyimpan} className="px-3 py-2.5 rounded-xl border border-border"><Text className="text-sm font-medium text-foreground">Buang</Text></Pressable>
          <Pressable onPress={() => void simpan()} disabled={menyimpan} className={`flex-row items-center gap-2 px-4 py-2.5 rounded-xl bg-primary ${menyimpan ? "opacity-60" : ""}`}>
            {menyimpan ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : <Save size={16} color={colors.primaryForeground} />}
            <Text className="text-sm font-semibold text-primary-foreground">{menyimpan ? "Menyimpan..." : "Simpan & tayangkan"}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

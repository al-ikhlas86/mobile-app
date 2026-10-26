// ============================================================
// KELOLA WEBSITE (2026-10-26) - port native dari webview (src/app/components/screens/KelolaWebsiteScreen.tsx).
// Admin IT / Pengelola Website mengedit landing page yayasan (https://yayasanalikhlas86.sch.id). Isi disimpan backend sebagai
// commit ke repo GitHub `web`; situs dibangun ulang otomatis (±2-4 menit) dan tetap tayang walau VPS mati.
// Admin IT: semua bagian + menunjuk Pengelola Website. Pengelola: bagian umum/yayasan dan/atau kartu milik katalognya.
// Aturan izin SESUNGGUHNYA ada di server (services/websiteContent.js); layar ini hanya mengunci/menyembunyikan.
// Tampilan untuk orang awam: satu bagian per layar, penjelasan bahasa biasa, tombol "Warnai kata", ringkasan perubahan.
// ============================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, Image, ActivityIndicator, Alert, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { ArrowLeft, CheckSquare, ChevronDown, ChevronUp, ExternalLink, ImageIcon, Lock, Plus, RotateCcw, Save, Search, Square, Trash2, Upload, UserPlus, X, AlertTriangle, CheckCircle, BookOpen, FileCheck, GraduationCap, HelpCircle, History, Images, Info, Megaphone, Phone, Star, ThumbsUp, Type, Users } from "lucide-react-native";
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
  faq: { q: string; a: string }[];
  pengurus: { id: string; nama: string; jabatan: string; deskripsi: string; foto: string }[];
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
    faq: { judul: string; deskripsi: string };
  };
}
interface Izin { global: boolean; umum: boolean; katalog: string[] }
interface KatalogInfo { kode: string; nama: string }
interface StatusBuild { id: number; status: string; hasil: string | null }
interface Riwayat { id: number; nama: string; peran: string; aksi: string; bagian: string; commit: string | null; waktu: string; bisaDikembalikan: boolean }
interface PengelolaItem { userId: number; nama: string; role: string; scopes: string[] }
interface PilihanScope { kode: string; nama: string }

const KATEGORI: KategoriGaleri[] = ["Pembelajaran", "Kegiatan", "Fasilitas"];
const inputCls = "bg-input-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground";
const idBaru = (awalan: string) => `${awalan}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const waktuLokal = (ts: string) => new Date(ts).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const ROLE_LABEL: Record<string, string> = { guru: "Guru", pegawai: "Pegawai", admin_tu: "Admin TU", admin_media: "Admin Media", keuangan: "Keuangan", supervisor: "Supervisor" };

// Alert bergaya "confirm" yang mengembalikan Promise<boolean>.
const konfirmasi = (judul: string, pesan: string, ya = "Ya") =>
  new Promise<boolean>((resolve) => {
    Alert.alert(judul, pesan, [{ text: "Batal", style: "cancel", onPress: () => resolve(false) }, { text: ya, onPress: () => resolve(true) }], { cancelable: true, onDismiss: () => resolve(false) });
  });

// ---------- ringkasan perubahan dalam bahasa biasa ----------
const beda = (x: unknown, y: unknown) => JSON.stringify(x) !== JSON.stringify(y);
function hitungKartu<T extends { id: string }>(a: T[], d: T[], satuan: string): string {
  const idA = new Set(a.map((x) => x.id));
  const idD = new Set(d.map((x) => x.id));
  const tambah = d.filter((x) => !idA.has(x.id)).length;
  const hapus = a.filter((x) => !idD.has(x.id)).length;
  const ubah = d.filter((x) => idA.has(x.id) && beda(x, a.find((y) => y.id === x.id))).length;
  const bagian: string[] = [];
  if (tambah) bagian.push(`${tambah} ${satuan} ditambah`);
  if (hapus) bagian.push(`${hapus} ${satuan} dihapus`);
  if (ubah) bagian.push(`${ubah} ${satuan} diubah`);
  if (!bagian.length && beda(a.map((x) => x.id), d.map((x) => x.id))) bagian.push("urutan diubah");
  return bagian.join(", ");
}
function ringkasanPerubahan(a: Isi, d: Isi): string[] {
  const h: string[] = [];
  if (beda(a.heroImage, d.heroImage) || beda(a.teks.hero, d.teks.hero)) h.push("Banner utama");
  if (beda(a.aboutImage, d.aboutImage) || beda(a.teks.tentang, d.teks.tentang) || beda(a.teks.profil, d.teks.profil)) h.push("Tentang & profil yayasan");
  if (beda(a.teks.nilai, d.teks.nilai)) h.push("Empat nilai pendidikan");
  if (beda(a.education, d.education) || beda(a.teks.jenjang, d.teks.jenjang)) { const k = hitungKartu(a.education, d.education, "jenjang"); h.push(`Jenjang pendidikan${k ? ` (${k})` : ""}`); }
  if (beda(a.benefitsImage, d.benefitsImage) || beda(a.teks.keunggulan, d.teks.keunggulan)) h.push("Mengapa memilih kami");
  if (beda(a.programs, d.programs) || beda(a.teks.program, d.teks.program)) { const k = hitungKartu(a.programs, d.programs, "program"); h.push(`Program unggulan${k ? ` (${k})` : ""}`); }
  if (beda(a.registrationImages, d.registrationImages) || beda(a.teks.pendaftaran, d.teks.pendaftaran)) h.push("Pendaftaran");
  if (beda(a.gallery, d.gallery) || beda(a.teks.galeri, d.teks.galeri)) { const k = hitungKartu(a.gallery, d.gallery, "foto"); h.push(`Galeri foto${k ? ` (${k})` : ""}`); }
  if (beda(a.contact, d.contact) || beda(a.socials, d.socials)) h.push("Kontak & media sosial");
  if (beda(a.teks.banner, d.teks.banner) || beda(a.teks.berita, d.teks.berita) || beda(a.teks.footer, d.teks.footer)) h.push("Spanduk, Info Terbaru & footer");
  if (beda(a.faq, d.faq) || beda(a.teks.faq, d.teks.faq)) h.push("Tanya jawab (FAQ)");
  if (beda(a.pengurus, d.pengurus)) h.push("Pengurus yayasan");
  return h;
}

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

// Contoh tampilan judul: kata yang diapit ** tampil berwarna, seperti di website.
function Sorot({ teks }: { teks: string }) {
  return <Text className="text-sm text-foreground">{teks.split("**").map((b, i) => (i % 2 === 1 ? <Text key={i} className="font-bold text-primary">{b}</Text> : b))}</Text>;
}

// Judul yang sebagian katanya diberi warna: blok kata, tekan "Warnai kata terpilih". Tanda ** dihasilkan otomatis.
function JudulField({ label, value, onChange, ro, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; ro?: boolean; rows?: number }) {
  const [sel, setSel] = useState({ start: 0, end: 0 });
  const warnai = () => {
    const { start: a, end: b } = sel;
    if (a === b) { Alert.alert("Blok kata dulu", "Blok dulu kata yang mau diberi warna (tekan lama pada kata), lalu tekan tombol ini."); return; }
    const pilih = value.slice(a, b);
    if (value.slice(a - 2, a) === "**" && value.slice(b, b + 2) === "**") onChange(value.slice(0, a - 2) + pilih + value.slice(b + 2));
    else if (pilih.includes("**")) Alert.alert("Sudah berwarna", "Bagian yang diblok sudah memuat kata berwarna. Blok kata lain.");
    else onChange(`${value.slice(0, a)}**${pilih}**${value.slice(b)}`);
  };
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-foreground">{label}</Text>
      <TextInput value={value} onChangeText={onChange} onSelectionChange={(e) => setSel(e.nativeEvent.selection)} maxLength={300} editable={!ro} multiline textAlignVertical="top" className={`${inputCls} ${ro ? "opacity-60" : ""}`} style={{ minHeight: 24 * rows + 16 }} />
      {!ro ? (
        <View className="gap-1.5">
          <Pressable onPress={warnai} className="self-start px-3 py-2 rounded-xl border border-border"><Text className="text-sm font-medium text-foreground">Warnai kata terpilih</Text></Pressable>
          <Text className="text-xs text-muted-foreground">Blok kata di kotak (tekan lama pada kata), lalu tekan tombol. Enter = baris baru.</Text>
        </View>
      ) : null}
      <Text className="text-xs text-muted-foreground">Contoh tampilan:</Text>
      <View className="rounded-xl bg-muted px-3 py-2"><Sorot teks={value} /></View>
    </View>
  );
}

function Foto({ label, value, onChange, ro, wajib, tampil, unggah, saran }: {
  label: string; value: string; onChange: (v: string) => void; ro?: boolean; wajib?: boolean; saran?: string;
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
      {saran && !ro ? <Text className="text-xs text-muted-foreground">{saran}</Text> : null}
    </View>
  );
}

function Bagian({ judul, info, ringkas, ikon, lihat, terbuka, sembunyi, onToggle, kunci, children }: { judul: string; info: string; ringkas?: string; ikon?: React.ReactNode; lihat?: string; terbuka: boolean; sembunyi: boolean; onToggle: () => void; kunci?: boolean; children: React.ReactNode }) {
  const colors = useThemeColors();
  if (sembunyi) return null;
  return (
    <View className="bg-card border border-border rounded-2xl overflow-hidden">
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: terbuka }} className="flex-row items-center gap-3 px-4 py-4">
        {ikon ? <View className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center">{ikon}</View> : null}
        <View className="flex-1">
          <Text className="font-semibold text-sm text-foreground">{judul}</Text>
          <Text className="text-xs text-muted-foreground">{info}</Text>
          {!terbuka && ringkas ? <Text numberOfLines={1} className="text-xs text-foreground mt-0.5" style={{ opacity: 0.7 }}>Saat ini: {ringkas}</Text> : null}
        </View>
        {kunci ? <View className="flex-row items-center gap-1"><Lock size={13} color={colors.mutedForeground} /><Text className="text-[11px] text-muted-foreground">Hanya lihat</Text></View>
          : !terbuka ? <View className="bg-primary/10 rounded-full px-2.5 py-1"><Text className="text-[11px] font-semibold text-primary">Ubah</Text></View> : null}
        {terbuka ? <ChevronUp size={18} color={colors.mutedForeground} /> : <ChevronDown size={18} color={colors.mutedForeground} />}
      </Pressable>
      {terbuka ? (
        <View className="px-4 pb-4 pt-3 gap-4 border-t border-border">
          {lihat ? <Pressable onPress={() => void Linking.openURL(lihat)} className="flex-row items-center gap-1.5 self-start"><ExternalLink size={13} color={colors.primary} /><Text className="text-xs text-primary">Lihat bagian ini di website</Text></Pressable> : null}
          {children}
        </View>
      ) : null}
    </View>
  );
}

function CatatanKunci() {
  const colors = useThemeColors();
  return <View className="flex-row items-center gap-2 bg-muted rounded-xl px-3 py-2"><Lock size={13} color={colors.mutedForeground} /><Text className="text-xs text-muted-foreground flex-1">Bagian ini tidak ditugaskan kepada Anda, jadi hanya bisa dilihat. Hubungi Admin IT bila perlu diubah.</Text></View>;
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
  if (pilihan.length <= 1) return null;
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

function Kotak({ label, nilai, onToggle, disabled }: { label: string; nilai: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onToggle} disabled={disabled} accessibilityRole="checkbox" accessibilityState={{ checked: nilai }} className="flex-row items-center gap-2 py-1">
      {nilai ? <CheckSquare size={20} color="#16a34a" /> : <Square size={20} color="#9ca3af" />}
      <Text className="text-sm text-foreground">{label}</Text>
    </Pressable>
  );
}

// ---------- panel Persetujuan kartu guru/pegawai ----------
interface Antrian { employeeId: number; nama: string; katalog: { kode: string; nama: string } | null; status: string[]; mapel: string[]; deskripsi: string; foto: string | null; sudahTayang: boolean }

function PanelPersetujuan({ antrian, onUbah }: { antrian: Antrian[] | null; onUbah: () => void }) {
  const [sibuk, setSibuk] = useState<number | null>(null);
  const [pesan, setPesan] = useState("");
  const [tolak, setTolak] = useState<{ a: Antrian; alasan: string } | null>(null);
  const kirim = async (a: Antrian, aksi: "setujui" | "tolak", catatan?: string) => {
    setSibuk(a.employeeId); setPesan("");
    const res = await api.profilTimKeputusan(a.employeeId, aksi, catatan);
    setSibuk(null); setTolak(null);
    if (!res.success) setPesan(res.message || "Gagal memproses.");
    onUbah();
  };
  const setujui = async (a: Antrian) => { if (await konfirmasi("Tayangkan kartu", `Tayangkan kartu ${a.nama} di website?`, "Setujui")) void kirim(a, "setujui"); };
  if (antrian === null) return <Text className="text-sm text-muted-foreground">Memuat...</Text>;
  return (
    <View className="gap-3">
      <Text className="text-sm text-foreground">Guru/pegawai yang memilih tampil di halaman Profil Yayasan menunggu persetujuan Anda di sini. Periksa foto dan tulisannya, lalu setujui atau tolak dengan alasan. Kartu baru tayang di website dalam sekitar 30 menit setelah disetujui.</Text>
      {pesan ? <Text className="text-sm text-red-600">{pesan}</Text> : null}
      {antrian.length === 0 ? <Text className="text-sm text-muted-foreground">Tidak ada kartu yang menunggu persetujuan.</Text> : antrian.map((a) => (
        <View key={a.employeeId} className="border border-border rounded-xl p-3 gap-2">
          <View className="flex-row gap-3">
            {a.foto ? <Image source={{ uri: a.foto }} className="w-20 h-28 rounded-lg bg-muted" resizeMode="cover" /> : <View className="w-20 h-28 rounded-lg border border-dashed border-border bg-muted items-center justify-center"><ImageIcon size={20} color="#9ca3af" /></View>}
            <View className="flex-1 gap-1.5">
              <Text className="text-sm font-semibold text-foreground">{a.nama} <Text className="text-xs font-normal text-muted-foreground">· {a.katalog?.nama ?? "Yayasan"}{a.sudahTayang ? " · perubahan" : " · baru"}</Text></Text>
              <View className="flex-row flex-wrap gap-1.5">{a.status.map((s) => <View key={s} className="bg-muted rounded-full px-2 py-0.5"><Text className="text-[11px] text-foreground">{s}</Text></View>)}</View>
              {a.mapel.length > 0 ? <Text className="text-xs text-muted-foreground">Mapel: {a.mapel.join(", ")}</Text> : null}
              <Text className="text-sm text-foreground">{a.deskripsi || "(tanpa deskripsi)"}</Text>
            </View>
          </View>
          {tolak?.a.employeeId === a.employeeId ? (
            <View className="gap-2">
              <TextInput value={tolak.alasan} onChangeText={(v) => setTolak({ a, alasan: v })} placeholder="Alasan menolak (akan dibaca guru)" maxLength={200} multiline className={inputCls} />
              <View className="flex-row gap-2">
                <TombolKecil onPress={() => setTolak(null)}>Batal</TombolKecil>
                <Pressable disabled={sibuk !== null || tolak.alasan.trim().length < 3} onPress={() => void kirim(a, "tolak", tolak.alasan.trim())} className={`px-4 py-2 rounded-xl bg-red-600 ${sibuk !== null || tolak.alasan.trim().length < 3 ? "opacity-50" : ""}`}><Text className="text-sm font-semibold text-white">Kirim penolakan</Text></Pressable>
              </View>
            </View>
          ) : (
            <View className="flex-row gap-2">
              <TombolKecil disabled={sibuk !== null} icon={<X size={14} color="#dc2626" />} onPress={() => setTolak({ a, alasan: "" })}>Tolak</TombolKecil>
              <Pressable disabled={sibuk !== null} onPress={() => void setujui(a)} className={`flex-row items-center gap-1.5 px-4 py-2 rounded-xl bg-primary ${sibuk !== null ? "opacity-50" : ""}`}>{sibuk === a.employeeId ? <ActivityIndicator size="small" color="#fff" /> : <CheckCircle size={14} color="#fff" />}<Text className="text-sm font-semibold text-primary-foreground">Setujui</Text></Pressable>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

// ---------- layar ----------
export function KelolaWebsiteScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<{ scrollTo?: (o: { y: number; animated: boolean }) => void } | null>(null);
  const [fase, setFase] = useState<"muat" | "ok" | "gagal">("muat");
  const [galat, setGalat] = useState("");
  const [asli, setAsli] = useState<Isi | null>(null);
  const [draft, setDraft] = useState<Isi | null>(null);
  const [sha, setSha] = useState("");
  const [izin, setIzin] = useState<Izin>({ global: false, umum: false, katalog: [] });
  const [semuaKatalog, setSemuaKatalog] = useState<KatalogInfo[]>([]);
  const [urlSitus, setUrlSitus] = useState("https://yayasanalikhlas86.sch.id");
  const [buka, setBuka] = useState("");
  const [menyimpan, setMenyimpan] = useState(false);
  const [massal, setMassal] = useState("");
  const [pesan, setPesan] = useState<{ jenis: "ok" | "info" | "galat"; teks: string } | null>(null);
  const [riwayat, setRiwayat] = useState<Riwayat[] | null>(null);
  const [previewLokal, setPreviewLokal] = useState<Record<string, string>>({});
  const penayanganRef = useRef(0);
  const [antrian, setAntrian] = useState<Antrian[] | null>(null);
  const muatAntrian = useCallback(async () => { const res = await api.profilTimAntrian(); setAntrian(res.success ? (res.data as Antrian[]) : []); }, []);

  const muat = useCallback(async () => {
    setFase("muat");
    const res = await api.websiteGet();
    if (!res.success) { setGalat(res.message || "Gagal memuat isi website."); setFase("gagal"); return; }
    const d = res.data as { isi: Isi; sha: string; izin: Izin; semuaKatalog: KatalogInfo[]; urlSitus: string };
    setAsli(d.isi); setDraft(JSON.parse(JSON.stringify(d.isi))); setSha(d.sha); setIzin(d.izin); setSemuaKatalog(d.semuaKatalog); setUrlSitus(d.urlSitus);
    setFase("ok");
  }, []);
  useEffect(() => { void muat(); }, [muat]);
  useEffect(() => { void muatAntrian(); }, [muatAntrian]);
  useEffect(() => () => { penayanganRef.current += 1; }, []);

  const dirty = useMemo(() => draft !== null && asli !== null && JSON.stringify(draft) !== JSON.stringify(asli), [draft, asli]);
  const daftarUbah = useMemo(() => (dirty && draft && asli ? ringkasanPerubahan(asli, draft) : []), [dirty, draft, asli]);

  const ubah = (fn: (d: Isi) => void) => setDraft((d) => { if (!d) return d; const c = JSON.parse(JSON.stringify(d)) as Isi; fn(c); return c; });
  const namaKatalog = (kode: string) => (kode ? semuaKatalog.find((k) => k.kode === kode)?.nama ?? kode : "Yayasan");
  const umumBoleh = izin.global || izin.umum;
  const milik = (kode: string) => izin.global || izin.katalog.includes(kode) || (kode === "" && izin.umum);
  const pilihanKatalog = useMemo(() => {
    if (izin.global) return [{ kode: "", nama: "Yayasan (umum)" }, ...semuaKatalog];
    return [...(izin.umum ? [{ kode: "", nama: "Yayasan (umum)" }] : []), ...semuaKatalog.filter((k) => izin.katalog.includes(k.kode))];
  }, [izin, semuaKatalog]);
  const katalogDefault = pilihanKatalog[0]?.kode ?? "";
  const tampil = (p: string) => previewLokal[p] ?? (p.startsWith("/") ? `${urlSitus}${p}` : p);

  // Memilih foto dari galeri HP lalu mengunggahnya satu per satu. Mengembalikan daftar path yang berhasil.
  const pilihDanUnggah = async (banyak: boolean, sisa = 48): Promise<string[]> => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Izin galeri ditolak", "Izinkan akses galeri di pengaturan HP untuk memilih foto."); return []; }
    const hasil = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: banyak, quality: 0.9 });
    if (hasil.canceled || hasil.assets.length === 0) return [];
    const aset = hasil.assets.slice(0, Math.max(0, sisa));
    if (hasil.assets.length > aset.length) Alert.alert("Galeri penuh", `Galeri maksimal 48 foto. Hanya ${aset.length} foto pertama yang diproses.`);
    const path: string[] = [];
    for (let i = 0; i < aset.length; i += 1) {
      if (banyak) setMassal(`Mengunggah foto ${i + 1} dari ${aset.length}...`);
      let uri = aset[i].uri; let mime = aset[i].mimeType ?? "image/jpeg";
      try {
        const kecil = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1600 } }], { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG });
        uri = kecil.uri; mime = "image/jpeg";
      } catch { /* gagal mengecilkan: kirim apa adanya */ }
      const res = await api.websiteFoto(uri, mime);
      if (!res.success) { Alert.alert("Gagal mengunggah foto", res.message || "Coba lagi."); break; }
      const p = (res.data as { path: string }).path;
      setPreviewLokal((m) => ({ ...m, [p]: uri }));
      path.push(p);
    }
    setMassal("");
    return path;
  };
  const unggah = async (): Promise<string | null> => (await pilihDanUnggah(false, 1))[0] ?? null;
  const tambahBanyak = async () => {
    if (!draft) return;
    const daftarPath = await pilihDanUnggah(true, 48 - draft.gallery.length);
    if (daftarPath.length === 0) return;
    ubah((d) => { for (const p of daftarPath) d.gallery.push({ id: idBaru("foto"), label: "Foto kegiatan", category: "Kegiatan", image: p, katalog: katalogDefault }); });
    setPesan({ jenis: "info", teks: `${daftarPath.length} foto ditambahkan ke galeri. Ubah keterangan tiap foto lalu tekan "Simpan & tayangkan".` });
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
    if (!(await konfirmasi("Tayangkan perubahan ini?", daftarUbah.map((x) => `• ${x}`).join("\n"), "Tayangkan"))) return;
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

  const toggle = (k: string) => { setBuka(buka === k ? "" : k); if (k === "riwayat" && riwayat === null) void muatRiwayat(); scrollRef.current?.scrollTo?.({ y: 0, animated: false }); };
  const sembunyi = (k: string) => buka !== "" && buka !== k;

  if (fase === "muat") return <View className="flex-1 bg-background items-center justify-center gap-2"><ActivityIndicator /><Text className="text-sm text-muted-foreground">Memuat isi website...</Text></View>;
  if (fase === "gagal" || !draft || !asli) {
    return (
      <View className="flex-1 bg-background px-4 py-8 gap-3">
        <View className="flex-row items-center gap-2"><AlertTriangle size={16} color="#dc2626" /><Text className="text-sm text-red-600 flex-1">{galat}</Text></View>
        <TombolKecil onPress={() => void muat()}>Coba lagi</TombolKecil>
      </View>
    );
  }

  const g = !umumBoleh; // bagian umum terkunci
  const t = draft.teks;
  const kartuProps = (k: string) => ({ katalog: k, namaKatalog: namaKatalog(k), boleh: milik(k) });
  const geser = <T,>(arr: T[], i: number, arah: number) => { const j = i + arah; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; };
  const hapusDgnKonfirmasi = async (nama: string, lakukan: () => void) => { if (await konfirmasi("Hapus", `Hapus ${nama}?`, "Hapus")) lakukan(); };
  const peranTeks = izin.global ? "Anda Admin IT: dapat mengubah semua bagian." : `Anda Pengelola Website untuk: ${[...(izin.umum ? ["bagian umum & yayasan"] : []), ...izin.katalog.map(namaKatalog)].join(", ")}.`;
  const warnaPesan = pesan?.jenis === "ok" ? "bg-green-50" : pesan?.jenis === "galat" ? "bg-red-50" : "bg-blue-50";
  const warnaTeksPesan = pesan?.jenis === "ok" ? "text-green-800" : pesan?.jenis === "galat" ? "text-red-700" : "text-blue-800";
  const proses = pesan !== null && pesan.jenis === "info" && /dibangun|Menunggu/.test(pesan.teks);

  return (
    <View className="flex-1 bg-background">
      <KeyboardAwareScrollView ref={scrollRef as never} className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: (dirty || menyimpan ? 110 : 32) + insets.bottom, gap: 14 }} bottomOffset={20}>
        {buka === "" ? (
          <View className="bg-card border border-border rounded-2xl p-4 gap-2">
            <Text className="text-sm text-foreground"><Text className="font-bold">Pilih bagian website yang mau diubah.</Text> Perubahan baru tayang setelah Anda menekan "Simpan & tayangkan" (sekitar 2-4 menit), dan tercatat siapa yang mengubah.</Text>
            <Text className="text-xs text-muted-foreground">{peranTeks}</Text>
            <Pressable onPress={() => void Linking.openURL(urlSitus)} className="flex-row items-center gap-1.5 self-start"><ExternalLink size={14} color={colors.primary} /><Text className="text-sm text-primary">Lihat website</Text></Pressable>
            <Text className="text-xs text-muted-foreground">Info Terbaru di website otomatis diambil dari Berita Acara yang diterbitkan dan dicentang “Tampilkan di website”; tidak diatur di sini.</Text>
          </View>
        ) : (
          <Pressable onPress={() => toggle(buka)} className="flex-row items-center gap-1.5 self-start"><ArrowLeft size={15} color={colors.primary} /><Text className="text-sm text-primary">Kembali ke semua bagian</Text></Pressable>
        )}

        {pesan ? (
          <View accessibilityRole="alert" className={`${warnaPesan} rounded-2xl px-4 py-3 flex-row items-start gap-2`}>
            {pesan.jenis === "galat" ? <AlertTriangle size={16} color="#b91c1c" /> : proses ? <ActivityIndicator size="small" /> : <CheckCircle size={16} color="#166534" />}
            <Text className={`text-sm flex-1 ${warnaTeksPesan}`}>{pesan.teks}</Text>
            <Pressable onPress={() => setPesan(null)} accessibilityLabel="Tutup pesan"><X size={14} color={colors.mutedForeground} /></Pressable>
          </View>
        ) : null}

        <Bagian judul="Banner utama" ikon={<ImageIcon size={18} color={colors.primary} />} lihat={`${urlSitus}/#beranda`} info="Foto besar dan kalimat sambutan di bagian paling atas website." ringkas={t.hero.slides[0]?.judul.replace(/\*\*|\n/g, " ")} terbuka={buka === "hero"} sembunyi={sembunyi("hero")} onToggle={() => toggle("hero")} kunci={g}>
          {g ? <CatatanKunci /> : null}
          <Foto label="Foto utama (gedung sekolah)" saran="Pilih foto mendatar yang jelas. Tidak perlu dikecilkan dulu." value={draft.heroImage} wajib ro={g} tampil={tampil} unggah={unggah} onChange={(v) => ubah((d) => { d.heroImage = v; })} />
          <Teks label="Teks kecil di atas judul" value={t.hero.eyebrow} ro={g} onChange={(v) => ubah((d) => { d.teks.hero.eyebrow = v; })} />
          {t.hero.slides.map((s, i) => (
            <View key={i} className="border border-border rounded-xl p-3 gap-3">
              <View className="flex-row items-center justify-between"><Text className="text-sm font-semibold text-foreground">Banner {i + 1}</Text>
                {!g && t.hero.slides.length > 1 ? <Pressable onPress={() => ubah((d) => { d.teks.hero.slides.splice(i, 1); })}><Text className="text-xs text-red-600">Hapus banner</Text></Pressable> : null}</View>
              <JudulField label="Judul" rows={3} ro={g} value={s.judul} onChange={(v) => ubah((d) => { d.teks.hero.slides[i].judul = v; })} />
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

        <Bagian judul="Tentang & profil yayasan" ikon={<Info size={18} color={colors.primary} />} lihat={`${urlSitus}/#tentang`} info="Perkenalan singkat yayasan, dan jendela “Lihat Profil Yayasan”." ringkas={t.tentang.subjudul} terbuka={buka === "tentang"} sembunyi={sembunyi("tentang")} onToggle={() => toggle("tentang")} kunci={g}>
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

        <Bagian judul="Empat nilai pendidikan" ikon={<Star size={18} color={colors.primary} />} lihat={`${urlSitus}/#tentang`} info="Empat kotak kecil di bawah perkenalan yayasan." ringkas={t.nilai.map((n) => n.judul).join(" · ")} terbuka={buka === "nilai"} sembunyi={sembunyi("nilai")} onToggle={() => toggle("nilai")} kunci={g}>
          {g ? <CatatanKunci /> : null}
          {t.nilai.map((n, i) => (
            <View key={i} className="border border-border rounded-xl p-3 gap-3">
              <Teks label={`Nilai ${i + 1}: judul`} value={n.judul} ro={g} onChange={(v) => ubah((d) => { d.teks.nilai[i].judul = v; })} />
              <Area label="Keterangan" rows={2} value={n.deskripsi} ro={g} onChange={(v) => ubah((d) => { d.teks.nilai[i].deskripsi = v; })} />
            </View>
          ))}
        </Bagian>

        <Bagian judul="Jenjang pendidikan" ikon={<GraduationCap size={18} color={colors.primary} />} lihat={`${urlSitus}/#pendidikan`} info="Kartu TKIT dan SDIT beserta foto dan penjelasannya." ringkas={draft.education.map((e) => e.shortTitle).join(" · ")} terbuka={buka === "jenjang"} sembunyi={sembunyi("jenjang")} onToggle={() => toggle("jenjang")}>
          {g ? <Text className="text-xs text-muted-foreground">Judul bagian dikunci. Anda dapat mengubah kartu jenjang milik katalog Anda.</Text> : (
            <>
              <Teks label="Judul bagian" value={t.jenjang.judul} onChange={(v) => ubah((d) => { d.teks.jenjang.judul = v; })} />
              <Area label="Keterangan bagian" rows={2} value={t.jenjang.deskripsi} onChange={(v) => ubah((d) => { d.teks.jenjang.deskripsi = v; })} />
            </>
          )}
          {draft.education.map((e, i) => (
            <KartuItem key={e.id} judul={e.title} {...kartuProps(e.katalog)} bisaHapus={umumBoleh && draft.education.length > 1}
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
          {umumBoleh && draft.education.length < 6 ? (
            <TombolKecil icon={<Plus size={14} color={colors.foreground} />} onPress={() => ubah((d) => { d.education.push({ id: idBaru("jenjang"), title: "Jenjang baru", shortTitle: "Jenjang", subtitle: "Moto singkat", description: "Ringkasan.", detail: "Penjelasan lengkap.", image: "", katalog: katalogDefault }); })}>Tambah jenjang</TombolKecil>
          ) : null}
        </Bagian>

        <Bagian judul="Mengapa memilih kami" ikon={<ThumbsUp size={18} color={colors.primary} />} lihat={`${urlSitus}/#pendidikan`} info="Foto dan daftar alasan memilih Al Ikhlas 86." ringkas={`${t.keunggulan.butir.length} butir`} terbuka={buka === "unggul"} sembunyi={sembunyi("unggul")} onToggle={() => toggle("unggul")} kunci={g}>
          {g ? <CatatanKunci /> : null}
          <Foto label="Foto bagian ini" value={draft.benefitsImage} ro={g} tampil={tampil} unggah={unggah} onChange={(v) => ubah((d) => { d.benefitsImage = v; })} />
          <JudulField label="Judul" rows={2} ro={g} value={t.keunggulan.judul} onChange={(v) => ubah((d) => { d.teks.keunggulan.judul = v; })} />
          {t.keunggulan.butir.map((b, i) => (
            <View key={i} className="flex-row gap-2 items-center">
              <TextInput accessibilityLabel={`Butir ${i + 1}`} value={b} maxLength={300} editable={!g} onChangeText={(v) => ubah((d) => { d.teks.keunggulan.butir[i] = v; })} className={`${inputCls} flex-1 ${g ? "opacity-60" : ""}`} />
              {!g && t.keunggulan.butir.length > 1 ? <Pressable onPress={() => ubah((d) => { d.teks.keunggulan.butir.splice(i, 1); })} accessibilityLabel="Hapus butir" className="p-2"><Trash2 size={16} color="#dc2626" /></Pressable> : null}
            </View>
          ))}
          {!g && t.keunggulan.butir.length < 10 ? <TombolKecil icon={<Plus size={14} color={colors.foreground} />} onPress={() => ubah((d) => { d.teks.keunggulan.butir.push("Butir baru."); })}>Tambah butir</TombolKecil> : null}
        </Bagian>

        <Bagian judul="Program unggulan" ikon={<BookOpen size={18} color={colors.primary} />} lihat={`${urlSitus}/#program`} info="Kartu kegiatan seperti tahfidz, pramuka, atau robotik." ringkas={`${draft.programs.length} program`} terbuka={buka === "program"} sembunyi={sembunyi("program")} onToggle={() => toggle("program")}>
          {g ? <Text className="text-xs text-muted-foreground">Judul bagian dikunci. Anda dapat mengubah, menambah, dan menghapus program milik katalog Anda.</Text> : (
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
              <PilihKatalog value={p.katalog} pilihan={pilihanKatalog} onChange={(v) => ubah((d) => { d.programs[i].katalog = v; })} />
            </KartuItem>
          ))}
          {draft.programs.length < 12 ? (
            <TombolKecil icon={<Plus size={14} color={colors.foreground} />} onPress={() => ubah((d) => { d.programs.push({ id: idBaru("prog"), title: "Program baru", subtitle: "Moto singkat", description: "Ringkasan program.", detail: "Penjelasan lengkap program.", katalog: katalogDefault }); })}>Tambah program</TombolKecil>
          ) : null}
        </Bagian>

        <Bagian judul="Pendaftaran" ikon={<Megaphone size={18} color={colors.primary} />} lihat={`${urlSitus}/#pendaftaran`} info="Ajakan mendaftar dan kolase empat foto." ringkas={t.pendaftaran.deskripsi} terbuka={buka === "daftar"} sembunyi={sembunyi("daftar")} onToggle={() => toggle("daftar")} kunci={g}>
          {g ? <CatatanKunci /> : null}
          <JudulField label="Judul" rows={3} ro={g} value={t.pendaftaran.judul} onChange={(v) => ubah((d) => { d.teks.pendaftaran.judul = v; })} />
          <Area label="Kalimat pengantar" rows={2} ro={g} value={t.pendaftaran.deskripsi} onChange={(v) => ubah((d) => { d.teks.pendaftaran.deskripsi = v; })} />
          <Area label="Catatan kecil di bawah tombol" rows={2} ro={g} value={t.pendaftaran.catatan} onChange={(v) => ubah((d) => { d.teks.pendaftaran.catatan = v; })} />
          {draft.registrationImages.map((p, i) => <Foto key={i} label={`Foto kolase ${i + 1}`} value={p} ro={g} tampil={tampil} unggah={unggah} onChange={(v) => ubah((d) => { d.registrationImages[i] = v; })} />)}
        </Bagian>

        <Bagian judul="Galeri foto kegiatan" ikon={<Images size={18} color={colors.primary} />} lihat={`${urlSitus}/#galeri`} info="Foto-foto kegiatan sekolah. Bisa menambah banyak foto sekaligus." ringkas={`${draft.gallery.length} foto`} terbuka={buka === "galeri"} sembunyi={sembunyi("galeri")} onToggle={() => toggle("galeri")}>
          {g ? <Text className="text-xs text-muted-foreground">Judul bagian dikunci. Anda dapat menambah, mengganti, dan menghapus foto milik katalog Anda.</Text> : (
            <>
              <Teks label="Judul bagian" value={t.galeri.judul} onChange={(v) => ubah((d) => { d.teks.galeri.judul = v; })} />
              <Area label="Keterangan bagian" rows={2} value={t.galeri.deskripsi} onChange={(v) => ubah((d) => { d.teks.galeri.deskripsi = v; })} />
            </>
          )}
          {draft.gallery.length < 48 ? (
            <View className="gap-1.5">
              <TombolKecil disabled={massal !== ""} icon={massal ? <ActivityIndicator size="small" /> : <Upload size={14} color={colors.foreground} />} onPress={() => void tambahBanyak()}>{massal || "Tambah banyak foto sekaligus"}</TombolKecil>
              <Text className="text-xs text-muted-foreground">Pilih beberapa foto di galeri HP. Foto baru tampil untuk katalog: {namaKatalog(katalogDefault)}.</Text>
            </View>
          ) : null}
          {draft.gallery.map((f, i) => (
            <KartuItem key={f.id} judul={f.label} {...kartuProps(f.katalog)} bisaHapus
              onNaik={() => ubah((d) => geser(d.gallery, i, -1))} onTurun={() => ubah((d) => geser(d.gallery, i, 1))}
              onHapus={() => void hapusDgnKonfirmasi(`foto ${f.label}`, () => ubah((d) => { d.gallery.splice(i, 1); }))}>
              <Foto label="Foto" value={f.image} tampil={tampil} unggah={unggah} onChange={(v) => ubah((d) => { d.gallery[i].image = v; })} />
              <Teks label="Keterangan foto" value={f.label} onChange={(v) => ubah((d) => { d.gallery[i].label = v; })} />
              <View className="gap-1"><Text className="text-sm font-medium text-foreground">Kategori</Text><SimplePicker value={f.category} options={KATEGORI.map((k) => ({ value: k, label: k }))} onChange={(v) => ubah((d) => { d.gallery[i].category = v as KategoriGaleri; })} /></View>
              <PilihKatalog value={f.katalog} pilihan={pilihanKatalog} onChange={(v) => ubah((d) => { d.gallery[i].katalog = v; })} />
            </KartuItem>
          ))}
          {draft.gallery.length < 48 ? (
            <TombolKecil icon={<Plus size={14} color={colors.foreground} />} onPress={() => ubah((d) => { d.gallery.push({ id: idBaru("foto"), label: "Foto baru", category: "Kegiatan", image: "", katalog: katalogDefault }); })}>Tambah satu foto</TombolKecil>
          ) : null}
        </Bagian>

        <Bagian judul="Kontak & media sosial" ikon={<Phone size={18} color={colors.primary} />} lihat={`${urlSitus}/#kontak`} info="Alamat, telepon, email, WhatsApp, peta, dan tautan media sosial." ringkas={`${draft.contact.phone} · ${draft.contact.email}`} terbuka={buka === "kontak"} sembunyi={sembunyi("kontak")} onToggle={() => toggle("kontak")} kunci={g}>
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

        <Bagian judul="Spanduk, Info Terbaru & footer" ikon={<Type size={18} color={colors.primary} />} lihat={`${urlSitus}/#artikel`} info="Spanduk hijau, judul bagian Info Terbaru, dan tulisan di bagian paling bawah." ringkas={t.footer.judul.replace(/\n/g, " ")} terbuka={buka === "footer"} sembunyi={sembunyi("footer")} onToggle={() => toggle("footer")} kunci={g}>
          {g ? <CatatanKunci /> : null}
          <JudulField label="Spanduk hijau: judul" rows={1} ro={g} value={t.banner.judul} onChange={(v) => ubah((d) => { d.teks.banner.judul = v; })} />
          <Area label="Spanduk hijau: slogan" rows={2} max={300} ro={g} hint="Enter = baris baru." value={t.banner.slogan} onChange={(v) => ubah((d) => { d.teks.banner.slogan = v; })} />
          <Teks label="Info Terbaru: judul bagian" value={t.berita.judul} ro={g} onChange={(v) => ubah((d) => { d.teks.berita.judul = v; })} />
          <Area label="Info Terbaru: keterangan" rows={2} ro={g} value={t.berita.deskripsi} onChange={(v) => ubah((d) => { d.teks.berita.deskripsi = v; })} />
          <Area label="Footer: judul" rows={2} max={300} ro={g} hint="Enter = baris baru." value={t.footer.judul} onChange={(v) => ubah((d) => { d.teks.footer.judul = v; })} />
          <Area label="Footer: slogan" rows={2} max={300} ro={g} hint="Enter = baris baru." value={t.footer.slogan} onChange={(v) => ubah((d) => { d.teks.footer.slogan = v; })} />
        </Bagian>

        <Bagian judul="Pengurus yayasan" ikon={<Users size={18} color={colors.primary} />} lihat={`${urlSitus}/profil/`} info="Daftar pengurus/petinggi yayasan di halaman Profil Yayasan (diisi manual). Guru dan pegawai mengisi kartunya sendiri lewat akunnya." ringkas={`${draft.pengurus.length} orang`} terbuka={buka === "pengurus"} sembunyi={sembunyi("pengurus")} onToggle={() => toggle("pengurus")} kunci={g}>
          {g ? <CatatanKunci /> : null}
          {draft.pengurus.map((p, i) => (
            <KartuItem key={p.id} judul={p.nama} {...kartuProps("")} bisaHapus={!g}
              onNaik={() => ubah((d) => geser(d.pengurus, i, -1))} onTurun={() => ubah((d) => geser(d.pengurus, i, 1))}
              onHapus={() => void hapusDgnKonfirmasi(`${p.nama} dari pengurus`, () => ubah((d) => { d.pengurus.splice(i, 1); }))}>
              <Foto label="Foto" saran="Foto berdiri/setengah badan, latar sederhana." value={p.foto} ro={g} tampil={tampil} unggah={unggah} onChange={(v) => ubah((d) => { d.pengurus[i].foto = v; })} />
              <Teks label="Nama lengkap" value={p.nama} max={100} ro={g} onChange={(v) => ubah((d) => { d.pengurus[i].nama = v; })} />
              <Teks label="Jabatan (mis. Ketua Yayasan)" value={p.jabatan} ro={g} onChange={(v) => ubah((d) => { d.pengurus[i].jabatan = v; })} />
              <Area label="Deskripsi singkat (opsional)" rows={3} max={600} ro={g} value={p.deskripsi} onChange={(v) => ubah((d) => { d.pengurus[i].deskripsi = v; })} />
            </KartuItem>
          ))}
          {!g && draft.pengurus.length < 20 ? <TombolKecil icon={<Plus size={14} color={colors.foreground} />} onPress={() => ubah((d) => { d.pengurus.push({ id: idBaru("pg"), nama: "Nama pengurus", jabatan: "Jabatan", deskripsi: "", foto: "" }); })}>Tambah pengurus</TombolKecil> : null}
        </Bagian>

        <Bagian judul="Tanya jawab (FAQ)" ikon={<HelpCircle size={18} color={colors.primary} />} lihat={`${urlSitus}/#faq`} info="Pertanyaan yang sering diajukan. Membantu pengunjung, dan membuat sekolah lebih mudah ditemukan di Google dan asisten AI." ringkas={`${draft.faq.length} pertanyaan`} terbuka={buka === "faq"} sembunyi={sembunyi("faq")} onToggle={() => toggle("faq")} kunci={g}>
          {g ? <CatatanKunci /> : null}
          <Teks label="Judul bagian" value={t.faq.judul} ro={g} onChange={(v) => ubah((d) => { d.teks.faq.judul = v; })} />
          <Area label="Keterangan bagian" rows={2} ro={g} value={t.faq.deskripsi} onChange={(v) => ubah((d) => { d.teks.faq.deskripsi = v; })} />
          {draft.faq.map((f, i) => (
            <View key={i} className="border border-border rounded-xl p-3 gap-3">
              <View className="flex-row items-center justify-between"><Text className="text-sm font-semibold text-foreground">Pertanyaan {i + 1}</Text>
                {!g ? <Pressable onPress={() => ubah((d) => { d.faq.splice(i, 1); })}><Text className="text-xs text-red-600">Hapus</Text></Pressable> : null}</View>
              <Teks label="Pertanyaan" value={f.q} max={500} ro={g} onChange={(v) => ubah((d) => { d.faq[i].q = v; })} />
              <Area label="Jawaban" rows={4} max={1000} ro={g} value={f.a} onChange={(v) => ubah((d) => { d.faq[i].a = v; })} />
            </View>
          ))}
          {!g && draft.faq.length < 12 ? <TombolKecil icon={<Plus size={14} color={colors.foreground} />} onPress={() => ubah((d) => { d.faq.push({ q: "Pertanyaan baru?", a: "Jawaban singkat dan faktual." }); })}>Tambah pertanyaan</TombolKecil> : null}
          {!g ? <Text className="text-xs text-muted-foreground">Tulis jawaban yang singkat dan benar (alamat, jenjang, cara mendaftar, jam layanan). Jangan memuat data pribadi.</Text> : null}
        </Bagian>

        <Bagian judul="Persetujuan kartu guru" ikon={<FileCheck size={18} color={colors.primary} />} lihat={`${urlSitus}/profil/`} info="Kartu profil guru/pegawai yang menunggu persetujuan sebelum tayang di halaman Profil Yayasan." ringkas={antrian === null ? "Memuat..." : antrian.length ? `${antrian.length} kartu menunggu persetujuan` : "Tidak ada yang menunggu"} terbuka={buka === "setuju"} sembunyi={sembunyi("setuju")} onToggle={() => toggle("setuju")}>
          <PanelPersetujuan antrian={antrian} onUbah={() => void muatAntrian()} />
        </Bagian>

        <Bagian judul="Riwayat perubahan" ikon={<History size={18} color={colors.primary} />} info="Siapa mengubah apa dan kapan." ringkas="Siapa mengubah apa" terbuka={buka === "riwayat"} sembunyi={sembunyi("riwayat")} onToggle={() => toggle("riwayat")}>
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
        <View className="absolute left-3 right-3 bg-card border border-border rounded-2xl px-4 py-3 gap-2" style={{ bottom: 10 + insets.bottom, elevation: 6 }}>
          <Text numberOfLines={2} className="text-xs text-muted-foreground">Belum disimpan: {daftarUbah.length ? daftarUbah.join(", ") : "perubahan"}</Text>
          <View className="flex-row items-center justify-end gap-3">
            <Pressable onPress={() => void batal()} disabled={menyimpan} className="px-3 py-2.5 rounded-xl border border-border"><Text className="text-sm font-medium text-foreground">Buang</Text></Pressable>
            <Pressable onPress={() => void simpan()} disabled={menyimpan} className={`flex-row items-center gap-2 px-4 py-2.5 rounded-xl bg-primary ${menyimpan ? "opacity-60" : ""}`}>
              {menyimpan ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : <Save size={16} color={colors.primaryForeground} />}
              <Text className="text-sm font-semibold text-primary-foreground">{menyimpan ? "Menyimpan..." : "Simpan & tayangkan"}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

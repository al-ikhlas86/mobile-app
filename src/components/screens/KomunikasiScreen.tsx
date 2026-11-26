import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Alert, Linking, AppState } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { SimplePicker } from "../ui/SimplePicker";
import { api } from "../../services/api";
import { useThemeColors } from "../../context/ThemeContext";
import { Isian, Kolom, Lencana, type Res } from "./psb/mShared";

// Email & Kontak (Admin IT) di HP: padanan layar web. Rahasia tidak pernah dikirim balik oleh server; kolom kosong = tidak diubah.
interface StatusEmail {
  mode: string; aktif: string | null; nama: string; kunciEnkripsi: boolean; urlBalik: string; cadanganEnv: boolean;
  gmail: { clientId: string; adaRahasia: boolean; terhubung: boolean; akun: string };
  smtp: { host: string; port: number; user: string; from: string; adaSandi: boolean; lengkap: boolean };
  terakhir: { waktu: number | null; ok: boolean | null; alasan: string | null; via: string | null };
}
interface KontakKatalog { id: number; kode: string; nama: string; label: string; nomor: string }
const NAMA_JALUR: Record<string, string> = { gmail: "Gmail (OAuth)", smtp: "SMTP", "smtp-env": "SMTP bawaan server (.env)" };

export function KomunikasiScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [st, setSt] = useState<StatusEmail | null>(null);
  const [galat, setGalat] = useState("");
  const muat = useCallback(async () => {
    const res = (await api.komunikasiEmail()) as Res<StatusEmail>;
    if (res.success && res.data) { setSt(res.data); setGalat(""); } else setGalat(res.message || "Gagal memuat pengaturan email.");
  }, []);
  useEffect(() => {
    void muat();
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") void muat(); });
    return () => sub.remove();
  }, [muat]);

  if (galat && !st) return <View className="flex-1 bg-background px-4 py-8 gap-3"><Text className="text-sm text-red-600">{galat}</Text><View className="flex-row"><Button size="sm" variant="outline" onPress={() => void muat()}>Coba lagi</Button></View></View>;
  if (!st) return <View className="flex-1 bg-background items-center justify-center"><ActivityIndicator color={colors.primary} /></View>;
  return (
    <ScrollView className="flex-1 bg-background px-4 pt-5" contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 12 }} keyboardShouldPersistTaps="handled">
      <KartuEmail st={st} onUbah={setSt} onMuat={muat} />
      <KartuKontak />
    </ScrollView>
  );
}

function KartuEmail({ st, onUbah, onMuat }: { st: StatusEmail; onUbah: (s: StatusEmail) => void; onMuat: () => Promise<void> }) {
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState<{ ok: boolean; t: string } | null>(null);
  const [nama, setNama] = useState(st.nama);
  const [clientId, setClientId] = useState(st.gmail.clientId);
  const [rahasia, setRahasia] = useState("");
  const [smtp, setSmtp] = useState({ host: st.smtp.host, port: String(st.smtp.port), user: st.smtp.user, pass: "", from: st.smtp.from });
  const [ke, setKe] = useState("");
  const [jenis, setJenis] = useState(st.mode === "smtp" ? "smtp" : "gmail");

  const jalankan = async (fn: () => Promise<unknown>, ok?: string) => {
    setSibuk(true); setPesan(null);
    const res = (await fn()) as Res<StatusEmail>;
    setSibuk(false);
    if (!res.success) { setPesan({ ok: false, t: res.message || "Gagal." }); return null; }
    if (res.data && typeof res.data === "object" && "mode" in res.data) onUbah(res.data as StatusEmail);
    if (ok) setPesan({ ok: true, t: ok });
    return res;
  };
  const hubungkan = async () => {
    const res = await jalankan(() => api.komunikasiGmailMulai());
    const url = (res?.data as unknown as { url?: string } | undefined)?.url;
    if (url) { setPesan({ ok: true, t: "Selesaikan izin di Google, lalu kembali ke aplikasi (status diperbarui otomatis)." }); void Linking.openURL(url); }
  };
  const uji = async () => {
    const res = await jalankan(() => api.komunikasiUji(ke.trim()));
    const h = res?.data as unknown as { terkirim: boolean; alasan: string | null } | undefined;
    if (h) setPesan(h.terkirim ? { ok: true, t: `Email uji terkirim ke ${ke.trim()}. Periksa kotak masuk (dan spam).` } : { ok: false, t: `Gagal terkirim: ${h.alasan}` });
    void onMuat();
  };
  const t = st.terakhir;

  return (
    <Card padding="lg">
      <View className="gap-3">
        <View className="gap-1">
          <Text className="font-semibold text-sm text-foreground">Email pengirim sistem</Text>
          {st.aktif ? <Lencana jenis="terbuka" teks={`Aktif: ${NAMA_JALUR[st.aktif] ?? st.aktif}`} /> : <Lencana jenis="draft" teks="Belum diatur" />}
          <Text className="text-xs text-muted-foreground mt-1">Dipakai untuk Key formulir, tanda lunas, dan konfirmasi PSB. Tiap email hanya ke SATU alamat tujuan, maksimal 5 per alamat per jam.</Text>
          {st.aktif === "gmail" ? <Text className="text-xs text-foreground">Terhubung sebagai {st.gmail.akun}.</Text> : null}
          {t.waktu ? <Text className="text-xs text-muted-foreground">Terakhir: {new Date(t.waktu).toLocaleString("id-ID")} · {t.ok ? "berhasil" : `gagal (${t.alasan})`}</Text> : null}
          {!st.kunciEnkripsi ? <Text className="text-xs text-red-600">Kunci enkripsi server belum diatur; rahasia tidak bisa disimpan.</Text> : null}
        </View>

        <Isian label="Nama pengirim"><Kolom value={nama} onChangeText={setNama} maxLength={60} /></Isian>
        <View className="flex-row"><Button size="sm" variant="outline" disabled={sibuk || nama === st.nama} onPress={() => void jalankan(() => api.komunikasiEmailNama(nama), "Nama pengirim disimpan.")}>Simpan nama</Button></View>

        <Isian label="Jenis pengirim"><SimplePicker value={jenis} options={[{ value: "gmail", label: "Gmail (OAuth)" }, { value: "smtp", label: "SMTP (email sekolah/lainnya)" }]} onChange={setJenis} /></Isian>

        {jenis === "gmail" ? (
          <View className="gap-3">
            <Text className="text-xs text-muted-foreground">Tanpa menyimpan sandi Gmail: Anda memberi izin &quot;kirim email saja&quot; lewat Google (bisa dicabut di myaccount.google.com/permissions). Sekali saja di Google Cloud Console: buat proyek, aktifkan Gmail API, buat OAuth client ID jenis Web, isi Authorized redirect URI dengan alamat berikut.</Text>
            <Text selectable className="bg-muted rounded-lg px-2.5 py-2 text-xs text-foreground" style={{ fontFamily: "monospace" }}>{st.urlBalik}</Text>
            <Isian label="Client ID"><Kolom value={clientId} onChangeText={setClientId} maxLength={200} autoCapitalize="none" autoCorrect={false} /></Isian>
            <Isian label="Client secret" bantuan={st.gmail.adaRahasia ? "Tersimpan. Kosongkan bila tidak diganti." : undefined}><Kolom value={rahasia} onChangeText={setRahasia} maxLength={200} secureTextEntry autoCapitalize="none" autoCorrect={false} /></Isian>
            <View className="flex-row flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={sibuk || !clientId} onPress={async () => { if (await jalankan(() => api.komunikasiGmailKlien(clientId.trim(), rahasia.trim()), "Client OAuth disimpan.")) setRahasia(""); }}>Simpan Client OAuth</Button>
              <Button size="sm" variant="primary" disabled={sibuk || !st.gmail.clientId || !st.gmail.adaRahasia} onPress={() => void hubungkan()}>{st.gmail.terhubung ? "Hubungkan ulang Google" : "Hubungkan akun Google"}</Button>
              {st.gmail.terhubung && st.mode !== "gmail" ? <Button size="sm" variant="outline" disabled={sibuk} onPress={() => void jalankan(() => api.komunikasiMode("gmail"), "Pengirim diganti ke Gmail.")}>Pakai Gmail ini</Button> : null}
              {st.gmail.terhubung ? <Button size="sm" variant="outline" disabled={sibuk} onPress={() => Alert.alert("Putuskan akun Google", "Email sistem berhenti terkirim sampai ada pengirim lain.", [{ text: "Batal", style: "cancel" }, { text: "Putuskan", style: "destructive", onPress: () => void jalankan(() => api.komunikasiPutus(), "Akun Google diputuskan.") }])}>Putuskan</Button> : null}
            </View>
          </View>
        ) : (
          <View className="gap-3">
            <Text className="text-xs text-muted-foreground">Untuk email resmi sekolah atau layanan pengirim email. Ganti dari Gmail ke SMTP cukup isi form lalu tekan &quot;Pakai SMTP ini&quot;; tanpa deploy.</Text>
            <Isian label="Host SMTP"><Kolom value={smtp.host} onChangeText={(v) => setSmtp({ ...smtp, host: v })} maxLength={253} autoCapitalize="none" autoCorrect={false} placeholder="smtp.gmail.com" /></Isian>
            <Isian label="Port"><SimplePicker value={smtp.port} options={[{ value: "587", label: "587 (STARTTLS)" }, { value: "465", label: "465 (SSL)" }, { value: "25", label: "25" }, { value: "2525", label: "2525" }]} onChange={(v) => setSmtp({ ...smtp, port: v })} /></Isian>
            <Isian label="Pengguna"><Kolom value={smtp.user} onChangeText={(v) => setSmtp({ ...smtp, user: v })} maxLength={254} autoCapitalize="none" autoCorrect={false} /></Isian>
            <Isian label="Sandi" bantuan={st.smtp.adaSandi ? "Tersimpan. Kosongkan bila tidak diganti." : undefined}><Kolom value={smtp.pass} onChangeText={(v) => setSmtp({ ...smtp, pass: v })} maxLength={200} secureTextEntry autoCapitalize="none" autoCorrect={false} /></Isian>
            <Isian label="Alamat pengirim (From)"><Kolom value={smtp.from} onChangeText={(v) => setSmtp({ ...smtp, from: v })} maxLength={254} keyboardType="email-address" autoCapitalize="none" /></Isian>
            <View className="flex-row flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={sibuk} onPress={async () => { if (await jalankan(() => api.komunikasiSmtp({ host: smtp.host.trim(), port: Number(smtp.port), user: smtp.user.trim(), pass: smtp.pass, from: smtp.from.trim() }), "Pengaturan SMTP disimpan.")) setSmtp((s) => ({ ...s, pass: "" })); }}>Simpan SMTP</Button>
              {st.smtp.lengkap && st.mode !== "smtp" ? <Button size="sm" variant="primary" disabled={sibuk} onPress={() => void jalankan(() => api.komunikasiMode("smtp"), "Pengirim diganti ke SMTP.")}>Pakai SMTP ini</Button> : null}
            </View>
          </View>
        )}

        <View className="gap-2 border-t border-border pt-3">
          <Isian label="Kirim email uji" bantuan="Isi alamat email Anda sendiri."><Kolom value={ke} onChangeText={setKe} maxLength={254} keyboardType="email-address" autoCapitalize="none" /></Isian>
          <View className="flex-row"><Button size="sm" variant="outline" disabled={sibuk || !ke || !st.aktif} onPress={() => void uji()}>Kirim email uji</Button></View>
        </View>
        {pesan ? <Text className={`text-sm ${pesan.ok ? "text-green-700" : "text-red-600"}`}>{pesan.t}</Text> : null}
      </View>
    </Card>
  );
}

function KartuKontak() {
  const [data, setData] = useState<{ bawaan: string; katalog: KontakKatalog[] } | null>(null);
  const [isi, setIsi] = useState<Record<number, { label: string; nomor: string }>>({});
  const [bawaan, setBawaan] = useState("");
  const [sibuk, setSibuk] = useState<number | "b" | null>(null);
  const [pesan, setPesan] = useState<{ ok: boolean; t: string } | null>(null);

  const muat = useCallback(async () => {
    const res = (await api.komunikasiKontak()) as Res<{ bawaan: string; katalog: KontakKatalog[] }>;
    if (res.success && res.data) { setData(res.data); setBawaan(res.data.bawaan); setIsi(Object.fromEntries(res.data.katalog.map((k) => [k.id, { label: k.label || `Admin ${k.kode}`, nomor: k.nomor }]))); } else setPesan({ ok: false, t: res.message || "Gagal memuat kontak." });
  }, []);
  useEffect(() => { void muat(); }, [muat]);

  const simpan = async (k: KontakKatalog) => {
    setSibuk(k.id); setPesan(null);
    const res = (await api.komunikasiKontakSimpan(k.id, isi[k.id].label, isi[k.id].nomor)) as Res;
    setSibuk(null);
    if (!res.success) { setPesan({ ok: false, t: res.message || "Gagal menyimpan." }); return; }
    setPesan({ ok: true, t: `Kontak ${k.nama} disimpan.` }); void muat();
  };
  const hapus = (k: KontakKatalog) => Alert.alert("Hapus kontak", `Hapus kontak person ${k.nama}? Halaman dan email PSB katalog ini memakai nomor bawaan.`, [
    { text: "Batal", style: "cancel" },
    { text: "Hapus", style: "destructive", onPress: async () => { setSibuk(k.id); const res = (await api.komunikasiKontakHapus(k.id)) as Res; setSibuk(null); if (!res.success) setPesan({ ok: false, t: res.message || "Gagal menghapus." }); else void muat(); } },
  ]);
  const simpanBawaan = async () => {
    setSibuk("b"); setPesan(null);
    const res = (await api.komunikasiKontakBawaan(bawaan)) as Res; setSibuk(null);
    if (!res.success) { setPesan({ ok: false, t: res.message || "Gagal menyimpan." }); return; }
    setPesan({ ok: true, t: "Nomor bawaan disimpan." }); void muat();
  };

  return (
    <Card padding="lg">
      <View className="gap-3">
        <View className="gap-1">
          <Text className="font-semibold text-sm text-foreground">Kontak person per katalog</Text>
          <Text className="text-xs text-muted-foreground">Nomor WhatsApp yang ditampilkan ke orang tua sesuai katalog pendaftarannya (halaman PSB dan email). Katalog baru otomatis muncul di sini.</Text>
        </View>
        {!data ? <ActivityIndicator /> : null}
        {data?.katalog.map((k) => (
          <View key={k.id} className="rounded-xl border border-border p-3 gap-2">
            <Text className="text-sm font-semibold text-foreground">{k.nama} ({k.kode})</Text>
            <Lencana jenis={k.nomor ? "terbuka" : "draft"} teks={k.nomor ? "Kontak diatur" : "Memakai nomor bawaan"} />
            <Isian label="Nama kontak"><Kolom value={isi[k.id]?.label ?? ""} onChangeText={(v) => setIsi((s) => ({ ...s, [k.id]: { ...s[k.id], label: v } }))} maxLength={80} placeholder={`Admin ${k.kode}`} /></Isian>
            <Isian label="Nomor WhatsApp"><Kolom value={isi[k.id]?.nomor ?? ""} onChangeText={(v) => setIsi((s) => ({ ...s, [k.id]: { ...s[k.id], nomor: v } }))} maxLength={25} keyboardType="phone-pad" placeholder="0812-3456-7890" /></Isian>
            <View className="flex-row gap-2">
              <Button size="sm" variant="primary" disabled={sibuk !== null || !isi[k.id]?.nomor} loading={sibuk === k.id} onPress={() => void simpan(k)}>Simpan</Button>
              {k.nomor ? <Button size="sm" variant="outline" disabled={sibuk !== null} onPress={() => hapus(k)}>Hapus</Button> : null}
            </View>
          </View>
        ))}
        {data ? (
          <View className="rounded-xl border border-dashed border-border p-3 gap-2">
            <Isian label="Nomor bawaan" bantuan="Dipakai bila katalog belum punya kontak sendiri dan di halaman PSB lintas katalog."><Kolom value={bawaan} onChangeText={setBawaan} maxLength={25} keyboardType="phone-pad" /></Isian>
            <View className="flex-row"><Button size="sm" variant="outline" disabled={sibuk !== null || bawaan === data.bawaan} onPress={() => void simpanBawaan()}>Simpan nomor bawaan</Button></View>
          </View>
        ) : null}
        {pesan ? <Text className={`text-sm ${pesan.ok ? "text-green-700" : "text-red-600"}`}>{pesan.t}</Text> : null}
      </View>
    </Card>
  );
}

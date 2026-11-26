import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Alert, Pressable, Image, ActivityIndicator, Switch } from "react-native";
import { ArrowLeft, UserPlus, Search } from "lucide-react-native";
import { Button } from "../../ui/Button";
import { SimplePicker } from "../../ui/SimplePicker";
import { api } from "../../../services/api";
import { useThemeColors } from "../../../context/ThemeContext";
import { Isian, Kolom, Lencana, LABEL_STATUS, JENIS_JADWAL, rupiah, waktuLengkap, type FieldForm, type GelombangDetail, type Res, type StatusPendaftar } from "./mShared";

// Tab Pendaftar (HP): daftar + cari + filter, detail (jawaban, foto berkas, tagihan, status, catatan, riwayat), dan pencatatan teks oleh staf.
// Berkas PDF dan unggah berkas dilakukan lewat versi web.
interface Ringkas { id: number; nomor: string; nama: string; namaOrtu: string | null; email: string | null; noHp: string; status: StatusPendaftar; sumber: string; dibuat: string; tagihan: string | null; kelas: string | null }
const KELOMPOK: { id: string; teks: string }[] = [{ id: "", teks: "Semua" }, { id: "valid", teks: "Valid" }, { id: "belum_isi", teks: "Bayar, belum isi" }, { id: "belum_bayar", teks: "Belum bayar" }];
interface Tagihan { id: number; jumlah: number; status: string; metode: string | null; referensi: string | null; dibayar_pada: string | null }
interface Detail extends Omit<Ringkas, "tagihan"> {
  catatanInternal: string | null; jawaban: Record<string, string>; fields: FieldForm[]; bisaKelola: boolean; statusTujuan: StatusPendaftar[];
  berkas: { id: number; kunci: string; tipe: string; ukuran: number }[];
  riwayat: { dari: string | null; ke: string; catatan: string | null; created_at: string; oleh: string | null }[];
  tagihan: Tagihan[]; jadwal: { id: number; judul: string; jenis: string; mulai: string; lokasi: string | null }[]; bisaResetKey: boolean;
}

export function TabPendaftar({ g, onChanged }: { g: GelombangDetail; onChanged: () => void }) {
  const [mode, setMode] = useState<{ t: "daftar" } | { t: "detail"; id: number } | { t: "catat" }>({ t: "daftar" });
  if (mode.t === "detail") return <DetailPendaftar id={mode.id} onKembali={() => { setMode({ t: "daftar" }); onChanged(); }} />;
  if (mode.t === "catat") return <CatatPendaftar g={g} onSelesai={() => { setMode({ t: "daftar" }); onChanged(); }} onBatal={() => setMode({ t: "daftar" })} />;
  return <DaftarPendaftar g={g} onBuka={(id) => setMode({ t: "detail", id })} onCatat={() => setMode({ t: "catat" })} />;
}

function DaftarPendaftar({ g, onBuka, onCatat }: { g: GelombangDetail; onBuka: (id: number) => void; onCatat: () => void }) {
  const colors = useThemeColors();
  const [status, setStatus] = useState("");
  const [kelompok, setKelompok] = useState("");
  const [kelas, setKelas] = useState("");
  const [q, setQ] = useState("");
  const [qAktif, setQAktif] = useState("");
  const [halaman, setHalaman] = useState(1);
  const [d, setD] = useState<{ data: Ringkas[]; totalHalaman: number; total: number; kelasTersedia: string[] } | null>(null);
  const [galat, setGalat] = useState("");
  const tunda = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => { if (tunda.current) clearTimeout(tunda.current); tunda.current = setTimeout(() => { setQAktif(q.trim()); setHalaman(1); }, 350); return () => { if (tunda.current) clearTimeout(tunda.current); }; }, [q]);
  const muat = useCallback(async () => {
    setGalat("");
    const res = (await api.psbPendaftarList(g.id, { status: status || undefined, kelompok: kelompok || undefined, kelas: kelas || undefined, q: qAktif || undefined, halaman })) as Res<Ringkas[]> & { totalHalaman: number; total: number; kelasTersedia: string[] };
    if (res.success && res.data) setD({ data: res.data, totalHalaman: res.totalHalaman, total: res.total, kelasTersedia: res.kelasTersedia ?? [] }); else setGalat(res.message || "Gagal memuat pendaftar.");
  }, [g.id, status, kelompok, kelas, qAktif, halaman]);
  useEffect(() => { void muat(); }, [muat]);

  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-2"><Search size={14} color={colors.mutedForeground} /><View className="flex-1"><Kolom value={q} onChangeText={setQ} placeholder="Cari nama, nomor, atau HP" maxLength={60} accessibilityLabel="Cari pendaftar" /></View></View>
      <SimplePicker value={status} options={[{ value: "", label: "Semua status" }, ...(Object.keys(LABEL_STATUS) as StatusPendaftar[]).map((s) => ({ value: s, label: LABEL_STATUS[s] }))]} onChange={(v) => { setStatus(v); setHalaman(1); }} placeholder="Semua status" />
      {(d?.kelasTersedia.length ?? 0) > 0 ? <SimplePicker value={kelas} options={[{ value: "", label: "Semua kelas" }, ...(d?.kelasTersedia ?? []).map((k) => ({ value: k, label: k }))]} onChange={(v) => { setKelas(v); setHalaman(1); }} placeholder="Semua kelas" /> : null}
      <View className="flex-row flex-wrap gap-1.5">{KELOMPOK.map((k) => (
        <Pressable key={k.id} onPress={() => { setKelompok(k.id); setHalaman(1); }} accessibilityRole="tab" accessibilityState={{ selected: kelompok === k.id }} className={`px-3 py-1.5 rounded-full border ${kelompok === k.id ? "bg-primary border-primary" : "border-border"}`}><Text className={`text-xs font-medium ${kelompok === k.id ? "text-primary-foreground" : "text-foreground"}`}>{k.teks}</Text></Pressable>
      ))}</View>
      {g.bisaKelola ? <View className="flex-row"><Button size="sm" variant="primary" onPress={onCatat}><UserPlus size={14} color="#fff" /> Catat pendaftar</Button></View> : null}
      {galat ? <Text className="text-sm text-red-600">{galat}</Text> : null}
      {!d && !galat ? <ActivityIndicator color={colors.primary} /> : null}
      {d && d.data.length === 0 ? <Text className="text-sm text-muted-foreground">Belum ada pendaftar{status || kelompok || kelas || qAktif ? " yang cocok dengan filter" : ""}.</Text> : null}
      {d?.data.map((p) => (
        <Pressable key={p.id} onPress={() => onBuka(p.id)} accessibilityRole="button" className="flex-row items-start justify-between gap-2 py-2 border-b border-border">
          <View className="flex-1"><Text className="text-sm font-semibold text-foreground">{p.nama}</Text><Text className="text-xs text-muted-foreground">{p.nomor} · {p.noHp}{p.sumber === "admin" ? " · dicatat staf" : ""}</Text>{p.namaOrtu || p.email || p.kelas ? <Text className="text-xs text-muted-foreground">{[p.namaOrtu && `Ortu: ${p.namaOrtu}`, p.email, p.kelas && `Kelas ${p.kelas}`].filter(Boolean).join(" · ")}</Text> : null}</View>
          <View className="items-end gap-1"><Lencana jenis={p.status} teks={LABEL_STATUS[p.status]} />{p.tagihan ? <Lencana jenis={p.tagihan} teks={`Tagihan ${p.tagihan}`} /> : null}</View>
        </Pressable>
      ))}
      {d && d.totalHalaman > 1 ? (
        <View className="flex-row items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" disabled={halaman <= 1} onPress={() => setHalaman(halaman - 1)}>Sebelumnya</Button>
          <Text className="text-xs text-muted-foreground">Hal. {halaman}/{d.totalHalaman} ({d.total})</Text>
          <Button size="sm" variant="outline" disabled={halaman >= d.totalHalaman} onPress={() => setHalaman(halaman + 1)}>Berikutnya</Button>
        </View>
      ) : null}
    </View>
  );
}

function DetailPendaftar({ id, onKembali }: { id: number; onKembali: () => void }) {
  const colors = useThemeColors();
  const [p, setP] = useState<Detail | null>(null);
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [catatan, setCatatan] = useState("");
  const [metode, setMetode] = useState("Transfer");
  const [referensi, setReferensi] = useState("");
  const [lihat, setLihat] = useState<number | null>(null);
  const [keyBaru, setKeyBaru] = useState<{ kodeAkses: string; emailTerkirim: boolean } | null>(null);

  const muat = useCallback(async () => {
    const res = (await api.psbPendaftar(id)) as Res<Detail>;
    if (res.success && res.data) { setP(res.data); setCatatan(res.data.catatanInternal ?? ""); } else setGalat(res.message || "Gagal memuat pendaftar.");
  }, [id]);
  useEffect(() => { void muat(); }, [muat]);

  const jalankan = async (fn: () => Promise<unknown>, sukses?: string) => {
    setSibuk(true);
    const res = (await fn()) as Res<{ peringatan?: string[] }>;
    setSibuk(false);
    if (!res.success) { Alert.alert("Gagal", res.message || "Gagal memproses."); return; }
    const info = [sukses, ...(res.data?.peringatan ?? [])].filter(Boolean).join("\n");
    if (info) Alert.alert("Info", info);
    void muat();
  };
  const ubahStatus = (ke: StatusPendaftar) => {
    if (!p) return;
    Alert.alert("Ubah status", `Ubah status ${p.nama} menjadi "${LABEL_STATUS[ke]}"?`, [
      { text: "Batal", style: "cancel" },
      { text: "Ya, ubah", style: ke === "ditolak" || ke === "mundur" ? "destructive" : "default", onPress: () => void jalankan(() => api.psbStatus(p.id, ke)) },
    ]);
  };

  const resetKey = () => {
    if (!p) return;
    Alert.alert("Buat ulang Key", "Key lama langsung tidak berlaku. Key baru dikirim ke email orang tua (bila ada) dan ditampilkan SEKALI di sini.", [
      { text: "Batal", style: "cancel" },
      { text: "Buat Key baru", onPress: async () => {
        setSibuk(true); const res = (await api.psbResetKey(p.id)) as Res<{ kodeAkses: string; emailTerkirim: boolean }>; setSibuk(false);
        if (!res.success || !res.data) { Alert.alert("Gagal", res.message || "Gagal membuat Key baru."); return; }
        setKeyBaru(res.data);
      } },
    ]);
  };

  if (galat) return <View className="gap-3"><Text className="text-sm text-red-600">{galat}</Text><View className="flex-row"><Button size="sm" variant="outline" onPress={onKembali}>Kembali</Button></View></View>;
  if (!p) return <ActivityIndicator color={colors.primary} />;
  const tagihan = p.tagihan[0];
  return (
    <View className="gap-4">
      <Pressable onPress={onKembali} accessibilityRole="button" className="flex-row items-center gap-1.5 self-start"><ArrowLeft size={14} color={colors.primary} /><Text className="text-sm font-medium text-primary">Kembali ke daftar</Text></Pressable>
      <View className="flex-row items-start justify-between gap-2"><View className="flex-1"><Text className="font-semibold text-foreground">{p.nama}</Text><Text className="text-xs text-muted-foreground">{p.nomor} · {p.noHp}</Text></View><Lencana jenis={p.status} teks={LABEL_STATUS[p.status]} /></View>

      {p.bisaKelola && p.statusTujuan.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">{p.statusTujuan.map((s) => <Button key={s} size="sm" variant={s === "diterima" || s === "diverifikasi" ? "primary" : "outline"} disabled={sibuk} onPress={() => ubahStatus(s)}>Jadikan {LABEL_STATUS[s]}</Button>)}</View>
      ) : null}

      <View className="gap-1">
        <Text className="text-sm font-semibold text-foreground">Kontak</Text>
        <Text className="text-sm text-foreground">Orang tua: {p.namaOrtu || "-"} · Email: {p.email || "-"} · WA: {p.noHp}</Text>
        {p.bisaKelola && p.bisaResetKey ? <View className="flex-row mt-1"><Button size="sm" variant="outline" disabled={sibuk} onPress={resetKey}>Buat ulang Key formulir</Button></View> : null}
        {keyBaru ? (
          <View className="bg-muted rounded-lg px-3 py-2 mt-1 gap-1">
            <Text selectable className="text-sm text-foreground">Key baru: <Text className="font-bold" style={{ fontFamily: "monospace" }}>{keyBaru.kodeAkses}</Text></Text>
            <Text className="text-xs text-muted-foreground">{keyBaru.emailTerkirim ? "Sudah dikirim ke email orang tua. " : "Email tidak terkirim (belum ada email atau SMTP belum dipasang): sampaikan lewat WhatsApp. "}Key tidak bisa ditampilkan lagi setelah layar ini ditutup.</Text>
          </View>
        ) : null}
      </View>

      <View className="gap-1">
        <Text className="text-sm font-semibold text-foreground">Data pendaftaran</Text>
        {p.fields.filter((f) => f.tipe !== "berkas").map((f) => (
          <View key={f.kunci} className="py-1 border-b border-border"><Text className="text-xs text-muted-foreground">{f.label}</Text><Text className="text-sm text-foreground">{p.jawaban[f.kunci] || "-"}</Text></View>
        ))}
      </View>

      <View className="gap-2">
        <Text className="text-sm font-semibold text-foreground">Berkas</Text>
        {p.berkas.length === 0 ? <Text className="text-xs text-muted-foreground">Tidak ada berkas diunggah.</Text> : p.berkas.map((b) => (
          <View key={b.id} className="gap-1">
            <View className="flex-row items-center justify-between gap-2">
              <Text className="text-sm text-foreground flex-1">{p.fields.find((f) => f.kunci === b.kunci)?.label ?? b.kunci} <Text className="text-xs text-muted-foreground">({b.tipe === "pdf" ? "PDF" : "foto"}, {Math.round(b.ukuran / 1024)} KB)</Text></Text>
              {b.tipe === "pdf" ? <Text className="text-xs text-muted-foreground">buka di web</Text> : <Button size="sm" variant="outline" onPress={() => setLihat(lihat === b.id ? null : b.id)}>{lihat === b.id ? "Tutup" : "Lihat"}</Button>}
            </View>
            {lihat === b.id ? <Image source={api.psbBerkasSumber(p.id, b.id)} style={{ width: "100%", height: 320, borderRadius: 8 }} resizeMode="contain" accessibilityLabel="Pratinjau berkas" /> : null}
          </View>
        ))}
      </View>

      {tagihan ? (
        <View className="gap-2">
          <Text className="text-sm font-semibold text-foreground">Tagihan pendaftaran</Text>
          <View className="flex-row items-center gap-2 flex-wrap"><Text className="text-sm font-bold text-foreground">{rupiah(tagihan.jumlah)}</Text><Lencana jenis={tagihan.status} teks={tagihan.status === "lunas" ? "Lunas" : tagihan.status === "batal" ? "Dibatalkan" : "Belum dibayar"} /></View>
          {tagihan.dibayar_pada ? <Text className="text-xs text-muted-foreground">{waktuLengkap(tagihan.dibayar_pada)} · {tagihan.metode}{tagihan.referensi ? ` · ${tagihan.referensi}` : ""}</Text> : null}
          {p.bisaKelola && tagihan.status === "belum" ? (
            <View className="gap-2">
              <Isian label="Metode"><Kolom value={metode} onChangeText={setMetode} maxLength={40} /></Isian>
              <Isian label="Referensi (opsional)"><Kolom value={referensi} onChangeText={setReferensi} maxLength={100} /></Isian>
              <View className="flex-row gap-2">
                <Button size="sm" variant="primary" disabled={sibuk} onPress={() => Alert.alert("Tandai lunas", `Tandai tagihan ${rupiah(tagihan.jumlah)} LUNAS?`, [{ text: "Batal", style: "cancel" }, { text: "Lunas", onPress: () => void jalankan(() => api.psbTagihanLunas(p.id, metode, referensi)) }])}>Tandai lunas</Button>
                <Button size="sm" variant="outline" disabled={sibuk} onPress={() => Alert.alert("Batalkan tagihan", "Batalkan tagihan ini?", [{ text: "Tidak", style: "cancel" }, { text: "Batalkan", style: "destructive", onPress: () => void jalankan(() => api.psbTagihanBatal(p.id)) }])}>Batalkan</Button>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {p.jadwal.length > 0 ? <View className="gap-1"><Text className="text-sm font-semibold text-foreground">Jadwal</Text>{p.jadwal.map((j) => <Text key={j.id} className="text-sm text-foreground">{waktuLengkap(j.mulai)} · {j.judul} ({JENIS_JADWAL[j.jenis] ?? j.jenis}){j.lokasi ? ` · ${j.lokasi}` : ""}</Text>)}</View> : null}

      {p.bisaKelola ? (
        <View className="gap-2">
          <Isian label="Catatan internal (tidak terlihat orang tua)"><Kolom value={catatan} onChangeText={setCatatan} multiline maxLength={2000} /></Isian>
          <View className="flex-row"><Button size="sm" variant="outline" disabled={sibuk || catatan === (p.catatanInternal ?? "")} onPress={() => void jalankan(() => api.psbCatatan(p.id, catatan), "Catatan disimpan.")}>Simpan catatan</Button></View>
        </View>
      ) : null}

      <View className="gap-1"><Text className="text-sm font-semibold text-foreground">Riwayat status</Text>{p.riwayat.map((r, i) => <Text key={i} className="text-xs text-muted-foreground">{waktuLengkap(r.created_at)} · {r.dari ? `${LABEL_STATUS[r.dari as StatusPendaftar] ?? r.dari} → ` : ""}{LABEL_STATUS[r.ke as StatusPendaftar] ?? r.ke}{r.oleh ? ` · ${r.oleh}` : ""}{r.catatan ? ` · ${r.catatan}` : ""}</Text>)}</View>
    </View>
  );
}

function CatatPendaftar({ g, onSelesai, onBatal }: { g: GelombangDetail; onSelesai: () => void; onBatal: () => void }) {
  const [nilai, setNilai] = useState<Record<string, string>>({});
  const [rincian, setRincian] = useState<Record<string, string>>({});
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [hasil, setHasil] = useState<{ nomor: string; kodeAkses: string } | null>(null);
  const [awal, setAwal] = useState({ namaOrtu: "", namaCalon: "", email: "", noHp: "" });
  const kirim = async () => {
    setGalat(""); setRincian({}); setSibuk(true);
    const jawaban = Object.fromEntries(Object.entries(nilai).filter(([, v]) => v !== ""));
    const res = (await api.psbPendaftarCatat(g.id, Object.fromEntries(Object.entries(awal).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v !== "")), jawaban)) as Res<{ nomor: string; kodeAkses: string }>;
    setSibuk(false);
    if (res.success && res.data) { setHasil(res.data); return; }
    setGalat(res.message || "Gagal menyimpan."); setRincian(res.rincian ?? {});
  };
  if (hasil) {
    return (
      <View className="gap-3">
        <Text className="font-semibold text-sm text-foreground">Pendaftar dicatat</Text>
        <Text className="text-sm text-foreground">Nomor pendaftaran <Text className="font-bold">{hasil.nomor}</Text>. Key untuk orang tua: <Text className="font-bold" style={{ fontFamily: "monospace" }}>{hasil.kodeAkses}</Text></Text>
        <Text className="text-xs text-red-600">Catat Key ini sekarang dan serahkan ke orang tua. Key tidak bisa ditampilkan lagi (bila hilang, buat ulang dari detail pendaftar).</Text>
        <View className="flex-row"><Button size="sm" variant="primary" onPress={onSelesai}>Selesai</Button></View>
      </View>
    );
  }
  const teksFields = g.fields.filter((f) => f.tipe !== "berkas");
  return (
    <View className="gap-3">
      <Text className="font-semibold text-sm text-foreground">Catat pendaftar (oleh staf)</Text>
      {g.fields.some((f) => f.tipe === "berkas") ? <Text className="text-xs text-muted-foreground">Dari HP hanya isian teks yang bisa dicatat. Unggah berkas lewat versi web.</Text> : null}
      <Text className="text-xs font-semibold text-muted-foreground uppercase">Data awal</Text>
      <Isian label="Nama orang tua / wali *" galat={rincian.namaOrtu}><Kolom value={awal.namaOrtu} onChangeText={(v) => setAwal({ ...awal, namaOrtu: v })} maxLength={120} /></Isian>
      <Isian label="Nama calon siswa *" galat={rincian.namaCalon}><Kolom value={awal.namaCalon} onChangeText={(v) => setAwal({ ...awal, namaCalon: v })} maxLength={120} /></Isian>
      <Isian label="Email (untuk mengirim Key)" galat={rincian.email}><Kolom value={awal.email} onChangeText={(v) => setAwal({ ...awal, email: v })} maxLength={254} keyboardType="email-address" autoCapitalize="none" /></Isian>
      <Isian label="Nomor WhatsApp *" galat={rincian.noHp}><Kolom value={awal.noHp} onChangeText={(v) => setAwal({ ...awal, noHp: v })} maxLength={20} keyboardType="phone-pad" /></Isian>
      <Text className="text-xs font-semibold text-muted-foreground uppercase mt-1">Formulir</Text>
      {teksFields.map((f) => {
        const v = nilai[f.kunci] ?? "";
        const set = (x: string) => setNilai((s) => ({ ...s, [f.kunci]: x }));
        const label = `${f.label}${f.wajib ? " *" : ""}`;
        let kontrol: React.ReactNode;
        if (f.tipe === "pilihan") kontrol = <SimplePicker value={v} options={(f.opsi ?? []).map((o) => ({ value: o, label: o }))} onChange={set} placeholder="Pilih..." />;
        else if (f.tipe === "ya_tidak") kontrol = <SimplePicker value={v} options={[{ value: "ya", label: "Ya" }, { value: "tidak", label: "Tidak" }]} onChange={set} placeholder="Pilih..." />;
        else if (f.tipe === "persetujuan") kontrol = <View className="flex-row items-center justify-between"><Text className="text-sm text-foreground flex-1">Setuju</Text><Switch value={v === "ya"} onValueChange={(x) => set(x ? "ya" : "")} /></View>;
        else if (f.tipe === "teks_panjang") kontrol = <Kolom value={v} onChangeText={set} multiline maxLength={2000} />;
        else if (f.tipe === "tanggal") kontrol = <Kolom value={v} onChangeText={set} maxLength={10} placeholder="TTTT-BB-HH" keyboardType="numbers-and-punctuation" />;
        else if (f.tipe === "telepon") kontrol = <Kolom value={v} onChangeText={set} maxLength={20} keyboardType="phone-pad" />;
        else if (f.tipe === "angka") kontrol = <Kolom value={v} onChangeText={set} maxLength={20} keyboardType="decimal-pad" />;
        else if (f.tipe === "email") kontrol = <Kolom value={v} onChangeText={set} maxLength={254} keyboardType="email-address" autoCapitalize="none" />;
        else kontrol = <Kolom value={v} onChangeText={set} maxLength={200} />;
        return <Isian key={f.kunci} label={label} bantuan={f.bantuan} galat={rincian[f.kunci]}>{kontrol}</Isian>;
      })}
      {galat ? <Text className="text-sm text-red-600">{galat}</Text> : null}
      <View className="flex-row gap-2"><Button size="sm" variant="primary" disabled={sibuk} loading={sibuk} onPress={() => void kirim()}>Simpan pendaftar</Button><Button size="sm" variant="outline" disabled={sibuk} onPress={onBatal}>Batal</Button></View>
    </View>
  );
}

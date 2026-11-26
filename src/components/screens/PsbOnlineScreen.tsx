import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Alert, Pressable, Share } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GraduationCap, Plus, AlertTriangle, Globe, ChevronRight } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { api, API_URL } from "../../services/api";
import { useThemeColors } from "../../context/ThemeContext";
import { PsbGelombang } from "./psb/PsbGelombang";
import { FormGelombang } from "./psb/MFormGelombang";
import {
  Lencana, Isian, Kolom, LABEL_GELOMBANG, LABEL_STATUS, rupiah, tanggalPendek, type GelombangRingkas, type Izin, type Res, type StatusPendaftar,
} from "./psb/mShared";

// PSB Online (staf) di HP: padanan layar web PsbOnlineScreen. Hak akses dijaga server per katalog.
const LINK_PUBLIK = `${API_URL}/api/public/psb`;

export function PsbOnlineScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [izin, setIzin] = useState<Izin | null>(null);
  const [daftar, setDaftar] = useState<GelombangRingkas[] | null>(null);
  const [galat, setGalat] = useState("");
  const [buka, setBuka] = useState<number | null>(null);
  const [membuat, setMembuat] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [lihatArsip, setLihatArsip] = useState(false);
  const [kontak, setKontak] = useState("");

  const muat = useCallback(async () => {
    setGalat("");
    const [a, b] = await Promise.all([api.psbIzin() as Promise<Res<Izin>>, api.psbGelombangList() as Promise<Res<GelombangRingkas[]>>]);
    if (a.success && a.data) { setIzin(a.data); setKontak(a.data.kontak); } else setGalat(a.message || "Gagal memuat izin PSB.");
    if (b.success && b.data) setDaftar(b.data); else if (a.success) setGalat(b.message || "Gagal memuat gelombang.");
  }, []);
  useEffect(() => { void muat(); }, [muat]);

  const atur = async (d: { publikAktif?: boolean; daftarOnline?: boolean; kontak?: string }) => {
    setSibuk(true); const res = (await api.psbPengaturan(d)) as Res; setSibuk(false);
    if (!res.success) Alert.alert("Gagal", res.message || "Gagal mengubah pengaturan."); else void muat();
  };
  const tanya = (judul: string, isi: string, aksi: string, d: { publikAktif?: boolean; daftarOnline?: boolean }, merusak = false) => Alert.alert(judul, isi, [
    { text: "Batal", style: "cancel" }, { text: aksi, style: merusak ? "destructive" : "default", onPress: () => void atur(d) },
  ]);

  if (galat && !izin) {
    return (
      <View className="flex-1 bg-background px-4 py-8 gap-3">
        <View className="flex-row items-center gap-2"><AlertTriangle size={16} color="#dc2626" /><Text className="text-sm text-red-600 flex-1">{galat}</Text></View>
        <View className="flex-row"><Button size="sm" variant="outline" onPress={() => void muat()}>Coba lagi</Button></View>
      </View>
    );
  }
  if (!izin || !daftar) return <View className="flex-1 bg-background items-center justify-center"><ActivityIndicator color={colors.primary} /></View>;
  if (buka !== null) return <PsbGelombang id={buka} izin={izin} onKembali={() => { setBuka(null); void muat(); }} />;

  const bisaBuat = izin.katalog.some((k) => k.kelola);
  const aktif = daftar.filter((g) => g.status !== "ditutup");
  const arsip = daftar.filter((g) => g.status === "ditutup");
  const tampil = lihatArsip ? arsip : aktif;
  return (
    <ScrollView className="flex-1 bg-background px-4 pt-5" contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 12 }} keyboardShouldPersistTaps="handled">
      {izin.bisaAturPublik ? (
        <Card padding="lg">
          <View className="flex-row items-start gap-3">
            <Globe size={20} color={colors.primary} />
            <View className="flex-1 gap-3">
              <View className="gap-1">
                <Text className="font-semibold text-sm text-foreground">Pendaftaran publik</Text>
                <Lencana jenis={izin.publikAktif ? "terbuka" : "draft"} teks={izin.publikAktif ? "Halaman terbuka untuk umum" : "Tertutup"} />
                <Text className="text-xs text-muted-foreground mt-1">{izin.publikAktif ? "Halaman pendaftaran bisa dibuka umum dan menampilkan gelombang publik yang terbit dan masih berlaku." : "Selama tertutup, tautan publik hanya menampilkan 'belum dibuka'. Siapkan gelombang dulu, lalu tekan GO PUBLIK."}</Text>
                <Text selectable className="bg-muted rounded-lg px-2.5 py-2 text-xs text-foreground mt-1" style={{ fontFamily: "monospace" }}>{LINK_PUBLIK}</Text>
                <View className="flex-row flex-wrap gap-2 mt-2">
                  <Button size="sm" variant={izin.publikAktif ? "outline" : "primary"} disabled={sibuk} onPress={() => (izin.publikAktif
                    ? tanya("Tutup halaman publik", "Data pendaftar yang sudah masuk tetap aman.", "Tutup", { publikAktif: false }, true)
                    : tanya("GO PUBLIK", "Halaman pendaftaran akan bisa dibuka SIAPA PUN dan menampilkan gelombang yang terbit. Fitur daftar online tetap mengikuti saklar di bawah. Lanjutkan?", "GO PUBLIK", { publikAktif: true }))}>{izin.publikAktif ? "Tutup halaman publik" : "GO PUBLIK"}</Button>
                  <Button size="sm" variant="outline" onPress={() => void Share.share({ message: LINK_PUBLIK })}>Bagikan tautan</Button>
                </View>
              </View>
              <View className="gap-1 border-t border-border pt-3">
                <Text className="font-semibold text-sm text-foreground">Fitur daftar online</Text>
                <Lencana jenis={izin.daftarOnline ? "terbuka" : "penuh"} teks={izin.daftarOnline ? "Terbuka" : "Terkunci"} />
                <Text className="text-xs text-muted-foreground mt-1">{izin.daftarOnline ? "Orang tua bisa mendaftar dan membayar lewat halaman publik." : "Terkunci: gelombang publik hanya menampilkan informasi dan nomor admin, belum bisa mendaftar. Buka kunci setelah urusan pembayaran siap. Gelombang privat tetap bisa dipakai untuk pengujian."}</Text>
                <View className="flex-row mt-2">
                  <Button size="sm" variant={izin.daftarOnline ? "outline" : "primary"} disabled={sibuk} onPress={() => (izin.daftarOnline
                    ? tanya("Kunci daftar online", "Orang tua tidak bisa mendaftar baru lewat gelombang publik (yang sudah mendaftar tetap bisa melanjutkan).", "Kunci", { daftarOnline: false }, true)
                    : tanya("Buka kunci daftar online", "Orang tua bisa mulai mendaftar dan menerima tagihan. Pastikan petunjuk pembayaran sudah terisi.", "Buka kunci", { daftarOnline: true }))}>{izin.daftarOnline ? "Kunci daftar online" : "Buka kunci daftar online"}</Button>
                </View>
                <View className="mt-2">
                  <Isian label="Nomor admin saat terkunci" bantuan="Dibuka lewat WhatsApp dari halaman publik.">
                    <Kolom value={kontak} onChangeText={setKontak} maxLength={25} keyboardType="phone-pad" />
                  </Isian>
                  <View className="flex-row mt-2"><Button size="sm" variant="outline" disabled={sibuk || kontak === izin.kontak} onPress={() => void atur({ kontak })}>Simpan nomor</Button></View>
                </View>
                <Text className="text-xs text-muted-foreground mt-2">Email konfirmasi/Key: {izin.emailTerpasang ? "terpasang" : "belum dipasang (Key tetap tampil di layar dan bisa dibuat ulang oleh staf)"}.</Text>
              </View>
            </View>
          </View>
        </Card>
      ) : null}

      {membuat ? (
        <Card padding="lg"><FormGelombang izin={izin} daftarGelombang={daftar} onBatal={() => setMembuat(false)} onSelesai={(id) => { setMembuat(false); setBuka(id); }} /></Card>
      ) : (
        <View className="flex-row flex-wrap items-center gap-2">
          {bisaBuat ? <Button size="sm" variant="primary" onPress={() => setMembuat(true)}><Plus size={14} color="#fff" /> Gelombang baru</Button> : null}
          <Pressable onPress={() => setLihatArsip(false)} accessibilityRole="tab" accessibilityState={{ selected: !lihatArsip }} className={`px-3 py-1.5 rounded-full border ${!lihatArsip ? "bg-primary border-primary" : "border-border"}`}><Text className={`text-sm font-medium ${!lihatArsip ? "text-primary-foreground" : "text-foreground"}`}>Aktif ({aktif.length})</Text></Pressable>
          <Pressable onPress={() => setLihatArsip(true)} accessibilityRole="tab" accessibilityState={{ selected: lihatArsip }} className={`px-3 py-1.5 rounded-full border ${lihatArsip ? "bg-primary border-primary" : "border-border"}`}><Text className={`text-sm font-medium ${lihatArsip ? "text-primary-foreground" : "text-foreground"}`}>Arsip ({arsip.length})</Text></Pressable>
        </View>
      )}

      {tampil.length === 0 && !membuat ? <Card padding="lg"><Text className="text-sm text-muted-foreground">{lihatArsip ? "Belum ada gelombang di arsip. Gelombang yang masa pendaftarannya lewat atau ditutup otomatis masuk ke sini." : `Belum ada gelombang pendaftaran aktif${bisaBuat ? ". Buat gelombang baru untuk memulai." : "."}`}</Text></Card> : null}

      {tampil.map((g) => (
        <Pressable key={g.id} onPress={() => setBuka(g.id)} accessibilityRole="button" accessibilityLabel={`Buka ${g.nama}`}>
          <Card padding="lg">
            <View className="flex-row items-start justify-between gap-2">
              <View className="flex-1">
                <View className="flex-row items-center gap-2"><GraduationCap size={16} color={colors.primary} /><Text className="font-semibold text-sm text-foreground flex-1">{g.nama}{g.akses === "privat" ? " (privat)" : ""}</Text></View>
                <Text className="text-xs text-muted-foreground">{g.katalog?.nama} · {g.tahunAjaran} · {tanggalPendek(g.tanggalBuka)} s.d. {tanggalPendek(g.tanggalTutup)}</Text>
              </View>
              <View className="items-end gap-1"><Lencana jenis={g.status} teks={LABEL_GELOMBANG[g.status]} /><ChevronRight size={16} color={colors.mutedForeground} /></View>
            </View>
            <Text className="text-xs text-muted-foreground mt-2">
              Biaya {g.biaya > 0 ? rupiah(g.biaya) : "gratis"} · {g.jumlahAktif} pendaftar aktif{g.kuota ? ` dari kuota ${g.kuota}` : ""}
              {(Object.keys(LABEL_STATUS) as StatusPendaftar[]).filter((k) => g.hitung[k]).map((k) => ` · ${LABEL_STATUS[k]} ${g.hitung[k]}`).join("")}
            </Text>
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// ============================================================
// KARTU PROFIL WEBSITE (2026-10-26) - port native dari webview. Guru/pegawai mengelola kartunya sendiri untuk halaman
// Profil Yayasan website. Tampil HANYA bila dicentang DAN disetujui Pengelola Website. Nomor HP/NIP tidak pernah tampil.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, Image, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { AlertTriangle, CheckCircle, CheckSquare, Clock, ImageIcon, Save, Square, Trash2, Upload } from "lucide-react-native";
import { api } from "../../services/api";
import { useThemeColors } from "../../context/ThemeContext";

interface Kartu {
  boleh: boolean; nama?: string; status?: string[]; mapelOtomatis?: string[];
  pengajuan?: { tampil: boolean; deskripsi: string; mapel: string; foto: string | null };
  publik?: { tampil: boolean; foto: string | null };
  status_pengajuan?: "draf" | "menunggu" | "disetujui" | "ditolak"; catatan?: string | null;
}
const inputCls = "bg-input-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground";
const MAKS = 300;

export function KartuProfilScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [fase, setFase] = useState<"muat" | "ok" | "gagal">("muat");
  const [galat, setGalat] = useState("");
  const [k, setK] = useState<Kartu | null>(null);
  const [tampil, setTampil] = useState(false);
  const [deskripsi, setDeskripsi] = useState("");
  const [mapel, setMapel] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState<{ jenis: "ok" | "galat"; teks: string } | null>(null);

  const isi = (d: Kartu) => { setK(d); setTampil(Boolean(d.pengajuan?.tampil)); setDeskripsi(d.pengajuan?.deskripsi ?? ""); setMapel(d.pengajuan?.mapel ?? ""); };
  const muat = useCallback(async () => {
    const res = await api.profilTimSaya();
    if (!res.success) { setGalat(res.message || "Gagal memuat kartu."); setFase("gagal"); return; }
    isi(res.data as Kartu); setFase("ok");
  }, []);
  useEffect(() => { void muat(); }, [muat]);

  const berubah = k?.pengajuan && (tampil !== k.pengajuan.tampil || deskripsi !== k.pengajuan.deskripsi || mapel !== k.pengajuan.mapel);

  const simpan = async () => {
    setSibuk(true); setPesan(null);
    const res = await api.profilTimSimpan({ tampil, deskripsi, mapel });
    setSibuk(false);
    if (!res.success) { setPesan({ jenis: "galat", teks: res.message || "Gagal menyimpan." }); return; }
    const d = res.data as Kartu; isi(d);
    setPesan({ jenis: "ok", teks: !tampil ? "Disimpan. Kartu Anda disembunyikan dari website." : d.status_pengajuan === "disetujui" ? "Disimpan." : "Disimpan. Foto/deskripsi menunggu persetujuan Pengelola Website sebelum tayang." });
  };
  const pilihFoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Izin galeri ditolak", "Izinkan akses galeri di pengaturan HP untuk memilih foto."); return; }
    const hasil = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: false, quality: 0.9 });
    if (hasil.canceled || hasil.assets.length === 0) return;
    let uri = hasil.assets[0].uri; let mime = hasil.assets[0].mimeType ?? "image/jpeg";
    setSibuk(true); setPesan(null);
    try {
      const kecil = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1200 } }], { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG });
      uri = kecil.uri; mime = "image/jpeg";
    } catch { /* kirim apa adanya */ }
    const res = await api.profilTimFoto(uri, mime);
    setSibuk(false);
    if (!res.success) { setPesan({ jenis: "galat", teks: res.message || "Gagal mengunggah foto." }); return; }
    const d = res.data as Kartu; setK(d);
    setPesan({ jenis: "ok", teks: d.pengajuan?.tampil ? "Foto diunggah. Menunggu persetujuan Pengelola Website." : "Foto diunggah." });
  };
  const hapusFoto = () => Alert.alert("Hapus foto", "Hapus foto kartu?", [
    { text: "Batal", style: "cancel" },
    { text: "Hapus", style: "destructive", onPress: async () => { setSibuk(true); const res = await api.profilTimHapusFoto(); setSibuk(false); if (res.success) setK(res.data as Kartu); else setPesan({ jenis: "galat", teks: res.message || "Gagal menghapus foto." }); } },
  ]);

  if (fase === "muat") return <View className="flex-1 bg-background items-center justify-center"><ActivityIndicator /></View>;
  if (fase === "gagal" || !k) return <View className="flex-1 bg-background px-4 py-8"><View className="flex-row items-center gap-2"><AlertTriangle size={16} color="#dc2626" /><Text className="text-sm text-red-600 flex-1">{galat}</Text></View></View>;
  if (!k.boleh) return <View className="flex-1 bg-background px-4 py-8"><Text className="text-sm text-muted-foreground">Akun Anda tidak tertaut ke data pegawai, jadi tidak memiliki kartu profil website.</Text></View>;

  const foto = k.pengajuan?.foto ?? null;
  const st = k.status_pengajuan ?? "draf";
  const info = st === "menunggu" ? { ikon: <Clock size={16} color="#92400e" />, bg: "bg-amber-50", tx: "text-amber-800", teks: "Foto/deskripsi Anda menunggu persetujuan Pengelola Website." }
    : st === "ditolak" ? { ikon: <AlertTriangle size={16} color="#b91c1c" />, bg: "bg-red-50", tx: "text-red-700", teks: `Belum bisa tayang: ${k.catatan ?? "perlu diperbaiki."} Perbaiki lalu simpan lagi.` }
    : st === "disetujui" && (k.publik?.foto || k.pengajuan?.deskripsi) ? { ikon: <CheckCircle size={16} color="#166534" />, bg: "bg-green-50", tx: "text-green-800", teks: "Foto/deskripsi Anda sudah tayang di halaman Profil Yayasan website." } : null;

  return (
    <KeyboardAwareScrollView className="flex-1 bg-background px-4 pt-4" contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 14 }} bottomOffset={20}>
      <View className="bg-card border border-border rounded-2xl p-4">
        <Text className="text-sm text-foreground"><Text className="font-bold">Nama dan jabatan/status Anda sudah tampil otomatis</Text> di halaman <Text className="font-bold">Profil Yayasan</Text> website. Foto, mata pelajaran, dan deskripsi tampil setelah Anda mengisinya dan disetujui Pengelola Website. <Text className="font-bold">Nomor HP dan data pribadi lain tidak pernah tampil.</Text></Text>
      </View>
      {info ? <View className={`${info.bg} rounded-2xl px-4 py-3 flex-row items-start gap-2`}>{info.ikon}<Text className={`text-sm flex-1 ${info.tx}`}>{info.teks}</Text></View> : null}
      {pesan ? <View className={`${pesan.jenis === "ok" ? "bg-green-50" : "bg-red-50"} rounded-2xl px-4 py-3`}><Text className={`text-sm ${pesan.jenis === "ok" ? "text-green-800" : "text-red-700"}`}>{pesan.teks}</Text></View> : null}

      <View className="bg-card border border-border rounded-2xl p-4 gap-4">
        <View className="gap-2">
          <Text className="text-lg font-semibold text-foreground">{k.nama}</Text>
          <View className="flex-row flex-wrap gap-2">{(k.status ?? []).map((s) => <View key={s} className="bg-muted rounded-full px-3 py-1.5"><Text className="text-xs font-semibold text-foreground">{s}</Text></View>)}</View>
          <Text className="text-xs text-muted-foreground">Status dihitung otomatis dari data sekolah (wali kelas, pendamping, kepala sekolah, kapasitas tambahan). Tidak bisa diubah di sini.</Text>
        </View>

        <View className="gap-1.5">
          <Text className="text-sm font-medium text-foreground">Foto</Text>
          <View className="flex-row items-center gap-3">
            {foto ? <Image source={{ uri: foto }} className="w-20 h-28 rounded-lg bg-muted" resizeMode="cover" /> : <View className="w-20 h-28 rounded-lg border border-dashed border-border bg-muted items-center justify-center"><ImageIcon size={22} color={colors.mutedForeground} /></View>}
            <View className="flex-1 flex-row flex-wrap gap-2">
              <Pressable onPress={() => void pilihFoto()} disabled={sibuk} className="flex-row items-center gap-1.5 px-3 py-2 rounded-xl border border-border"><Upload size={14} color={colors.foreground} /><Text className="text-sm font-medium text-foreground">{foto ? "Ganti foto" : "Pilih foto"}</Text></Pressable>
              {foto ? <Pressable onPress={hapusFoto} disabled={sibuk} className="flex-row items-center gap-1.5 px-3 py-2 rounded-xl border border-border"><Trash2 size={14} color={colors.foreground} /><Text className="text-sm font-medium text-foreground">Hapus</Text></Pressable> : null}
            </View>
          </View>
          <Text className="text-xs text-muted-foreground">Foto berpakaian rapi, wajah jelas, latar sederhana. Foto baru perlu disetujui sebelum tayang. Tanpa foto pun kartu Anda tetap tampil (dengan inisial).</Text>
        </View>

        <View className="gap-1">
          <Text className="text-sm font-medium text-foreground">Mata pelajaran yang diampu (opsional)</Text>
          <TextInput value={mapel} onChangeText={setMapel} maxLength={120} placeholder="Contoh: Matematika, IPA" className={inputCls} />
          <Text className="text-xs text-muted-foreground">{(k.mapelOtomatis ?? []).length ? `Dari jadwal pelajaran otomatis tampil juga: ${(k.mapelOtomatis ?? []).join(", ")}.` : "Pisahkan dengan koma."}</Text>
        </View>

        <View className="gap-1">
          <Text className="text-sm font-medium text-foreground">Deskripsi / kata sambutan</Text>
          <TextInput value={deskripsi} onChangeText={setDeskripsi} maxLength={MAKS} multiline textAlignVertical="top" placeholder="Contoh: Semangat selalu anak-anakku!" className={inputCls} style={{ minHeight: 110 }} />
          <Text className="text-xs text-muted-foreground text-right">{deskripsi.length}/{MAKS}</Text>
        </View>

        <Pressable onPress={() => setTampil(!tampil)} accessibilityRole="checkbox" accessibilityState={{ checked: tampil }} className="flex-row items-start gap-3 border border-border rounded-xl p-4">
          {tampil ? <CheckSquare size={22} color="#16a34a" /> : <Square size={22} color="#9ca3af" />}
          <View className="flex-1 gap-0.5"><Text className="text-sm font-medium text-foreground">Tampilkan nama saya di halaman Profil Yayasan</Text><Text className="text-xs text-muted-foreground">Hilangkan centang kapan saja untuk menyembunyikan kartu Anda (langsung hilang dari website).</Text></View>
        </Pressable>

        <Pressable onPress={() => void simpan()} disabled={sibuk || !berubah} className={`flex-row items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary ${sibuk || !berubah ? "opacity-50" : ""}`}>
          {sibuk ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : <Save size={16} color={colors.primaryForeground} />}
          <Text className="text-sm font-semibold text-primary-foreground">{sibuk ? "Menyimpan..." : "Simpan"}</Text>
        </Pressable>
      </View>
    </KeyboardAwareScrollView>
  );
}

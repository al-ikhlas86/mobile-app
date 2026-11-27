import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Alert, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GraduationCap, Plus, AlertTriangle, ChevronRight } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { api } from "../../services/api";
import { useThemeColors } from "../../context/ThemeContext";
import { PsbGelombang } from "./psb/PsbGelombang";
import { FormGelombang } from "./psb/MFormGelombang";
import {
  Lencana, Isian, Kolom, LABEL_GELOMBANG, LABEL_JENIS, LABEL_STATUS, rupiah, tanggalPendek, type GelombangRingkas, type Izin, type Res, type StatusPendaftar,
} from "./psb/mShared";

// PSB Online (staf) di HP: padanan layar web PsbOnlineScreen. Hak akses dijaga server per katalog.

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

  const atur = async (d: { kontak?: string }) => {
    setSibuk(true); const res = (await api.psbPengaturan(d)) as Res; setSibuk(false);
    if (!res.success) Alert.alert("Gagal", res.message || "Gagal mengubah pengaturan."); else void muat();
  };

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
      {izin.semua ? (
        <Card padding="lg">
          <Isian label="Nomor admin umum (WhatsApp)" bantuan="Ditampilkan di halaman publik bila katalog belum punya kontak sendiri. GO PUBLIK dan daftar online diatur per gelombang, di tab Pengaturan tiap gelombang.">
            <Kolom value={kontak} onChangeText={setKontak} maxLength={25} keyboardType="phone-pad" />
          </Isian>
          <View className="flex-row mt-2"><Button size="sm" variant="outline" disabled={sibuk || kontak === izin.kontak} onPress={() => void atur({ kontak })}>Simpan nomor</Button></View>
          <Text className="text-xs text-muted-foreground mt-2">Email konfirmasi/Key: {izin.emailTerpasang ? "terpasang" : "belum dipasang (Key tetap tampil di layar dan bisa dibuat ulang oleh staf)"}.</Text>
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
                <View className="flex-row items-center gap-2"><GraduationCap size={16} color={colors.primary} /><Text className="font-semibold text-sm text-foreground flex-1">{g.nama}{g.akses === "privat" ? " (privat)" : ""}{g.jenis !== "siswa" ? ` (lowongan ${LABEL_JENIS[g.jenis].toLowerCase()})` : ""}</Text></View>
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

import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { AlertCircle, ChevronDown, Award } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { api } from "../../services/api";
import { useThemeColors } from "../../context/ThemeContext";
import { LABEL_SEMESTER, formatNilai, warnaPredikat } from "../../utils/nilaiRaport";

interface PeriodeOpsi { tahunSourceId: number; tahunNama: string; semester: "ganjil" | "genap" }
interface MapelNilai {
  mapelSourceId: number; nama: string; kkm: number; nilaiAkhir: number | null; predikat: string | null; tuntas: boolean | null;
  komponen: { kode: string; nama: string; bobot: number; nilai: number | null }[];
}
interface HasilAnak {
  anak: { id: number; nama: string };
  periode: PeriodeOpsi | null;
  periodeTersedia: PeriodeOpsi[];
  mapel: MapelNilai[];
  sikap: { grade: string; label: string; catatan: string | null } | null;
}

const WARNA_SIKAP: Record<string, "success" | "info" | "warning" | "error"> = {
  sangat_baik: "success", baik: "info", cukup: "warning", perlu_bimbingan: "error",
};

// Nilai anak untuk orang tua (2026-10-02) - port native dari webview SiswaNilaiScreen.tsx.
// Hanya menampilkan lembar yang SUDAH diterbitkan guru/wali kelas - draf & jadwal yang belum
// tiba tidak pernah dikirim server ke sini. Dirender di dalam ScrollView AkademikSiswaScreen
// (bersama ChildSwitcher), jadi layar ini TIDAK punya scroll vertikal sendiri.
export function SiswaNilaiScreen({ studentCacheId, studentNama }: { studentCacheId: number; studentNama: string }) {
  const colors = useThemeColors();
  const [memuat, setMemuat] = useState(true);
  const [mati, setMati] = useState(false);
  const [error, setError] = useState("");
  const [hasil, setHasil] = useState<HasilAnak | null>(null);
  const [pilih, setPilih] = useState<PeriodeOpsi | null>(null);
  const [terbuka, setTerbuka] = useState<number | null>(null);

  useEffect(() => {
    let batal = false;
    setMemuat(true);
    setError("");
    setMati(false);
    api.raportAnak(studentCacheId, pilih?.tahunSourceId, pilih?.semester).then((res: any) => {
      if (batal) return;
      if (!res?.success) {
        if (res?.code === "RAPORT_NONAKTIF") setMati(true);
        else setError(res?.message ?? "Gagal memuat nilai.");
      } else {
        setHasil(res.data);
      }
      setMemuat(false);
    }).catch(() => { if (!batal) { setError("Gagal memuat nilai. Periksa koneksi internet."); setMemuat(false); } });
    return () => { batal = true; };
  }, [studentCacheId, pilih?.tahunSourceId, pilih?.semester]);

  // Ganti anak -> kembali ke periode terbaru anak itu.
  useEffect(() => { setPilih(null); setTerbuka(null); }, [studentCacheId]);

  if (memuat && !hasil) {
    return <View className="items-center justify-center py-12"><ActivityIndicator color={colors.primary} /></View>;
  }
  if (mati) {
    return (
      <View className="items-center justify-center gap-3 px-8 py-12">
        <Award size={32} color={colors.mutedForeground} />
        <Text className="text-sm text-muted-foreground text-center">Fitur nilai belum tersedia. Akan muncul di sini setelah diaktifkan sekolah.</Text>
      </View>
    );
  }
  if (error) {
    return (
      <Card padding="md"><View className="flex-row items-start gap-2.5">
        <AlertCircle size={16} color="#dc2626" /><Text className="text-sm text-foreground flex-1">{error}</Text>
      </View></Card>
    );
  }
  if (!hasil || !hasil.periode) {
    return (
      <View className="items-center justify-center gap-3 px-8 py-12">
        <View className="w-16 h-16 rounded-2xl bg-primary/10 items-center justify-center"><Award size={30} color={colors.primary} /></View>
        <Text className="text-base font-semibold text-foreground text-center">Belum Ada Nilai</Text>
        <Text className="text-sm text-muted-foreground text-center leading-5">
          Nilai {studentNama} akan muncul di sini setelah diterbitkan oleh guru atau wali kelas. Anda akan mendapat notifikasi.
        </Text>
      </View>
    );
  }

  const periodeAktif = hasil.periode;
  return (
    <View className="gap-3">
      {hasil.periodeTersedia.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ flexGrow: 0 }}>
          {hasil.periodeTersedia.map((p) => {
            const aktif = p.tahunSourceId === periodeAktif.tahunSourceId && p.semester === periodeAktif.semester;
            return (
              <Pressable key={`${p.tahunSourceId}-${p.semester}`} onPress={() => setPilih(p)}
                className={`px-3.5 py-2 rounded-xl border ${aktif ? "bg-primary border-primary" : "bg-card border-border"}`}>
                <Text className={`text-sm font-medium ${aktif ? "text-primary-foreground" : "text-foreground"}`}>{p.tahunNama}</Text>
                <Text className={`text-[10px] ${aktif ? "text-primary-foreground/80" : "text-muted-foreground"}`}>Semester {LABEL_SEMESTER[p.semester]}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      {hasil.periodeTersedia.length === 1 && (
        <Text className="text-xs text-muted-foreground">Tahun ajaran {periodeAktif.tahunNama} · Semester {LABEL_SEMESTER[periodeAktif.semester]}</Text>
      )}

      {hasil.sikap && (
        <Card padding="md" className="gap-1.5">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="text-sm font-semibold text-foreground">Nilai Sikap</Text>
            <Badge variant={WARNA_SIKAP[hasil.sikap.grade] ?? "muted"}>{hasil.sikap.label}</Badge>
          </View>
          {hasil.sikap.catatan ? <Text className="text-sm text-muted-foreground leading-5">{hasil.sikap.catatan}</Text> : null}
        </Card>
      )}

      {hasil.mapel.length === 0 && !hasil.sikap && <Text className="text-sm text-muted-foreground">Belum ada nilai pada periode ini.</Text>}
      {hasil.mapel.map((m) => {
        const buka = terbuka === m.mapelSourceId;
        return (
          <Card key={m.mapelSourceId} padding="none">
            <Pressable onPress={() => setTerbuka(buka ? null : m.mapelSourceId)} className="flex-row items-center justify-between gap-3 p-4">
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>{m.nama}</Text>
                <Text className="text-xs text-muted-foreground">
                  {m.nilaiAkhir === null ? "Nilai akhir belum lengkap" : m.tuntas ? `Tuntas (KKM ${m.kkm})` : `Di bawah KKM ${m.kkm}`}
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <View className="items-end">
                  <Text className={`text-lg font-bold leading-6 ${warnaPredikat(m.predikat)}`}>{formatNilai(m.nilaiAkhir)}</Text>
                  {m.predikat ? <Text className={`text-[11px] font-medium ${warnaPredikat(m.predikat)}`}>Predikat {m.predikat}</Text> : null}
                </View>
                <View style={{ transform: [{ rotate: buka ? "180deg" : "0deg" }] }}><ChevronDown size={16} color={colors.mutedForeground} /></View>
              </View>
            </Pressable>
            {buka && (
              <View className="px-4 pb-4 pt-3 border-t border-border gap-1.5">
                {m.komponen.map((k) => (
                  <View key={k.kode} className="flex-row justify-between gap-3">
                    <Text className="text-sm text-foreground flex-1">{k.nama} <Text className="text-muted-foreground text-xs">({k.bobot}%)</Text></Text>
                    <Text className="text-sm text-foreground">{formatNilai(k.nilai)}</Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
        );
      })}
    </View>
  );
}

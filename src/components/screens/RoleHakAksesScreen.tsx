import React from "react";
import { View, Text, ScrollView } from "react-native";
import { Shield } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";

const ROLES: { name: string; desc: string; auto?: string }[] = [
  { name: "Admin IT", desc: "Akses penuh - kelola pengguna & role, pantau status sistem." },
  { name: "Supervisor", desc: "Memantau seluruh data lintas unit (SD & TK/Playground)." },
  { name: "Admin TU (SD)", desc: "Kelola administrasi & presensi unit SD." },
  { name: "Admin TU (TK & Playground)", desc: "Kelola administrasi & presensi unit TK/Playground." },
  { name: "Admin Media (SD)", desc: "Kelola Berita Acara & media unit SD." },
  { name: "Admin Media (TK & Playground)", desc: "Kelola Berita Acara & media unit TK/Playground." },
  { name: "Keuangan", desc: "Akses data pembayaran & tagihan." },
  { name: "Guru", desc: "Akses presensi & data mengajar sendiri.", auto: "Otomatis dari jabatan pegawai (guru_bidang) di Hub API" },
  { name: "Guru Kelas", desc: "Sama seperti Guru, plus akses data wali kelas.", auto: "Otomatis dari jabatan pegawai (guru_kelas) di Hub API" },
  { name: "Pegawai", desc: "Akses presensi pribadi.", auto: "Otomatis dari jabatan pegawai (karyawan) di Hub API" },
  { name: "Orang Tua", desc: "Akses data & presensi anak.", auto: "Otomatis dari data siswa - tidak bisa dipromosikan manual" },
];

export function RoleHakAksesScreen() {
  return (
    <ScrollView className="flex-1 bg-background px-4 pt-5" contentContainerStyle={{ paddingBottom: 32, gap: 12 }}>
      <Text className="text-xs text-muted-foreground">Referensi peran yang tersedia di aplikasi ini. Untuk mengubah role akun pegawai, gunakan menu Manajemen Pengguna.</Text>
      {ROLES.map((r) => (
        <Card key={r.name} padding="md">
          <View className="flex-row items-start gap-3">
            <View className="w-9 h-9 rounded-lg bg-purple-50 items-center justify-center"><Shield size={16} color="#7c3aed" /></View>
            <View className="flex-1">
              <View className="flex-row items-center gap-2 flex-wrap">
                <Text className="text-sm font-semibold text-foreground">{r.name}</Text>
                {r.auto ? <Badge variant="muted">Otomatis</Badge> : null}
              </View>
              <Text className="text-xs text-muted-foreground mt-0.5">{r.desc}</Text>
              {r.auto ? <Text className="text-[11px] text-muted-foreground/80 mt-1">{r.auto}</Text> : null}
            </View>
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

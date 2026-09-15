import React from "react";
import { View, Text, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Shield } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";

const ROLES: { name: string; desc: string; auto?: string }[] = [
  { name: "Admin IT", desc: "Akses penuh - kelola pengguna & role, pantau status sistem." },
  { name: "Supervisor", desc: "Memantau seluruh data lintas unit (SD & TK/Playground)." },
  // Sistem Katalog (2026-09-14) - Admin TU/Media DIGABUNG jadi generik
  // (dulu 4 varian SD/TK terpisah) - katalog mana yg dipegang SEKARANG
  // ditentukan lewat Kapasitas Tambahan (bisa >1 katalog per orang), bukan
  // lagi bagian dari nama role - lihat menu "Kelola Katalog" di Manajemen
  // Pengguna utk daftar katalog yang ada.
  { name: "Admin TU", desc: "Kelola administrasi & presensi katalog (unit) yang ditentukan lewat Kapasitas Tambahan." },
  { name: "Admin Media", desc: "Kelola Berita Acara & media katalog (unit) yang ditentukan lewat Kapasitas Tambahan." },
  { name: "Keuangan", desc: "Akses data pembayaran & tagihan." },
  { name: "Guru", desc: "Akses presensi & data mengajar sendiri. Guru yang berstatus wali kelas otomatis mendapat menu tambahan (data siswa kelasnya, persetujuan izin, dst).", auto: "Otomatis dari jabatan pegawai (guru_kelas/guru_bidang) di Hub API - status wali kelas sendiri BUKAN role terpisah, tambahan otomatis dari penetapan Wali Kelas di Data Master" },
  { name: "Kepala Sekolah", desc: "BUKAN role tersendiri - tambahan di atas role apa pun (Guru/Pegawai): menyetujui/menolak izin guru unitnya, pantau rekap presensi unitnya. Role dasar TIDAK berubah.", auto: "Otomatis dari penanda di Data Master (tabel kepala_sekolah, pola sama Wali Kelas) - TIDAK bisa di-assign manual lewat Manajemen Pengguna" },
  { name: "Pegawai", desc: "Akses presensi pribadi.", auto: "Otomatis dari jabatan pegawai (karyawan) di Hub API" },
  { name: "Orang Tua", desc: "Akses data & presensi anak.", auto: "Otomatis dari data siswa - tidak bisa dipromosikan manual" },
];

export function RoleHakAksesScreen() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView className="flex-1 bg-background px-4 pt-5" contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 12 }}>
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
              {r.auto ? <Text className="text-[11px] text-muted-foreground mt-1">{r.auto}</Text> : null}
            </View>
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

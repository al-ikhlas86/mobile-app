import React from "react";
import { ScrollView, Pressable, Text, View } from "react-native";
import { useThemeColors } from "../context/ThemeContext";

export interface ChildOption {
  id: number;
  nama: string;
  kelas_nama?: string | null;
}

interface Props {
  children: ChildOption[];
  activeId: number | null;
  onChange: (id: number) => void;
}

// Dipakai di SEMUA layar Orang Tua yang menampilkan/mengirim data atas nama
// 1 anak (Presensi Anak, Jadwal Pelajaran, Kirim Aduan, Pengenalan Wajah,
// Dashboard) - akun Orang Tua bisa punya lebih dari 1 anak (tabel
// parent_students), jadi harus SELALU jelas anak MANA yang sedang aktif
// sebelum data ditampilkan/dikirim (keputusan desain user 2026-08-30:
// "HARAM banget kalo sampe salah pembacaan/salah pendataan"). Sengaja
// disembunyikan total (return null) kalau cuma 1 anak - tidak menambah
// noise UI untuk mayoritas akun yang memang cuma py 1 anak.
export function ChildSwitcher({ children, activeId, onChange }: Props) {
  const colors = useThemeColors();
  if (children.length <= 1) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
      {children.map((c) => {
        const active = c.id === activeId;
        return (
          <Pressable
            key={c.id}
            onPress={() => onChange(c.id)}
            className={`px-3.5 py-2 rounded-xl border ${active ? "bg-primary border-primary" : "bg-card border-border"}`}
          >
            <Text className={`text-sm font-medium ${active ? "text-primary-foreground" : "text-foreground"}`}>{c.nama}</Text>
            {c.kelas_nama ? (
              <Text style={{ fontSize: 10, color: active ? colors.primaryForeground : colors.mutedForeground, opacity: active ? 0.8 : 1 }}>
                Kelas {c.kelas_nama}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

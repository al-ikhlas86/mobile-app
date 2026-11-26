import React from "react";
import { View, Text, Image, Pressable, FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Plus, Check, X, Trash2 } from "lucide-react-native";
import { resolveAvatarUrl } from "../services/api";
import { daftarAkunGantiAkun, jenisAkun, type SavedAccount } from "../services/authService";
import { useThemeColors } from "../context/ThemeContext";

interface Props {
  visible: boolean;
  currentAccountId: string;
  savedAccounts: SavedAccount[];
  onSwitch: (id: string) => void;
  onAddAccount: () => void;
  onRemoveAccount: (id: string) => void;
  onClose: () => void;
}

// Ganti akun cepat gaya Instagram/webview (AccountSwitcher.tsx web) -
// SEBELUMNYA belum ada sama sekali di versi native (murni 1 sesi, tanpa
// cara pindah antar akun tertaut tanpa login ulang). Dibuka dari avatar
// di header Dashboard ATAU dari tombol "Ganti Akun" di Profil.
//
// SENGAJA BUKAN React Native <Modal> lagi - <Modal> Android bikin WINDOW
// SENDIRI yang terbukti (expo/expo#39749 + pengalaman langsung: sudah
// dicoba statusBarTranslucent/navigationBarTranslucent, TETAP gagal)
// tidak konsisten mewarisi pengaturan nav bar dari window utama app.
// Diganti jadi overlay biasa DI DALAM tree yang sama persis dgn
// Dashboard/Login/dst (absolute, nutup 1 layar penuh) - otomatis ikut
// window yang SAMA, tidak perlu perlakuan/tambal khusus apapun lagi.
export function AccountSwitcher({ visible, currentAccountId, savedAccounts, onSwitch, onAddAccount, onRemoveAccount, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  if (!visible) return null;
  const akunAktif = savedAccounts.find((a) => a.id === currentAccountId);
  return (
    <View className="absolute inset-0" style={{ zIndex: 50, elevation: 50 }}>
      <Pressable className="flex-1 bg-black/50 justify-end" onPress={onClose}>
        {/* paddingBottom pakai safe-area inset - SEBELUMNYA konten (khususnya
            baris "Tambah Akun" paling bawah) mepet langsung ke tepi layar,
            ketiban tombol navigasi bawaan Android (3-tombol/gesture pill). */}
        <Pressable className="bg-card rounded-t-3xl max-h-[70%]" style={{ paddingBottom: insets.bottom }} onPress={(e) => e.stopPropagation()}>
          <View className="flex-row items-center justify-between p-4 border-b border-border">
            <Text className="text-base font-bold text-foreground">Ganti Akun</Text>
            <Pressable onPress={onClose}><X size={20} color={colors.mutedForeground} /></Pressable>
          </View>
          <FlatList
            // Semua akun tampil, dikelompokkan per orang: Office dulu lalu Orang Tua (lihat daftarAkunGantiAkun).
            data={daftarAkunGantiAkun(savedAccounts)}
            keyExtractor={(a) => a.id}
            contentContainerStyle={{ padding: 12, gap: 4 }}
            renderItem={({ item }) => {
              const isCurrent = item.id === currentAccountId;
              const avatar = resolveAvatarUrl(item.avatarUrl);
              return (
                <View className="flex-row items-center gap-3 px-2 py-2.5 rounded-xl">
                  <Pressable onPress={() => onSwitch(item.id)} className="flex-1 flex-row items-center gap-3">
                    <View className="w-11 h-11 rounded-full bg-primary items-center justify-center overflow-hidden">
                      {avatar ? <Image source={{ uri: avatar }} className="w-full h-full" /> : <Text className="text-primary-foreground font-bold">{item.avatarInitials}</Text>}
                    </View>
                    <View className="flex-1">
                      <Text numberOfLines={1} className="text-sm font-semibold text-foreground">{item.fullName}</Text>
                      <Text numberOfLines={1} className="text-xs text-muted-foreground">{item.role}</Text>
                      <View style={{ alignSelf: "flex-start", marginTop: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: jenisAkun(item.role) === "Office" ? "rgba(53,100,71,0.12)" : "#fef3c7" }}>
                        <Text style={{ fontSize: 11, fontWeight: "600", color: jenisAkun(item.role) === "Office" ? colors.primary : "#78350f" }}>{jenisAkun(item.role)}</Text>
                      </View>
                    </View>
                    {isCurrent && <Check size={18} color={colors.primary} />}
                  </Pressable>
                  {/* Akun lain milik orang yang SAMA dengan akun aktif tidak bisa dihapus dari sini (akan ikut menghapus akun aktif): gunakan Keluar. */}
                  {!isCurrent && item.username !== akunAktif?.username && (
                    <Pressable onPress={() => onRemoveAccount(item.id)} className="p-2" accessibilityLabel={savedAccounts.some((a) => a.id !== item.id && a.username === item.username) ? "Hapus akses (akun Office dan Orang Tua orang ini)" : "Hapus akses akun"}>
                      <Trash2 size={16} color={colors.mutedForeground} />
                    </Pressable>
                  )}
                </View>
              );
            }}
            ListFooterComponent={
              <Pressable onPress={onAddAccount} className="flex-row items-center gap-3 px-2 py-3 mt-1">
                <View className="w-11 h-11 rounded-full bg-muted items-center justify-center"><Plus size={20} color={colors.primary} /></View>
                <Text className="text-sm font-semibold text-primary">Tambah Akun</Text>
              </Pressable>
            }
          />
        </Pressable>
      </Pressable>
    </View>
  );
}

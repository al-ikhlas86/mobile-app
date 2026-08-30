import React, { useEffect, useState } from "react";
import { View, Text, Image, Pressable, ScrollView, ActivityIndicator } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { User, Mail, Phone, Lock, LogOut, ChevronRight, Shield, Camera, X, ScanFace, Bell, Sun, Moon, Users, MessageCircle, Heart, Clock, Wallet, Receipt, FlaskConical, Pencil, Check } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Input } from "../ui/Input";
import { useTheme, useThemeColors } from "../../context/ThemeContext";
import { getActiveSession, updateAccountFullName } from "../../services/authService";
import { api, resolveAvatarUrl } from "../../services/api";
import type { RoleName } from "../../services/authService";

interface Props {
  role: RoleName;
  onLogout: () => void;
  onNavigate: (screen: string, params?: Record<string, unknown>) => void;
  onAvatarChanged: (url: string | null) => void;
  onOpenSwitcher: () => void;
  canUseDemoMode: boolean;
  demoActive: boolean;
  onOpenDemoSwitcher: () => void;
}

const STAFF_ROLES: RoleName[] = ["Guru", "Guru Kelas", "Pegawai"];

export function ProfilScreen({ role, onLogout, onNavigate, onAvatarChanged, onOpenSwitcher, canUseDemoMode, demoActive, onOpenDemoSwitcher }: Props) {
  const { isDark, toggleTheme } = useTheme();
  const colors = useThemeColors();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean> | null>(null);
  const session = getActiveSession();
  const isOrangTua = role === "Orang Tua";

  // Ganti Nama (2026-08-31) - KHUSUS Orang Tua, lihat catatan lengkap di
  // versi webview (ProfilScreen.tsx) soal kenapa (akun ini auto-dibuat
  // "Orang Tua {anak pertama}", tidak pernah berubah walau anak ke-2 dst
  // ditautkan).
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(session?.fullName ?? "");
  const [nameSaving, setNameSaving] = useState(false);
  const [displayName, setDisplayName] = useState(session?.fullName ?? "");

  async function handleSaveName() {
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    setNameSaving(true);
    const res = await api.updateFullName(trimmed);
    setNameSaving(false);
    if (res.success) {
      setDisplayName(trimmed);
      if (session) await updateAccountFullName(session.accountId, trimmed);
      setEditingName(false);
    }
  }

  useEffect(() => {
    (async () => {
      const res = await api.me();
      if (res.success) {
        setPhone(res.user.phone);
        setEmail(res.user.email);
        setAvatarUrl(resolveAvatarUrl(res.user.avatar_url));
      }
      const prefRes = await api.notificationPreferences();
      if (prefRes.success) setNotifPrefs(prefRes.data);
    })();
  }, []);

  async function toggleNotifPref(key: string) {
    if (!notifPrefs) return;
    const next = !notifPrefs[key];
    setNotifPrefs({ ...notifPrefs, [key]: next }); // optimistic
    const res = await api.updateNotificationPreferences({ [key]: next } as any);
    if (res.success) setNotifPrefs(res.data);
    else setNotifPrefs((prev) => (prev ? { ...prev, [key]: !next } : prev)); // rollback kalau gagal
  }

  async function handleAvatarChange() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    setAvatarUploading(true);
    const asset = result.assets[0];
    const res = await api.uploadAvatar(asset.uri, asset.mimeType ?? "image/jpeg");
    setAvatarUploading(false);
    if (res.success) {
      const url = resolveAvatarUrl(res.data.avatar_url);
      setAvatarUrl(url);
      onAvatarChanged(url);
    }
  }
  async function handleAvatarRemove() {
    setAvatarUploading(true);
    const res = await api.deleteAvatar();
    setAvatarUploading(false);
    if (res.success) { setAvatarUrl(null); onAvatarChanged(null); }
  }

  if (!session) return null;

  return (
    <ScrollView className="flex-1 bg-background px-4 pt-5" contentContainerStyle={{ paddingBottom: 32, gap: 16 }}>
      <Card padding="lg" className="bg-primary border-0 items-center">
        <View className="relative mb-3">
          <View className="w-24 h-24 rounded-full bg-white/15 items-center justify-center overflow-hidden">
            {avatarUploading ? <ActivityIndicator color={colors.primaryForeground} /> : avatarUrl ? (
              <Image source={{ uri: avatarUrl }} className="w-full h-full" />
            ) : (
              <Text className="text-primary-foreground font-black text-2xl">{session.avatarInitials}</Text>
            )}
          </View>
          <Pressable onPress={handleAvatarChange} disabled={avatarUploading} className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-card items-center justify-center">
            <Camera size={13} color={colors.foreground} />
          </Pressable>
          {avatarUrl && !avatarUploading && (
            <Pressable onPress={handleAvatarRemove} className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500 items-center justify-center">
              <X size={12} color="#fff" />
            </Pressable>
          )}
        </View>
        <Text className="text-xl font-bold text-primary-foreground">{displayName}</Text>
        <Badge variant="primary" className="mt-2 bg-white/15"><Text className="text-primary-foreground">{session.role}</Text></Badge>
        <Text className="text-xs text-primary-foreground mt-2">@{session.username}</Text>
      </Card>

      <Card padding="md">
        <Text className="text-sm font-semibold text-foreground mb-4">Informasi Akun</Text>
        <View className="flex-row items-center gap-3 py-3 border-b border-border">
          <View className="w-8 h-8 rounded-lg bg-muted items-center justify-center"><User size={18} color={colors.primary} /></View>
          <View className="flex-1">
            <Text className="text-xs text-muted-foreground">Nama Lengkap</Text>
            {editingName ? (
              <View className="flex-row items-center gap-2 mt-1">
                <Input value={nameDraft} onChangeText={setNameDraft} maxLength={100} autoFocus style={{ flex: 1 }} />
                <Pressable onPress={handleSaveName} disabled={nameSaving || !nameDraft.trim()} style={{ opacity: nameSaving || !nameDraft.trim() ? 0.5 : 1 }}>
                  <Check size={18} color={colors.primary} />
                </Pressable>
                <Pressable onPress={() => { setEditingName(false); setNameDraft(displayName); }}>
                  <X size={18} color={colors.mutedForeground} />
                </Pressable>
              </View>
            ) : (
              <Text numberOfLines={1} className="text-sm font-medium text-foreground">{displayName}</Text>
            )}
          </View>
          {isOrangTua && !editingName && (
            <Pressable onPress={() => setEditingName(true)}>
              <Pencil size={15} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
        {[
          { icon: <Shield size={18} color="#059669" />, label: "Role", value: session.role },
          { icon: <Mail size={18} color="#22c55e" />, label: "Email", value: email ?? "-" },
          { icon: <Phone size={18} color="#f59e0b" />, label: "Nomor HP", value: phone ?? "-" },
        ].map((item, idx, arr) => (
          <View key={idx} className={`flex-row items-center gap-3 py-3 ${idx !== arr.length - 1 ? "border-b border-border" : ""}`}>
            <View className="w-8 h-8 rounded-lg bg-muted items-center justify-center">{item.icon}</View>
            <View className="flex-1">
              <Text className="text-xs text-muted-foreground">{item.label}</Text>
              <Text numberOfLines={1} className="text-sm font-medium text-foreground">{item.value}</Text>
            </View>
          </View>
        ))}
      </Card>

      <Text className="text-xs font-semibold text-muted-foreground uppercase -mb-2 ml-1">Pengaturan</Text>

      <Card padding="md">
        <Text className="text-sm font-semibold text-foreground mb-3">Tampilan</Text>
        <Pressable onPress={toggleTheme} className="flex-row items-center gap-3 py-1">
          <View className="w-8 h-8 rounded-lg bg-emerald-50 items-center justify-center">
            {isDark ? <Moon size={16} color={colors.primary} /> : <Sun size={16} color={colors.primary} />}
          </View>
          <View className="flex-1">
            <Text className="text-sm font-medium text-foreground">Tema Aplikasi</Text>
            <Text className="text-xs text-muted-foreground">{isDark ? "Mode Gelap aktif" : "Mode Terang aktif"}</Text>
          </View>
          <View className={`w-10 h-6 rounded-full px-0.5 justify-center ${isDark ? "bg-primary" : "bg-muted"}`}>
            <View className={`w-5 h-5 rounded-full bg-white ${isDark ? "self-end" : "self-start"}`} />
          </View>
        </Pressable>
      </Card>

      <Card padding="md">
        <Text className="text-sm font-semibold text-foreground mb-1">Notifikasi</Text>
        <Text className="text-xs text-muted-foreground mb-3">Pilih jenis pemberitahuan yang ingin Anda terima.</Text>
        {notifPrefs ? (
          [
            { key: "notif_komentar", label: "Komentar", icon: <MessageCircle size={15} color="#0f766e" />, bg: "bg-teal-50" },
            { key: "notif_like", label: "Suka (Like)", icon: <Heart size={15} color="#ec4899" />, bg: "bg-pink-50" },
            { key: "notif_presensi", label: "Presensi", icon: <Clock size={15} color="#b45309" />, bg: "bg-amber-50" },
            { key: "notif_bayaran", label: "Bayaran", icon: <Wallet size={15} color="#16a34a" />, bg: "bg-green-50" },
            { key: "notif_tagihan", label: "Tagihan", icon: <Receipt size={15} color="#7c3aed" />, bg: "bg-purple-50" },
          ].map((item, idx, arr) => {
            const enabled = !!notifPrefs[item.key];
            return (
              <Pressable
                key={item.key}
                onPress={() => toggleNotifPref(item.key)}
                className={`flex-row items-center gap-3 py-2.5 ${idx !== arr.length - 1 ? "border-b border-border" : ""}`}
              >
                <View className={`w-8 h-8 rounded-lg ${item.bg} items-center justify-center`}>{item.icon}</View>
                <Text className="text-sm font-medium text-foreground flex-1">{item.label}</Text>
                <View className={`w-10 h-6 rounded-full px-0.5 justify-center ${enabled ? "bg-primary" : "bg-muted"}`}>
                  <View className={`w-5 h-5 rounded-full bg-white ${enabled ? "self-end" : "self-start"}`} />
                </View>
              </Pressable>
            );
          })
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </Card>

      {STAFF_ROLES.includes(role) && (
        <Card padding="md">
          <Text className="text-sm font-semibold text-foreground mb-3">Presensi</Text>
          <Pressable onPress={() => onNavigate("pengenalan-wajah")} className="flex-row items-center gap-3 py-1">
            <View className="w-8 h-8 rounded-lg bg-green-50 items-center justify-center"><ScanFace size={16} color="#16a34a" /></View>
            <Text className="text-sm font-medium text-foreground flex-1">Pengenalan Wajah</Text>
            <ChevronRight size={16} color={colors.mutedForeground} />
          </Pressable>
        </Card>
      )}

      <Text className="text-xs font-semibold text-muted-foreground uppercase -mb-2 ml-1">Akun & Keamanan</Text>

      <Card padding="md">
        <Text className="text-sm font-semibold text-foreground mb-3">Akun</Text>
        <Pressable onPress={onOpenSwitcher} className="flex-row items-center gap-3 py-1">
          <View className="w-8 h-8 rounded-lg bg-amber-50 items-center justify-center"><Users size={16} color="#D0AF68" /></View>
          <Text className="text-sm font-medium text-foreground flex-1">Ganti Akun</Text>
          <ChevronRight size={16} color={colors.mutedForeground} />
        </Pressable>
        {canUseDemoMode && (
          <Pressable onPress={onOpenDemoSwitcher} className="flex-row items-center gap-3 py-1 mt-2">
            <View className={`w-8 h-8 rounded-lg items-center justify-center ${demoActive ? "bg-amber-500" : "bg-amber-50"}`}>
              <FlaskConical size={16} color={demoActive ? "#fff" : "#D0AF68"} />
            </View>
            <Text className="text-sm font-medium text-foreground flex-1">Mode Demo</Text>
            <ChevronRight size={16} color={colors.mutedForeground} />
          </Pressable>
        )}
      </Card>

      <Card padding="md">
        <Text className="text-sm font-semibold text-foreground mb-3">Keamanan</Text>
        <Pressable onPress={() => onNavigate("ubah-password")} className="flex-row items-center gap-3 py-1">
          <View className="w-8 h-8 rounded-lg bg-purple-50 items-center justify-center"><Lock size={16} color="#7c3aed" /></View>
          <Text className="text-sm font-medium text-foreground flex-1">Ubah Kata Sandi</Text>
          <ChevronRight size={16} color={colors.mutedForeground} />
        </Pressable>
      </Card>

      {!showLogoutConfirm ? (
        <Button variant="outline" size="lg" onPress={() => setShowLogoutConfirm(true)} className="border-red-200">
          <LogOut size={18} color={colors.destructive} />{"  "}<Text className="text-destructive font-semibold">Keluar</Text>
        </Button>
      ) : (
        <Card padding="md" className="border border-red-200 bg-red-50">
          <Text className="text-sm font-semibold text-red-700 text-center mb-3">Yakin ingin keluar?</Text>
          <View className="flex-row gap-2">
            <Button variant="outline" className="flex-1" onPress={() => setShowLogoutConfirm(false)}>Batal</Button>
            <Button className="flex-1 bg-red-600" onPress={onLogout}>Keluar</Button>
          </View>
        </Card>
      )}

      <View className="items-center py-2">
        <Text className="text-xs text-muted-foreground">Layanan Digital Sekolah · v1.0.0</Text>
        <Text className="text-xs text-muted-foreground">© 2026 All rights reserved</Text>
      </View>
    </ScrollView>
  );
}

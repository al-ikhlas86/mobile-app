import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TextInput, Pressable, ActivityIndicator } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Phone, Plus, Trash2, X, Link2, UserX, AlertTriangle } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { SimplePicker } from "../ui/SimplePicker";
import { api, ROLE_MAP } from "../../services/api";
import { getActiveSession } from "../../services/authService";
import { useThemeColors } from "../../context/ThemeContext";

interface AdminUser { id: number; username: string; phone: string | null; full_name: string; role: string; is_active: 0 | 1; employee_cache_id: number | null; }
interface AccountLinkReview { id: number; nama: string; jabatan: string | null; role: string; phone: string; existing_full_name: string; existing_phone: string | null; status: string; }

// kepala_sekolah_sd/tk DIKELUARKAN dari daftar ini 2026-09-04 - sekarang
// jabatan asli di Data Master (spt guru_kelas), auto-provisioning penuh,
// TIDAK LAGI bisa di-assign manual admin_it lewat layar ini (lihat
// accountProvision.js resolveRoleFromJabatan() di repo backend).
// SUMBER KEBENARAN: backend/src/utils/roles.js (ASSIGNABLE_ROLES) di repo
// mobile-app. Native tidak bisa import langsung dari situ (repo/bundler
// terpisah) - kalau daftar ini berubah, update JUGA salinan di webview
// (src/app/components/screens/ManajemenPenggunaScreen.tsx).
const ASSIGNABLE_ROLES = ["admin_it", "supervisor", "admin_tu_sd", "admin_media_sd", "admin_tu_tk", "admin_media_tk", "keuangan"];
const ROLE_OPTIONS = ASSIGNABLE_ROLES.map((r) => ({ value: r, label: ROLE_MAP[r] ?? r }));
function initials(name: string) { return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join(""); }

export function ManajemenPenggunaScreen() {
  const colors = useThemeColors();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [reviews, setReviews] = useState<AccountLinkReview[]>([]);
  const [reviewBusyId, setReviewBusyId] = useState<number | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newRole, setNewRole] = useState(ASSIGNABLE_ROLES[0]);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState("");
  const currentUserId = Number(getActiveSession()?.accountId?.replace(/^USR/, "")) || null;

  const load = async () => {
    setLoading(true); setError("");
    const res = await api.adminUsers();
    setLoading(false);
    if (res.success) setUsers(res.data); else setError(res.message ?? "Gagal memuat daftar pengguna.");
  };
  const loadReviews = async () => { const res = await api.adminAccountLinkReviews(); if (res.success) setReviews(res.data.pending); };
  useEffect(() => { load(); loadReviews(); }, []);

  const handleLinkReview = async (id: number) => {
    setReviewBusyId(id);
    const res = await api.adminLinkAccountReview(id);
    setReviewBusyId(null);
    if (res.success) setReviews((prev) => prev.filter((r) => r.id !== id)); else setError(res.message ?? "Gagal menautkan akun.");
  };
  const handleRejectReview = async (id: number) => {
    setReviewBusyId(id);
    const res = await api.adminRejectAccountReview(id);
    setReviewBusyId(null);
    if (res.success) setReviews((prev) => prev.filter((r) => r.id !== id)); else setError(res.message ?? "Gagal menolak tautan.");
  };
  const handleChangeRole = async (userId: number, role: string) => {
    setSavingId(userId);
    const res = await api.adminUpdateUser(userId, { role });
    setSavingId(null);
    if (res.success) setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u))); else setError(res.message ?? "Gagal mengubah role.");
  };
  const handleDelete = async (userId: number) => {
    if (confirmDeleteId !== userId) { setConfirmDeleteId(userId); return; }
    setConfirmDeleteId(null);
    const res = await api.adminDeleteUser(userId);
    if (res.success) setUsers((prev) => prev.filter((u) => u.id !== userId)); else setError(res.message ?? "Gagal menghapus akun.");
  };
  const resetAddForm = () => { setNewUsername(""); setNewPassword(""); setNewFullName(""); setNewRole(ASSIGNABLE_ROLES[0]); setAddError(""); setShowAddForm(false); };
  const handleAdd = async () => {
    if (!newUsername.trim() || !newPassword || !newFullName.trim()) { setAddError("Username, password, dan nama wajib diisi."); return; }
    setAddSaving(true); setAddError("");
    const res = await api.adminCreateUser({ username: newUsername.trim(), password: newPassword, full_name: newFullName.trim(), role: newRole });
    setAddSaving(false);
    if (res.success) { setUsers((prev) => [...prev, res.data].sort((a, b) => a.full_name.localeCompare(b.full_name))); resetAddForm(); }
    else setAddError(res.message ?? "Gagal menambah akun.");
  };

  if (loading) return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator color={colors.primary} /></View>;

  return (
    <KeyboardAwareScrollView className="flex-1 bg-background px-4 pt-5" contentContainerStyle={{ paddingBottom: 32, gap: 16 }} bottomOffset={20}>
      <Text className="text-xs text-muted-foreground">
        Halaman ini khusus akun administratif (Admin IT, Supervisor, Admin TU, Admin Media, Keuangan). Akun Guru/Guru
        Kelas/Pegawai/Orang Tua tidak tampil di sini - role-nya sudah otomatis benar dari data sekolah.
      </Text>
      {error ? <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3"><Text className="text-sm text-red-600">{error}</Text></View> : null}

      {reviews.length > 0 && (
        <Card padding="md">
          <View className="flex-row items-center gap-2 mb-1"><AlertTriangle size={16} color="#f59e0b" /><Text className="text-sm font-semibold text-foreground">Tinjau Akun Ganda ({reviews.length})</Text></View>
          <Text className="text-xs text-muted-foreground mb-3">Terdeteksi no HP yang sama dipakai pegawai lain dengan peran yang sama persis - pastikan dulu sebelum menautkan.</Text>
          <View className="gap-2.5">
            {reviews.map((r) => (
              <View key={r.id} className="border border-border rounded-xl p-3">
                <Text className="text-sm text-foreground"><Text className="font-semibold">{r.nama}</Text> ({r.jabatan ?? ROLE_MAP[r.role] ?? r.role}) — no HP {r.phone}</Text>
                <Text className="text-xs text-muted-foreground mt-0.5">Bentrok dengan akun yang sudah ada: <Text className="font-medium">{r.existing_full_name}</Text> ({r.existing_phone ?? "-"})</Text>
                <View className="flex-row gap-3 mt-2">
                  <Pressable onPress={() => handleLinkReview(r.id)} disabled={reviewBusyId === r.id} className="flex-row items-center gap-1.5"><Link2 size={12} color={colors.primary} /><Text className="text-xs font-medium text-primary">Ya, Orang yang Sama - Tautkan</Text></Pressable>
                  <Pressable onPress={() => handleRejectReview(r.id)} disabled={reviewBusyId === r.id} className="flex-row items-center gap-1.5"><UserX size={12} color={colors.mutedForeground} /><Text className="text-xs font-medium text-muted-foreground">Bukan, Tolak</Text></Pressable>
                </View>
              </View>
            ))}
          </View>
        </Card>
      )}

      {!showAddForm ? (
        <Button variant="outline" onPress={() => setShowAddForm(true)}><Plus size={16} color={colors.primary} />{"  "}Tambah Akun</Button>
      ) : (
        <Card padding="md">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-sm font-semibold text-foreground">Tambah Akun Baru</Text>
            <Pressable onPress={resetAddForm}><X size={16} color={colors.mutedForeground} /></Pressable>
          </View>
          <View className="gap-2.5">
            <TextInput value={newFullName} onChangeText={setNewFullName} placeholder="Nama lengkap" className="bg-input-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground" />
            <TextInput value={newUsername} onChangeText={setNewUsername} placeholder="Username (bebas, mis. yai86)" autoCapitalize="none" className="bg-input-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground" />
            <TextInput value={newPassword} onChangeText={setNewPassword} placeholder="Password (minimal 6 karakter)" secureTextEntry autoCapitalize="none" className="bg-input-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground" />
            <SimplePicker value={newRole} options={ROLE_OPTIONS} onChange={setNewRole} />
            {addError ? <Text className="text-xs text-red-500">{addError}</Text> : null}
            <Button onPress={handleAdd} loading={addSaving} fullWidth>{addSaving ? "Menyimpan..." : "Simpan Akun"}</Button>
          </View>
        </Card>
      )}

      {users.length === 0 && !error ? <Text className="text-sm text-muted-foreground text-center py-8">Belum ada akun pegawai.</Text> : null}

      {users.map((u) => (
        <Card key={u.id} padding="md">
          <View className="flex-row items-center gap-3">
            <View className={`w-10 h-10 rounded-full items-center justify-center ${u.is_active ? "bg-primary" : "bg-muted"}`}>
              <Text className={`text-sm font-bold ${u.is_active ? "text-white" : "text-muted-foreground"}`}>{initials(u.full_name)}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-foreground">{u.full_name}</Text>
              <View className="flex-row items-center gap-1"><Phone size={11} color={colors.mutedForeground} /><Text className="text-xs text-muted-foreground">{u.phone ?? u.username}</Text></View>
            </View>
            {!u.is_active && <Badge variant="muted">Nonaktif</Badge>}
            {u.id === currentUserId ? (
              <Text className="text-[10px] text-muted-foreground px-1.5">Ini kamu</Text>
            ) : (
              <Pressable onPress={() => handleDelete(u.id)} className={`p-1.5 rounded-full ${confirmDeleteId === u.id ? "bg-red-100" : ""}`}>
                <Trash2 size={15} color={confirmDeleteId === u.id ? "#ef4444" : colors.mutedForeground} />
              </Pressable>
            )}
          </View>
          {confirmDeleteId === u.id && (
            <Text className="text-xs text-red-500 mt-1">{u.employee_cache_id ? "Akun ini tertaut pegawai aktif - akan dibuat ulang otomatis saat sync berikutnya. " : ""}Ketuk ikon hapus sekali lagi untuk konfirmasi.</Text>
          )}
          <View className="mt-3">
            {savingId === u.id ? (
              <View className="px-3 py-2.5 rounded-xl bg-muted"><Text className="text-sm text-muted-foreground">Menyimpan...</Text></View>
            ) : (
              <SimplePicker value={u.role} options={ROLE_OPTIONS} onChange={(role) => handleChangeRole(u.id, role)} />
            )}
          </View>
        </Card>
      ))}
    </KeyboardAwareScrollView>
  );
}

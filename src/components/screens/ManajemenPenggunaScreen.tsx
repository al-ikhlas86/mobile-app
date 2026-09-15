import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Phone, Plus, Trash2, X, Link2, UserX, AlertTriangle, Users2, ChevronRight, BookOpen, Shield, Check } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { SimplePicker } from "../ui/SimplePicker";
import { api, ROLE_MAP } from "../../services/api";
import { getActiveSession } from "../../services/authService";
import { useThemeColors } from "../../context/ThemeContext";

interface Props { onNavigate: (screen: string, params?: Record<string, unknown>) => void; }
interface AdminUser { id: number; username: string; phone: string | null; full_name: string; role: string; is_active: 0 | 1; employee_cache_id: number | null; }
interface AccountLinkReview { id: number; nama: string; jabatan: string | null; role: string; phone: string; existing_full_name: string; existing_phone: string | null; status: string; }
interface Catalog { id: number; kode: string; nama: string; }
interface RoleDefinition { id: number; role_type: string; label: string; catalogs: Catalog[]; }

// CREATABLE_ROLES - satu2nya role yang bisa dibuat BARU (POST) atau di-SET
// ke akun yang sudah ada (PATCH .../role) lewat layar ini - cuma admin_it.
// Sistem Katalog (2026-09-14) - DIPERKETAT dari versi 2026-09-07: dulu
// picker "ganti role" akun yg SUDAH ADA masih pakai ASSIGNABLE_ROLES penuh
// (7 nilai) sengaja TIDAK dipersempit "biar tidak merusak akun yg sudah
// ada". SEKARANG backend (routes/admin.js) MENOLAK keras (400) percobaan
// set role manapun selain admin_it lewat endpoint ini - keputusan EKSPLISIT
// user: supervisor/keuangan/admin_tu/admin_media TIDAK BOLEH LAGI jadi akun
// standalone BARU dengan cara apa pun, keempatnya MURNI capability yang
// ditempel ke akun yang sudah ada lewat Kapasitas Tambahan. Picker "ganti
// role" di bawah ikut dipersempit ke CREATABLE_ROLES supaya tidak
// menampilkan opsi yang PASTI ditolak server - akun standalone LAMA yang
// masih py salah satu dari 4 role itu (grandfathered) tetap jalan normal
// tanpa disentuh, cuma tidak bisa lagi "dipindah role" ke situ dari sini.
// SUMBER KEBENARAN: backend/src/utils/roles.js. Webview & native tidak bisa
// import langsung dari backend (repo/bundler terpisah) - kalau daftar ini
// berubah, update JUGA salinan di webview
// (src/app/components/screens/ManajemenPenggunaScreen.tsx).
const CREATABLE_ROLES = ["admin_it"];
const CREATABLE_ROLE_OPTIONS = CREATABLE_ROLES.map((r) => ({ value: r, label: ROLE_MAP[r] ?? r }));

// Role Definitions (2026-09-15) - 4 role dasar yg BISA didaftarkan sbg
// kombinasi Role+Katalog di tab "Tambah Role" - pola sama KapasitasTambahanScreen.tsx.
const ROLE_TYPE_OPTIONS = ["admin_tu", "admin_media", "keuangan", "supervisor"];
const ROLE_TYPE_SELECT_OPTIONS = ROLE_TYPE_OPTIONS.map((r) => ({ value: r, label: ROLE_MAP[r] ?? r }));

type Tab = "Akun Admin" | "Kelola Katalog" | "Tambah Role";
const TABS: Tab[] = ["Akun Admin", "Kelola Katalog", "Tambah Role"];

function initials(name: string) { return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join(""); }

export function ManajemenPenggunaScreen({ onNavigate }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [tab, setTab] = useState<Tab>("Akun Admin");
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
  const [newRole, setNewRole] = useState(CREATABLE_ROLES[0]);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState("");
  const currentUserId = Number(getActiveSession()?.accountId?.replace(/^USR/, "")) || null;

  // Kelola Katalog (2026-09-14, Sistem Katalog) - satu2nya tempat Admin IT
  // mendaftarkan unit sekolah baru (SD/TK/dst) - PENGGANTI env var
  // UNIT_SCOPE_MAP lama (diisi manual lewat SSH developer).
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [showAddCatalog, setShowAddCatalog] = useState(false);
  const [newCatalogKode, setNewCatalogKode] = useState("");
  const [newCatalogNama, setNewCatalogNama] = useState("");
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  // Edit/Hapus katalog (2026-09-15, diminta user - pil katalog sebelumnya
  // MURNI tampilan, tidak bisa di-tap sama sekali).
  const [editingCatalogId, setEditingCatalogId] = useState<number | null>(null);
  const [editCatalogKode, setEditCatalogKode] = useState("");
  const [editCatalogNama, setEditCatalogNama] = useState("");
  const [editCatalogError, setEditCatalogError] = useState("");
  const [catalogBusyId, setCatalogBusyId] = useState<number | null>(null);

  // Tambah Role / Role Definitions (2026-09-15) - PENDAFTARAN eksplisit
  // kombinasi Role+Katalog SEBELUM bisa dipakai di Kapasitas Tambahan
  // (diminta user: "jangan tiba-tiba ada", pola sama persis Kelola Katalog).
  // Bisa ada TANPA orang dulu (slot kosong) - Kapasitas Tambahan nanti
  // MEMILIH dari definisi yang sudah terdaftar di sini.
  const [roleDefinitions, setRoleDefinitions] = useState<RoleDefinition[]>([]);
  const [newRoleType, setNewRoleType] = useState(ROLE_TYPE_OPTIONS[0]);
  const [newRoleCatalogIds, setNewRoleCatalogIds] = useState<number[]>([]);
  const [newRoleLabel, setNewRoleLabel] = useState("");
  const [roleDefSaving, setRoleDefSaving] = useState(false);
  const [roleDefError, setRoleDefError] = useState("");
  const [roleDefBusyId, setRoleDefBusyId] = useState<number | null>(null);

  const loadCatalogs = async () => {
    const res = await api.adminCatalogs();
    if (res.success) setCatalogs(res.data);
  };

  const loadRoleDefinitions = async () => {
    const res = await api.adminRoleDefinitions();
    if (res.success) setRoleDefinitions(res.data);
  };

  const handleAddCatalog = async () => {
    if (!newCatalogKode.trim() || !newCatalogNama.trim()) {
      setCatalogError("Kode dan nama katalog wajib diisi.");
      return;
    }
    setCatalogSaving(true); setCatalogError("");
    const res = await api.adminCreateCatalog({ kode: newCatalogKode.trim(), nama: newCatalogNama.trim() });
    setCatalogSaving(false);
    if (res.success) {
      setCatalogs((prev) => [...prev, res.data].sort((a, b) => a.nama.localeCompare(b.nama)));
      setNewCatalogKode(""); setNewCatalogNama(""); setShowAddCatalog(false);
    } else {
      setCatalogError(res.message ?? "Gagal membuat katalog.");
    }
  };

  const openEditCatalog = (c: Catalog) => {
    setEditingCatalogId(c.id);
    setEditCatalogKode(c.kode);
    setEditCatalogNama(c.nama);
    setEditCatalogError("");
  };

  const handleUpdateCatalog = async (id: number) => {
    if (!editCatalogKode.trim() || !editCatalogNama.trim()) {
      setEditCatalogError("Kode dan nama katalog wajib diisi.");
      return;
    }
    setCatalogBusyId(id); setEditCatalogError("");
    const res = await api.adminUpdateCatalog(id, { kode: editCatalogKode.trim(), nama: editCatalogNama.trim() });
    setCatalogBusyId(null);
    if (res.success) {
      setCatalogs((prev) => prev.map((c) => (c.id === id ? { ...c, kode: editCatalogKode.trim(), nama: editCatalogNama.trim() } : c)).sort((a, b) => a.nama.localeCompare(b.nama)));
      setEditingCatalogId(null);
    } else {
      setEditCatalogError(res.message ?? "Gagal menyimpan perubahan.");
    }
  };

  const handleDeleteCatalog = (c: Catalog) => {
    Alert.alert("Hapus Katalog", `Hapus katalog "${c.nama}"? Cuma bisa dihapus kalau tidak ada unit/orang yang masih terhubung ke sini.`, [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          setCatalogBusyId(c.id);
          const res = await api.adminDeleteCatalog(c.id);
          setCatalogBusyId(null);
          if (res.success) {
            setCatalogs((prev) => prev.filter((x) => x.id !== c.id));
            setEditingCatalogId(null);
          } else {
            Alert.alert("Gagal", res.message ?? "Gagal menghapus katalog.");
          }
        },
      },
    ]);
  };

  const toggleNewRoleCatalog = (id: number) => {
    setNewRoleCatalogIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleCreateRoleDefinition = async () => {
    if (newRoleCatalogIds.length === 0) {
      setRoleDefError("Pilih minimal 1 katalog.");
      return;
    }
    setRoleDefSaving(true); setRoleDefError("");
    const res = await api.adminCreateRoleDefinition({
      roleType: newRoleType,
      catalogIds: newRoleCatalogIds,
      label: newRoleLabel.trim() || undefined,
    });
    setRoleDefSaving(false);
    if (res.success) {
      loadRoleDefinitions();
      setNewRoleCatalogIds([]);
      setNewRoleLabel("");
    } else {
      setRoleDefError(res.message ?? "Gagal membuat role.");
    }
  };

  const handleDeleteRoleDefinition = (def: RoleDefinition) => {
    Alert.alert("Hapus Role", `Hapus role "${def.label}"? Cuma bisa dihapus kalau tidak ada orang yang masih memegangnya.`, [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          setRoleDefBusyId(def.id);
          const res = await api.adminDeleteRoleDefinition(def.id);
          setRoleDefBusyId(null);
          if (res.success) {
            setRoleDefinitions((prev) => prev.filter((d) => d.id !== def.id));
          } else {
            Alert.alert("Gagal", res.message ?? "Gagal menghapus role.");
          }
        },
      },
    ]);
  };

  const load = async () => {
    setLoading(true); setError("");
    const res = await api.adminUsers();
    setLoading(false);
    if (res.success) setUsers(res.data); else setError(res.message ?? "Gagal memuat daftar pengguna.");
  };
  const loadReviews = async () => { const res = await api.adminAccountLinkReviews(); if (res.success) setReviews(res.data.pending); };
  useEffect(() => { load(); loadReviews(); loadCatalogs(); loadRoleDefinitions(); }, []);

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
  const resetAddForm = () => { setNewUsername(""); setNewPassword(""); setNewFullName(""); setNewRole(CREATABLE_ROLES[0]); setAddError(""); setShowAddForm(false); };
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
    <KeyboardAwareScrollView className="flex-1 bg-background px-4 pt-5" contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 16 }} bottomOffset={20}>
      <View className="flex-row gap-2 p-1 bg-muted rounded-xl">
        {TABS.map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} className={`flex-1 py-2 rounded-lg items-center ${tab === t ? "bg-card" : ""}`}>
            <Text className={`text-sm font-medium ${tab === t ? "text-foreground" : "text-muted-foreground"}`}>{t}</Text>
          </Pressable>
        ))}
      </View>

      {error ? <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3"><Text className="text-sm text-red-600">{error}</Text></View> : null}

      {tab === "Akun Admin" && (
        <>
          <Text className="text-xs text-muted-foreground">
            Halaman ini khusus akun administratif MANDIRI. Akun Guru/Pegawai/Orang Tua tidak tampil di
            sini. Akun baru yang bisa dibuat di sini cuma Admin IT - peran lain (Supervisor, Admin TU, Admin
            Media, Keuangan) ditempelkan ke guru/pegawai yang sudah ada lewat menu Kapasitas Tambahan, bukan
            dibuat sebagai akun baru di sini.
          </Text>

          <Pressable onPress={() => onNavigate("kapasitas-tambahan")} className="flex-row items-center gap-3 bg-primary/10 border border-primary/30 rounded-xl px-4 py-3">
            <Users2 size={18} color={colors.primary} />
            <View className="flex-1">
              <Text className="text-sm font-semibold text-foreground">Kapasitas Tambahan</Text>
              <Text className="text-xs text-muted-foreground">Tempelkan Admin TU/Media/Keuangan/Supervisor ke guru/pegawai yang sudah ada</Text>
            </View>
            <ChevronRight size={16} color={colors.mutedForeground} />
          </Pressable>

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
                {CREATABLE_ROLE_OPTIONS.length > 1 ? (
                  <SimplePicker value={newRole} options={CREATABLE_ROLE_OPTIONS} onChange={setNewRole} />
                ) : (
                  <Text className="text-xs text-muted-foreground px-1">
                    Peran: <Text className="font-medium text-foreground">{ROLE_MAP[CREATABLE_ROLES[0]] ?? CREATABLE_ROLES[0]}</Text>.
                    Peran lain (Admin TU/Media/Keuangan/Supervisor) ditempelkan lewat menu Kapasitas Tambahan ke guru/pegawai yang sudah ada, bukan dibuat baru di sini.
                  </Text>
                )}
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
                  <SimplePicker
                    value={u.role}
                    options={CREATABLE_ROLE_OPTIONS.some((o) => o.value === u.role) ? CREATABLE_ROLE_OPTIONS : [{ value: u.role, label: ROLE_MAP[u.role] ?? u.role }, ...CREATABLE_ROLE_OPTIONS]}
                    onChange={(role) => { if (role !== u.role) handleChangeRole(u.id, role); }}
                  />
                )}
              </View>
            </Card>
          ))}
        </>
      )}

      {tab === "Kelola Katalog" && (
        <Card padding="md">
          <View className="flex-row items-center gap-2 mb-1">
            <BookOpen size={16} color={colors.primary} />
            <Text className="text-sm font-semibold text-foreground">Kelola Katalog ({catalogs.length})</Text>
          </View>
          <Text className="text-xs text-muted-foreground mb-3">
            Daftar unit sekolah (SD/TK/dst). Tambah katalog baru di sini kalau ada jenjang baru (mis. SMP) -
            setelahnya baru bisa dipilih saat menyetujui sinkronisasi unit baru & saat mendaftarkan Role di tab
            "Tambah Role". Ketuk salah satu utk ubah nama/kode atau hapus.
          </Text>
          {catalogs.length > 0 && (
            <View className="flex-row flex-wrap gap-1.5 mb-3">
              {catalogs.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => (editingCatalogId === c.id ? setEditingCatalogId(null) : openEditCatalog(c))}
                  className={`px-2.5 py-1 rounded-full ${editingCatalogId === c.id ? "bg-primary" : "bg-muted"}`}
                >
                  <Text className={`text-xs font-medium ${editingCatalogId === c.id ? "text-white" : "text-foreground"}`}>{c.nama}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {editingCatalogId !== null && (
            <View className="gap-2 mb-3 bg-muted/50 rounded-xl p-3 border border-border">
              <View className="flex-row gap-2">
                <TextInput
                  value={editCatalogKode}
                  onChangeText={setEditCatalogKode}
                  placeholder="Kode"
                  maxLength={20}
                  className="w-28 bg-input-background border border-border rounded-xl px-3 py-2 text-sm text-foreground"
                />
                <TextInput
                  value={editCatalogNama}
                  onChangeText={setEditCatalogNama}
                  placeholder="Nama tampilan"
                  maxLength={100}
                  className="flex-1 bg-input-background border border-border rounded-xl px-3 py-2 text-sm text-foreground"
                />
              </View>
              {editCatalogError ? <Text className="text-xs text-red-500">{editCatalogError}</Text> : null}
              <View className="flex-row gap-2">
                <Button size="sm" onPress={() => handleUpdateCatalog(editingCatalogId)} loading={catalogBusyId === editingCatalogId}>Simpan</Button>
                <Button size="sm" variant="destructive" onPress={() => handleDeleteCatalog(catalogs.find((c) => c.id === editingCatalogId)!)} disabled={catalogBusyId === editingCatalogId}>
                  <Trash2 size={14} color="#fff" />{"  "}Hapus
                </Button>
                <Button size="sm" variant="outline" onPress={() => setEditingCatalogId(null)}>Batal</Button>
              </View>
            </View>
          )}
          {!showAddCatalog ? (
            <Button variant="outline" size="sm" onPress={() => setShowAddCatalog(true)}>
              <Plus size={14} color={colors.primary} />{"  "}Tambah Katalog
            </Button>
          ) : (
            <View className="gap-2">
              <View className="flex-row gap-2">
                <TextInput
                  value={newCatalogKode}
                  onChangeText={setNewCatalogKode}
                  placeholder="Kode (mis. SMP)"
                  autoCapitalize="characters"
                  maxLength={20}
                  className="w-28 bg-input-background border border-border rounded-xl px-3 py-2 text-sm text-foreground"
                />
                <TextInput
                  value={newCatalogNama}
                  onChangeText={setNewCatalogNama}
                  placeholder="Nama tampilan (mis. SMP Al-Ikhlas 86)"
                  maxLength={100}
                  className="flex-1 bg-input-background border border-border rounded-xl px-3 py-2 text-sm text-foreground"
                />
              </View>
              {catalogError ? <Text className="text-xs text-red-500">{catalogError}</Text> : null}
              <View className="flex-row gap-2">
                <Button size="sm" onPress={handleAddCatalog} loading={catalogSaving}>Simpan</Button>
                <Button size="sm" variant="outline" onPress={() => { setShowAddCatalog(false); setNewCatalogKode(""); setNewCatalogNama(""); setCatalogError(""); }}>Batal</Button>
              </View>
            </View>
          )}
        </Card>
      )}

      {tab === "Tambah Role" && (
        <Card padding="md">
          <View className="flex-row items-center gap-2 mb-1">
            <Shield size={16} color={colors.primary} />
            <Text className="text-sm font-semibold text-foreground">Tambah Role ({roleDefinitions.length})</Text>
          </View>
          <Text className="text-xs text-muted-foreground mb-3">
            Daftarkan dulu kombinasi Role+Katalog di sini (mis. "Media - SD", "Keuangan - SD & TK") - baru
            SETELAH itu bisa dipilih & ditempelkan ke orang lewat menu Kapasitas Tambahan. 1 role bisa mengapit
            lebih dari 1 katalog sekaligus, atau bikin role terpisah per katalog.
          </Text>

          {roleDefinitions.length > 0 && (
            <View className="gap-2 mb-4">
              {roleDefinitions.map((def) => (
                <View key={def.id} className="flex-row items-center gap-3 border border-border rounded-xl p-3">
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-foreground">{def.label}</Text>
                    <View className="flex-row flex-wrap gap-1 mt-1">
                      <View className="bg-primary/10 px-2 py-0.5 rounded-full"><Text className="text-[10px] font-medium text-primary">{ROLE_MAP[def.role_type] ?? def.role_type}</Text></View>
                      {def.catalogs.map((c) => (
                        <View key={c.id} className="bg-muted px-2 py-0.5 rounded-full"><Text className="text-[10px] font-medium text-foreground">{c.kode}</Text></View>
                      ))}
                    </View>
                  </View>
                  <Pressable onPress={() => handleDeleteRoleDefinition(def)} disabled={roleDefBusyId === def.id} className="p-1.5 rounded-full">
                    <Trash2 size={15} color={colors.mutedForeground} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <View className="gap-2.5 border-t border-border pt-4">
            <Text className="text-xs font-semibold text-foreground">Buat Role Baru</Text>
            <SimplePicker value={newRoleType} options={ROLE_TYPE_SELECT_OPTIONS} onChange={setNewRoleType} />

            <View>
              <Text className="text-xs font-medium text-muted-foreground mb-1.5">Katalog (pilih 1 atau lebih)</Text>
              {catalogs.length === 0 ? (
                <Text className="text-xs text-amber-600">Belum ada katalog terdaftar - buat dulu lewat tab "Kelola Katalog".</Text>
              ) : (
                <View className="flex-row flex-wrap gap-1.5">
                  {catalogs.map((c) => {
                    const checked = newRoleCatalogIds.includes(c.id);
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() => toggleNewRoleCatalog(c.id)}
                        className={`flex-row items-center px-2.5 py-1.5 rounded-full border ${checked ? "bg-primary border-primary" : "bg-transparent border-border"}`}
                      >
                        {checked && <Check size={11} color="#fff" style={{ marginRight: 4 }} />}
                        <Text className={`text-xs font-medium ${checked ? "text-white" : "text-foreground"}`}>{c.nama}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            <TextInput
              value={newRoleLabel}
              onChangeText={setNewRoleLabel}
              placeholder="Label (opsional, mis. 'Media - SD' - kosongkan utk otomatis)"
              maxLength={150}
              className="bg-input-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground"
            />
            {roleDefError ? <Text className="text-xs text-red-500">{roleDefError}</Text> : null}
            <Button onPress={handleCreateRoleDefinition} loading={roleDefSaving} disabled={catalogs.length === 0}>
              <Plus size={14} color={colors.primaryForeground} />{"  "}Buat Role
            </Button>
          </View>
        </Card>
      )}
    </KeyboardAwareScrollView>
  );
}

// ============================================================
// BERITA ACARA ADMIN — port native. Upload gambar pakai expo-image-picker
// (galeri HP), bukan <input type=file> web. Select kategori/unit pakai
// SimplePicker (RN tidak punya <select>).
// ============================================================
import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TextInput, Pressable, Image, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Plus, Edit2, Trash2, Eye, Upload, CheckCircle, ImageIcon, Send, Save, ArrowLeft, X, Link2 } from "lucide-react-native";
import { api, resolveAvatarUrl } from "../../services/api";
import { getTodayLocal } from "../../utils/formatters";
import { SimplePicker } from "../ui/SimplePicker";
import type { RoleName } from "../../services/authService";
import { useThemeColors } from "../../context/ThemeContext";

type AdminView = "list" | "form";
type Status = "draft" | "terkirim" | "disetujui";
interface Media { id: number; media_type: "thumbnail" | "activity"; filename: string; url: string; }
interface LinkItem { id: number; url: string; }
interface BeritaItem {
  id: number; title: string; category: string | null; description: string | null; author_name: string | null;
  activity_date: string | null; unit_scope: string; status: Status; created_by_name: string; created_at: string;
  approved_at: string | null; media: Media[]; links: LinkItem[];
}

const CATEGORIES = ["Kegiatan Sekolah", "Prestasi", "Pengumuman", "Pendidikan", "Olahraga", "Seni & Budaya", "Lainnya"];
const CATEGORY_OPTIONS = CATEGORIES.map((c) => ({ value: c, label: c }));
const ALL_UNIT_SCOPES = [{ value: "SD", label: "SD Al-Ikhlas 86" }, { value: "TK_PLAYGROUND", label: "TK & Playground" }, { value: "ALL", label: "Semua Unit" }];

function unitScopesFor(role?: RoleName) {
  if (role === "Admin Media (SD)") return ALL_UNIT_SCOPES.filter((u) => u.value !== "TK_PLAYGROUND");
  if (role === "Admin Media (TK & Playground)") return ALL_UNIT_SCOPES.filter((u) => u.value !== "SD");
  return ALL_UNIT_SCOPES;
}
function StatusBadge({ status }: { status: Status }) {
  const cfg = { disetujui: { label: "Terbit", bg: "bg-green-100", text: "text-green-700" }, draft: { label: "Draft", bg: "bg-amber-100", text: "text-amber-700" }, terkirim: { label: "Terkirim", bg: "bg-emerald-100", text: "text-emerald-800" } }[status];
  return <View className={`px-2 py-0.5 rounded-full ${cfg.bg}`}><Text className={`text-xs font-medium ${cfg.text}`}>{cfg.label}</Text></View>;
}
function formatDate(iso: string) { return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }); }
function mediaUrl(m: Media) { return resolveAvatarUrl(m.url) ?? undefined; }

export function BeritaAcaraAdmin({ onNavigate, role }: { onNavigate: (screen: string, params?: Record<string, unknown>) => void; role?: RoleName }) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const unitScopes = unitScopesFor(role);
  const [view, setView] = useState<AdminView>("list");
  const [items, setItems] = useState<BeritaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingMedia, setEditingMedia] = useState<Media[]>([]);
  const [editingLinks, setEditingLinks] = useState<LinkItem[]>([]);
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [linkSaving, setLinkSaving] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formAuthorName, setFormAuthorName] = useState("");
  const [formCategory, setFormCategory] = useState(CATEGORIES[0]);
  const [formUnitScope, setFormUnitScope] = useState("ALL");
  const [formActivityDate, setFormActivityDate] = useState(getTodayLocal());
  const [formSaving, setFormSaving] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [uploadingActivity, setUploadingActivity] = useState(false);

  const load = async () => { setLoading(true); const res = await api.beritaAcaraList(); if (res.success) setItems(res.data); setLoading(false); };
  useEffect(() => { load(); }, []);

  function resetForm() {
    setEditingId(null); setEditingMedia([]); setEditingLinks([]); setNewLinkUrl("");
    setFormTitle(""); setFormDescription(""); setFormAuthorName("");
    setFormCategory(CATEGORIES[0]); setFormUnitScope("ALL");
    setFormActivityDate(getTodayLocal()); setFormMessage("");
  }
  function openCreate() { resetForm(); setView("form"); }
  function openEdit(item: BeritaItem) {
    setEditingId(item.id); setEditingMedia(item.media); setEditingLinks(item.links); setNewLinkUrl("");
    setFormTitle(item.title); setFormDescription(item.description ?? ""); setFormAuthorName(item.author_name ?? "");
    setFormCategory(item.category ?? CATEGORIES[0]); setFormUnitScope(item.unit_scope);
    setFormActivityDate(item.activity_date ?? getTodayLocal());
    setFormMessage(""); setView("form");
  }

  async function saveOrCreate(): Promise<number | null> {
    if (!formTitle.trim()) { setFormMessage("Isi judul dulu."); return null; }
    setFormSaving(true); setFormMessage("");
    const payload = { title: formTitle.trim(), category: formCategory, description: formDescription, author_name: formAuthorName.trim(), activity_date: formActivityDate, unit_scope: formUnitScope };
    const res = editingId ? await api.beritaAcaraUpdate(editingId, payload) : await api.beritaAcaraCreate(payload);
    setFormSaving(false);
    if (!res.success) { setFormMessage(res.message ?? "Gagal menyimpan."); return null; }
    const id = editingId ?? res.data.id;
    if (!editingId) setEditingId(id);
    load();
    return id;
  }
  async function handleSaveDraft() { const id = await saveOrCreate(); if (id) setFormMessage("Draf tersimpan."); }
  async function handlePublish() {
    const id = await saveOrCreate();
    if (!id) return;
    setFormSaving(true);
    const res = await api.beritaAcaraPublish(id);
    setFormSaving(false);
    if (res.success) { await load(); setView("list"); } else setFormMessage(res.message ?? "Gagal menerbitkan.");
  }
  async function handlePublishFromList(id: number) { const res = await api.beritaAcaraPublish(id); if (res.success) load(); }
  async function handleDelete(id: number) {
    if (confirmDeleteId !== id) { setConfirmDeleteId(id); return; }
    setConfirmDeleteId(null);
    const res = await api.beritaAcaraDelete(id);
    if (res.success) load();
  }

  // Resize sisi klien sebelum upload (2026-09-05, W4C) - server (sharp,
  // imageProcessing.js) SUDAH resize+compress ke WebP, tapi itu terjadi
  // SETELAH file mentah (bisa 8-10MB dari kamera HP) sudah selesai
  // dikirim penuh lewat jaringan - mengecilkan DULU di HP mempercepat
  // TRANSFER-nya, bukan cuma ukuran akhir di server. Lebar target 1600px
  // konsisten dgn resize server (imageProcessing.js). GIF SENGAJA
  // dilewati (tidak diresize) - ImageManipulator akan meratakan/merusak
  // animasinya jadi 1 frame JPEG.
  async function resizeForUpload(uri: string, mime: string): Promise<{ uri: string; mime: string }> {
    if (mime === "image/gif") return { uri, mime };
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1600 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );
      return { uri: result.uri, mime: "image/jpeg" };
    } catch {
      return { uri, mime }; // gagal resize (mis. gambar sudah kecil) - upload apa adanya, bukan blokir user.
    }
  }

  async function pickAndUpload(type: "thumbnail" | "activity") {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setFormMessage("Izin galeri ditolak."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: type === "activity",
      quality: 0.8,
    });
    if (result.canceled || result.assets.length === 0) return;

    // BUG NYATA ditemukan user (2026-09-05, susulan W4A): flag
    // uploadingThumb/uploadingActivity SEBELUMNYA baru di-set TRUE
    // SETELAH `saveOrCreate()` (network round-trip bikin/update artikel
    // dulu) selesai - ada celah waktu SEBELUM flag itu true dimana tombol
    // Terbitkan/Simpan Draft SEMPAT enabled lagi (formSaving milik
    // saveOrCreate sendiri sudah balik false, uploadingThumb belum
    // sempat true). Diperbaiki: flag di-set TRUE PALING AWAL (sebelum
    // saveOrCreate dipanggil sama sekali) - tidak ada celah tersisa.
    if (type === "thumbnail") setUploadingThumb(true); else setUploadingActivity(true);
    const id = editingId ?? (await saveOrCreate());
    if (!id) {
      // saveOrCreate gagal (mis. judul masih kosong) - upload dibatalkan,
      // flag WAJIB dilepas lagi di sini juga (bukan cuma di akhir fungsi)
      // supaya tombol tidak nyangkut disabled selamanya kalau gagal di titik ini.
      if (type === "thumbnail") setUploadingThumb(false); else setUploadingActivity(false);
      setFormMessage((prev) => prev || "Isi judul dulu sebelum upload gambar.");
      return;
    }
    for (const asset of result.assets) {
      const { uri, mime } = await resizeForUpload(asset.uri, asset.mimeType ?? "image/jpeg");
      const res = await api.beritaAcaraUploadMedia(id, uri, mime, type);
      if (res.success) {
        setEditingMedia((prev) => type === "thumbnail" ? [...prev.filter((m) => m.media_type !== "thumbnail"), res.data] : [...prev, res.data]);
      } else {
        setFormMessage(res.message ?? "Upload gagal.");
        break;
      }
    }
    if (type === "thumbnail") setUploadingThumb(false); else setUploadingActivity(false);
  }

  async function handleRemoveMedia(mediaId: number) {
    if (!editingId) return;
    const res = await api.beritaAcaraDeleteMedia(editingId, mediaId);
    if (res.success) setEditingMedia((prev) => prev.filter((m) => m.id !== mediaId));
  }
  async function handleAddLink() {
    const url = newLinkUrl.trim();
    if (!url) return;
    const id = editingId ?? (await saveOrCreate());
    if (!id) return;
    setLinkSaving(true);
    const res = await api.beritaAcaraAddLink(id, url);
    setLinkSaving(false);
    if (res.success) { setEditingLinks((prev) => [...prev, res.data]); setNewLinkUrl(""); }
    else setFormMessage(res.message ?? "Link tidak valid.");
  }
  async function handleRemoveLink(linkId: number) {
    if (!editingId) return;
    const res = await api.beritaAcaraDeleteLink(editingId, linkId);
    if (res.success) setEditingLinks((prev) => prev.filter((l) => l.id !== linkId));
  }

  const thumbnail = editingMedia.find((m) => m.media_type === "thumbnail");
  const activityImages = editingMedia.filter((m) => m.media_type === "activity");
  const filtered = statusFilter === "all" ? items : items.filter((p) => p.status === statusFilter);

  if (view === "form") {
    return (
      <KeyboardAwareScrollView className="flex-1 bg-background px-4 pt-4" contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 16 }} bottomOffset={20}>
        <Pressable onPress={() => setView("list")} className="flex-row items-center gap-1.5 -ml-1"><ArrowLeft size={16} color={colors.mutedForeground} /><Text className="text-sm text-muted-foreground">Kembali ke Daftar</Text></Pressable>
        <Text className="text-lg font-bold text-foreground">{editingId ? "Edit Berita" : "Buat Berita Baru"}</Text>

        {formMessage ? (
          <View className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 flex-row items-center gap-2">
            <CheckCircle size={16} color="#059669" /><Text className="text-sm text-emerald-800 flex-1">{formMessage}</Text>
          </View>
        ) : null}

        <View className="gap-1.5">
          <Text className="text-sm font-medium text-foreground">Judul Berita *</Text>
          <TextInput value={formTitle} onChangeText={setFormTitle} placeholder="Masukkan judul berita" className="bg-input-background border border-border rounded-xl px-4 py-3 text-foreground" />
        </View>
        <View className="gap-1.5">
          <Text className="text-sm font-medium text-foreground">Isi / Narasi</Text>
          <TextInput value={formDescription} onChangeText={setFormDescription} placeholder="Tulis isi berita secara lengkap..." multiline numberOfLines={6} textAlignVertical="top" className="bg-input-background border border-border rounded-xl px-4 py-3 text-foreground" style={{ minHeight: 120 }} />
        </View>
        <View className="gap-1.5">
          <Text className="text-sm font-medium text-foreground">Link (opsional, boleh lebih dari 1)</Text>
          {editingLinks.map((l) => (
            <View key={l.id} className="flex-row items-center gap-2 bg-muted rounded-xl px-3 py-2">
              <Link2 size={13} color={colors.mutedForeground} /><Text numberOfLines={1} className="text-xs text-foreground flex-1">{l.url}</Text>
              <Pressable onPress={() => handleRemoveLink(l.id)}><X size={13} color={colors.mutedForeground} /></Pressable>
            </View>
          ))}
          <View className="flex-row gap-2">
            <TextInput value={newLinkUrl} onChangeText={setNewLinkUrl} placeholder="https://..." autoCapitalize="none" className="flex-1 bg-input-background border border-border rounded-xl px-4 py-3 text-foreground" />
            <Pressable onPress={handleAddLink} disabled={linkSaving || !newLinkUrl.trim()} className="px-4 justify-center rounded-xl border border-border"><Text className="text-sm font-medium text-foreground">Tambah</Text></Pressable>
          </View>
        </View>
        <View className="gap-1.5">
          <Text className="text-sm font-medium text-foreground">Nama Penulis (opsional)</Text>
          <TextInput value={formAuthorName} onChangeText={setFormAuthorName} placeholder="Kosongkan utk pakai nama akun ini" className="bg-input-background border border-border rounded-xl px-4 py-3 text-foreground" />
        </View>
        <View className="flex-row gap-3">
          <View className="flex-1 gap-1.5"><Text className="text-sm font-medium text-foreground">Kategori</Text><SimplePicker value={formCategory} options={CATEGORY_OPTIONS} onChange={setFormCategory} /></View>
          <View className="flex-1 gap-1.5"><Text className="text-sm font-medium text-foreground">Unit</Text><SimplePicker value={formUnitScope} options={unitScopes} onChange={setFormUnitScope} /></View>
        </View>
        <View className="gap-1.5">
          <Text className="text-sm font-medium text-foreground">Tanggal Kegiatan (YYYY-MM-DD)</Text>
          <TextInput value={formActivityDate} onChangeText={setFormActivityDate} placeholder="2026-08-21" className="bg-input-background border border-border rounded-xl px-4 py-3 text-foreground" />
        </View>

        <View className="border border-border rounded-xl p-4 gap-3">
          <View className="flex-row items-center gap-1.5"><ImageIcon size={14} color={colors.foreground} /><Text className="text-sm font-semibold text-foreground">Media</Text></View>
          <View>
            <Text className="text-xs text-muted-foreground mb-2">Thumbnail (1 gambar sampul)</Text>
            {thumbnail ? (
              <View className="mb-2">
                <Image source={{ uri: mediaUrl(thumbnail) }} className="w-full h-32 rounded-xl" resizeMode="cover" />
                <Pressable onPress={() => handleRemoveMedia(thumbnail.id)} className="absolute top-1.5 right-1.5 bg-black/60 rounded-full p-1"><X size={12} color="#fff" /></Pressable>
              </View>
            ) : null}
            <Pressable onPress={() => pickAndUpload("thumbnail")} disabled={uploadingThumb || formSaving} className="flex-row items-center gap-2">
              {uploadingThumb ? <ActivityIndicator size="small" color={colors.primary} /> : <Upload size={14} color={colors.primary} />}
              <Text className="text-sm text-primary">{uploadingThumb ? "Mengunggah..." : thumbnail ? "Ganti Thumbnail" : "Upload Thumbnail"}</Text>
            </Pressable>
          </View>
          <View>
            <Text className="text-xs text-muted-foreground mb-2">Gambar Kegiatan ({activityImages.length})</Text>
            <View className="flex-row flex-wrap gap-2 mb-2">
              {activityImages.map((img) => (
                <View key={img.id}>
                  <Image source={{ uri: mediaUrl(img) }} className="w-20 h-20 rounded-lg" resizeMode="cover" />
                  <Pressable onPress={() => handleRemoveMedia(img.id)} className="absolute -top-1.5 -right-1.5 bg-black/60 rounded-full p-1"><X size={10} color="#fff" /></Pressable>
                </View>
              ))}
            </View>
            <Pressable onPress={() => pickAndUpload("activity")} disabled={uploadingActivity || formSaving} className="flex-row items-center gap-2">
              {uploadingActivity ? <ActivityIndicator size="small" color={colors.primary} /> : <Upload size={14} color={colors.primary} />}
              <Text className="text-sm text-primary">{uploadingActivity ? "Mengunggah..." : "Tambah Gambar Kegiatan"}</Text>
            </Pressable>
          </View>
        </View>

        {/* uploadingThumb/uploadingActivity ikut masuk disabled (2026-09-05,
            W4A) - SEBELUMNYA cuma formSaving/judul kosong yg dicek, jadi bisa
            tap Terbitkan SAAT upload gambar masih berjalan: publish langsung
            jalan (status berubah) padahal baris media belum sempat ke-INSERT
            - hasilnya berita terbit dgn gambar blank/hilang total (laporan
            user, terbukti pas upload >1MB yg makan waktu lumayan). */}
        <View className="flex-row gap-3">
          <Pressable onPress={handleSaveDraft} disabled={formSaving || uploadingThumb || uploadingActivity || !formTitle.trim()} className="flex-1 flex-row items-center justify-center gap-2 py-3 border border-border rounded-xl">
            <Save size={15} color={colors.foreground} /><Text className="text-sm font-medium text-foreground">{formSaving ? "Menyimpan..." : "Simpan Draft"}</Text>
          </Pressable>
          <Pressable onPress={handlePublish} disabled={formSaving || uploadingThumb || uploadingActivity || !formTitle.trim()} className="flex-1 flex-row items-center justify-center gap-2 py-3 bg-primary rounded-xl">
            <Send size={15} color={colors.primaryForeground} /><Text className="text-sm font-semibold text-primary-foreground">{(uploadingThumb || uploadingActivity) ? "Menunggu upload..." : formSaving ? "Memproses..." : "Terbitkan"}</Text>
          </Pressable>
        </View>
      </KeyboardAwareScrollView>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background px-4 pt-5" contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 12 }}>
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-bold text-foreground">Kelola Berita Acara</Text>
        <Pressable onPress={openCreate} className="flex-row items-center gap-1.5 bg-primary px-3 py-2 rounded-xl"><Plus size={15} color={colors.primaryForeground} /><Text className="text-sm font-semibold text-primary-foreground">Tambah</Text></Pressable>
      </View>
      <View className="flex-row gap-2">
        {(["all", "disetujui", "draft"] as const).map((f) => (
          <Pressable key={f} onPress={() => setStatusFilter(f)} className={`px-3 py-1.5 rounded-full ${statusFilter === f ? "bg-primary" : "bg-secondary"}`}>
            <Text className={`text-xs font-medium ${statusFilter === f ? "text-primary-foreground" : "text-foreground"}`}>{f === "all" ? "Semua" : f === "disetujui" ? "Terbit" : "Draft"}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : filtered.length === 0 ? (
        <View className="py-12 items-center">
          <Text className="text-muted-foreground text-sm">Belum ada berita untuk filter ini.</Text>
          <Pressable onPress={openCreate}><Text className="mt-3 text-primary text-sm font-medium">+ Buat berita pertama</Text></Pressable>
        </View>
      ) : (
        filtered.map((item) => {
          const thumb = item.media.find((m) => m.media_type === "thumbnail");
          return (
            <View key={item.id} className="bg-card border border-border rounded-2xl p-4 gap-2">
              <View className="flex-row items-start justify-between gap-2">
                <View className="flex-1">
                  <View className="flex-row items-center gap-2 mb-1">
                    <StatusBadge status={item.status} />
                    {item.category ? <Text className="text-xs text-muted-foreground">{item.category}</Text> : null}
                  </View>
                  <Text numberOfLines={2} className="font-semibold text-foreground text-sm">{item.title}</Text>
                  <Text className="text-xs text-muted-foreground mt-1">{item.approved_at ? `Terbit: ${formatDate(item.approved_at)}` : `Dibuat: ${formatDate(item.created_at)}`}</Text>
                </View>
                {thumb ? <Image source={{ uri: mediaUrl(thumb) }} className="w-16 h-16 rounded-xl" /> : null}
              </View>
              <View className="flex-row gap-3 flex-wrap items-center">
                <Pressable onPress={() => openEdit(item)} className="flex-row items-center gap-1"><Edit2 size={12} color={colors.primary} /><Text className="text-xs text-primary font-medium">Edit</Text></Pressable>
                {item.status !== "disetujui" ? (
                  <Pressable onPress={() => handlePublishFromList(item.id)} className="flex-row items-center gap-1"><Send size={12} color="#16a34a" /><Text className="text-xs text-green-600 font-medium">Terbitkan</Text></Pressable>
                ) : null}
                <Pressable onPress={() => onNavigate("berita-acara-viewer", { newsId: item.id })} className="flex-row items-center gap-1"><Eye size={12} color={colors.mutedForeground} /><Text className="text-xs text-muted-foreground">Preview</Text></Pressable>
                <Pressable onPress={() => handleDelete(item.id)} className="flex-row items-center gap-1 ml-auto">
                  <Trash2 size={12} color={confirmDeleteId === item.id ? "#dc2626" : colors.mutedForeground} />
                  <Text className={`text-xs font-medium ${confirmDeleteId === item.id ? "text-red-600" : "text-muted-foreground"}`}>{confirmDeleteId === item.id ? "Konfirmasi Hapus?" : "Hapus"}</Text>
                </Pressable>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

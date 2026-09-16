import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Megaphone } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { SimplePicker } from "../ui/SimplePicker";
import { api, ROLE_MAP } from "../../services/api";
import { useThemeColors } from "../../context/ThemeContext";

interface Catalog { id: number; kode: string; nama: string; }

const TARGET_OPTIONS = [{ value: "ALL", label: "Semua Pengguna" }, ...Object.entries(ROLE_MAP).map(([value, label]) => ({ value, label }))];

// keuangan/supervisor DITAMBAH 2026-09-15 (Role Definitions) - SEBELUMNYA
// global tanpa katalog, SEKARANG jg wajib didaftarkan eksplisit per
// katalog spt admin_tu/admin_media (lihat backend routes/admin.js).
function needsCatalog(targetRole: string) {
  return targetRole === "admin_tu" || targetRole === "admin_media" || targetRole === "keuangan" || targetRole === "supervisor";
}

export function BuatPengumumanScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [targetRole, setTargetRole] = useState("ALL");
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [catalogId, setCatalogId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api.adminCatalogs().then((res) => {
      if (res.success) {
        setCatalogs(res.data);
        if (res.data.length > 0) setCatalogId((prev) => prev ?? res.data[0].id);
      }
    });
  }, []);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) { setError("Judul dan isi pengumuman wajib diisi."); return; }
    // admin_tu/admin_media (2026-09-14, Sistem Katalog) - WAJIB sertakan
    // katalog, keputusan eksplisit user: pengumuman ke role ini TIDAK BOLEH
    // melebar lintas katalog.
    if (needsCatalog(targetRole) && !catalogId) {
      setError("Pilih katalog dulu - pengumuman ke Admin TU/Media harus jelas ditujukan ke katalog yang mana.");
      return;
    }
    setSaving(true); setError("");
    const res = await api.adminCreateAnnouncement({
      title: title.trim(),
      message: message.trim(),
      target_role: targetRole,
      ...(needsCatalog(targetRole) && catalogId ? { catalog_id: catalogId } : {}),
    });
    setSaving(false);
    if (res.success) { setSuccess(true); setTitle(""); setMessage(""); setTargetRole("ALL"); }
    else setError(res.message ?? "Gagal mengirim pengumuman.");
  };

  return (
    <KeyboardAwareScrollView className="flex-1 bg-background px-4 pt-5" contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 16 }} bottomOffset={20}>
      <Text className="text-xs text-muted-foreground">Pengumuman muncul di tab "Pengumuman" pada menu Notifikasi seluruh pengguna yang jadi target - terpisah dari notifikasi aktivitas biasa.</Text>
      {success ? <View className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3"><Text className="text-sm text-green-700 dark:text-green-400">Pengumuman berhasil dikirim.</Text></View> : null}
      {error ? <View className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3"><Text className="text-sm text-red-600 dark:text-red-400">{error}</Text></View> : null}

      <Card padding="md">
        <View className="gap-3">
          <View>
            <Text className="text-xs font-medium text-muted-foreground mb-1">Kirim ke</Text>
            <SimplePicker value={targetRole} options={TARGET_OPTIONS} onChange={setTargetRole} />
          </View>
          {needsCatalog(targetRole) && (
            <View>
              <Text className="text-xs font-medium text-muted-foreground mb-1">Katalog</Text>
              <SimplePicker
                value={catalogId != null ? String(catalogId) : ""}
                options={catalogs.map((c) => ({ value: String(c.id), label: c.nama }))}
                onChange={(v) => setCatalogId(Number(v))}
                placeholder="Pilih katalog..."
              />
            </View>
          )}
          <View>
            <Text className="text-xs font-medium text-muted-foreground mb-1">Judul</Text>
            <TextInput value={title} onChangeText={setTitle} placeholder="Mis. Pemeliharaan Sistem Malam Ini" maxLength={200} className="w-full bg-input-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground" />
          </View>
          <View>
            <Text className="text-xs font-medium text-muted-foreground mb-1">Isi Pengumuman</Text>
            <TextInput value={message} onChangeText={setMessage} placeholder="Tulis isi pengumuman di sini..." maxLength={1000} multiline numberOfLines={5} textAlignVertical="top" className="w-full bg-input-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground" style={{ minHeight: 100 }} />
          </View>
          <Button onPress={handleSend} loading={saving} fullWidth>
            <Megaphone size={16} color={colors.primaryForeground} />{"  "}{saving ? "Mengirim..." : "Kirim Pengumuman"}
          </Button>
        </View>
      </Card>
    </KeyboardAwareScrollView>
  );
}

import React, { useState } from "react";
import { View, Text, ScrollView, TextInput } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Megaphone } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { SimplePicker } from "../ui/SimplePicker";
import { api, ROLE_MAP } from "../../services/api";
import { useThemeColors } from "../../context/ThemeContext";

const TARGET_OPTIONS = [{ value: "ALL", label: "Semua Pengguna" }, ...Object.entries(ROLE_MAP).map(([value, label]) => ({ value, label }))];

export function BuatPengumumanScreen() {
  const colors = useThemeColors();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [targetRole, setTargetRole] = useState("ALL");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) { setError("Judul dan isi pengumuman wajib diisi."); return; }
    setSaving(true); setError("");
    const res = await api.adminCreateAnnouncement({ title: title.trim(), message: message.trim(), target_role: targetRole });
    setSaving(false);
    if (res.success) { setSuccess(true); setTitle(""); setMessage(""); setTargetRole("ALL"); }
    else setError(res.message ?? "Gagal mengirim pengumuman.");
  };

  return (
    <KeyboardAwareScrollView className="flex-1 bg-background px-4 pt-5" contentContainerStyle={{ paddingBottom: 32, gap: 16 }} bottomOffset={20}>
      <Text className="text-xs text-muted-foreground">Pengumuman muncul di tab "Pengumuman" pada menu Notifikasi seluruh pengguna yang jadi target - terpisah dari notifikasi aktivitas biasa.</Text>
      {success ? <View className="bg-green-50 border border-green-200 rounded-xl px-4 py-3"><Text className="text-sm text-green-700">Pengumuman berhasil dikirim.</Text></View> : null}
      {error ? <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3"><Text className="text-sm text-red-600">{error}</Text></View> : null}

      <Card padding="md">
        <View className="gap-3">
          <View>
            <Text className="text-xs font-medium text-muted-foreground mb-1">Kirim ke</Text>
            <SimplePicker value={targetRole} options={TARGET_OPTIONS} onChange={setTargetRole} />
          </View>
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

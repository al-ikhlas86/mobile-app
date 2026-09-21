import React, { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator } from "react-native";
// ScrollView gesture-handler KHUSUS dropdown saran model - dropdown ini
// dipasang di dalam ScrollView RN biasa milik SinkronisasiPane sendiri,
// nested scroll RN vs RN macet (sama root cause dgn catatan SimplePicker.tsx
// - scroll dalam kalah rebutan gesture ke scroll luar).
import { ScrollView as GestureScrollView } from "react-native-gesture-handler";
import { Send, Bot, User as UserIcon, Trash2, Settings, GraduationCap } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { api } from "../../services/api";
import { useThemeColors } from "../../context/ThemeContext";

interface Message { id: number; role: "user" | "assistant"; content: string; created_at: string; }
interface TrainingEntry { id: number; content: string; created_at: string; trainer_name: string; }
type TabType = "Chatbot" | "Pelatih" | "Sinkronisasi";

// Port 1:1 dari webview (ChatbotScreen.tsx) - cakupan tab persis
// spesifikasi user (2026-09-21): semua orang dapat "Chatbot". "Pelatih"
// cuma utk ber-capability chatbot_trainer (Admin IT otomatis dapat).
// "Sinkronisasi" khusus Admin IT. Backend routes/chatbot.js tetap gerbang
// asli - ini cuma UI.
export function ChatbotScreen() {
  const colors = useThemeColors();
  const [isAdminIt, setIsAdminIt] = useState(false);
  const [isTrainer, setIsTrainer] = useState(false);
  const [tab, setTab] = useState<TabType>("Chatbot");
  const [loadingStatus, setLoadingStatus] = useState(true);

  useEffect(() => {
    api.chatbotStatus().then((res: any) => {
      if (res.success) { setIsAdminIt(res.isAdminIt); setIsTrainer(res.isTrainer); }
      setLoadingStatus(false);
    });
  }, []);

  const tabs: TabType[] = ["Chatbot", ...(isTrainer ? (["Pelatih"] as const) : []), ...(isAdminIt ? (["Sinkronisasi"] as const) : [])];

  if (loadingStatus) {
    return <View className="flex-1 items-center justify-center"><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <View className="flex-1 px-4 py-4 gap-3">
      {tabs.length > 1 && (
        <View className="flex-row gap-2 p-1 bg-muted rounded-xl">
          {tabs.map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} className={`flex-1 py-2 rounded-lg items-center ${tab === t ? "bg-card" : ""}`}>
              <Text className={`text-sm font-medium ${tab === t ? "text-foreground" : "text-muted-foreground"}`}>{t}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {tab === "Chatbot" && <ChatPane />}
      {tab === "Pelatih" && <PelatihPane />}
      {tab === "Sinkronisasi" && <SinkronisasiPane />}
    </View>
  );
}

function ChatPane() {
  const colors = useThemeColors();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    api.chatbotMessages().then((res: any) => { if (res.success) setMessages(res.data); setLoading(false); });
  }, []);

  async function handleSend() {
    const pesan = input.trim();
    if (!pesan || sending) return;
    setError("");
    setSending(true);
    setInput("");
    setMessages((prev) => [...prev, { id: Date.now(), role: "user", content: pesan, created_at: new Date().toISOString() }]);
    const res: any = await api.chatbotSend(pesan);
    setSending(false);
    if (!res.success) { setError(res.message ?? "Gagal mengirim pesan."); return; }
    setMessages((prev) => [...prev, res.data]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }

  return (
    <View className="flex-1 gap-3">
      <ScrollView ref={scrollRef} className="flex-1" contentContainerStyle={{ gap: 10, paddingBottom: 8 }} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
        {loading ? (
          <Text className="text-sm text-muted-foreground text-center py-8">Memuat...</Text>
        ) : messages.length === 0 ? (
          <View className="items-center gap-2 py-12">
            <Bot size={32} color={colors.mutedForeground} />
            <Text className="text-sm text-muted-foreground text-center px-6">Tanya apa saja seputar sekolah - kalender kegiatan, dll.</Text>
          </View>
        ) : (
          messages.map((m) => (
            <View key={m.id} className={`flex-row gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "assistant" && (
                <View className="w-7 h-7 rounded-full bg-primary/10 items-center justify-center mt-0.5"><Bot size={14} color={colors.primary} /></View>
              )}
              <View className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${m.role === "user" ? "bg-primary" : "bg-card border border-border"}`}>
                <Text className={`text-sm ${m.role === "user" ? "text-primary-foreground" : "text-foreground"}`}>{m.content}</Text>
              </View>
              {m.role === "user" && (
                <View className="w-7 h-7 rounded-full bg-muted items-center justify-center mt-0.5"><UserIcon size={14} color={colors.mutedForeground} /></View>
              )}
            </View>
          ))
        )}
        {sending && <Text className="text-xs text-muted-foreground text-center">Chatbot sedang mengetik...</Text>}
      </ScrollView>

      {!!error && <Text className="text-xs text-red-500 text-center">{error}</Text>}

      <View className="flex-row gap-2 items-end">
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ketik pertanyaan..."
          placeholderTextColor={colors.mutedForeground}
          multiline
          className="flex-1 bg-input-background border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm max-h-24"
        />
        <Pressable onPress={handleSend} disabled={sending || !input.trim()} className={`w-11 h-11 rounded-full bg-primary items-center justify-center ${sending || !input.trim() ? "opacity-50" : ""}`}>
          <Send size={16} color={colors.primaryForeground} />
        </Pressable>
      </View>
    </View>
  );
}

function PelatihPane() {
  const colors = useThemeColors();
  const [entries, setEntries] = useState<TrainingEntry[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => api.chatbotTraining().then((res: any) => { if (res.success) setEntries(res.data); setLoading(false); });
  useEffect(() => { load(); }, []);

  async function handleAdd() {
    const isi = input.trim();
    if (!isi) return;
    setSaving(true);
    setError("");
    const res: any = await api.chatbotAddTraining(isi);
    setSaving(false);
    if (!res.success) { setError(res.message ?? "Gagal menyimpan."); return; }
    setInput("");
    load();
  }

  async function handleDelete(id: number) {
    await api.chatbotDeleteTraining(id);
    load();
  }

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ gap: 16 }}>
      <Card padding="md">
        <View className="flex-row items-center gap-1.5 mb-2">
          <GraduationCap size={16} color={colors.primary} />
          <Text className="text-sm font-semibold text-foreground">Mode Pelatih</Text>
        </View>
        <Text className="text-xs text-muted-foreground mb-3">
          Tulis pengetahuan/panduan bebas - chatbot akan pakai ini saat pertanyaan orang tua/pegawai mirip topiknya.
        </Text>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Contoh: Konseling untuk anak yang sulit fokus belajar biasanya..."
          placeholderTextColor={colors.mutedForeground}
          multiline
          numberOfLines={3}
          className="bg-input-background border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm min-h-[80px]"
        />
        {!!error && <Text className="text-xs text-red-500 mt-1.5">{error}</Text>}
        <Button onPress={handleAdd} disabled={saving || !input.trim()} loading={saving} className="mt-2">Simpan Pembelajaran</Button>
      </Card>

      <View className="gap-2">
        <Text className="text-sm font-semibold text-foreground">Riwayat Pembelajaran</Text>
        {loading ? (
          <Text className="text-sm text-muted-foreground text-center py-4">Memuat...</Text>
        ) : entries.length === 0 ? (
          <Text className="text-sm text-muted-foreground text-center py-4">Belum ada pembelajaran.</Text>
        ) : (
          entries.map((e) => (
            <Card key={e.id} padding="sm">
              <View className="flex-row items-start gap-2">
                <Text className="text-sm text-foreground flex-1">{e.content}</Text>
                <Pressable onPress={() => handleDelete(e.id)} className="p-1 rounded-full">
                  <Trash2 size={14} color={colors.destructive} />
                </Pressable>
              </View>
              <Text className="text-[10px] text-muted-foreground mt-1.5">oleh {e.trainer_name}</Text>
            </Card>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function SinkronisasiPane() {
  const colors = useThemeColors();
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiKeySet, setApiKeySet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [modelOptions, setModelOptions] = useState<{ id: string; isCombo: boolean }[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelFocused, setModelFocused] = useState(false);

  useEffect(() => {
    api.chatbotGetSettings().then((res: any) => {
      if (res.success) { setBaseUrl(res.data.baseUrl); setModel(res.data.model); setApiKeySet(res.data.apiKeySet); }
      setLoading(false);
    });
  }, []);

  // Muat pilihan model dari provider (9Router /models) - port 1:1 dari
  // webview (ChatbotScreen.tsx), debounce 600ms. RN tidak punya <datalist>
  // jadi daftar sarannya dirender manual di bawah kolom (lihat JSX Model).
  useEffect(() => {
    if (!baseUrl.trim()) { setModelOptions([]); return; }
    const timer = setTimeout(() => {
      setLoadingModels(true);
      api.chatbotListModels({ baseUrl: baseUrl.trim(), apiKey: apiKey.trim() || undefined })
        .then((res: any) => { if (res.success) setModelOptions(res.data); })
        .finally(() => setLoadingModels(false));
    }, 600);
    return () => clearTimeout(timer);
  }, [baseUrl, apiKey]);

  // Combo (dibuat manual Admin IT di dashboard 9Router) ditaruh paling
  // atas - port 1:1 dari webview, lihat catatan lengkap di sana kenapa
  // model mentah provider bisa sangat banyak tapi belum tentu valid.
  const filteredModelOptions = modelOptions
    .filter((m) => m.id.toLowerCase().includes(model.trim().toLowerCase()))
    .sort((a, b) => Number(b.isCombo) - Number(a.isCombo));

  async function handleSave() {
    if (!baseUrl.trim() || !model.trim()) { setMessage({ text: "Base URL dan Model wajib diisi.", ok: false }); return; }
    setSaving(true);
    setMessage(null);
    const res: any = await api.chatbotSaveSettings({ baseUrl: baseUrl.trim(), model: model.trim(), apiKey: apiKey.trim() || undefined });
    setSaving(false);
    if (!res.success) { setMessage({ text: res.message ?? "Gagal menyimpan.", ok: false }); return; }
    setMessage({ text: "Tersimpan.", ok: true });
    if (apiKey.trim()) { setApiKeySet(true); setApiKey(""); }
  }

  if (loading) return <View className="flex-1 items-center justify-center"><ActivityIndicator color={colors.primary} /></View>;

  return (
    <ScrollView className="flex-1">
      <Card padding="md">
        <View className="flex-row items-center gap-1.5 mb-3">
          <Settings size={16} color={colors.primary} />
          <Text className="text-sm font-semibold text-foreground">Sumber AI Chatbot</Text>
        </View>
        <Text className="text-xs text-muted-foreground mb-4">
          Alamat & kunci layanan AI yang dipakai chatbot. Kalau layanan yang sekarang bermasalah suatu saat, cukup ganti 2 field ini ke layanan lain - tidak perlu ubah aplikasi.
        </Text>
        <View className="gap-3">
          <Input label="Base URL" value={baseUrl} onChangeText={setBaseUrl} placeholder="http://127.0.0.1:20128/v1" autoCapitalize="none" />
          <Input
            label={`API Key${apiKeySet ? " (sudah diisi - kosongkan kalau tidak mau ganti)" : ""}`}
            value={apiKey}
            onChangeText={setApiKey}
            placeholder={apiKeySet ? "••••••••••••" : "sk-..."}
            secureTextEntry
          />
          <View style={{ position: "relative", zIndex: modelFocused ? 50 : 1 }}>
            <Input
              label={`Model / Nama Combo${loadingModels ? " (memuat pilihan...)" : ""}`}
              value={model}
              onChangeText={setModel}
              onFocus={() => setModelFocused(true)}
              onBlur={() => setTimeout(() => setModelFocused(false), 150)}
              placeholder="chatbot"
              autoCapitalize="none"
            />
            {modelFocused && filteredModelOptions.length > 0 && (
              <View
                className="absolute left-0 right-0 bg-card border border-border rounded-xl overflow-hidden"
                style={{ top: "100%", marginTop: 4, zIndex: 50, elevation: 8, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }}
              >
                <GestureScrollView style={{ maxHeight: Math.min(filteredModelOptions.length, 5) * 40 }} nestedScrollEnabled showsVerticalScrollIndicator keyboardShouldPersistTaps="handled">
                  {filteredModelOptions.map((m) => (
                    <Pressable key={m.id} onPress={() => { setModel(m.id); setModelFocused(false); }} className="flex-row items-center justify-between gap-2 px-4 border-b border-border/50" style={{ height: 40 }}>
                      <Text numberOfLines={1} className="flex-1 text-sm text-foreground">{m.id}</Text>
                      {m.isCombo && (
                        <Text className="text-[10px] font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">Combo</Text>
                      )}
                    </Pressable>
                  ))}
                </GestureScrollView>
              </View>
            )}
            {!loadingModels && modelOptions.some((m) => !m.isCombo) && (
              <Text className="text-xs text-muted-foreground mt-1">Disarankan pilih yang bertanda "Combo" - selain itu cuma daftar mentah dari provider, belum tentu benar2 tersambung/berfungsi.</Text>
            )}
          </View>
        </View>
        {message && <Text className={`text-xs mt-3 text-center ${message.ok ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>{message.text}</Text>}
        <Button onPress={handleSave} disabled={saving} loading={saving} fullWidth className="mt-3">Simpan</Button>
      </Card>
    </ScrollView>
  );
}

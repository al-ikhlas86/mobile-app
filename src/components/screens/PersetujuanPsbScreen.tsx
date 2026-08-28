import React, { useEffect, useState } from "react";
import { View, Text, TextInput, ScrollView, Pressable, Linking, ActivityIndicator } from "react-native";
import { UserPlus, Check, X, FileText, AlertCircle, Phone } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { SimplePicker } from "../ui/SimplePicker";
import { api } from "../../services/api";

interface CalonSiswa {
  hub_id: number;
  nama: string;
  jenis_kelamin: "L" | "P";
  nisn: string | null;
  tempat_lahir: string | null;
  tanggal_lahir: string | null;
  asal_sekolah: string | null;
  nama_ayah: string | null;
  nama_ibu: string | null;
  no_handphone: string | null;
  dokumen_lengkap: 0 | 1;
  status: "menunggu" | "diterima" | "ditolak";
  catatan: string | null;
}
interface KelasOption {
  id: number;
  source_id: number;
  nama: string;
  tingkat: string;
}

// Persetujuan PSB dari HP - port 1:1 dari versi webview
// (PersetujuanPsbScreen.tsx), lihat catatan arsitektur lengkap di sana.
export function PersetujuanPsbScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState<CalonSiswa[]>([]);
  const [kelasOptions, setKelasOptions] = useState<KelasOption[]>([]);
  const [expanded, setExpanded] = useState<{ hubId: number; mode: "terima" | "tolak" } | null>(null);
  const [nis, setNis] = useState("");
  const [kelasSourceId, setKelasSourceId] = useState("");
  const [catatan, setCatatan] = useState("");
  const [busy, setBusy] = useState(false);
  const [pesan, setPesan] = useState("");

  const load = async () => {
    setLoading(true);
    const [listRes, kelasRes] = await Promise.all([api.psbList(), api.psbKelas()]);
    if (!listRes.success) { setError(listRes.message ?? "Gagal memuat daftar PSB."); setLoading(false); return; }
    setItems(listRes.data);
    if (kelasRes.success) setKelasOptions(kelasRes.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openTerima = (hubId: number) => { setExpanded({ hubId, mode: "terima" }); setNis(""); setKelasSourceId(""); setPesan(""); };
  const openTolak = (hubId: number) => { setExpanded({ hubId, mode: "tolak" }); setCatatan(""); setPesan(""); };
  const tutup = () => { setExpanded(null); setPesan(""); };

  const kirimTerima = async (hubId: number) => {
    if (!nis.trim() || !kelasSourceId) { setPesan("NIS dan kelas wajib diisi."); return; }
    setBusy(true);
    const res = await api.psbKeputusan(hubId, { keputusan: "terima", nis: nis.trim(), kelasSourceId: Number(kelasSourceId) });
    setBusy(false);
    if (!res.success) { setPesan(res.message ?? "Gagal mengirim keputusan."); return; }
    setItems((prev) => prev.filter((i) => i.hub_id !== hubId));
    tutup();
  };

  const kirimTolak = async (hubId: number) => {
    setBusy(true);
    const res = await api.psbKeputusan(hubId, { keputusan: "tolak", catatan: catatan.trim() || undefined });
    setBusy(false);
    if (!res.success) { setPesan(res.message ?? "Gagal mengirim keputusan."); return; }
    setItems((prev) => prev.filter((i) => i.hub_id !== hubId));
    tutup();
  };

  if (loading) return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator color="#356447" /></View>;
  if (error) return <View className="flex-1 items-center justify-center bg-background gap-3 px-8"><AlertCircle size={32} color="#6E776F" /><Text className="text-sm text-muted-foreground text-center">{error}</Text></View>;

  const kelasPickerOptions = kelasOptions.map((k) => ({ value: String(k.source_id), label: `${k.tingkat} ${k.nama}` }));

  return (
    <ScrollView className="flex-1 bg-background px-4 pt-4" contentContainerStyle={{ paddingBottom: 32, gap: 12 }}>
      <View className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex-row items-start gap-2">
        <AlertCircle size={16} color="#d97706" style={{ marginTop: 2 }} />
        <Text className="flex-1 text-xs text-amber-700">
          Keputusan diterapkan ke data master di PC sekolah pada sinkronisasi berikutnya (maks ~1 menit, PC harus menyala & online) - bukan seketika.
        </Text>
      </View>

      {items.length === 0 ? (
        <Card padding="lg">
          <View className="items-center py-6">
            <UserPlus size={32} color="#6E776F" />
            <Text className="text-sm text-muted-foreground mt-2 text-center">Tidak ada pendaftar yang menunggu persetujuan.</Text>
          </View>
        </Card>
      ) : (
        items.map((c) => (
          <Card key={c.hub_id} padding="md">
            <View className="flex-row items-start gap-3">
              <View className="w-10 h-10 rounded-xl bg-blue-50 items-center justify-center">
                <UserPlus size={18} color="#2563eb" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-foreground">{c.nama}</Text>
                <Text className="text-xs text-muted-foreground mt-0.5">
                  {c.jenis_kelamin === "L" ? "Laki-laki" : "Perempuan"}
                  {c.tempat_lahir ? ` · ${c.tempat_lahir}` : ""}
                  {c.tanggal_lahir ? `, ${new Date(c.tanggal_lahir).toLocaleDateString("id-ID")}` : ""}
                </Text>
                {c.asal_sekolah && <Text className="text-xs text-muted-foreground">Asal sekolah: {c.asal_sekolah}</Text>}
                {(c.nama_ayah || c.nama_ibu) && (
                  <Text className="text-xs text-muted-foreground">Orang tua: {[c.nama_ayah, c.nama_ibu].filter(Boolean).join(" / ")}</Text>
                )}
                <View className="flex-row items-center gap-3 mt-1.5">
                  {c.no_handphone && (
                    <Pressable onPress={() => Linking.openURL(`tel:${c.no_handphone}`)} className="flex-row items-center gap-1">
                      <Phone size={12} color="#356447" /><Text className="text-xs text-primary">{c.no_handphone}</Text>
                    </Pressable>
                  )}
                  <View className="flex-row items-center gap-1">
                    <FileText size={12} color={c.dokumen_lengkap ? "#059669" : "#d97706"} />
                    <Text className={`text-xs ${c.dokumen_lengkap ? "text-emerald-600" : "text-amber-600"}`}>
                      Dokumen {c.dokumen_lengkap ? "lengkap" : "belum lengkap"}
                    </Text>
                  </View>
                </View>

                {expanded?.hubId === c.hub_id ? (
                  <View className="mt-3 pt-3 border-t border-border gap-2">
                    {expanded.mode === "terima" ? (
                      <>
                        <TextInput
                          value={nis}
                          onChangeText={(t) => setNis(t.replace(/\D/g, ""))}
                          placeholder="NIS (angka)"
                          placeholderTextColor="#6E776F"
                          keyboardType="numeric"
                          className="bg-input-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground"
                        />
                        <SimplePicker value={kelasSourceId} options={kelasPickerOptions} onChange={setKelasSourceId} placeholder="Pilih kelas..." />
                        {pesan ? <Text className="text-xs text-red-500">{pesan}</Text> : null}
                        <View className="flex-row gap-2 mt-1">
                          <View className="flex-1"><Button variant="primary" disabled={busy} onPress={() => kirimTerima(c.hub_id)}>Konfirmasi Terima</Button></View>
                          <Button variant="secondary" disabled={busy} onPress={tutup}>Batal</Button>
                        </View>
                      </>
                    ) : (
                      <>
                        <TextInput
                          value={catatan}
                          onChangeText={setCatatan}
                          placeholder="Catatan penolakan (opsional)"
                          placeholderTextColor="#6E776F"
                          multiline
                          numberOfLines={2}
                          className="bg-input-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground"
                        />
                        {pesan ? <Text className="text-xs text-red-500">{pesan}</Text> : null}
                        <View className="flex-row gap-2 mt-1">
                          <View className="flex-1"><Button variant="destructive" disabled={busy} onPress={() => kirimTolak(c.hub_id)}>Konfirmasi Tolak</Button></View>
                          <Button variant="secondary" disabled={busy} onPress={tutup}>Batal</Button>
                        </View>
                      </>
                    )}
                  </View>
                ) : (
                  <View className="flex-row gap-2 mt-2">
                    <Pressable onPress={() => openTerima(c.hub_id)} className="flex-1 flex-row items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-50">
                      <Check size={14} color="#047857" /><Text className="text-emerald-700 text-xs font-semibold">Terima</Text>
                    </Pressable>
                    <Pressable onPress={() => openTolak(c.hub_id)} className="flex-1 flex-row items-center justify-center gap-1.5 py-2 rounded-lg bg-red-50">
                      <X size={14} color="#dc2626" /><Text className="text-red-600 text-xs font-semibold">Tolak</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, TextInput, Pressable, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Calendar, PartyPopper, Bell, BellOff, Plus, Pencil, Trash2, X, Sparkles } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { api } from "../../services/api";
import { AcademicMonthCalendar, indexAgenda, toISO, type AgendaItem } from "./JadwalPelajaranScreen";
import { useThemeColors } from "../../context/ThemeContext";

// Kalender Kegiatan (2026-09-24, Poin 3 Fase 2) - port 1:1 dari webview
// KalenderKegiatanScreen.tsx. LAYAR TERPISAH dari JadwalPelajaranScreen -
// jadwal pribadi (mengajar/kelas) tinggal di menu "Akademik", layar ini
// MURNI agenda umum unit + catatan pribadi.
//
// Catatan/Pengingat pribadi (2026-09-24) - fiturnya SUDAH ADA sejak
// 2026-09-15 (backend + UI) tapi cuma muncul di JadwalKerjaScreen.tsx
// (khusus Pegawai) - diintegrasikan APA ADANYA ke sini (data sama persis,
// akun yg sama akan lihat catatan yg sama di kedua layar, itu memang benar
// krn bukan data per-layar) supaya SEMUA role bisa pakai dari kalender umum.

interface CatatanItem {
  id: number;
  tanggal: string;
  jam: string | null;
  deskripsi: string;
  notifikasi_aktif: number | boolean;
}

function jamRingkas(jam: string | null): string {
  return jam ? jam.slice(0, 5) : "";
}

export function KalenderKegiatanScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [loading, setLoading] = useState(true);
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(() => toISO(new Date()));

  const [catatan, setCatatan] = useState<CatatanItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCatatan, setEditingCatatan] = useState<CatatanItem | null>(null);
  const [formTanggal, setFormTanggal] = useState(selectedDate);
  const [formJam, setFormJam] = useState("");
  const [formDeskripsi, setFormDeskripsi] = useState("");
  const [formNotifAktif, setFormNotifAktif] = useState(true);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const loadCatatan = async () => {
    const res = await api.catatanList();
    if (res.success) setCatatan(res.data ?? []);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await api.scheduleKalender();
      if (res.success) setAgenda(res.data ?? []);
      setLoading(false);
    })();
    loadCatatan();
  }, []);

  const openAddCatatan = () => {
    setEditingCatatan(null);
    setFormTanggal(selectedDate);
    setFormJam("");
    setFormDeskripsi("");
    setFormNotifAktif(true);
    setFormError("");
    setDialogOpen(true);
  };

  const openEditCatatan = (item: CatatanItem) => {
    setEditingCatatan(item);
    setFormTanggal(item.tanggal.slice(0, 10));
    setFormJam(jamRingkas(item.jam));
    setFormDeskripsi(item.deskripsi);
    setFormNotifAktif(Boolean(item.notifikasi_aktif));
    setFormError("");
    setDialogOpen(true);
  };

  const handleSaveCatatan = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(formTanggal) || !formDeskripsi.trim()) {
      setFormError("Tanggal (format YYYY-MM-DD) dan deskripsi wajib diisi.");
      return;
    }
    if (formJam && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(formJam)) {
      setFormError("Format jam harus HH:MM, mis. 14:00.");
      return;
    }
    setFormSaving(true);
    setFormError("");
    const payload = {
      tanggal: formTanggal,
      jam: formJam || null,
      deskripsi: formDeskripsi.trim(),
      notifikasi_aktif: formJam ? formNotifAktif : false,
    };
    const res = editingCatatan
      ? await api.catatanUpdate(editingCatatan.id, payload)
      : await api.catatanCreate(payload);
    setFormSaving(false);
    if (res.success) {
      setDialogOpen(false);
      loadCatatan();
    } else {
      setFormError(res.message ?? "Gagal menyimpan catatan.");
    }
  };

  const handleDeleteCatatan = (item: CatatanItem) => {
    Alert.alert("Hapus Catatan", "Hapus catatan ini? Tidak bisa dibatalkan.", [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          const res = await api.catatanDelete(item.id);
          if (res.success) setCatatan((prev) => prev.filter((c) => c.id !== item.id));
        },
      },
    ]);
  };

  if (loading) return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator color={colors.primary} /></View>;

  const agendaByDate = indexAgenda(agenda);
  const selectedAgenda = agendaByDate[selectedDate] || [];
  const selectedLiburItems = selectedAgenda.filter((a) => Number(a.is_libur) === 1);
  const selectedLainnya = selectedAgenda.filter((a) => Number(a.is_libur) !== 1);
  const selectedDateLabel = new Date(selectedDate + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const selectedCatatan = catatan
    .filter((c) => c.tanggal.slice(0, 10) === selectedDate)
    .sort((a, b) => (a.jam || "99:99").localeCompare(b.jam || "99:99"));

  // Ringkasan "Bulan Ini" - lihat catatan lengkap di versi webview soal
  // kenapa scoped ke bulan kalender SEKARANG (bukan bulan yg sedang
  // dilihat di grid, AcademicMonthCalendar kelola navigasinya sendiri).
  const now = new Date();
  const bulanIniKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const agendaBulanIni = agenda.filter((a) => a.tanggal_mulai.slice(0, 7) === bulanIniKey);
  const jumlahLiburBulanIni = agendaBulanIni.filter((a) => Number(a.is_libur) === 1).length;
  const jumlahKegiatanBulanIni = agendaBulanIni.filter((a) => Number(a.is_libur) !== 1).length;
  const namaBulanIni = now.toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  return (
    <View className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4 pt-5" contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 16 }}>
        <Card padding="md" className="bg-primary/5 border-primary/20">
          <View className="flex-row items-center gap-1.5 mb-2.5">
            <Sparkles size={14} color={colors.primary} />
            <Text className="text-xs font-semibold text-muted-foreground capitalize">{namaBulanIni}</Text>
          </View>
          <View className="flex-row" style={{ gap: 24 }}>
            <View>
              <Text className="text-[11px] text-muted-foreground">Kegiatan</Text>
              <Text className="text-xl font-bold text-foreground">{jumlahKegiatanBulanIni}</Text>
            </View>
            <View>
              <Text className="text-[11px] text-muted-foreground">Hari Libur</Text>
              <Text className="text-xl font-bold text-red-600 dark:text-red-400">{jumlahLiburBulanIni}</Text>
            </View>
          </View>
        </Card>

        <AcademicMonthCalendar hasSchedule={{}} agendaByDate={agendaByDate} selected={selectedDate} onSelectDate={setSelectedDate} />

        <View>
          <Text className="text-sm font-semibold text-foreground mb-2 capitalize">{selectedDateLabel}</Text>

          {selectedLiburItems.length > 0 && (
            <Card padding="md" className="bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800 mb-2">
              <View className="flex-row items-start gap-3">
                <View className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/20 items-center justify-center"><PartyPopper size={18} color="#dc2626" /></View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-red-700 dark:text-red-400">Libur</Text>
                  {selectedLiburItems.map((a, i) => (
                    <Text key={i} className="text-xs text-red-600 dark:text-red-400 mt-0.5">{a.judul}{a.keterangan ? ` - ${a.keterangan}` : ""}</Text>
                  ))}
                </View>
              </View>
            </Card>
          )}

          {selectedLainnya.length > 0 ? (
            <View className="gap-2">
              {selectedLainnya.map((a, i) => (
                <Card key={i} padding="sm">
                  <View className="flex-row items-start gap-2">
                    <View className="w-1.5 h-1.5 rounded-full mt-1.5" style={{ backgroundColor: a.warna || "#f59e0b" }} />
                    <View className="flex-1">
                      <Text className="text-xs font-medium text-foreground">{a.judul}</Text>
                      <Text className="text-[10px] text-muted-foreground">{[a.waktu, a.sasaran].filter(Boolean).join(" · ")}</Text>
                      {a.keterangan ? <Text className="text-[11px] text-muted-foreground mt-0.5">{a.keterangan}</Text> : null}
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          ) : selectedLiburItems.length === 0 ? (
            <Card padding="md">
              <View className="items-center py-3">
                <Calendar size={28} color={colors.mutedForeground} />
                <Text className="text-sm text-muted-foreground mt-2 text-center">Tidak ada kegiatan pada hari ini.</Text>
              </View>
            </Card>
          ) : null}
        </View>

        <View>
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-sm font-semibold text-foreground">Catatan Saya</Text>
            <Button size="sm" variant="outline" onPress={openAddCatatan}>
              <Plus size={14} color={colors.primary} />{"  "}Tambah Catatan
            </Button>
          </View>
          {selectedCatatan.length === 0 ? (
            <Text className="text-xs text-muted-foreground text-center py-4">Belum ada catatan utk tanggal ini.</Text>
          ) : (
            <View className="gap-2">
              {selectedCatatan.map((c) => (
                <Card key={c.id} padding="sm">
                  <View className="flex-row items-start gap-2.5">
                    <View className="w-8 h-8 rounded-lg bg-primary/10 items-center justify-center mt-0.5">
                      {c.notifikasi_aktif ? <Bell size={14} color={colors.primary} /> : <BellOff size={14} color={colors.mutedForeground} />}
                    </View>
                    <View className="flex-1">
                      {c.jam ? <Text className="text-xs font-semibold text-foreground">{jamRingkas(c.jam)} WIB</Text> : null}
                      <Text className="text-sm text-foreground">{c.deskripsi}</Text>
                    </View>
                    <View className="flex-row gap-1">
                      <Pressable onPress={() => openEditCatatan(c)} className="p-1.5 rounded-full"><Pencil size={14} color={colors.mutedForeground} /></Pressable>
                      <Pressable onPress={() => handleDeleteCatatan(c)} className="p-1.5 rounded-full"><Trash2 size={14} color={colors.mutedForeground} /></Pressable>
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* SENGAJA overlay biasa, BUKAN <Modal> - lihat catatan panjang di
          JadwalKerjaScreen.tsx / AccountSwitcher.tsx. */}
      {dialogOpen && (
        <Pressable className="absolute inset-0 bg-black/50 items-center justify-center p-6" style={{ zIndex: 50, elevation: 50 }} onPress={() => setDialogOpen(false)}>
          <KeyboardAwareScrollView
            style={{ maxHeight: "85%", width: "100%" }}
            contentContainerStyle={{ flexGrow: 0 }}
            bottomOffset={20}
          >
            <Pressable className="bg-card rounded-2xl p-5 w-full gap-3" onPress={(e) => e.stopPropagation()}>
              <View className="flex-row items-center justify-between">
                <Text className="text-base font-bold text-foreground">{editingCatatan ? "Ubah Catatan" : "Tambah Catatan"}</Text>
                <Pressable onPress={() => setDialogOpen(false)}><X size={18} color={colors.mutedForeground} /></Pressable>
              </View>

              <View>
                <Text className="text-xs font-medium text-muted-foreground mb-1">Tanggal (YYYY-MM-DD)</Text>
                <TextInput
                  value={formTanggal}
                  onChangeText={setFormTanggal}
                  placeholder="2026-09-15"
                  className="bg-input-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground"
                />
              </View>
              <View>
                <Text className="text-xs font-medium text-muted-foreground mb-1">Jam (opsional, HH:MM)</Text>
                <TextInput
                  value={formJam}
                  onChangeText={setFormJam}
                  placeholder="14:00"
                  keyboardType="numbers-and-punctuation"
                  className="bg-input-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground"
                />
              </View>
              <View>
                <Text className="text-xs font-medium text-muted-foreground mb-1">Deskripsi</Text>
                <TextInput
                  value={formDeskripsi}
                  onChangeText={setFormDeskripsi}
                  placeholder="Tulis apa yang ingin diingatkan..."
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  maxLength={500}
                  className="bg-input-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground"
                  style={{ minHeight: 72 }}
                />
              </View>
              <Pressable
                onPress={() => formJam && setFormNotifAktif((v) => !v)}
                disabled={!formJam}
                className="flex-row items-center gap-3"
                style={{ opacity: formJam ? 1 : 0.4 }}
              >
                <View className={`w-10 h-6 rounded-full items-center px-0.5 ${formNotifAktif && formJam ? "bg-primary" : "bg-muted"}`} style={{ flexDirection: "row", justifyContent: formNotifAktif && formJam ? "flex-end" : "flex-start" }}>
                  <View className="w-5 h-5 rounded-full bg-white" />
                </View>
                <Text className="text-sm font-medium text-foreground flex-1">Kirim notifikasi pada jam tersebut</Text>
              </Pressable>
              {!formJam && <Text className="text-[11px] text-muted-foreground -mt-2">Isi jam dulu supaya notifikasi bisa diaktifkan.</Text>}
              {formError ? <Text className="text-xs text-red-500">{formError}</Text> : null}
              <View className="flex-row gap-2">
                <Button onPress={handleSaveCatatan} loading={formSaving} fullWidth>{formSaving ? "Menyimpan..." : "Simpan"}</Button>
                <Button variant="outline" onPress={() => setDialogOpen(false)}><X size={16} color={colors.foreground} /></Button>
              </View>
            </Pressable>
          </KeyboardAwareScrollView>
        </Pressable>
      )}
    </View>
  );
}

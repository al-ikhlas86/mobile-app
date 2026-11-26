import React, { useEffect, useState } from "react";
import { View, Text, Alert, TextInput, Share, Pressable } from "react-native";
import { Ban, Check, Trash2, Plus, Pencil, UserPlus, ShieldOff, ShieldCheck, CheckSquare, Square, Tablet, Share2, KeyRound } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { api } from "../../services/api";
import { useThemeColors } from "../../context/ThemeContext";

// Tab "Absensi" (perangkat kiosk Presensi) - khusus Admin IT; padanan layar web KioskPerangkatSection.tsx. Alur sama dengan Keuangan:
// aplikasi Presensi yang baru dipasang/diperbarui meminta izin lewat POST /api/kiosk/register, muncul di "Menunggu persetujuan", Admin IT
// menyetujui sambil menentukan katalog (boleh lebih dari satu) dan nama tampilan. Tolak = hapus (boleh mengajukan lagi); Blokir = tidak bisa
// mendaftar lagi sampai blokir dibuka. Token ASLI hanya dikembalikan sekali (alur manual).
export interface KioskDevice {
  id: number;
  nama: string;
  catalog_id: number | null;
  catalogs: { id: number; kode: string; nama: string }[];
  is_active: number | boolean;
  is_approved: number | boolean;
  is_blocked?: number | boolean;
  blocked_at?: string | null;
  created_at: string;
  last_used_at: string | null;
  app_version?: string | null;
  versi_terbaru?: string | null;
  status_versi?: string | null;
}
export interface KioskMeta { tokenLamaAktif: boolean; tokenLamaAda: boolean; tokenLamaTerakhirDipakai: string | null }

interface Catalog { id: number; kode: string; nama: string }

function formatTanggal(ts: string | null | undefined) {
  if (!ts) return "belum pernah";
  return new Date(ts).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) + " WIB";
}
const terhubung = (ts: string | null) => !!ts && Date.now() - new Date(ts).getTime() < 5 * 60 * 1000;
const TEKS_BLOKIR = (nama: string) => `Blokir perangkat "${nama}"? Perangkat ini langsung berhenti bisa presensi dan TIDAK bisa mengajukan izin lagi sampai blokir dibuka. (Untuk sekadar menolak permintaan agar boleh mengajukan lagi, pakai Tolak.)`;

// Alert.alert sebagai janji: true bila pengguna menekan tombol konfirmasi.
const tanya = (judul: string, pesan: string, tombol = "Lanjut", merusak = false) =>
  new Promise<boolean>((resolve) => {
    Alert.alert(judul, pesan, [
      { text: "Batal", style: "cancel", onPress: () => resolve(false) },
      { text: tombol, style: merusak ? "destructive" : "default", onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });

export function KioskPerangkatSection({ devices, meta, onChanged }: { devices: KioskDevice[]; meta: KioskMeta; onChanged: () => void }) {
  const colors = useThemeColors();
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [busyToken, setBusyToken] = useState(false);
  const [panelId, setPanelId] = useState<number | null>(null);
  const [mode, setMode] = useState<"approve" | "edit">("approve");
  const [picked, setPicked] = useState<number[]>([]);
  const [namaBaru, setNamaBaru] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [nama, setNama] = useState("");
  const [pickedBaru, setPickedBaru] = useState<number[]>([]);
  const [creating, setCreating] = useState(false);
  const [tokenBaru, setTokenBaru] = useState<{ nama: string; token: string } | null>(null);

  useEffect(() => {
    api.adminCatalogs().then((res: { success: boolean; data: Catalog[] }) => { if (res.success) setCatalogs(res.data); });
  }, []);

  const diblokir = devices.filter((d) => !!d.is_blocked);
  const menunggu = devices.filter((d) => !d.is_approved && !d.is_blocked);
  const disetujui = devices.filter((d) => !!d.is_approved && !d.is_blocked);
  const toggle = (setter: React.Dispatch<React.SetStateAction<number[]>>, id: number) =>
    setter((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const galat = (e?: { message?: string }) => Alert.alert("Gagal", e?.message || "Gagal menghubungi server - cek koneksi internet.");

  const bukaPanel = (d: KioskDevice, m: "approve" | "edit") => { setPanelId(d.id); setMode(m); setPicked(d.catalogs.map((c) => c.id)); setNamaBaru(d.nama); };

  const simpanPanel = async (d: KioskDevice) => {
    if (picked.length === 0) { Alert.alert("Pilih katalog", "Pilih minimal 1 katalog (SD/TK) untuk perangkat ini."); return; }
    if (!namaBaru.trim()) { Alert.alert("Nama kosong", "Nama perangkat wajib diisi."); return; }
    const katalog = catalogs.filter((c) => picked.includes(c.id)).map((c) => c.nama).join(" + ");
    if (!(await tanya(mode === "approve" ? "Setujui perangkat" : "Simpan perubahan", `${mode === "approve" ? "Setujui" : "Simpan"} "${namaBaru.trim()}" untuk katalog: ${katalog}?`, mode === "approve" ? "Setujui" : "Simpan"))) return;
    setBusyId(d.id);
    try {
      let res: { success: boolean; message?: string };
      if (mode === "approve") res = await api.adminApproveKioskDevice(d.id, picked, namaBaru.trim());
      else {
        res = await api.adminSetKioskDeviceCatalogs(d.id, picked);
        if (res.success && namaBaru.trim() !== d.nama) res = await api.adminRenameKioskDevice(d.id, namaBaru.trim());
      }
      if (!res.success) Alert.alert("Gagal", res.message || "Gagal memproses.");
      else setPanelId(null);
      onChanged();
    } catch { galat(); } finally { setBusyId(null); }
  };

  const jalankan = async (aksi: "cabut" | "aktifkan" | "hapus" | "blokir" | "bukablokir", d: KioskDevice, konfirmasi?: { judul: string; pesan: string; tombol: string }) => {
    if (konfirmasi && !(await tanya(konfirmasi.judul, konfirmasi.pesan, konfirmasi.tombol, aksi === "hapus" || aksi === "blokir"))) return;
    setBusyId(d.id);
    try {
      const res = aksi === "hapus" ? await api.adminDeleteKioskDevice(d.id)
        : aksi === "blokir" ? await api.adminBlockKioskDevice(d.id)
        : aksi === "bukablokir" ? await api.adminUnblockKioskDevice(d.id)
        : await api.adminSetKioskDeviceActive(d.id, aksi === "aktifkan");
      if (!res.success) Alert.alert("Gagal", res.message || "Gagal memproses.");
      onChanged();
    } catch { galat(); } finally { setBusyId(null); }
  };

  const buat = async () => {
    if (!nama.trim()) { Alert.alert("Nama kosong", "Nama perangkat wajib diisi."); return; }
    setCreating(true);
    try {
      const res = await api.adminCreateKioskDevice({ nama: nama.trim(), ...(pickedBaru.length ? { catalogIds: pickedBaru } : {}) });
      if (!res.success || !res.data) { Alert.alert("Gagal", res.message || "Gagal membuat perangkat."); return; }
      setTokenBaru({ nama: res.data.nama, token: res.data.token });
      setFormOpen(false); setNama(""); setPickedBaru([]);
      onChanged();
    } catch { galat(); } finally { setCreating(false); }
  };

  const bagikanToken = async () => {
    if (!tokenBaru) return;
    try { await Share.share({ message: tokenBaru.token, title: `Token kiosk ${tokenBaru.nama}` }); }
    catch { Alert.alert("Gagal", "Tidak bisa membuka menu bagikan. Tekan lama tokennya untuk menyalin."); }
  };

  const ubahTokenLama = async () => {
    const aktifBaru = !meta.tokenLamaAktif;
    if (!aktifBaru && !(await tanya("Matikan token lama", "Matikan token kiosk lama (bersama)? Kiosk versi lama yang belum diperbarui dan disetujui akan berhenti bisa presensi.", "Matikan", true))) return;
    setBusyToken(true);
    try {
      let res = await api.adminSetKioskTokenLama(aktifBaru);
      // Token lama masih dipakai kiosk (< 24 jam): server minta konfirmasi eksplisit sebelum mematikannya.
      if (!aktifBaru && !res.success && res.code === "BUTUH_KONFIRMASI") {
        if (!(await tanya("Token lama masih dipakai", `${res.message}\n\nTetap matikan sekarang?`, "Tetap matikan", true))) return;
        res = await api.adminSetKioskTokenLama(false, true);
      }
      if (!res.success) Alert.alert("Gagal", res.message || "Gagal memproses.");
      onChanged();
    } catch { galat(); } finally { setBusyToken(false); }
  };

  const PilihKatalog = (nilai: number[], onToggle: (id: number) => void) => (
    <View className="gap-1.5">
      {catalogs.map((c) => (
        <Pressable key={c.id} onPress={() => onToggle(c.id)} accessibilityRole="checkbox" accessibilityState={{ checked: nilai.includes(c.id) }} className="flex-row items-center gap-2 py-1">
          {nilai.includes(c.id) ? <CheckSquare size={20} color={colors.primary} /> : <Square size={20} color={colors.mutedForeground} />}
          <Text className="text-sm text-foreground">{c.nama} <Text className="text-xs text-muted-foreground">({c.kode})</Text></Text>
        </Pressable>
      ))}
    </View>
  );

  const Panel = (d: KioskDevice) => (
    <View className="gap-2 bg-card rounded-lg p-2.5 border border-border mt-2">
      <Text className="text-xs font-medium text-foreground">Nama perangkat (mis. ABSENSI GEDUNG A, PC TU SD)</Text>
      <TextInput value={namaBaru} onChangeText={setNamaBaru} maxLength={100} accessibilityLabel="Nama perangkat" className="bg-input-background border border-border rounded-lg px-2.5 py-2 text-sm text-foreground" placeholderTextColor={colors.mutedForeground} />
      <Text className="text-xs font-medium text-foreground mt-1">Perangkat ini melayani katalog mana? (boleh lebih dari 1)</Text>
      {PilihKatalog(picked, (id) => toggle(setPicked, id))}
      <View className="flex-row flex-wrap gap-2 mt-1">
        <Button size="sm" variant="primary" disabled={busyId === d.id} loading={busyId === d.id} onPress={() => simpanPanel(d)}>{mode === "approve" ? "Konfirmasi Setujui" : "Simpan"}</Button>
        <Button size="sm" variant="outline" disabled={busyId === d.id} onPress={() => setPanelId(null)}>Batal</Button>
      </View>
    </View>
  );

  const katalogTeks = (d: KioskDevice) => (d.catalogs.length ? d.catalogs.map((c) => c.kode).join(" + ") : "Semua katalog (tanpa batas)");

  return (
    <View className="gap-4">
      <Text className="text-xs text-muted-foreground">
        Aplikasi Presensi (kiosk) yang baru dipasang atau diperbarui otomatis meminta izin ke sini dan menunggu persetujuan Anda. Setelah disetujui, kiosk hanya
        mencatat presensi untuk katalog yang Anda tentukan. Kiosk versi lama memakai token bersama sampai diperbarui dan disetujui; matikan token lama (di bawah)
        setelah semua kiosk muncul di daftar.
      </Text>

      {tokenBaru ? (
        <View className="rounded-xl border-2 border-amber-400 bg-amber-50 p-3 gap-2" accessibilityRole="alert">
          <Text className="text-sm font-semibold text-gray-900">Token untuk "{tokenBaru.nama}"</Text>
          <Text className="text-xs font-semibold text-amber-700">Simpan sekarang, tidak akan ditampilkan lagi.</Text>
          <Text selectable className="bg-white border border-gray-300 rounded-lg px-2.5 py-2 text-xs text-gray-900" style={{ fontFamily: "monospace" }}>{tokenBaru.token}</Text>
          <View className="flex-row flex-wrap gap-2">
            <Button size="sm" variant="primary" onPress={bagikanToken}><Share2 size={14} color="#fff" /> Bagikan</Button>
            <Button size="sm" variant="outline" onPress={() => setTokenBaru(null)}>Tutup</Button>
          </View>
        </View>
      ) : null}

      {menunggu.length > 0 ? (
        <Card padding="lg">
          <View className="flex-row items-center gap-2 mb-3">
            <UserPlus size={20} color="#f59e0b" />
            <Text className="font-semibold text-sm text-foreground">Menunggu Persetujuan Absensi ({menunggu.length})</Text>
          </View>
          <View className="gap-3">
            {menunggu.map((d) => (
              <View key={d.id} className="border border-amber-300 bg-amber-50/60 rounded-xl p-3">
                <Text className="text-sm font-medium text-foreground">{d.nama}</Text>
                <Text className="text-xs text-muted-foreground mb-2">Meminta izin: {formatTanggal(d.created_at)}{d.app_version ? ` · versi ${d.app_version}` : ""}</Text>
                {panelId !== d.id ? (
                  <View className="flex-row flex-wrap gap-2">
                    <Button size="sm" variant="primary" disabled={busyId === d.id} onPress={() => bukaPanel(d, "approve")}><Check size={14} color="#fff" /> Setujui</Button>
                    <Button size="sm" variant="destructive" disabled={busyId === d.id} onPress={() => jalankan("hapus", d, { judul: "Tolak permintaan", pesan: `Tolak & hapus permintaan "${d.nama}"? Perangkat itu tidak bisa presensi sampai mendaftar lagi.`, tombol: "Tolak" })}><Trash2 size={14} color="#fff" /> Tolak</Button>
                    <Button size="sm" variant="outline" disabled={busyId === d.id} onPress={() => jalankan("blokir", d, { judul: "Blokir perangkat", pesan: TEKS_BLOKIR(d.nama), tombol: "Blokir" })}><ShieldOff size={14} color={colors.foreground} /> Blokir</Button>
                  </View>
                ) : Panel(d)}
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      {diblokir.length > 0 ? (
        <Card padding="lg">
          <View className="flex-row items-center gap-2 mb-2">
            <ShieldOff size={20} color="#ef4444" />
            <Text className="font-semibold text-sm text-foreground">Diblokir ({diblokir.length})</Text>
          </View>
          <Text className="text-xs text-muted-foreground mb-2">Perangkat di sini tidak bisa presensi dan tidak bisa mengajukan izin lagi. Buka blokir bila sudah sesuai.</Text>
          <View className="gap-3">
            {diblokir.map((d) => (
              <View key={d.id} className="border-b border-border pb-3">
                <Text className="text-sm font-medium text-foreground">{d.nama} <Text className="text-[11px] text-muted-foreground">#{d.id}</Text></Text>
                <Text className="text-xs text-muted-foreground mb-2">Diblokir: {formatTanggal(d.blocked_at)}</Text>
                <View className="flex-row flex-wrap gap-2">
                  <Button size="sm" variant="primary" disabled={busyId === d.id} onPress={() => jalankan("bukablokir", d, { judul: "Buka blokir", pesan: `Buka blokir "${d.nama}"? Perangkat bisa mengajukan izin lagi dan tidak otomatis aktif.`, tombol: "Buka blokir" })}><ShieldCheck size={14} color="#fff" /> Buka blokir</Button>
                  <Button size="sm" variant="destructive" disabled={busyId === d.id} onPress={() => jalankan("hapus", d, { judul: "Hapus perangkat", pesan: `Hapus "${d.nama}" permanen? Setelah dihapus, perangkat itu tidak lagi tercatat diblokir dan boleh mengajukan izin lagi.`, tombol: "Hapus" })}><Trash2 size={14} color="#fff" /> Hapus</Button>
                </View>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      <Card padding="lg">
        <View className="flex-row items-center justify-between gap-2 mb-3 flex-wrap">
          <View className="flex-row items-center gap-2">
            <Tablet size={20} color={colors.primary} />
            <Text className="font-semibold text-sm text-foreground">Absensi Terhubung ({disetujui.length})</Text>
          </View>
          {!formOpen ? <Button size="sm" variant="outline" onPress={() => setFormOpen(true)}><Plus size={14} color={colors.foreground} /> Token manual</Button> : null}
        </View>

        {formOpen ? (
          <View className="gap-2 bg-card rounded-lg p-2.5 border border-border mb-3">
            <Text className="text-xs font-medium text-foreground">Buat token manual (untuk kiosk tanpa pembaruan otomatis)</Text>
            <TextInput value={nama} onChangeText={setNama} maxLength={100} placeholder="Nama perangkat (mis. ABSENSI GEDUNG A)" placeholderTextColor={colors.mutedForeground} accessibilityLabel="Nama perangkat kiosk" className="bg-input-background border border-border rounded-lg px-2.5 py-2 text-sm text-foreground" />
            <Text className="text-xs text-muted-foreground">Katalog (boleh lebih dari 1; kosongkan = semua katalog):</Text>
            {PilihKatalog(pickedBaru, (id) => toggle(setPickedBaru, id))}
            <View className="flex-row flex-wrap gap-2 mt-1">
              <Button size="sm" variant="primary" disabled={creating} loading={creating} onPress={buat}>Buat Perangkat</Button>
              <Button size="sm" variant="outline" disabled={creating} onPress={() => setFormOpen(false)}>Batal</Button>
            </View>
          </View>
        ) : null}

        {disetujui.length === 0 ? (
          <Text className="text-xs text-muted-foreground">Belum ada perangkat Absensi yang disetujui. Kiosk versi lama masih memakai token bersama.</Text>
        ) : (
          <View className="gap-3">
            {disetujui.map((d) => {
              const aktif = !!d.is_active;
              return (
                <View key={d.id} className="border-b border-border pb-3">
                  <Text className="text-sm font-medium text-foreground">{d.nama} <Text className="text-[11px] text-muted-foreground">#{d.id}</Text></Text>
                  <Text className="text-xs text-muted-foreground">Katalog: <Text className="font-medium text-foreground">{katalogTeks(d)}</Text> · <Text className={aktif ? "text-green-600" : "text-red-500"}>{aktif ? (terhubung(d.last_used_at) ? "● Terhubung" : "● Aktif") : "Dicabut"}</Text></Text>
                  <Text className="text-xs text-muted-foreground">Terakhir dipakai: {formatTanggal(d.last_used_at)}</Text>
                  <Text className="text-xs text-muted-foreground mb-2">Aplikasi Presensi: {d.app_version ? `v${d.app_version}${d.status_versi === "ada_update" ? " · ada versi lebih baru" : d.status_versi === "terbaru" ? " · terbaru" : ""}` : "versi belum dilaporkan"}</Text>
                  <View className="flex-row flex-wrap gap-2">
                    <Button size="sm" variant="outline" disabled={busyId === d.id} onPress={() => bukaPanel(d, "edit")}><Pencil size={14} color={colors.foreground} /> Ubah</Button>
                    {aktif ? (
                      <Button size="sm" variant="outline" disabled={busyId === d.id} onPress={() => jalankan("cabut", d, { judul: "Cabut perangkat", pesan: `Cabut akses perangkat "${d.nama}"? Kiosk itu berhenti bisa presensi sampai diaktifkan lagi.`, tombol: "Cabut" })}><Ban size={14} color={colors.foreground} /> Cabut</Button>
                    ) : (
                      <Button size="sm" variant="primary" disabled={busyId === d.id} onPress={() => jalankan("aktifkan", d)}><Check size={14} color="#fff" /> Aktifkan</Button>
                    )}
                    <Button size="sm" variant="destructive" disabled={busyId === d.id} onPress={() => jalankan("hapus", d, { judul: "Hapus perangkat", pesan: `Hapus perangkat "${d.nama}" permanen? Tokennya tidak akan bisa dipakai lagi.`, tombol: "Hapus" })}><Trash2 size={14} color="#fff" /> Hapus</Button>
                    <Button size="sm" variant="outline" disabled={busyId === d.id} onPress={() => jalankan("blokir", d, { judul: "Blokir perangkat", pesan: TEKS_BLOKIR(d.nama), tombol: "Blokir" })}><ShieldOff size={14} color={colors.foreground} /> Blokir</Button>
                  </View>
                  {panelId === d.id ? Panel(d) : null}
                </View>
              );
            })}
          </View>
        )}

        {meta.tokenLamaAda ? (
          <View className="mt-4 pt-3 border-t border-border gap-2">
            <View className="flex-row items-center gap-2"><KeyRound size={16} color={colors.mutedForeground} /><Text className="text-sm font-medium text-foreground">Token kiosk lama (bersama)</Text></View>
            <Text className="text-xs text-muted-foreground">
              Dipakai kiosk versi lama yang belum diperbarui. Matikan setelah semua kiosk muncul di daftar di atas dan berstatus aktif. Status: <Text className={meta.tokenLamaAktif ? "font-medium text-amber-600" : "font-medium text-foreground"}>{meta.tokenLamaAktif ? "Aktif" : "Mati"}</Text>
              {meta.tokenLamaTerakhirDipakai ? ` · terakhir dipakai kiosk: ${formatTanggal(meta.tokenLamaTerakhirDipakai)}` : " · belum pernah tercatat dipakai"}
            </Text>
            <View className="flex-row"><Button size="sm" variant={meta.tokenLamaAktif ? "outline" : "primary"} disabled={busyToken} loading={busyToken} onPress={ubahTokenLama}>{meta.tokenLamaAktif ? "Matikan" : "Aktifkan"}</Button></View>
          </View>
        ) : null}
      </Card>
    </View>
  );
}

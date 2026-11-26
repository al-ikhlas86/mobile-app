import React, { useState } from "react";
import { View, Text, Switch } from "react-native";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react-native";
import { Button } from "../../ui/Button";
import { SimplePicker } from "../../ui/SimplePicker";
import { api } from "../../../services/api";
import { useThemeColors } from "../../../context/ThemeContext";
import { Isian, Kolom, TIPE_LABEL, adaPendaftar, type FieldForm, type GelombangDetail, type Res } from "./mShared";

// Form builder (HP): padanan TabFormulir web. Dua kolom sistem selalu ada; setelah ada pendaftar struktur dikunci sebagian oleh server.
const slug = (label: string) => label.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^[^a-z]+/, "").slice(0, 30) || "kolom";
const kunciBaru = (label: string, dipakai: Set<string>) => { const d = slug(label); let k = d; let n = 2; while (dipakai.has(k) || k.length < 2) { k = `${d}_${n}`; n += 1; } return k; };

export function TabFormulir({ g, onChanged }: { g: GelombangDetail; onChanged: () => void }) {
  const colors = useThemeColors();
  const terkunciStruktur = adaPendaftar(g);
  const kunciLama = new Set(g.fields.map((f) => f.kunci));
  const [fields, setFields] = useState<FieldForm[]>(() => g.fields.map((f) => ({ ...f })));
  const [opsiTeks, setOpsiTeks] = useState<Record<number, string>>(() => Object.fromEntries(g.fields.map((f, i) => [i, (f.opsi ?? []).join("\n")])));
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const [berhasil, setBerhasil] = useState(false);

  const ubah = (i: number, patch: Partial<FieldForm>) => { setBerhasil(false); setFields((s) => s.map((f, j) => (j === i ? { ...f, ...patch } : f))); };
  const pindah = (i: number, arah: -1 | 1) => {
    const j = i + arah; if (j < 0 || j >= fields.length) return;
    setBerhasil(false);
    setFields((s) => { const c = [...s]; [c[i], c[j]] = [c[j], c[i]]; return c; });
    setOpsiTeks((o) => ({ ...o, [i]: o[j] ?? "", [j]: o[i] ?? "" }));
  };
  const hapus = (i: number) => {
    setBerhasil(false);
    setFields((s) => s.filter((_, j) => j !== i));
    setOpsiTeks((o) => { const n: Record<number, string> = {}; Object.entries(o).forEach(([k, v]) => { const x = Number(k); if (x < i) n[x] = v; else if (x > i) n[x - 1] = v; }); return n; });
  };
  const simpan = async () => {
    setGalat(""); setBerhasil(false); setSibuk(true);
    const dipakai = new Set(fields.filter((f) => f.kunci).map((f) => f.kunci));
    const kirim = fields.map((f, i) => {
      const kunci = f.kunci || kunciBaru(f.label, dipakai); dipakai.add(kunci);
      return { kunci, label: f.label, tipe: f.tipe, wajib: f.wajib, opsi: f.tipe === "pilihan" ? (opsiTeks[i] ?? "").split("\n").map((x) => x.trim()).filter(Boolean) : null, bantuan: f.bantuan || null, bagian: f.bagian || null };
    });
    const res = (await api.psbFormulirSimpan(g.id, kirim)) as Res;
    setSibuk(false);
    if (!res.success) { setGalat(res.message || "Gagal menyimpan formulir."); return; }
    setBerhasil(true); onChanged();
  };

  if (!g.bisaKelola) return <Text className="text-sm text-muted-foreground">Anda hanya bisa melihat formulir. {fields.length} kolom.</Text>;
  return (
    <View className="gap-3">
      {terkunciStruktur ? <Text className="text-xs bg-muted rounded-lg px-3 py-2 text-foreground">Gelombang ini sudah punya pendaftar. Kolom lama tidak bisa dihapus atau diganti jenisnya, dan kolom baru tidak boleh wajib. Judul, urutan, bantuan, dan penambahan pilihan tetap boleh.</Text> : null}
      {fields.map((f, i) => {
        const terkunci = f.sistem || (terkunciStruktur && kunciLama.has(f.kunci));
        return (
          <View key={f.kunci || `baru-${i}`} className="rounded-xl border border-border p-3 gap-2">
            <View className="flex-row items-center justify-between gap-2">
              <Text className="text-xs font-semibold text-muted-foreground flex-1">Kolom {i + 1}{f.sistem ? " · kolom sistem" : f.kunci ? ` · ${f.kunci}` : " · baru"}</Text>
              <View className="flex-row gap-1">
                <Button size="sm" variant="outline" disabled={i === 0} onPress={() => pindah(i, -1)} accessibilityLabel="Naikkan"><ArrowUp size={14} color={colors.primary} /></Button>
                <Button size="sm" variant="outline" disabled={i === fields.length - 1} onPress={() => pindah(i, 1)} accessibilityLabel="Turunkan"><ArrowDown size={14} color={colors.primary} /></Button>
                <Button size="sm" variant="outline" disabled={terkunci} onPress={() => hapus(i)} accessibilityLabel="Hapus kolom"><Trash2 size={14} color={colors.primary} /></Button>
              </View>
            </View>
            <Isian label="Judul kolom"><Kolom value={f.label} onChangeText={(v) => ubah(i, { label: v })} maxLength={160} /></Isian>
            <Isian label="Jenis isian">{terkunci ? <Text className="text-sm text-foreground">{TIPE_LABEL[f.tipe] ?? f.tipe}</Text> : <SimplePicker value={f.tipe} options={Object.entries(TIPE_LABEL).map(([value, label]) => ({ value, label }))} onChange={(v) => ubah(i, { tipe: v })} />}</Isian>
            <Isian label="Bagian (pengelompokan)"><Kolom value={f.bagian ?? ""} onChangeText={(v) => ubah(i, { bagian: v })} maxLength={80} placeholder="mis. Data orang tua" /></Isian>
            <Isian label="Teks bantuan"><Kolom value={f.bantuan ?? ""} onChangeText={(v) => ubah(i, { bantuan: v })} maxLength={300} /></Isian>
            {f.tipe === "pilihan" ? <Isian label="Pilihan (satu per baris, minimal 2)"><Kolom value={opsiTeks[i] ?? ""} onChangeText={(v) => { setBerhasil(false); setOpsiTeks((o) => ({ ...o, [i]: v })); }} multiline /></Isian> : null}
            <View className="flex-row items-center justify-between"><Text className="text-sm text-foreground">Wajib diisi</Text><Switch value={f.wajib} disabled={f.sistem || (terkunciStruktur && !kunciLama.has(f.kunci))} onValueChange={(v) => ubah(i, { wajib: v })} /></View>
          </View>
        );
      })}
      <View className="flex-row"><Button size="sm" variant="outline" disabled={fields.length >= 100} onPress={() => { setBerhasil(false); setFields((s) => [...s, { kunci: "", label: "", tipe: "teks", wajib: false, sistem: false, opsi: null, bantuan: null, bagian: null }]); }}><Plus size={14} color={colors.primary} /> Tambah kolom</Button></View>
      {galat ? <Text className="text-sm text-red-600">{galat}</Text> : null}
      {berhasil ? <Text className="text-sm text-green-700">Formulir disimpan.</Text> : null}
      <View className="flex-row"><Button size="sm" variant="primary" disabled={sibuk} loading={sibuk} onPress={() => void simpan()}>Simpan formulir</Button></View>
    </View>
  );
}

import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
// ScrollView dari react-native-gesture-handler (BUKAN dari "react-native")
// sengaja dipakai di sini - FlatList/ScrollView bawaan RN kalah rebutan
// gesture scroll saat dropdown ini dipasang di dalam FlatList/ScrollView
// layar induknya (mis. PresensiAdminTU, RekapitulasiKehadiranScreen),
// akibatnya list opsi mentok di baris ke-5 walau opsinya lebih banyak
// (dilaporkan user - "Semua Kelas" cuma sampai Kelas 2). ScrollView
// gesture-handler ikut sistem gesture recognizer yang sama dgn navigasi
// stack app ini (sudah terpasang, bukan dependency baru), jadi prioritas
// scroll nested-nya benar tanpa perlu balik ke <Modal>.
import { ScrollView } from "react-native-gesture-handler";
import { ChevronDown, ChevronUp, Check } from "lucide-react-native";
import { useThemeColors } from "../../context/ThemeContext";

interface Option { value: string; label: string; }

const ROW_HEIGHT = 44;
const MAX_VISIBLE_ROWS = 5;

// "Dropdown macet" (dilaporkan user, 2026-09-15, contoh: Buat Pengumuman -
// yang SEKARANG bisa punya 2 picker sekaligus di 1 layar sejak field
// katalog Sistem Katalog) - root cause: tiap SimplePicker cuma kelola state
// `open` MILIKNYA SENDIRI, tidak tahu-menahu soal instance lain. Kalau user
// buka dropdown A lalu (tanpa pilih opsi/tutup dulu) tap dropdown B, KEDUA
// list dropdown itu jadi render bersamaan (masing2 absolute-positioned,
// zIndex sama) - saling menutupi & rebutan sentuhan, kelihatan/kerasa
// "macet" (tap tidak seperti diharapkan, kadang harus tap 2-3x). Fix:
// pub-sub module-scope MINIMAL (bukan Context - tidak perlu ubah provider
// tree apa pun) - begitu 1 picker dibuka, semua picker LAIN yg sedang
// terbuka otomatis dipaksa nutup duluan. Ini di level komponen BERSAMA
// (dipakai di SEMUA layar/role), jadi otomatis menutup celah "macet" ini
// di mana pun SimplePicker dipakai, bukan cuma di 1 halaman contoh.
const openListeners = new Set<() => void>();
function closeOtherPickers(except: () => void) {
  openListeners.forEach((closeFn) => { if (closeFn !== except) closeFn(); });
}

// Pengganti <select> HTML (tidak ada padanan native langsung) - dropdown
// nempel LANGSUNG DI BAWAH kolomnya sendiri (spt <select> web/native
// biasa), BUKAN lagi bottom-sheet dari dasar layar. SEBELUMNYA pakai
// <Modal> bottom-sheet - selain user minta tampilannya diubah (harus
// muncul dari tempat teksnya, bukan numpuk dari bawah layar), desain
// BARU ini SEKALIAN menghilangkan <Modal> Android sepenuhnya (jadi
// otomatis tidak py masalah nav bar putih spt AccountSwitcher/dst -
// posisinya cukup relatif ke kolom-nya sendiri, tidak perlu menutupi 1
// layar penuh sama sekali). Tinggi dibatasi ~5 baris, kalau opsinya lebih
// banyak dari itu FlatList di dalam otomatis bisa di-scroll.
export function SimplePicker({ value, options, onChange, placeholder = "Pilih..." }: { value: string; options: Option[]; onChange: (v: string) => void; placeholder?: string }) {
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const maxHeight = Math.min(options.length, MAX_VISIBLE_ROWS) * ROW_HEIGHT;

  const closeThis = useCallback(() => setOpen(false), []);
  useEffect(() => {
    openListeners.add(closeThis);
    return () => { openListeners.delete(closeThis); };
  }, [closeThis]);

  const toggle = () => {
    setOpen((wasOpen) => {
      const next = !wasOpen;
      if (next) closeOtherPickers(closeThis);
      return next;
    });
  };

  return (
    <View style={{ position: "relative", zIndex: open ? 50 : 1 }}>
      <Pressable onPress={toggle} className="flex-row items-center justify-between px-3 py-2.5 rounded-xl bg-muted">
        <Text numberOfLines={1} className="flex-1 text-sm font-medium text-foreground">{selected?.label ?? placeholder}</Text>
        {open ? <ChevronUp size={16} color={colors.mutedForeground} /> : <ChevronDown size={16} color={colors.mutedForeground} />}
      </Pressable>
      {open && (
        <View
          className="absolute left-0 right-0 bg-card border border-border rounded-xl overflow-hidden"
          style={{ top: "100%", marginTop: 4, zIndex: 50, elevation: 8, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }}
        >
          <ScrollView style={{ maxHeight }} nestedScrollEnabled showsVerticalScrollIndicator>
            {options.map((item) => (
              <Pressable
                key={item.value}
                onPress={() => { onChange(item.value); setOpen(false); }}
                className="flex-row items-center justify-between px-4 border-b border-border/50"
                style={{ height: ROW_HEIGHT }}
              >
                <Text numberOfLines={1} className="flex-1 text-sm text-foreground">{item.label}</Text>
                {item.value === value && <Check size={16} color={colors.primary} />}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

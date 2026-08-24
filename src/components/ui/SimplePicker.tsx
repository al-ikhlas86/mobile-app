import React, { useState } from "react";
import { View, Text, Pressable, FlatList } from "react-native";
import { ChevronDown, ChevronUp, Check } from "lucide-react-native";

interface Option { value: string; label: string; }

const ROW_HEIGHT = 44;
const MAX_VISIBLE_ROWS = 5;

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
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const maxHeight = Math.min(options.length, MAX_VISIBLE_ROWS) * ROW_HEIGHT;

  return (
    <View style={{ position: "relative", zIndex: open ? 50 : 1 }}>
      <Pressable onPress={() => setOpen((v) => !v)} className="flex-row items-center justify-between px-3 py-2.5 rounded-xl bg-muted">
        <Text numberOfLines={1} className="flex-1 text-sm font-medium text-foreground">{selected?.label ?? placeholder}</Text>
        {open ? <ChevronUp size={16} color="#6E776F" /> : <ChevronDown size={16} color="#6E776F" />}
      </Pressable>
      {open && (
        <View
          className="absolute left-0 right-0 bg-card border border-border rounded-xl overflow-hidden"
          style={{ top: "100%", marginTop: 4, zIndex: 50, elevation: 8, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }}
        >
          <FlatList
            data={options}
            keyExtractor={(o) => o.value}
            style={{ maxHeight }}
            nestedScrollEnabled
            renderItem={({ item }) => (
              <Pressable
                onPress={() => { onChange(item.value); setOpen(false); }}
                className="flex-row items-center justify-between px-4 border-b border-border/50"
                style={{ height: ROW_HEIGHT }}
              >
                <Text numberOfLines={1} className="flex-1 text-sm text-foreground">{item.label}</Text>
                {item.value === value && <Check size={16} color="#356447" />}
              </Pressable>
            )}
          />
        </View>
      )}
    </View>
  );
}

import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react-native";
import { useThemeColors } from "../../context/ThemeContext";

interface Props {
  value: string; // "YYYY-MM-DD"
  onChange: (v: string) => void;
}

const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const WEEKDAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function formatDisplay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
}

// Kalender mini anchored (bukan modal/bottom-sheet) - user bisa klik
// tanggal langsung di grid ATAU tombol "Hari Ini". Pengganti 3 dropdown
// terpisah (day/month/year) yang dirasa kurang intuitif - dibangun murni
// dari View/Pressable (TIDAK pakai @react-native-community/datetimepicker
// atau library kalender manapun) supaya TIDAK butuh native module baru/
// build ulang APK, sama prinsipnya dgn SimplePicker.
export function SimpleCalendarPicker({ value, onChange }: Props) {
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);
  const [y, m] = value.split("-").map(Number);
  const [viewYear, setViewYear] = useState(y);
  const [viewMonth, setViewMonth] = useState(m); // 1-12

  function openPicker() {
    const [cy, cm] = value.split("-").map(Number);
    setViewYear(cy);
    setViewMonth(cm);
    setOpen((v) => !v);
  }

  function changeMonth(delta: number) {
    let nm = viewMonth + delta;
    let ny = viewYear;
    if (nm < 1) { nm = 12; ny -= 1; }
    if (nm > 12) { nm = 1; ny += 1; }
    setViewMonth(nm);
    setViewYear(ny);
  }

  function selectDay(d: number) {
    onChange(toDateStr(viewYear, viewMonth, d));
    setOpen(false);
  }

  function selectToday() {
    const t = new Date();
    onChange(toDateStr(t.getFullYear(), t.getMonth() + 1, t.getDate()));
    setOpen(false);
  }

  const firstWeekday = new Date(viewYear, viewMonth - 1, 1).getDay(); // 0=Min
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const todayStr = toDateStr(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate());

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <View style={{ position: "relative", zIndex: open ? 50 : 1 }}>
      <Pressable onPress={openPicker} className="flex-row items-center gap-2 px-3 py-2.5 rounded-xl bg-input-background border border-border">
        <CalendarIcon size={15} color={colors.mutedForeground} />
        <Text className="flex-1 text-sm text-foreground">{formatDisplay(value)}</Text>
        {open ? <ChevronUp size={15} color={colors.mutedForeground} /> : <ChevronDown size={15} color={colors.mutedForeground} />}
      </Pressable>

      {open && (
        <View
          className="absolute left-0 right-0 bg-card border border-border rounded-xl p-3"
          style={{ top: "100%", marginTop: 4, zIndex: 50, elevation: 8, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }}
        >
          <View className="flex-row items-center justify-between mb-2">
            <Pressable onPress={() => changeMonth(-1)} className="p-1.5 rounded-lg"><ChevronLeft size={16} color={colors.primary} /></Pressable>
            <Text className="text-sm font-semibold text-foreground">{MONTH_NAMES[viewMonth - 1]} {viewYear}</Text>
            <Pressable onPress={() => changeMonth(1)} className="p-1.5 rounded-lg"><ChevronRight size={16} color={colors.primary} /></Pressable>
          </View>

          <View className="flex-row mb-1">
            {WEEKDAY_LABELS.map((w) => (
              <View key={w} style={{ width: `${100 / 7}%` }} className="items-center py-1">
                <Text className="text-[10px] text-muted-foreground">{w}</Text>
              </View>
            ))}
          </View>

          {rows.map((row, ri) => (
            <View key={ri} className="flex-row">
              {row.map((d, ci) => {
                if (d === null) return <View key={ci} style={{ width: `${100 / 7}%` }} />;
                const dateStr = toDateStr(viewYear, viewMonth, d);
                const isSelected = dateStr === value;
                const isToday = dateStr === todayStr;
                return (
                  <View key={ci} style={{ width: `${100 / 7}%` }} className="items-center py-0.5">
                    <Pressable
                      onPress={() => selectDay(d)}
                      className="w-8 h-8 items-center justify-center rounded-full"
                      style={isSelected ? { backgroundColor: colors.primary } : isToday ? { borderWidth: 1, borderColor: colors.primary } : undefined}
                    >
                      <Text className={`text-xs ${isSelected ? "text-primary-foreground font-semibold" : isToday ? "text-primary font-medium" : "text-foreground"}`}>{d}</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ))}

          <Pressable onPress={selectToday} className="mt-2 py-2 rounded-lg items-center bg-muted">
            <Text className="text-xs font-medium text-primary">Hari Ini</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

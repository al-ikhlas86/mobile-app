import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Home, FileText, Clock, User, ScanLine } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";

// Bar bawah lima tombol (2026-11-27), port dari BottomNav.tsx webview: dua kiri, SCAN di tengah (lebih besar, menonjol dari lekuk bar), dua kanan.
// Tombol Scan berada DI DALAM area tinggi bar (ada ruang transparan di atas bar) karena di Android sentuhan di luar batas induk tidak sampai ke anak.
const TINGGI_BAR = 64;
const TONJOL = 30;        // bagian tombol Scan yang menonjol di atas bar
const UKURAN_SCAN = 68;
const LEKUK_LEBAR = 92;
const LEKUK_DALAM = 41;
const SUDUT = 24;

const ITEM: Record<string, { label: string; Icon: React.ComponentType<{ size: number; color: string }> }> = {
  dashboard: { label: "Beranda", Icon: Home },
  "berita-acara": { label: "Berita", Icon: FileText },
  presensi: { label: "Presensi", Icon: Clock },
  profil: { label: "Profil", Icon: User },
};

interface Props extends BottomTabBarProps {
  onOpenSwitcher: () => void;
}

export function ScanTabBar({ state, navigation, onOpenSwitcher }: Props) {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [lebar, setLebar] = useState(0);
  const aktifWarna = isDark ? "#D0AF68" : "#356447";
  const pasifWarna = isDark ? "#A3A3AA" : "#6E776F";
  const bg = isDark ? "#212127" : "#FFFFFF";
  const garis = isDark ? "rgba(255,255,255,0.1)" : "rgba(33,57,41,0.1)";
  const latar = isDark ? "#09090B" : "#E6E9E2"; // = warna latar halaman (global.css / RootNavigator): cincin tombol Scan tampak "terpotong" dari bar
  const total = TINGGI_BAR + insets.bottom;

  const tekan = (route: { key: string; name: string; params?: object }, fokus: boolean) => {
    const e = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (!fokus && !e.defaultPrevented) navigation.navigate(route.name, route.params);
  };

  const cx = lebar / 2;
  const d = lebar > 0
    ? `M0 ${SUDUT} Q0 0 ${SUDUT} 0 L${cx - LEKUK_LEBAR / 2} 0 C${cx - LEKUK_LEBAR / 2 + 14} 0 ${cx - LEKUK_LEBAR / 2 + 20} ${LEKUK_DALAM} ${cx} ${LEKUK_DALAM} C${cx + LEKUK_LEBAR / 2 - 20} ${LEKUK_DALAM} ${cx + LEKUK_LEBAR / 2 - 14} 0 ${cx + LEKUK_LEBAR / 2} 0 L${lebar - SUDUT} 0 Q${lebar} 0 ${lebar} ${SUDUT} L${lebar} ${total} L0 ${total} Z`
    : "";

  const tombol = (index: number) => {
    const route = state.routes[index];
    const info = ITEM[route.name];
    if (!info) return null;
    const fokus = state.index === index;
    const warna = fokus ? aktifWarna : pasifWarna;
    return (
      <Pressable
        key={route.key}
        onPress={() => tekan(route, fokus)}
        onLongPress={route.name === "profil" ? onOpenSwitcher : undefined}
        delayLongPress={350}
        accessibilityRole="button"
        accessibilityState={fokus ? { selected: true } : {}}
        accessibilityLabel={info.label}
        style={{ flex: 1, alignItems: "center", justifyContent: "center", height: TINGGI_BAR, gap: 4 }}
      >
        <info.Icon size={22} color={warna} />
        <Text style={{ fontSize: 10, color: warna, fontWeight: fokus ? "700" : "500" }}>{info.label}</Text>
        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: fokus ? aktifWarna : "transparent" }} />
      </Pressable>
    );
  };

  const idxScan = state.routes.findIndex((r) => r.name === "scan");
  const scanFokus = state.index === idxScan;
  // Urutan route di Navigator: dashboard, berita-acara, scan, presensi, profil
  const kiri = [0, 1];
  const kanan = [3, 4];

  return (
    <View pointerEvents="box-none" style={{ height: total + TONJOL }} onLayout={(e) => setLebar(e.nativeEvent.layout.width)}>
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: total }}>
        {lebar > 0 && (
          <Svg width={lebar} height={total} style={{ position: "absolute", left: 0, top: 0 }}>
            <Path d={d} fill={bg} stroke={garis} strokeWidth={1} />
          </Svg>
        )}
        <View style={{ flexDirection: "row", height: TINGGI_BAR }}>
          <View style={{ flex: 1, flexDirection: "row" }}>{kiri.map(tombol)}</View>
          <View style={{ width: LEKUK_LEBAR }} />
          <View style={{ flex: 1, flexDirection: "row" }}>{kanan.map(tombol)}</View>
        </View>
        <Text pointerEvents="none" style={{ position: "absolute", bottom: insets.bottom + 7, alignSelf: "center", fontSize: 10, color: scanFokus ? aktifWarna : pasifWarna, fontWeight: scanFokus ? "700" : "500" }}>Scan</Text>
      </View>
      <Pressable
        onPress={() => idxScan >= 0 && tekan(state.routes[idxScan], scanFokus)}
        accessibilityRole="button"
        accessibilityLabel="Scan"
        style={({ pressed }) => ({
          position: "absolute", top: 0, alignSelf: "center", width: UKURAN_SCAN, height: UKURAN_SCAN, borderRadius: UKURAN_SCAN / 2,
          backgroundColor: aktifWarna, alignItems: "center", justifyContent: "center", borderWidth: 5, borderColor: latar,
          transform: [{ scale: pressed ? 0.95 : 1 }], shadowColor: aktifWarna, shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 8,
        })}
      >
        <ScanLine size={32} color={isDark ? "#1A1710" : "#FFFFFF"} strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}

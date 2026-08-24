import { Platform } from "react-native";
import * as NavigationBar from "expo-navigation-bar";

// Satu tempat, dipanggil SEKALI tiap tema berganti (lihat ThemeContext.tsx)
// - sama spt Dashboard/Presensi/dst yang sudah benar dari awal. Sempat
// dikira perlu ditambal timing/polling di banyak tempat (Login, modal
// Ganti Akun) krn KELIHATANNYA cuma 2 layar itu yang gagal - akar
// masalah SEBENARNYA bukan timing sama sekali: KeyboardProvider
// (react-native-keyboard-controller) menimpa balik pengaturan ini kalau
// tidak dikasih `preserveEdgeToEdge` (lihat App.tsx). Setelah itu
// diperbaiki di sumbernya, 1 pemanggilan ini di sini sudah cukup utk
// SEMUA layar termasuk Login/modal, tidak ada perlakuan khusus lagi.
export function applyNavBarStyle(isDark: boolean) {
  if (Platform.OS !== "android") return;
  try {
    NavigationBar.setStyle(isDark ? "light" : "dark");
  } catch {
    // Diam - device tanpa nav bar fisik/gesture-only dst, bukan fatal.
  }
}

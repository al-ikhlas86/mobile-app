import "./src/styles/global.css";
import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ThemeProvider, useTheme } from "./src/context/ThemeContext";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { loadAuthState } from "./src/services/authService";
import { loadDemoState } from "./src/services/demoService";

function Splash() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator size="large" color="#356447" />
    </View>
  );
}

// className="dark" di SINI yang tadinya hilang total - semua warna
// (bg-background, text-foreground, dst) resolve lewat CSS variable yang
// didefinisikan di global.css pakai selector ".dark { ... }" (SAMA PERSIS
// pola web: document.documentElement.classList.toggle("dark", ...)) - tanpa
// ada elemen NYATA yang ditandai "dark" di pohon komponen, variabel itu
// TIDAK PERNAH switch walau ThemeContext.isDark sudah true (state-nya
// benar, tapi tidak pernah dibaca oleh mesin style manapun) - itu sebabnya
// SEBELUMNYA cuma navbar (dihitung manual dari isDark di JS, bukan lewat
// className) yang ikut berubah, sisanya diam di tema terang terus.
function ThemedApp({ ready }: { ready: boolean }) {
  const { isDark } = useTheme();
  return (
    <View className={`flex-1 ${isDark ? "dark" : ""}`}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      {ready ? <RootNavigator /> : <Splash />}
    </View>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([loadAuthState(), loadDemoState()]).finally(() => setReady(true));
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* preserveEdgeToEdge - AKAR MASALAH SEBENARNYA dari "tombol navigasi
          Android putih di layar Login/modal Ganti Akun, padahal Dashboard/
          Presensi/Notifikasi/Profil benar". KeyboardProvider (dipasang utk
          keyboard tidak nutup input) MENGELOLA mode edge-to-edge Android
          SENDIRI dan diam2 menimpa balik pengaturan dari expo-navigation-bar
          - itulah kenapa CUMA layar dgn keyboard aktif (Login py form) yg
          rusak, layar tanpa form (Dashboard dst) aman krn interferensinya
          tidak pernah kepicu. `preserveEdgeToEdge` eksplisit bilang ke
          KeyboardProvider "biarkan library LAIN (expo-navigation-bar) yg
          atur ini, jangan ditimpa" - didokumentasikan resmi di API-nya utk
          KASUS PERSIS INI. Dgn ini, Login/modal otomatis benar SAMA PERSIS
          spt layar lain, TANPA perlu kode timing/reapply manual apapun lagi
          (semua itu sudah dihapus - akar masalahnya yg diperbaiki, bukan
          gejalanya ditambal terus). */}
      <KeyboardProvider preserveEdgeToEdge statusBarTranslucent navigationBarTranslucent>
        <SafeAreaProvider>
          <ThemeProvider>
            <ThemedApp ready={ready} />
          </ThemeProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

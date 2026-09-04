import "./src/styles/global.css";
import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, StatusBar, AppState } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ThemeProvider, useTheme } from "./src/context/ThemeContext";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { loadAuthState } from "./src/services/authService";
import { loadDemoState } from "./src/services/demoService";
import { refreshSessionFromServer } from "./src/services/api";
import { resetViewingYear } from "./src/services/viewingYearService";

// BUG NYATA ditemukan 2026-09-04 (laporan user, dites nyata: tempel
// capability Admin Media SD ke akun sungguhan, menu barunya TIDAK PERNAH
// muncul di HP) - lihat catatan lengkap di webview App.tsx/authService.ts.
// Native: dipanggil begitu app siap DAN tiap kali app kembali ke foreground
// (AppState 'active' - skenario paling umum: HP di-lock/pindah app lalu
// dibuka lagi), bukan cuma sekali saat start. Fungsinya sendiri SEKARANG
// tinggal di services/api.ts (2026-09-04, Fase 4) - dipanggil juga dari
// RootNavigator.tsx (popup "Ganti Tahun Ajaran"), pindah kesana biar tidak
// perlu impor melingkar App.tsx<->RootNavigator.tsx.

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
    // resetViewingYear() (2026-09-04, Fase 4) - "reset ke tahun aktif tiap
    // login" (diminta eksplisit user) - app-start adalah salah satu titiknya
    // (2 lainnya: handleLogin/handleSwitchAccount di RootNavigator.tsx).
    resetViewingYear();
    Promise.all([loadAuthState(), loadDemoState()]).finally(() => {
      setReady(true);
      refreshSessionFromServer();
    });
  }, []);

  // Refresh sesi tiap app kembali ke foreground (2026-09-04) - lihat
  // catatan panjang di atas. 'active' = app kembali kelihatan/dipakai
  // (dari background ATAU dari terkunci) - skenario paling umum di HP:
  // TU/Admin IT kasih capability baru, guru yg appnya SUDAH terbuka
  // minimize sebentar lalu buka lagi.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshSessionFromServer();
    });
    return () => sub.remove();
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

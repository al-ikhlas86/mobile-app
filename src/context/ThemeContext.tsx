import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { applyNavBarStyle } from "../utils/navBarStyle";

export type ThemePreference = "light" | "dark";

interface ThemeContextValue {
  theme: ThemePreference;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (t: ThemePreference) => void;
}

const STORAGE_KEY = "alikhlas86_theme";

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  isDark: false,
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [theme, setThemeState] = useState<ThemePreference>(systemScheme === "dark" ? "dark" : "light");
  const [loaded, setLoaded] = useState(false);

  // Baca preferensi tersimpan sekali di awal - kalau belum pernah diset,
  // ikuti tema sistem HP (sama seperti default web: prefers-color-scheme).
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === "light" || saved === "dark") setThemeState(saved);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(STORAGE_KEY, theme).catch(() => {});
  }, [theme, loaded]);

  // Ikon tombol navigasi bawaan Android (segitiga/lingkaran/kotak) warnanya
  // TIDAK otomatis ikut tema app - defaultnya "light" (ikon putih), yang
  // KEBETULAN kelihatan di background gelap tapi jadi TIDAK KELIHATAN sama
  // sekali di tema terang (putih di atas putih). Disamakan manual tiap tema
  // berganti - TIDAK pakai style "auto" krn itu ikut skema warna SISTEM HP,
  // bukan toggle tema di DALAM app ini (2 hal beda, user bisa app-nya gelap
  // walau HP-nya terang). SATU pemanggilan di sini SUDAH CUKUP utk SEMUA
  // layar (termasuk Login/modal Ganti Akun, yg sempat kelihatan "beda" -
  // akar masalahnya ternyata KeyboardProvider menimpa baliknya, sudah
  // diperbaiki di App.tsx via preserveEdgeToEdge, BUKAN soal timing).
  useEffect(() => {
    applyNavBarStyle(theme === "dark");
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setThemeState((t) => (t === "light" ? "dark" : "light"));
  }, []);

  const setTheme = useCallback((t: ThemePreference) => setThemeState(t), []);

  return (
    <ThemeContext.Provider value={{ theme, isDark: theme === "dark", toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

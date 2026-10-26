// Menu "Kelola Website" untuk Pengelola Website (orang yang ditunjuk Admin IT; lihat backend routes/website.js).
// Hak TIDAK ikut role/kapasitas lain, jadi menunya dimunculkan dari jawaban server (/api/website/akses), di dashboard mana pun
// orang itu berada. Admin IT memakai menu statis di dashboardnya sendiri.
import React, { useEffect, useState } from "react";
import { Globe } from "lucide-react-native";
import { api } from "../services/api";
import { getActiveSession } from "../services/authService";
import type { MenuCategory } from "./QuickMenuGrid";

const TTL_MS = 5 * 60 * 1000;
let cache: { kunci: string; at: number; boleh: boolean } | null = null;

export function useAksesWebsite(): boolean {
  const sesi = getActiveSession();
  const kunci = sesi?.accountId ?? "";
  const segar = cache !== null && cache.kunci === kunci && Date.now() - cache.at < TTL_MS;
  const [boleh, setBoleh] = useState(segar ? cache!.boleh : false);
  useEffect(() => {
    if (!sesi || sesi.role === "Orang Tua") { setBoleh(false); return undefined; }
    if (cache !== null && cache.kunci === kunci && Date.now() - cache.at < TTL_MS) { setBoleh(cache.boleh); return undefined; }
    let batal = false;
    api.websiteAkses().then((res) => {
      const b = Boolean(res.success && res.data?.boleh);
      cache = { kunci, at: Date.now(), boleh: b };
      if (!batal) setBoleh(b);
    }).catch(() => undefined);
    return () => { batal = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kunci]);
  return boleh;
}

export function dgnMenuWebsite(kategori: MenuCategory[], boleh: boolean, onNavigate: (screen: string) => void): MenuCategory[] {
  if (!boleh || kategori.length === 0) return kategori;
  const item = { label: "Kelola Website", icon: <Globe size={20} color="#0f766e" />, colorScheme: "teal" as const, onPress: () => onNavigate("kelola-website") };
  return kategori.map((c, i) => (i === kategori.length - 1 ? { ...c, items: [...c.items, item] } : c));
}

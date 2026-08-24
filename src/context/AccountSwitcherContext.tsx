import React, { createContext, useContext, useState, useCallback } from "react";

interface Ctx { open: () => void; visible: boolean; close: () => void; }
const AccountSwitcherContext = createContext<Ctx>({ open: () => {}, visible: false, close: () => {} });

// Dipakai DashboardLayout (avatar header) & ProfilScreen ("Ganti Akun") biar
// bisa buka modal switcher yang SAMA tanpa nge-drill prop lewat 8 file
// dashboard per-role - keduanya jauh dari RootNavigator (yg simpan state
// akun sesungguhnya) di pohon komponen.
export function AccountSwitcherProvider({ children, visible, onOpen, onClose }: { children: React.ReactNode; visible: boolean; onOpen: () => void; onClose: () => void }) {
  return <AccountSwitcherContext.Provider value={{ open: onOpen, visible, close: onClose }}>{children}</AccountSwitcherContext.Provider>;
}

export function useAccountSwitcher() {
  return useContext(AccountSwitcherContext);
}

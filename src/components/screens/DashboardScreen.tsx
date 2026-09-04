import React from "react";
import { AdminITDashboard } from "./dashboards/AdminITDashboard";
import { SupervisorDashboard } from "./dashboards/SupervisorDashboard";
import { AdminTUDashboard } from "./dashboards/AdminTUDashboard";
import { AdminMediaDashboard } from "./dashboards/AdminMediaDashboard";
import { KeuanganDashboard } from "./dashboards/KeuanganDashboard";
import { OrangTuaDashboard } from "./dashboards/OrangTuaDashboard";
import { GuruDashboard } from "./dashboards/GuruDashboard";
import { PegawaiDashboard } from "./dashboards/PegawaiDashboard";
import type { RoleName } from "../../services/authService";

interface Props {
  role: RoleName;
  onNavigate: (screen: string, params?: Record<string, unknown>) => void;
}

const ADMIN_MEDIA_ROLES: RoleName[] = ["Admin Media (SD)", "Admin Media (TK & Playground)"];

// Dispatcher per-role - persis pola AppScreen() di App.tsx versi webview:
// masing-masing role py dashboard & menu SENDIRI, bukan 1 tampilan generik
// utk semua orang.
export function DashboardScreen({ role, onNavigate }: Props) {
  if (role === "Admin IT") return <AdminITDashboard onNavigate={onNavigate} />;
  if (role === "Supervisor") return <SupervisorDashboard onNavigate={onNavigate} />;
  if (role === "Admin TU (SD)" || role === "Admin TU (TK & Playground)") return <AdminTUDashboard onNavigate={onNavigate} />;
  // Kepala Sekolah (2026-09-04) - BUKAN role/dashboard terpisah lagi,
  // sekarang FLAG (session.isKepalaSekolah) di atas role dasar - falls
  // through ke GuruDashboard/PegawaiDashboard di bawah, yang masing2 baca
  // flag-nya sendiri lewat getActiveSession(). Lihat webview App.tsx utk
  // catatan lengkap.
  if (ADMIN_MEDIA_ROLES.includes(role)) return <AdminMediaDashboard onNavigate={onNavigate} role={role} />;
  if (role === "Keuangan") return <KeuanganDashboard onNavigate={onNavigate} />;
  if (role === "Orang Tua") return <OrangTuaDashboard onNavigate={onNavigate} />;
  if (role === "Guru" || role === "Guru Kelas") return <GuruDashboard onNavigate={onNavigate} role={role} />;
  if (role === "Pegawai") return <PegawaiDashboard onNavigate={onNavigate} />;
  return <AdminITDashboard onNavigate={onNavigate} />;
}

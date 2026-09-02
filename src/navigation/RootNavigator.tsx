import React, { useState, useRef, useEffect } from "react";
import { View, Pressable, BackHandler } from "react-native";
import { X } from "lucide-react-native";
import { NavigationContainer, DefaultTheme, DarkTheme, type NavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { MainTabs } from "./MainTabs";
import { LoginScreen } from "../components/screens/LoginScreen";
import { FaceEnrollmentScreen } from "../components/screens/FaceEnrollmentScreen";
import { UbahPasswordScreen } from "../components/screens/UbahPasswordScreen";
import { WaBotConnectionScreen } from "../components/screens/WaBotConnectionScreen";
import { PresensiAdminTU } from "../components/screens/PresensiAdminTU";
import { PersetujuanIzinScreen } from "../components/screens/PersetujuanIzinScreen";
import { PersetujuanIzinGuruScreen } from "../components/screens/PersetujuanIzinGuruScreen";
import { PengaturanLokasiScreen } from "../components/screens/PengaturanLokasiScreen";
import { PengaturanJamKeterlambatanScreen } from "../components/screens/PengaturanJamKeterlambatanScreen";
import { RingkasanScreen } from "../components/screens/RingkasanScreen";
import { PerformaCariScreen } from "../components/screens/PerformaCariScreen";
import { RekapitulasiKehadiranScreen } from "../components/screens/RekapitulasiKehadiranScreen";
import { KirimAduanScreen } from "../components/screens/KirimAduanScreen";
import { AduanMasukScreen } from "../components/screens/AduanMasukScreen";
import { ManajemenPenggunaScreen } from "../components/screens/ManajemenPenggunaScreen";
import { RoleHakAksesScreen } from "../components/screens/RoleHakAksesScreen";
import { BuatPengumumanScreen } from "../components/screens/BuatPengumumanScreen";
import { BackupDatabaseScreen } from "../components/screens/BackupDatabaseScreen";
import { SyncStatusScreen } from "../components/screens/SyncStatusScreen";
import { ActivityLogScreen } from "../components/screens/ActivityLogScreen";
import { KeuanganAdmin } from "../components/screens/KeuanganAdmin";
import { DetailPembayaran } from "../components/screens/DetailPembayaran";
import { BeritaAcaraAdmin } from "../components/screens/BeritaAcaraAdmin";
import { StatistikKontenScreen } from "../components/screens/StatistikKontenScreen";
import { BlokiranKomentarScreen } from "../components/screens/BlokiranKomentarScreen";
import { BeritaAcaraViewer } from "../components/screens/BeritaAcaraViewer";
import { JadwalPelajaranScreen } from "../components/screens/JadwalPelajaranScreen";
import { BuatTugasScreen } from "../components/screens/BuatTugasScreen";
import { TugasAnakScreen } from "../components/screens/TugasAnakScreen";
import { JadwalKerjaScreen } from "../components/screens/JadwalKerjaScreen";
import { CariSiswaGuruScreen } from "../components/screens/CariSiswaGuruScreen";
import { PersetujuanPsbScreen } from "../components/screens/PersetujuanPsbScreen";
import { PlaceholderScreen } from "../components/screens/PlaceholderScreen";
import { getActiveSession, getActiveToken, getRealActiveSession, getSavedAccounts, switchAccount, removeAccount, updateAccountAvatar, logout as authLogout, type ActiveSession, type SavedAccount, type RoleName } from "../services/authService";
import { fetchDemoRoles, startDemoSession, exitDemoMode, isDemoActive, type DemoRoleOption } from "../services/demoService";
import { useTheme } from "../context/ThemeContext";
import { AccountSwitcherProvider } from "../context/AccountSwitcherContext";
import { AccountSwitcher } from "../components/AccountSwitcher";
import { DemoModeSwitcher } from "../components/DemoModeSwitcher";
import { DemoModeBanner } from "../components/DemoModeBanner";
import { initPushNotifications } from "../services/pushNotifications";
import { resolveNavScreen } from "../utils/navAlias";

const Stack = createNativeStackNavigator();

// Nama layar yang SEBENARNYA hidup DI DALAM MainTabs (bottom tabs), bukan
// Stack.Screen langsung di sini. React Navigation TIDAK otomatis "menyelam"
// ke navigator bersarang cuma dari nama polos (`navigate("presensi")`) kalau
// dipanggil dari LUAR tab itu sendiri - harus eksplisit
// `navigate("main", { screen: "presensi" })`. SEBELUMNYA semua tombol menu
// dashboard (Presensi/Profil/Berita Acara/dst) diam-diam GAGAL total
// (`navigate("presensi")` polos), cuma ketahuan dari log Metro
// ("NAVIGATE ... was not handled by any navigator") - laporan user
// sebelumnya sempat dikira sudah beres krn dites lewat pembacaan kode, BUKAN
// lewat klik sungguhan di HP.
const TAB_SCREENS = new Set(["dashboard", "berita-acara", "presensi", "notifikasi", "profil"]);

function navigateTo(navigation: { navigate: (name: string, params?: unknown) => void } | null | undefined, screen: string, params?: Record<string, unknown>) {
  if (!navigation) return;
  if (TAB_SCREENS.has(screen)) {
    navigation.navigate("main", { screen, params });
  } else {
    navigation.navigate(screen, params);
  }
}

export function RootNavigator() {
  const { isDark } = useTheme();
  const [session, setSession] = useState<ActiveSession | null>(() => getActiveSession());
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>(() => getSavedAccounts());
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const navigationRef = useRef<NavigationContainerRef<any>>(null);

  // ---- Mode Demo - lihat catatan lengkap di App.tsx webview
  // (authService.ts/demoService.ts) utk desain isolasi total.
  const [showDemoSwitcher, setShowDemoSwitcher] = useState(false);
  const [demoActive, setDemoActive] = useState(() => isDemoActive());
  const [demoRoles, setDemoRoles] = useState<DemoRoleOption[]>([]);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const canUseDemoMode = getRealActiveSession()?.role === "Admin IT" || demoActive;

  const handleLoadDemoRoles = async () => {
    if (demoRoles.length > 0) return;
    const token = getActiveToken();
    if (!token) return;
    const roles = await fetchDemoRoles(token);
    setDemoRoles(roles);
  };

  const handlePickDemoRole = async (roleValue: string) => {
    setDemoLoading(true);
    setDemoError(null);
    const token = getActiveToken();
    const result = await startDemoSession(roleValue, token ?? "");
    setDemoLoading(false);
    if (!result.success) {
      setDemoError(result.message);
      return;
    }
    setDemoActive(true);
    setShowDemoSwitcher(false);
    const s = getActiveSession();
    if (s) applySession(s);
  };

  const handleExitDemo = async () => {
    await exitDemoMode();
    setDemoActive(false);
    setShowDemoSwitcher(false);
    const s = getActiveSession();
    if (s) applySession(s);
    else setSession(null);
  };

  // Tombol kembali fisik Android SEBELUMNYA langsung nutup app krn tidak ada
  // yang pernah mendengarkan event ini sama sekali - default handling
  // react-navigation ternyata TIDAK otomatis aktif di setup Stack+Tab
  // bersarang ini. Dipasang eksplisit: kalau navigator (stack ATAU riwayat
  // tab) masih bisa mundur, mundur 1 langkah & konsumsi event (return true);
  // kalau sudah di halaman paling awal, biarkan Android proses default-nya
  // (keluar app) dgn return false. Overlay "Ganti Akun"/"Tambah Akun"
  // SEKARANG bukan <Modal> lagi (lihat catatan di AccountSwitcher.tsx),
  // jadi tombol kembali fisik TIDAK otomatis menutupnya lagi spt sblmnya -
  // dicek DULUAN di sini sebelum navigasi stack biasa.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (showAddAccount) {
        setShowAddAccount(false);
        return true;
      }
      if (showSwitcher) {
        setShowSwitcher(false);
        return true;
      }
      if (navigationRef.current?.canGoBack()) {
        navigationRef.current.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [showSwitcher, showAddAccount]);

  const applySession = (s: ActiveSession) => {
    setSession(s);
    setSavedAccounts(getSavedAccounts());
  };

  const handleSwitchAccount = async (accountId: string) => {
    const s = await switchAccount(accountId);
    if (s) applySession(s);
    setShowSwitcher(false);
  };

  const handleAddAccount = () => {
    setShowSwitcher(false);
    setShowAddAccount(true);
  };

  const handleRemoveLinkedAccount = async (accountId: string) => {
    await removeAccount(accountId);
    setSavedAccounts(getSavedAccounts());
  };

  const handleAddAccountLogin = (_role: RoleName, _fullName: string, _avatarInitials: string, _accountId: string) => {
    const s = getActiveSession();
    if (s) applySession(s);
    setShowAddAccount(false);
  };

  const handleLogin = (role: RoleName, fullName: string, avatarInitials: string, accountId: string) => {
    const s = getActiveSession();
    if (s) applySession(s);
  };

  const handleAvatarChanged = async (url: string | null) => {
    if (!session) return;
    await updateAccountAvatar(session.accountId, url);
    setSession(getActiveSession());
    // SEBELUMNYA hilang di sini (ADA di versi webview, App.tsx) - tanpa ini,
    // foto akun SENDIRI di daftar "Ganti Akun" tetap basi setelah ganti
    // foto profil, krn AccountSwitcher baca dari state `savedAccounts` yg
    // cuma di-refresh oleh aksi LAIN (switch/hapus akun), bukan oleh ganti
    // foto itu sendiri.
    setSavedAccounts(getSavedAccounts());
  };

  const handleLogout = async () => {
    if (!session) return;
    await removeAccount(session.accountId);
    const remaining = getSavedAccounts();
    setSavedAccounts(remaining);
    if (remaining.length > 0) {
      const s = await switchAccount(remaining[0].id);
      if (s) { applySession(s); return; }
    }
    setSession(null);
  };

  React.useEffect(() => {
    if (!session) return;
    // Deep-link tap notifikasi - SEBELUMNYA no-op (belum disambungkan sama
    // sekali), sekarang navigasi sungguhan lewat navigationRef (bisa
    // dipanggil dari mana saja, tidak terikat screen yg sedang fokus -
    // pas utk notifikasi yg bisa di-tap dari kondisi app apa saja).
    //
    // Cleanup WAJIB (2026-09-02): effect ini jalan ULANG tiap ganti akun,
    // dan tanpa melepas listener lama, listener onMessage menumpuk -> 1 push
    // dari server tampil berkali-kali di HP (user melaporkan 4 notifikasi
    // identik utk 1x presensi). initPushNotifications() async, jadi fungsi
    // pembersihnya baru ada setelah promise selesai - disimpan di variabel &
    // ditandai "cancelled" kalau effect keburu dibersihkan duluan.
    let cancelled = false;
    let disposePush: (() => void) | null = null;
    initPushNotifications((screen, params) => {
      navigateTo(navigationRef.current as any, resolveNavScreen(screen), params);
    }).then((dispose) => {
      if (cancelled) dispose();
      else disposePush = dispose;
    });
    return () => {
      cancelled = true;
      disposePush?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.accountId]);

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: isDark ? "#101012" : "#F7F7F3",
      card: isDark ? "#19191C" : "#FFFFFF",
      primary: isDark ? "#D0AF68" : "#356447",
      text: isDark ? "#F1F1F2" : "#17201B",
      border: isDark ? "rgba(255,255,255,0.1)" : "rgba(33,57,41,0.1)",
    },
  };

  return (
    <AccountSwitcherProvider visible={showSwitcher} onOpen={() => setShowSwitcher(true)} onClose={() => setShowSwitcher(false)}>
    {demoActive && session && <DemoModeBanner roleLabel={session.role} onExit={handleExitDemo} />}
    <NavigationContainer
      ref={navigationRef}
      theme={navTheme}
    >
      {/* animation:"none" - default native-stack Android SEKARANG pakai
          transisi "zoom"/scale (Android 14+ predictive-back style) yg
          sempat nutupin/numpuk tombol navigasi HP paling bawah selagi
          animasinya jalan (laporan user). Dimatikan spy pindah layar
          langsung (spt Dashboard/dst yg pindah TAB, bukan STACK, memang
          tidak pernah py animasi ini dari awal). */}
      <Stack.Navigator screenOptions={{ headerShown: false, animation: "none" }}>
        {!session ? (
          <Stack.Screen name="login">
            {() => <LoginScreen onLogin={handleLogin} />}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="main">
              {({ navigation }) => (
                // key={session.accountId} - SAMA PERSIS pola yg SUDAH dipakai
                // webview (App.tsx, `key={accountId}` di NotificationsProvider)
                // utk bug yg IDENTIK: ProfilScreen (dan layar tab lain) adalah
                // layar PERSISTEN (tidak pernah unmount pas pindah tab, lihat
                // catatan TAB_ROOT_SCREENS/screenOptions MainTabs) - state
                // lokalnya (avatarUrl/phone/email/notifPrefs di ProfilScreen,
                // diisi via useEffect([]) yg cuma jalan SEKALI saat mount
                // pertama) TIDAK PERNAH ke-refresh saat ganti akun krn
                // komponennya sendiri tidak pernah remount - nama/role tetap
                // benar (dibaca langsung dari getActiveSession() tiap render,
                // bukan state), tapi avatar/data lain nyangkut punya akun
                // LAMA (laporan user, dgn screenshot). key yg berubah
                // memaksa React unmount+mount ulang SELURUH MainTabs dari nol
                // tiap accountId berbeda - satu fix ini menyembuhkan SEMUA
                // field basi sekaligus (avatar, phone, email, notifPrefs),
                // bukan cuma avatar, dan konsisten dgn mekanisme webview.
                <MainTabs
                  key={session.accountId}
                  role={session.role}
                  onLogout={handleLogout}
                  onAvatarChanged={handleAvatarChanged}
                  onOpenSwitcher={() => setShowSwitcher(true)}
                  onNavigateStack={(screen, params) => navigateTo(navigation, screen, params)}
                  canUseDemoMode={canUseDemoMode}
                  demoActive={demoActive}
                  onOpenDemoSwitcher={() => { handleLoadDemoRoles(); setShowDemoSwitcher(true); }}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="pengenalan-wajah" options={{ headerShown: true, title: "Pengenalan Wajah" }}>
              {({ navigation }) => (
                <FaceEnrollmentScreen
                  onNavigate={(screen) => navigateTo(navigation, screen)}
                  target={session.role === "Orang Tua" ? "child" : "self"}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="ubah-password" options={{ headerShown: true, title: "Ubah Kata Sandi" }}>
              {({ navigation }) => <UbahPasswordScreen onNavigate={(screen) => navigateTo(navigation, screen)} />}
            </Stack.Screen>
            <Stack.Screen
              name="koneksi-wa-bot"
              options={{ headerShown: true, title: "Koneksi Bot WhatsApp" }}
              component={WaBotConnectionScreen}
            />
            <Stack.Screen
              name="pengaturan-lokasi"
              options={{ headerShown: true, title: "Pengaturan Lokasi Presensi" }}
              component={PengaturanLokasiScreen}
            />
            <Stack.Screen
              name="pengaturan-jam-keterlambatan"
              options={{ headerShown: true, title: "Jam Keterlambatan" }}
              component={PengaturanJamKeterlambatanScreen}
            />
            <Stack.Screen name="presensi-admin-tu" options={{ headerShown: true, title: "Rekap Kehadiran" }}>
              {({ navigation }) => <PresensiAdminTU role={session.role} onNavigate={(screen, params) => navigateTo(navigation, screen, params)} />}
            </Stack.Screen>
            <Stack.Screen name="persetujuan-izin" options={{ headerShown: true, title: "Persetujuan Izin" }} component={PersetujuanIzinScreen} />
            <Stack.Screen name="persetujuan-izin-guru" options={{ headerShown: true, title: "Persetujuan Izin Guru" }} component={PersetujuanIzinGuruScreen} />
            <Stack.Screen name="rekapitulasi-kehadiran" options={{ headerShown: true, title: "Rekapitulasi Kehadiran" }}>
              {() => <RekapitulasiKehadiranScreen role={session.role} />}
            </Stack.Screen>
            <Stack.Screen name="ringkasan" options={{ headerShown: true, title: "Ringkasan Presensi" }}>
              {() => <RingkasanScreen role={session.role} />}
            </Stack.Screen>
            <Stack.Screen name="performa-cari" options={{ headerShown: true, title: "Performa Individu" }} component={PerformaCariScreen} />
            <Stack.Screen name="kirim-aduan" options={{ headerShown: true, title: "Kirim Aduan" }} component={KirimAduanScreen} />
            <Stack.Screen name="aduan-masuk" options={{ headerShown: true, title: "Aduan Masuk" }} component={AduanMasukScreen} />
            <Stack.Screen name="manajemen-pengguna" options={{ headerShown: true, title: "Manajemen Pengguna" }} component={ManajemenPenggunaScreen} />
            <Stack.Screen name="role-hak-akses" options={{ headerShown: true, title: "Role & Hak Akses" }} component={RoleHakAksesScreen} />
            <Stack.Screen name="buat-pengumuman" options={{ headerShown: true, title: "Buat Pengumuman" }} component={BuatPengumumanScreen} />
            <Stack.Screen name="backup-database" options={{ headerShown: true, title: "Backup Database" }} component={BackupDatabaseScreen} />
            <Stack.Screen name="status-sinkronisasi" options={{ headerShown: true, title: "Status Sinkronisasi" }} component={SyncStatusScreen} />
            <Stack.Screen name="log-aktivitas" options={{ headerShown: true, title: "Log Aktivitas" }} component={ActivityLogScreen} />
            <Stack.Screen name="keuangan-admin" options={{ headerShown: true, title: "Keuangan" }} component={KeuanganAdmin} />
            <Stack.Screen name="detail-pembayaran" options={{ headerShown: true, title: "Rincian Biaya" }} component={DetailPembayaran} />
            <Stack.Screen name="statistik-konten" options={{ headerShown: true, title: "Statistik Konten" }}>
              {({ navigation }) => <StatistikKontenScreen onNavigate={(screen, params) => navigateTo(navigation, screen, params)} />}
            </Stack.Screen>
            <Stack.Screen name="blokiran-komentar" options={{ headerShown: true, title: "Pengguna Diblokir" }} component={BlokiranKomentarScreen} />
            <Stack.Screen name="berita-acara-admin" options={{ headerShown: true, title: "Kelola Berita Acara" }}>
              {({ navigation }) => <BeritaAcaraAdmin role={session.role} onNavigate={(screen, params) => navigateTo(navigation, screen, params)} />}
            </Stack.Screen>
            <Stack.Screen name="berita-acara-viewer" options={{ headerShown: true, title: "Detail Berita" }}>
              {({ navigation, route }) => (
                <BeritaAcaraViewer
                  newsId={(route.params as { newsId?: string } | undefined)?.newsId}
                  onNavigate={(screen, params) => navigateTo(navigation, screen, params)}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="jadwal-pelajaran" options={{ headerShown: true, title: "Jadwal Pelajaran" }}>
              {() => <JadwalPelajaranScreen mode={session.role === "Orang Tua" ? "anak" : "guru"} />}
            </Stack.Screen>
            <Stack.Screen name="buat-tugas" options={{ headerShown: true, title: "Buat Tugas / Materi" }} component={BuatTugasScreen} />
            <Stack.Screen name="tugas-anak" options={{ headerShown: true, title: "Tugas & Materi" }} component={TugasAnakScreen} />
            <Stack.Screen name="jadwal-kerja" options={{ headerShown: true, title: "Jadwal Kerja" }} component={JadwalKerjaScreen} />
            <Stack.Screen name="cari-siswa-guru" options={{ headerShown: true, title: "Cari Siswa & Guru" }} component={CariSiswaGuruScreen} />
            <Stack.Screen name="persetujuan-psb" options={{ headerShown: true, title: "Persetujuan PSB" }} component={PersetujuanPsbScreen} />
            {/* Rute generik utk menu yang GENUINELY belum dibangun (Slip
                Gaji, Keuangan dkk, lihat catatan Projek.md 2026-08-13 & 29) -
                dipanggil dari dashboard via onNavigate("placeholder", {title}),
                sama pola dgn versi webview (App.tsx AppScreen). */}
            <Stack.Screen name="placeholder" options={({ route }) => ({ headerShown: true, title: (route.params as { title?: string } | undefined)?.title ?? "Fitur" })}>
              {({ route }) => (
                <PlaceholderScreen
                  title={(route.params as { title?: string } | undefined)?.title ?? "Fitur"}
                  subtitle="Fitur ini sedang disiapkan dan akan segera tersedia."
                />
              )}
            </Stack.Screen>
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
    {session && !demoActive && (
      <AccountSwitcher
        visible={showSwitcher}
        currentAccountId={session.accountId}
        savedAccounts={savedAccounts}
        onSwitch={handleSwitchAccount}
        onAddAccount={handleAddAccount}
        onRemoveAccount={handleRemoveLinkedAccount}
        onClose={() => setShowSwitcher(false)}
      />
    )}
    {session && (
      <DemoModeSwitcher
        visible={showDemoSwitcher}
        roles={demoRoles}
        activeDemoLabel={demoActive ? session.role : null}
        loading={demoLoading}
        errorMessage={demoError}
        onPick={handlePickDemoRole}
        onExitDemo={handleExitDemo}
        onClose={() => setShowDemoSwitcher(false)}
      />
    )}
    {/* SENGAJA BUKAN <Modal> lagi - lihat catatan panjang di
        AccountSwitcher.tsx (window Modal Android tidak konsisten mewarisi
        nav bar walau sudah dikasih translucent props). Overlay biasa di
        tree yang sama spy ikut window utama app. */}
    {showAddAccount && (
      <View className="absolute inset-0 bg-card" style={{ zIndex: 50, elevation: 50 }}>
        <Pressable
          onPress={() => setShowAddAccount(false)}
          className="absolute top-14 left-4 z-30 p-2.5 rounded-xl border border-border bg-card/90"
        >
          <X size={18} color={isDark ? "#F1F1F2" : "#17201B"} />
        </Pressable>
        <LoginScreen onLogin={handleAddAccountLogin} notice="Masuk dengan akun lain untuk ditambahkan." />
      </View>
    )}
    </AccountSwitcherProvider>
  );
}

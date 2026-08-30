import React from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Home, FileText, Clock, Bell, User, Sun, Moon } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import { DashboardScreen } from "../components/screens/DashboardScreen";
import { BeritaAcaraScreen } from "../components/screens/BeritaAcaraScreen";
import { PresensiScreen } from "../components/screens/PresensiScreen";
import { PresensiAnak } from "../components/screens/PresensiAnak";
import { PresensiAdminTU } from "../components/screens/PresensiAdminTU";
import { PlaceholderScreen } from "../components/screens/PlaceholderScreen";
import { NotifikasiScreen } from "../components/screens/NotifikasiScreen";
import { ProfilScreen } from "../components/screens/ProfilScreen";
import { useUnreadNotificationCount } from "../hooks/useUnreadNotificationCount";
import type { RoleName } from "../services/authService";

const ADMIN_MEDIA_ROLES: RoleName[] = ["Admin Media (SD)", "Admin Media (TK & Playground)"];
const ADMIN_TU_ROLES: RoleName[] = ["Admin TU (SD)", "Admin TU (TK & Playground)"];

function PresensiTab({ role, onNavigate }: { role: RoleName; onNavigate: (screen: string, params?: Record<string, unknown>) => void }) {
  if (role === "Orang Tua") return <PresensiAnak />;
  if (ADMIN_MEDIA_ROLES.includes(role)) return <PlaceholderScreen title="Akun administratif - gunakan akun utama utk presensi" />;
  if (ADMIN_TU_ROLES.includes(role) || role === "Kepala Sekolah (SD)" || role === "Kepala Sekolah (TK & Playground)" || role === "Admin IT" || role === "Keuangan" || role === "Supervisor") return <PresensiAdminTU role={role} onNavigate={onNavigate} />;
  return <PresensiScreen role={role} onNavigate={onNavigate} />;
}

const Tab = createBottomTabNavigator();

// Pill bulat+terangkat di belakang ikon tab aktif - meniru persis
// BottomNav.tsx webview (lingkaran primary + "-translate-y-2" + shadow).
// SEBELUMNYA cuma warna ikon yang berubah (tabBarActiveTintColor polos),
// bedanya nyaris tidak kelihatan sekilas - user lapor "navbar belum ada
// tandanya lagi di menu apa".
function TabIcon({ IconCmp, focused, color, activeColor, isDark }: { IconCmp: React.ComponentType<{ color: string; size: number }>; focused: boolean; color: string; activeColor: string; isDark: boolean }) {
  if (!focused) return <IconCmp color={color} size={22} />;
  return (
    <View
      className="w-9 h-9 rounded-full items-center justify-center"
      style={{ backgroundColor: activeColor, transform: [{ translateY: -8 }], shadowColor: activeColor, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 }}
    >
      {/* activeColor jadi emas (#D0AF68) di dark mode - ikon gelap wajib
          disitu, putih di light mode dimana activeColor hijau (#356447). */}
      <IconCmp color={isDark ? "#1A1710" : "#FFFFFF"} size={20} />
    </View>
  );
}

interface Props {
  role: RoleName;
  onLogout: () => void;
  onAvatarChanged: (url: string | null) => void;
  onOpenSwitcher: () => void;
  onNavigateStack: (screen: string, params?: Record<string, unknown>) => void;
  canUseDemoMode: boolean;
  demoActive: boolean;
  onOpenDemoSwitcher: () => void;
}

// Bottom tabs 5 menu - persis strukturnya dgn BottomNav.tsx versi webview.
// Header judul (headerShown:true) sengaja DIAKTIFKAN utk 4 tab non-Beranda -
// SEBELUMNYA mati total di semua tab, itu penyebab layar Berita Acara/
// Presensi/Notifikasi/Profil kelihatan "kurang turun" (konten mepet ke
// status bar tanpa judul layar spt versi web). Beranda TETAP headerShown:
// false krn py header custom sendiri di dalam DashboardLayout (hero+ikon).
export function MainTabs({ role, onLogout, onAvatarChanged, onOpenSwitcher, onNavigateStack, canUseDemoMode, demoActive, onOpenDemoSwitcher }: Props) {
  const { isDark, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  // Badge angka notifikasi (2026-08-31, spt WA/Line) - lihat catatan
  // lengkap di hook (juga men-set badge ikon aplikasi di homescreen HP).
  const unreadCount = useUnreadNotificationCount();
  const activeColor = isDark ? "#D0AF68" : "#356447";
  const inactiveColor = isDark ? "#A3A3AA" : "#6E776F";
  const bg = isDark ? "#19191C" : "#FFFFFF";
  const border = isDark ? "rgba(255,255,255,0.1)" : "rgba(33,57,41,0.1)";
  const textColor = isDark ? "#F1F1F2" : "#17201B";

  const ThemeToggleButton = () => (
    <Pressable onPress={toggleTheme} className="mr-4 p-1.5">
      {isDark ? <Sun size={19} color={textColor} /> : <Moon size={19} color={textColor} />}
    </Pressable>
  );

  return (
    <Tab.Navigator
      backBehavior="history"
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: bg },
        headerTitleStyle: { color: textColor, fontSize: 15, fontWeight: "700" },
        headerShadowVisible: false,
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        // height/paddingBottom WAJIB ikutkan insets.bottom - SEBELUMNYA
        // height fixed (64) tanpa itu, jadi tab bar rendering ketiban
        // tombol navigasi bawaan Android (3-tombol/gesture pill) di device
        // yang py inset besar, krn override height manual menghapus
        // penyesuaian aman-area otomatis bawaan react-navigation.
        tabBarStyle: { backgroundColor: bg, borderTopColor: border, height: 56 + insets.bottom, paddingTop: 8, paddingBottom: insets.bottom },
        headerRight: () => <ThemeToggleButton />,
      }}
    >
      <Tab.Screen
        name="dashboard"
        options={{ title: "Beranda", headerShown: false, tabBarIcon: ({ color, focused }) => <TabIcon IconCmp={Home} focused={focused} color={color} activeColor={activeColor} isDark={isDark} /> }}
      >
        {() => <DashboardScreen role={role} onNavigate={onNavigateStack} />}
      </Tab.Screen>
      <Tab.Screen
        name="berita-acara"
        options={{ title: "Berita Acara", tabBarIcon: ({ color, focused }) => <TabIcon IconCmp={FileText} focused={focused} color={color} activeColor={activeColor} isDark={isDark} /> }}
      >
        {() => <BeritaAcaraScreen onNavigate={onNavigateStack} />}
      </Tab.Screen>
      <Tab.Screen
        name="presensi"
        options={{ title: "Presensi", tabBarIcon: ({ color, focused }) => <TabIcon IconCmp={Clock} focused={focused} color={color} activeColor={activeColor} isDark={isDark} /> }}
      >
        {() => <PresensiTab role={role} onNavigate={onNavigateStack} />}
      </Tab.Screen>
      <Tab.Screen
        name="notifikasi"
        options={{
          title: "Notifikasi",
          tabBarIcon: ({ color, focused }) => <TabIcon IconCmp={Bell} focused={focused} color={color} activeColor={activeColor} isDark={isDark} />,
          tabBarBadge: unreadCount > 0 ? (unreadCount > 9 ? "9+" : unreadCount) : undefined,
          tabBarBadgeStyle: { backgroundColor: "#ef4444", fontSize: 10 },
        }}
      >
        {() => <NotifikasiScreen onNavigate={onNavigateStack} />}
      </Tab.Screen>
      <Tab.Screen
        name="profil"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, focused }) => <TabIcon IconCmp={User} focused={focused} color={color} activeColor={activeColor} isDark={isDark} />,
          // Tekan lama ikon Profil di bottom nav = buka switch akun cepat,
          // gaya Instagram (tap biasa tetap buka layar Profil spt biasa).
          tabBarButton: (props) => <Pressable {...(props as any)} onLongPress={onOpenSwitcher} delayLongPress={350} />,
        }}
      >
        {() => (
          <ProfilScreen
            role={role}
            onLogout={onLogout}
            onNavigate={onNavigateStack}
            onAvatarChanged={onAvatarChanged}
            onOpenSwitcher={onOpenSwitcher}
            canUseDemoMode={canUseDemoMode}
            demoActive={demoActive}
            onOpenDemoSwitcher={onOpenDemoSwitcher}
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

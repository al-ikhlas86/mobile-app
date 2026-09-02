// ============================================================
// PUSH NOTIFICATIONS — native asli via @react-native-firebase/messaging +
// expo-notifications. INI YANG UTAMA jadi alasan aplikasi native ini
// dibuat: di webview (Capacitor), dialog izin notifikasi Android 13+
// SERING tidak pernah muncul sama sekali (POST_NOTIFICATIONS permission
// silently gagal) dan notifikasi TIDAK PERNAH tampil di system tray/luar
// aplikasi - cuma toast di dalam app saja. Di sini keduanya beres krn
// jalur notifikasi 100% native:
//   1. @react-native-firebase/messaging -> token FCM ASLI (SAMA PERSIS
//      dgn yang backend (Mobile-app/backend/src/services/pushNotifications.js,
//      firebase-admin SDK) sudah kirim ke - TIDAK ADA perubahan backend
//      sama sekali, cuma sumber tokennya yang beda: native FCM langsung
//      drpd Capacitor PushNotifications plugin).
//   2. expo-notifications -> handler foreground + kanal notifikasi Android
//      (wajib utk Android 8+ supaya notifikasi background/terminated bisa
//      tampil di system tray sungguhan, bukan cuma dalam-app).
//
// v26 @react-native-firebase/messaging SUDAH pindah total ke API modular
// (getMessaging/getToken/onMessage dst, BUKAN lagi messaging() default
// export gaya lama) - dikonfirmasi langsung dari .d.ts terpasang, sama
// persis pola yang ditemui di firebase-admin (Mobile-app/backend) sesi ini.
// ============================================================
import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Notifications from "expo-notifications";
import { api } from "./api";

// @react-native-firebase/messaging BUKAN modul yang tersedia di Expo Go
// (cuma ada di custom dev-client/APK asli yang sudah di-prebuild) - import
// statis di file ini akan langsung CRASH seluruh app begitu dibuka di Expo
// Go (dipakai utk preview cepat selagi masih banyak yang dirombak, lihat
// PROGRESS.md). Di-import DINAMIS & cuma dijalankan kalau BUKAN Expo Go,
// supaya app tetap 100% jalan normal di Expo Go - notifikasi push saja yang
// otomatis nonaktif di situ (satu-satunya fitur yang genuinely butuh APK asli).
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type NavigateFn = (screen: string, params?: Record<string, unknown>) => void;

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Pemberitahuan Al-Ikhlas 86",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#356447",
  });
}

function handleNotificationTap(navigate: NavigateFn, data: Record<string, any> | undefined) {
  // Backend (notificationService.js) mengirim field "actionScreen" di
  // payload data FCM, BUKAN "screen" - sebelumnya salah baca "screen" di
  // sini jadi tap notifikasi push TIDAK PERNAH navigasi kemanapun (selalu
  // undefined, silently no-op).
  const screen = data?.actionScreen ?? data?.screen;
  if (!screen) return;
  try {
    const params = data?.actionParams ?? data?.params;
    const parsed = typeof params === "string" ? JSON.parse(params) : params;
    navigate(String(screen), parsed);
  } catch {
    navigate(String(screen));
  }
}

// Mengembalikan fungsi pembersih (unsubscribe SEMUA listener yang dipasang).
// WAJIB dipanggil pemakainya saat effect dibersihkan/ganti akun - BUG NYATA
// 2026-09-02: sebelumnya fungsi ini tidak mengembalikan apa pun dan listener
// onMessage/addNotificationResponseReceivedListener TIDAK PERNAH dilepas,
// padahal RootNavigator memanggilnya ulang tiap ganti akun. Listener
// menumpuk, jadi SATU push dari server tampil BERKALI-KALI di HP (dilaporkan
// user: 1x presensi -> 4 notifikasi identik; dikonfirmasi dari DB server
// cuma ada 1 baris notifikasi & 1 token, jadi duplikasi murni di sisi klien).
export async function initPushNotifications(navigate: NavigateFn): Promise<() => void> {
  const cleanups: Array<() => void> = [];
  const cleanup = () => {
    for (const fn of cleanups.splice(0)) {
      try { fn(); } catch { /* unsubscribe gagal tidak boleh bikin crash */ }
    }
  };
  if (isExpoGo) return cleanup; // Push native tidak tersedia di Expo Go - lihat catatan di atas.
  try {
    const {
      getMessaging, getToken, onTokenRefresh, onMessage,
      onNotificationOpenedApp, getInitialNotification,
    } = await import("@react-native-firebase/messaging");

    await ensureAndroidChannel();

    // Izin notifikasi (2026-08-29) - SEBELUMNYA pakai
    // `requestPermission(messaging)` dari @react-native-firebase/messaging,
    // TERBUKTI jadi akar masalah "guru tidak pernah terima push sama
    // sekali" (server kirim sukses ke FCM tanpa error, HP tidak
    // menampilkan apa pun): dikonfirmasi LANGSUNG dari tipe library itu
    // sendiri (messaging.d.ts) - method itu SUDAH DEPRECATED khusus utk
    // Android & "It's a no-op on Android and will promise resolve
    // AuthorizationStatus.AUTHORIZED" TANPA SYARAT, tidak peduli izin
    // POST_NOTIFICATIONS (Android 13+) sungguhan sudah diberikan atau
    // belum - jadi kode sebelumnya SELALU lolos pengecekan izin padahal
    // OS-nya sendiri mungkin belum pernah benar2 diminta izin, dan diam2
    // membungkam notifikasi yang masuk. Diganti expo-notifications yang
    // menangani izin Android SUNGGUHAN (termasuk dialog POST_NOTIFICATIONS
    // Android 13+) - direkomendasikan resmi oleh dokumentasi
    // @react-native-firebase/messaging sendiri sbg pengganti.
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return cleanup;

    const messaging = getMessaging();
    const token = await getToken(messaging);
    if (token) await api.registerFcmToken(token).catch(() => {});

    cleanups.push(
      onTokenRefresh(messaging, (newToken: string) => {
        api.registerFcmToken(newToken).catch(() => {});
      })
    );

    // Notifikasi masuk selagi app di foreground - Firebase Messaging TIDAK
    // otomatis menampilkan system notification saat app di foreground
    // (perilaku standar Android/iOS), jadi ditampilkan manual lewat
    // expo-notifications supaya konsisten baik foreground/background/terminated.
    cleanups.push(
      onMessage(messaging, async (remoteMessage) => {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: remoteMessage.notification?.title ?? "Al-Ikhlas 86",
            body: remoteMessage.notification?.body ?? "",
            data: remoteMessage.data,
          },
          trigger: null,
        });
      })
    );

    // Notifikasi di-tap saat app di background (bukan foreground/terminated).
    cleanups.push(
      onNotificationOpenedApp(messaging, (remoteMessage) => {
        handleNotificationTap(navigate, remoteMessage.data);
      })
    );

    // App dibuka DARI KONDISI TERTUTUP TOTAL lewat tap notifikasi.
    const initialMessage = await getInitialNotification(messaging);
    if (initialMessage) handleNotificationTap(navigate, initialMessage.data);

    // Notifikasi lokal (dijadwalkan lewat scheduleNotificationAsync di atas)
    // yang di-tap - path terpisah dari remote message di atas.
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationTap(navigate, response.notification.request.content.data as Record<string, any>);
    });
    cleanups.push(() => responseSub.remove());
  } catch {
    // Gagal (mis. Google Play Services tidak ada - device tanpa GMS) tidak
    // boleh bikin aplikasi crash - fitur lain tetap harus jalan normal.
  }
  return cleanup;
}

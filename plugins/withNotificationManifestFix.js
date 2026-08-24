// expo-notifications & @react-native-firebase/messaging SAMA-SAMA
// mendeklarasikan meta-data 'com.google.firebase.messaging.default_notification_color'
// di AndroidManifest.xml masing-masing (dgn nilai beda) - manifest merger
// Android GAGAL tiap kali `expo prebuild` regenerasi ulang android/ dari
// nol, krn tidak ada tools:replace di baris yg expo-notifications tulis.
// Plugin ini otomatis menambahkan tools:replace="android:resource" begitu
// prebuild jalan - supaya perbaikan ini TIDAK HILANG tiap kali prebuild
// diulang (sebelumnya harus ditambal manual tiap habis prebuild).
const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withNotificationManifestFix(config) {
  return withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest.application?.[0];
    const metaData = app?.["meta-data"] ?? [];
    const target = metaData.find(
      (m) => m.$["android:name"] === "com.google.firebase.messaging.default_notification_color"
    );
    if (target) {
      target.$["tools:replace"] = "android:resource";
    }
    return config;
  });
};

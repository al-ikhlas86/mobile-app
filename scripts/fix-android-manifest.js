// Dijalankan MANUAL setelah `expo prebuild` selesai total (lihat
// .github/workflows/build-android.yml) - BUKAN config plugin.
//
// Ditemukan lewat build GitHub Actions pertama (2026-09-02): "Manifest
// merger failed" krn expo-notifications DAN @react-native-firebase/messaging
// sama-sama mendeklarasikan meta-data
// "com.google.firebase.messaging.default_notification_color" dgn nilai
// beda. Sudah dicoba dibikin jadi config plugin (withAndroidManifest DAN
// withDangerousMod), keduanya GAGAL karena urutan eksekusi mod internal
// Expo (appBuildGradle/androidManifest) ternyata tidak bisa diandalkan -
// dangerousMod malah terbukti jalan SEBELUM manifest final ditulis (isinya
// masih 1823 char, blm ada meta-data ini sama sekali saat dicek). Satu2nya
// cara yg terbukti pasti benar: patch file SETELAH `expo prebuild` 100%
// selesai, sbg langkah terpisah - bukan bagian dari pipeline plugin-nya.
const fs = require("fs");
const path = require("path");

const META_DATA_NAME = "com.google.firebase.messaging.default_notification_color";
const manifestPath = path.join(__dirname, "..", "android", "app", "src", "main", "AndroidManifest.xml");

let contents = fs.readFileSync(manifestPath, "utf8");

const metaDataRegex = new RegExp(
  `(<meta-data android:name="${META_DATA_NAME.replace(/\./g, "\\.")}" android:resource="[^"]*")(\\s*/>)`
);

if (!metaDataRegex.test(contents)) {
  console.error(`[fix-android-manifest] meta-data "${META_DATA_NAME}" tidak ditemukan di ${manifestPath} - cek manual, struktur manifest mungkin berubah.`);
  process.exit(1);
}

if (contents.includes('tools:replace="android:resource"')) {
  console.log("[fix-android-manifest] tools:replace sudah ada, tidak ada perubahan.");
  process.exit(0);
}

contents = contents.replace(metaDataRegex, `$1 tools:replace="android:resource"$2`);
fs.writeFileSync(manifestPath, contents);
console.log("[fix-android-manifest] tools:replace=\"android:resource\" berhasil ditambahkan ke meta-data firebase messaging notification color.");

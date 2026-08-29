#!/usr/bin/env node
// Perbaikan yang WAJIB dijalankan setiap kali `npx expo prebuild` (dengan
// atau tanpa --clean) dijalankan ulang di proyek ini - folder android/
// di-gitignore & di-generate ulang total tiap prebuild, dan 2 hal berikut
// SELALU rusak/hilang lagi setelahnya:
//
// 1. android/local.properties (sdk.dir) - file ini juga di-gitignore,
//    Expo CLI tidak selalu menuliskannya ulang dgn benar (2026-08-29:
//    setelah prebuild --clean, file ini hilang total, bikin Gradle error
//    "SDK location not found").
//
// 2. AndroidManifest.xml - konflik meta-data
//    'com.google.firebase.messaging.default_notification_color' antara
//    yang ditulis plugin expo-notifications vs yang dibawa library
//    @react-native-firebase/messaging (nilai beda) - PERNAH dicoba
//    diperbaiki via Expo config plugin (withAndroidManifest lalu
//    withDangerousMod), KEDUANYA TERBUKTI GAGAL lewat pengujian nyata:
//    debug log menunjukkan mod plugin dieksekusi SEBELUM expo-notifications
//    sendiri sempat menulis meta-data itu ke manifest, jadi tidak ada yang
//    bisa ditemukan/ditambal di titik itu - urutan eksekusi mod Expo
//    ternyata TIDAK mengikuti urutan `plugins` di app.json utk kasus ini.
//    Solusi yang TERBUKTI bekerja: tambal FILE ASLI di disk lewat script
//    terpisah ini, dijalankan SETELAH `expo prebuild` benar2 selesai.
//
// Cara pakai: `node scripts/fix-android-after-prebuild.js` tiap habis
// `npx expo prebuild` (atau `expo prebuild --clean`).
const fs = require("fs");
const path = require("path");
const os = require("os");

const androidDir = path.join(__dirname, "..", "android");

// 1. Restore local.properties (sdk.dir) - path SDK Android default Windows.
//    Kalau SDK ada di lokasi lain, set env ANDROID_HOME/ANDROID_SDK_ROOT
//    sebelum menjalankan script ini, atau edit path di bawah.
const localPropertiesPath = path.join(androidDir, "local.properties");
const sdkDir =
  process.env.ANDROID_HOME ||
  process.env.ANDROID_SDK_ROOT ||
  path.join(os.homedir(), "AppData", "Local", "Android", "Sdk").replace(/\\/g, "/");
if (!fs.existsSync(localPropertiesPath)) {
  fs.writeFileSync(localPropertiesPath, `sdk.dir=${sdkDir.replace(/\\/g, "/")}\n`, "utf-8");
  console.log(`[fix-android-after-prebuild] local.properties dibuat ulang (sdk.dir=${sdkDir}).`);
} else {
  console.log("[fix-android-after-prebuild] local.properties sudah ada, tidak diubah.");
}

// 2. Tambal konflik meta-data notifikasi Firebase.
const manifestPath = path.join(androidDir, "app", "src", "main", "AndroidManifest.xml");
let manifest = fs.readFileSync(manifestPath, "utf-8");
const targetName = "com.google.firebase.messaging.default_notification_color";
const pattern = new RegExp(`(<meta-data android:name="${targetName.replace(/\./g, "\\.")}"[^>]*?)(/>)`);
const match = manifest.match(pattern);
if (!match) {
  console.warn(`[fix-android-after-prebuild] PERINGATAN: meta-data '${targetName}' tidak ditemukan di manifest - cek manual, mungkin struktur template berubah.`);
} else if (match[1].includes("tools:replace")) {
  console.log("[fix-android-after-prebuild] tools:replace sudah ada, tidak diubah.");
} else {
  manifest = manifest.replace(pattern, `$1 tools:replace="android:resource"$2`);
  fs.writeFileSync(manifestPath, manifest, "utf-8");
  console.log("[fix-android-after-prebuild] tools:replace ditambahkan ke AndroidManifest.xml.");
}

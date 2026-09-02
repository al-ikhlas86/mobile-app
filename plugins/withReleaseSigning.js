// Menyuntikkan signingConfigs.release yang baca kredensial dari environment
// variable (RELEASE_KEYSTORE_PATH/RELEASE_KEYSTORE_PASSWORD/RELEASE_KEY_ALIAS/
// RELEASE_KEY_PASSWORD), diisi oleh GitHub Actions Secrets saat build APK/AAB
// otomatis (lihat .github/workflows/build-android.yml). Kalau env var itu
// TIDAK ada (mis. developer jalanin `expo prebuild` + gradlew manual di
// laptop sendiri), build "release" tetap jatuh ke signingConfigs.debug apa
// adanya seperti sebelum plugin ini ada - tidak memutus alur dev lokal.
//
// Ditulis sbg plugin (bukan edit manual android/app/build.gradle) krn folder
// android/ di-gitignore & di-generate ulang total tiap `expo prebuild` - edit
// manual akan hilang diam-diam tanpa ini.
//
// Pakai REGEX (bukan exact-string anchor kayak withDebugAppIdSuffix.js) krn
// terbukti dari testing nyata: `expo prebuild` menjalankan pipeline mod 2x
// dan urutan konten persis yang dilihat plugin ini di tiap pass bisa beda
// dgn yg akhirnya ditulis ke disk - anchor string persis gagal cocok padahal
// harusnya sama. Regex yg cuma cari kata kunci struktural ("signingConfigs {"
// / "release {" diikuti "signingConfig signingConfigs.debug") jauh lebih
// tahan thd variasi itu.
const { withAppBuildGradle } = require("@expo/config-plugins");

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    const signingConfigsOpenRegex = /signingConfigs\s*\{/;
    if (signingConfigsOpenRegex.test(contents) && !contents.includes("RELEASE_KEYSTORE_PATH")) {
      contents = contents.replace(signingConfigsOpenRegex, (match) =>
        `${match}\n` +
        "        release {\n" +
        "            if (System.getenv('RELEASE_KEYSTORE_PATH')) {\n" +
        "                storeFile file(System.getenv('RELEASE_KEYSTORE_PATH'))\n" +
        "                storePassword System.getenv('RELEASE_KEYSTORE_PASSWORD')\n" +
        "                keyAlias System.getenv('RELEASE_KEY_ALIAS')\n" +
        "                keyPassword System.getenv('RELEASE_KEY_PASSWORD')\n" +
        "                v1SigningEnabled true\n" +
        "                v2SigningEnabled true\n" +
        "            }\n" +
        "        }"
      );
    } else if (!contents.includes("RELEASE_KEYSTORE_PATH")) {
      console.warn("[withReleaseSigning] Blok signingConfigs { tidak ditemukan - cek manual android/app/build.gradle.");
    }

    const releaseSigningConfigRegex = /(release\s*\{(?:\s*\/\/[^\n]*\n)*\s*)signingConfig signingConfigs\.debug/;
    if (releaseSigningConfigRegex.test(contents)) {
      contents = contents.replace(
        releaseSigningConfigRegex,
        (_match, prefix) =>
          `${prefix}signingConfig System.getenv('RELEASE_KEYSTORE_PATH') ? signingConfigs.release : signingConfigs.debug`
      );
    } else if (!contents.includes("RELEASE_KEYSTORE_PATH) ? signingConfigs.release")) {
      console.warn("[withReleaseSigning] Baris signingConfig di buildTypes.release tidak ditemukan - cek manual android/app/build.gradle.");
    }

    config.modResults.contents = contents;
    return config;
  });
};

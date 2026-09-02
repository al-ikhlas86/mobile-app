// APK dev-client (Metro/dev server) dan APK produksi (release, JS
// ter-bundle) SEBELUMNYA memakai applicationId yang PERSIS SAMA
// ('com.alikhlas86.mobileapp') - kalau dipasang di HP yang sama, salah
// satu akan menimpa yang lain (Android menganggapnya "update" app yang
// sama). Plugin ini menambahkan applicationIdSuffix ".dev" + nama app
// beda ("Al-Ikhlas 86 (Dev)") KHUSUS build type debug, supaya keduanya
// bisa terpasang berdampingan. Ditulis sebagai plugin (bukan edit
// manual android/app/build.gradle) krn folder android/ di-gitignore &
// di-generate ulang total tiap `expo prebuild` - edit manual akan hilang
// diam-diam tanpa ini.
//
// Pakai REGEX (bukan exact-string anchor) - ditemukan lewat testing nyata
// 2026-09-02 (saat menambah plugin withReleaseSigning.js) bahwa `expo
// prebuild` menjalankan pipeline mod appBuildGradle lebih dari 1x, dan
// anchor string PERSIS yang cocok di satu pass bisa gagal cocok di pass
// lain walau isinya semestinya identik - regex yg cuma cari kata kunci
// struktural jauh lebih tahan thd itu drpd exact-string match.
const { withAppBuildGradle } = require("@expo/config-plugins");

module.exports = function withDebugAppIdSuffix(config) {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    if (!contents.includes('applicationIdSuffix ".dev"')) {
      const debugBuildTypeRegex = /(debug\s*\{\s*\n)(\s*)(signingConfig signingConfigs\.debug)/;
      if (debugBuildTypeRegex.test(contents)) {
        contents = contents.replace(
          debugBuildTypeRegex,
          (_m, open, indent, signingLine) =>
            `${open}${indent}applicationIdSuffix ".dev"\n${indent}resValue "string", "app_name", "Al-Ikhlas 86 (Dev)"\n${indent}${signingLine}`
        );
      } else {
        console.warn(
          "[withDebugAppIdSuffix] Pola buildTypes.debug bawaan template tidak ditemukan - " +
          "cek manual android/app/build.gradle setelah prebuild, applicationIdSuffix mungkin tidak terpasang."
        );
      }
    }

    // v1SigningEnabled ditambahkan 2026-08-29 - default AGP MODERN cuma
    // aktifkan v2 signing utk release (v1/JAR signing dianggap usang),
    // tapi TERBUKTI beberapa perangkat OEM (dilaporkan nyata: MIUI 12,
    // "kesalahan saat mengurai paket" saat instalasi) py package parser
    // yang bermasalah dgn APK v2-only walau device-nya SUNGGUHAN
    // mendukung Android 7+ (syarat minimum v2). Aktifkan KEDUANYA (v1+v2)
    // supaya APK dikenali packageinstaller manapun, bukan cuma AOSP murni.
    // Regex ini menangkap SELURUH blok signingConfigs.debug (dgn atau tanpa
    // v1/v2 yg mungkin sudah disisipkan sebelumnya) supaya pengecekan "sudah
    // ada belum" di-scope KHUSUS ke blok ini saja - tidak boleh cuma
    // `contents.includes("v1SigningEnabled")` global, krn teks itu JUGA ada
    // di blok signingConfigs.release (punya plugin withReleaseSigning.js),
    // dan urutan eksekusi mod appBuildGradle TERNYATA tidak selalu mengikuti
    // urutan array "plugins" di app.json (dikonfirmasi lewat testing nyata
    // 2026-09-02) - guard global akan false-positive skip kalau release
    // block itu kebetulan sudah tersisip lebih dulu.
    const debugSigningBlockRegex =
      /debug\s*\{\s*\n\s*storeFile file\('debug\.keystore'\)\s*\n\s*storePassword 'android'\s*\n\s*keyAlias 'androiddebugkey'\s*\n\s*keyPassword 'android'\s*\n(?:\s*v1SigningEnabled true\s*\n\s*v2SigningEnabled true\s*\n)?(\s*)\}/;
    const debugSigningMatch = contents.match(debugSigningBlockRegex);
    if (debugSigningMatch) {
      if (!debugSigningMatch[0].includes("v1SigningEnabled")) {
        const closeIndent = debugSigningMatch[1];
        const innerIndent = closeIndent + "    ";
        const replaced = debugSigningMatch[0].replace(
          /\n(\s*)\}$/,
          `\n${innerIndent}v1SigningEnabled true\n${innerIndent}v2SigningEnabled true\n${closeIndent}}`
        );
        contents = contents.replace(debugSigningMatch[0], replaced);
      }
    } else {
      console.warn(
        "[withDebugAppIdSuffix] Pola signingConfigs.debug bawaan template tidak ditemukan - " +
        "cek manual android/app/build.gradle setelah prebuild, v1SigningEnabled mungkin tidak terpasang."
      );
    }

    config.modResults.contents = contents;
    return config;
  });
};

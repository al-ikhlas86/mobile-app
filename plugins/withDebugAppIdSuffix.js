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
const { withAppBuildGradle } = require("@expo/config-plugins");

module.exports = function withDebugAppIdSuffix(config) {
  return withAppBuildGradle(config, (config) => {
    const debugMarker = "debug {\n            signingConfig signingConfigs.debug\n        }";
    const debugReplacement =
      'debug {\n' +
      '            applicationIdSuffix ".dev"\n' +
      '            resValue "string", "app_name", "Al-Ikhlas 86 (Dev)"\n' +
      '            signingConfig signingConfigs.debug\n' +
      '        }';

    if (config.modResults.contents.includes(debugMarker)) {
      config.modResults.contents = config.modResults.contents.replace(debugMarker, debugReplacement);
    } else {
      console.warn(
        "[withDebugAppIdSuffix] Pola buildTypes.debug bawaan template tidak ditemukan persis - " +
        "cek manual android/app/build.gradle setelah prebuild, applicationIdSuffix mungkin tidak terpasang."
      );
    }

    // v1SigningEnabled ditambahkan 2026-08-29 - default AGP MODERN cuma
    // aktifkan v2 signing utk release (v1/JAR signing dianggap usang),
    // tapi TERBUKTI beberapa perangkat OEM (dilaporkan nyata: MIUI 12,
    // "kesalahan saat mengurai paket" saat instalasi) py package parser
    // yang bermasalah dgn APK v2-only walau device-nya SUNGGUHAN
    // mendukung Android 7+ (syarat minimum v2). Aktifkan KEDUANYA (v1+v2)
    // supaya APK dikenali packageinstaller manapun, bukan cuma AOSP murni.
    const signingMarker =
      "signingConfigs {\n        debug {\n            storeFile file('debug.keystore')\n            storePassword 'android'\n            keyAlias 'androiddebugkey'\n            keyPassword 'android'\n        }\n    }";
    const signingReplacement =
      "signingConfigs {\n        debug {\n            storeFile file('debug.keystore')\n            storePassword 'android'\n            keyAlias 'androiddebugkey'\n            keyPassword 'android'\n            v1SigningEnabled true\n            v2SigningEnabled true\n        }\n    }";
    if (config.modResults.contents.includes(signingMarker)) {
      config.modResults.contents = config.modResults.contents.replace(signingMarker, signingReplacement);
    } else {
      console.warn(
        "[withDebugAppIdSuffix] Pola signingConfigs.debug bawaan template tidak ditemukan persis - " +
        "cek manual android/app/build.gradle setelah prebuild, v1SigningEnabled mungkin tidak terpasang."
      );
    }

    return config;
  });
};

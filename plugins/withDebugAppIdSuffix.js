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
    const marker = "debug {\n            signingConfig signingConfigs.debug\n        }";
    const replacement =
      'debug {\n' +
      '            applicationIdSuffix ".dev"\n' +
      '            resValue "string", "app_name", "Al-Ikhlas 86 (Dev)"\n' +
      '            signingConfig signingConfigs.debug\n' +
      '        }';

    if (config.modResults.contents.includes(marker)) {
      config.modResults.contents = config.modResults.contents.replace(marker, replacement);
    } else {
      console.warn(
        "[withDebugAppIdSuffix] Pola buildTypes.debug bawaan template tidak ditemukan persis - " +
        "cek manual android/app/build.gradle setelah prebuild, applicationIdSuffix mungkin tidak terpasang."
      );
    }
    return config;
  });
};

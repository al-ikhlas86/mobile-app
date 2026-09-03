// Kompilasi Gradle (langkah "Build release APK + AAB" di
// .github/workflows/build-android.yml) makan ~25 menit - 92% dari total
// durasi build (diukur langsung dari log run 2026-09-02: 1514 dari ~1650
// detik). Cache yang sudah ada di workflow (~/.gradle/caches,
// ~/.gradle/wrapper) cuma menyimpan DEPENDENCY yang di-download, bukan
// HASIL KOMPILASI - jadi tiap runner baru tetap kompilasi ulang dari nol
// walau dependency-nya sudah tidak perlu di-download lagi. Dicek langsung:
// tidak ada satu pun pengaturan org.gradle.caching di repo ini sebelumnya.
//
// org.gradle.caching=true menyalakan build cache Gradle (beda dari
// dependency cache) - task yang inputnya sama (source file tidak berubah)
// memakai ulang output yang sudah pernah dikompilasi, walau folder android/
// itu sendiri di-generate ulang total tiap `expo prebuild --clean` (build
// cache Gradle disimpan di ~/.gradle/caches/build-cache-1, keyed dari HASH
// isi source - bukan dari path folder, jadi regenerasi folder tidak
// menggugurkan cache-nya). Cache ini otomatis ikut tersimpan/dipulihkan
// lewat langkah "Cache Gradle" yang sudah ada (path-nya sudah mencakup
// ~/.gradle/caches secara keseluruhan).
//
// Ditulis sbg plugin (bukan taruh gradle.properties manual) krn folder
// android/ di-gitignore & di-generate ulang total tiap `expo prebuild` -
// file manual akan hilang diam-diam tanpa ini.
//
// updateAndroidBuildProperty (helper internal @expo/config-plugins) SENGAJA
// TIDAK dipakai - dicoba dulu (ketemu lewat file .d.ts-nya), TAPI terbukti
// gagal saat diuji nyata (`npx expo prebuild`): fungsinya tidak diekspor
// di index publik package (cuma ada di modul internalnya sendiri,
// BuildProperties.js), jadi `require("@expo/config-plugins")` tidak
// pernah benar2 punya fungsi itu - error "is not a function" langsung
// ketauan sebelum sempat dipakai di CI. Diganti logika manual (cari
// baris dgn key yg sama, update value-nya; kalau belum ada, tambahkan)
// yang cuma pakai bentuk data publik (PropertiesItem: type 'property'
// dgn field key/value) - sama persis konsepnya dgn helper yg gagal tadi,
// tanpa bergantung pada API yg tidak dijamin stabil ke depannya.
const { withGradleProperties } = require("@expo/config-plugins");

module.exports = function withGradleBuildCache(config) {
  return withGradleProperties(config, (config) => {
    const key = "org.gradle.caching";
    const existing = config.modResults.find((item) => item.type === "property" && item.key === key);
    if (existing) {
      existing.value = "true";
    } else {
      config.modResults.push({ type: "property", key, value: "true" });
    }
    return config;
  });
};

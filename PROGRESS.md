# Status Aplikasi Native (React Native / Expo)

Salinan native dari Mobile-app (yang sebelumnya webview Capacitor). Backend
**100% sama** (`../backend`, Node/Express) - tidak ada satu baris pun
endpoint API yang berubah, cuma cara app memanggilnya yang beda.

Dibangun: 2026-08-21, oleh Claude (sesi otomatis, tanpa persetujuan
per-langkah sesuai instruksi user). **Belum 100% selesai** - lihat rincian
di bawah. Jangan hapus versi webview sebelum semua di bawah ini beres dan
diuji nyata di HP.

## Stack yang dipakai & kenapa

- **Expo SDK 57 + React Native + TypeScript** - dipilih drpd Flutter karena
  memungkinkan port logika bisnis (auth, api client, alur layar) hampir
  apa adanya dari kode React yang sudah ada, bukan tulis ulang total dari
  nol di bahasa berbeda.
- **NativeWind (Tailwind untuk RN)** - token warna (`src/styles/global.css`)
  disalin PERSIS dari `Mobile-app/src/styles/theme.css` (light+dark), jadi
  skema warna identik tanpa perlu desain ulang.
- **React Navigation** (bottom tabs + native stack) - menggantikan sistem
  navigasi custom berbasis history array di webview.
- **expo-camera, expo-location, @react-native-firebase/messaging** - INI
  alasan utama proyek ini dibuat: ketiganya native asli, bukan API browser
  di dalam WebView yang sering diam-diam gagal (scan wajah gabisa, absen
  lokasi gabisa, notifikasi gapernah muncul di luar app).

## Sudah selesai & terverifikasi bisa di-build (`npx expo export` sukses,
   3335 modul, 0 error)

- Autentikasi penuh: Login, OTP (kirim+verifikasi+countdown cooldown, PERSIS
  fix yang baru dikerjakan di versi web/backend hari ini), sesi tersimpan
  native (AsyncStorage, bukan localStorage).
- **Presensi via GPS** - `expo-location`, dialog izin native asli.
- **Pengenalan Wajah** - `expo-camera`, auto-capture berdasar deteksi arah
  wajah (logika & threshold disalin persis dari versi web yang sudah
  dikalibrasi ke server), dialog izin kamera native asli.
- **Push notification native** - `@react-native-firebase/messaging`
  (token FCM ASLI, backend TIDAK perlu diubah sama sekali) + kanal
  notifikasi Android + tampil di system tray sungguhan (bukan cuma toast
  dalam-app spt webview).
- Layar: Dashboard (versi ringkas, lihat "Belum selesai"), Berita Acara
  (daftar), Notifikasi, Profil (+ toggle tema), Ubah Kata Sandi, Koneksi
  Bot WhatsApp (admin).
- Dark mode penuh, mengikuti tema sistem HP secara default.
- `app.json` sudah dikonfigurasi: applicationId SAMA dgn APK webview
  (`com.alikhlas86.mobileapp`) supaya bisa reuse project Firebase yang
  sama tanpa setup baru, permission Android (kamera/lokasi/notifikasi)
  sudah didaftarkan.

## Update 2026-08-21 (lanjutan) — SEMUA 8 dashboard per-role sudah diporting

User protes keras versi pertama cuma py 1 Dashboard umum utk semua role
("ganti2 role menunya sama aja") - sudah diperbaiki total: ke-8 varian
Dashboard (AdminIT, AdminTU, Keuangan, OrangTua, Pegawai, Guru/GuruKelas,
Supervisor, AdminMedia) diporting SATU-SATU dari kode webview aslinya,
menu/kategori/urutan/link-nya PERSIS sama, disalurkan lewat dispatcher
`DashboardScreen.tsx` berdasar role (persis pola `AppScreen()` di webview).
Komponen shared ikut diporting: `SummaryCard`, `QuickMenuGrid`+
`QuickMenuButton`, `SemuaMenuView` (cari+kategori), `DashboardHero`+
`DashboardLayout`, `NewsCarousel`+`useNewsList`. Tab Presensi juga sekarang
role-aware (`PresensiTab` di `MainTabs.tsx`): Orang Tua → kehadiran anak,
Admin TU/IT/Keuangan/Supervisor → rekap semua orang, Admin Media → notice
akun administratif, role lain → presensi diri sendiri via GPS.

Layar yang menu-nya sudah nyambung ke fungsi ASLI (bukan placeholder):
Presensi (GPS), Pengenalan Wajah (kamera), Presensi Anak, Rekap Kehadiran
(PresensiAdminTU), Berita Acara (viewer), Notifikasi, Profil, Ubah Password,
Koneksi Bot WA.

Layar yang menu-nya SUDAH ADA & bisa ditekan tapi ISINYA masih placeholder
jujur ("belum diporting", bukan crash/dead-end): Manajemen Pengguna, Role &
Hak Akses, Buat Pengumuman, Backup Database, Status Sinkronisasi, Log
Aktivitas, Keuangan (data pembayaran), Kelola Berita Acara (mode admin),
Statistik Konten, Pengguna Diblokir, Detail Berita (viewer per-item),
Detail Pembayaran, Jadwal Pelajaran. Ini next priority utk diporting.

Terverifikasi: `tsc --noEmit` bersih (0 error) DAN `expo export` bundle
sukses (3351 modul) SETELAH semua perubahan di atas - bukan cuma sebelum.

## Update 2026-08-21 (lanjutan #2) — SEMUA 13 layar placeholder tadi sudah diporting fungsional

User protes keras lagi ("100% SAMA, jangan setop2") - ke-13 layar yang
sebelumnya placeholder SEMUA sudah diporting dari kode webview aslinya:
Manajemen Pengguna (+tinjau akun ganda), Role & Hak Akses, Buat Pengumuman,
Backup Database (download via expo-file-system+expo-sharing), Status
Sinkronisasi (polling live), Log Aktivitas (+pagination), Keuangan &
Detail Pembayaran (placeholder "belum tersambung ke Akuntansi" - INI SAMA
PERSIS dgn kondisi versi web, backend memang belum ada, bukan porting yg
dilewati), **Kelola Berita Acara mode admin PENUH** (buat/edit/draft/
terbitkan/hapus, upload thumbnail+galeri via expo-image-picker, tambah/
hapus link, filter status), Statistik Konten, Pengguna Diblokir
(+buka blokir), **Detail Berita/viewer PENUH** (galeri+lightbox, like,
komentar+balas+hapus+blokir pengomentar), Jadwal Pelajaran (+kalender
bulanan interaktif + agenda sekolah).

**Penyesuaian yg disadari & wajar utk platform native** (bukan fitur yang
dihilangkan diam-diam): embed iframe YouTube/Instagram/Facebook di detail
berita (RN tidak punya iframe) diganti buka link eksternal via `Linking`;
`<select>` HTML diganti `SimplePicker` (modal bottom-sheet) krn RN tidak
punya elemen select native.

Ditambah 3 dependensi baru: `expo-image-picker` (upload media berita),
`expo-file-system` + `expo-sharing` (download backup database - API
`expo-file-system` v57 SDK 57 ternyata sudah pindah ke API baru berbasis
class `File`/`Directory`, dipakai `expo-file-system/legacy` supaya tetap
bisa pakai `downloadAsync` yg familiar).

Terverifikasi: `tsc --noEmit` 0 error, `expo export` bundle sukses (3378
modul) SETELAH semua penambahan di atas.

## BELUM selesai (jangan anggap 100% - ini daftar jujur)

- **Semua fungsi sudah ada**, tapi kerapian visual/detail interaksi BELUM
  disamakan 100% ke versi web (spacing, animasi, transisi halus, dst) -
  user sendiri sudah bilang prioritas fungsi dulu, ini pekerjaan lanjutan.
- **Berita Acara viewer**: embed IG/FB/YouTube dibuka via browser eksternal
  (bukan inline spt web) - keterbatasan RN, lihat catatan di atas.
- **Keuangan, Jadwal Pelajaran, Manajemen Pengguna, Role & Hak Akses,
  Backup Database, Log Aktivitas, Statistik Konten, Buat Pengumuman,
  Rekap Kehadiran Admin (PresensiAdminTU), Blokiran Komentar** - SEMUA
  belum diporting sama sekali.
- **Multi-akun / "Ganti Akun"** (1 no HP = banyak peran) - logic backend
  jalan (linkedAccounts), tapi UI switcher belum ada di sini.
- **Upload foto profil/avatar** - endpoint sudah ada di `api.ts`
  (`uploadAvatar`), belum ada UI pemicunya.
- **Deep-link dari notifikasi ke layar spesifik** - kerangkanya ada
  (`pushNotifications.ts` sudah parse `data.screen`/`data.params`), tapi
  belum disambungkan ke navigator (lihat komentar TODO di
  `RootNavigator.tsx`).
- **iOS**: belum ada `GoogleService-Info.plist` (project Firebase belum
  pernah didaftarkan utk iOS) - push notification iOS BELUM bisa jalan
  sampai ini diisi. Build iOS sendiri juga tidak bisa dilakukan dari mesin
  Windows ini (butuh macOS/EAS Build cloud).
- **BELUM PERNAH diuji di HP/emulator sungguhan** - baru terverifikasi
  compile+bundle (`tsc --noEmit` bersih, `expo export` sukses 3335 modul).
  Ini beda dgn "sudah jalan" - kamera/GPS/push HARUS diuji langsung di
  device fisik sebelum dipakai produksi (emulator seringkali tidak akurat
  utk 3 fitur native ini khususnya).

## Bug kecil yang diketahui (belum sempat didalami)

- **`plugins/withNotificationManifestFix.js` tidak jalan sesuai rencana.**
  Dibuat supaya perbaikan konflik manifest (expo-notifications vs
  @react-native-firebase/messaging sama-sama declare
  `default_notification_color`) otomatis terpasang tiap `expo prebuild`
  diulang - tapi setelah dicoba, meta-data target TIDAK ketemu saat plugin
  ini jalan (kemungkinan urutan eksekusi mod expo-notifications beda dari
  yang diasumsikan). **Solusi sementara yang TERBUKTI jalan**: tambah manual
  `tools:replace="android:resource"` ke baris
  `com.google.firebase.messaging.default_notification_color` di
  `android/app/src/main/AndroidManifest.xml` SETIAP KALI habis jalankan
  `expo prebuild` (folder `android/` di-generate ulang dari nol tiap kali,
  jadi tambalan manual selalu hilang). Jangan lupa langkah ini sebelum
  build kalau baru prebuild ulang.
- **`android/local.properties` (path Android SDK) juga ikut hilang tiap
  `expo prebuild`** krn folder `android/` dihapus total & dibuat ulang -
  isi ulang manual (`sdk.dir=C:/Users/rei alt/AppData/Local/Android/Sdk`)
  sebelum build kalau baru prebuild ulang.

## Langkah selanjutnya yang disarankan (belum dikerjakan)

1. `npx expo run:android` dari mesin dev (atau `eas build`) → install ke HP
   asli → uji Login/OTP/Presensi GPS/Pengenalan Wajah/Push Notification
   satu-satu, LANGSUNG di device, bukan cuma percaya kode.
2. Porting sisa dashboard per-role + layar admin yang terdaftar di atas.
3. Daftarkan project Firebase utk iOS, dapatkan `GoogleService-Info.plist`.
4. Baru setelah semua di atas beres & teruji nyata - baru versi webview
   lama "dibersihkan jadi webview murni" sesuai rencana 2-versi (versi
   browser tetap ada, versi native ini yang ke Play Store/App Store).

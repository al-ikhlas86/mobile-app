# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Konteks Al-Ikhlas 86 (repo publik: tanpa rahasia/infrastruktur di sini)

Aplikasi Android native (Expo/React Native + NativeWind) untuk orang tua, guru, dan pegawai Al-Ikhlas 86. Backend dan PWA ada di repo `webview-app` (privat);
API-nya sama. Konteks ekosistem lengkap ada di laptop dev pemilik: `C:\xampp\htdocs\webarsipdata-master\CLAUDE.md` dan `Projek.md`.

- Balas Bahasa Indonesia; commit tanpa trailer Claude.
- **Jangan build APK lokal.** Build lewat GitHub Actions: `gh workflow run build-android.yml -R al-ikhlas86/mobile-app` (push ke `main` juga memicu); APK didistribusikan otomatis.
- Pengecekan tipe: `npx tsc --noEmit`. Pola layar mengikuti `src/` yang ada; paritas dengan webview (satu API) harus dijaga.
- Akun gabungan: sesi staf yang nomornya punya akun Orang Tua memakai token akun itu untuk jalur milik orang tua (`JALUR_ORANG_TUA` di `src/services/api.ts`); pilihan anak aktif dibawa `anakTerpilihService`.
- Mode Demo tidak boleh mendaftarkan token push; header tahun ajaran (`X-Viewing-Tahun-Ajaran`) hanya untuk token akun aktif.
- Jangan commit `google-services.json` baru/kunci apa pun; jangan tulis alamat server atau token di kode baru selain konfigurasi yang sudah ada.

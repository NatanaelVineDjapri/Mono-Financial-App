# MONO Finance — Rencana impor otomatis dari notifikasi

Ditulis sebelum kode (CLAUDE.md, Build order 11). Cakupan: **sumber Notifikasi Android saja**. Gmail **ditunda**: tidak ada kode, tabel, layar, atau izin untuknya, dan kartu "Gmail" di papan Import-Setup tidak digambar sampai ada keputusan baru. Versi lama rencana ini (dua sumber, dengan Gmail) ada di riwayat git.

Prinsip yang tidak boleh bergeser: semua lokal, tanpa jaringan, tanpa AI, tanpa login. Notifikasi tidak pernah menyimpan transaksi sendiri; semua hasil bacaan lewat layar tinjauan dan baru jadi transaksi saat pengguna menekan Simpan.

## 1. Tujuan

Semua aplikasi bank dan e-wallet bisa dicoba dibaca, dengan dua tingkat:

- **Didukung penuh**: aplikasi yang punya parser khusus (satu modul per institusi, diuji dengan teks sampel asli). Daftar ini **kosong** sampai ada sampel nyata.
- **Aplikasi terdeteksi**: aplikasi lain yang pernah mengirim notifikasi. Dibaca dengan parser umum dan hasilnya **selalu bertanda "Ditebak"**.

Urutan baca nanti: parser khusus, lalu parser umum, lalu dibuang (teksnya tidak disimpan sama sekali).

Yang dikerjakan di tahap ini (fondasi): listener native dengan allowlist, pencatat "aplikasi terdeteksi", tabel pengaturan per aplikasi, layar Impor otomatis (Import-Setup dan Import-Settings), panduan izin (Import-Permission), dan perekam sampel khusus dev. **Belum**: parser, antrean tinjauan, layar Import-Review dan Import-Review-Edit (tahap berikutnya).

## 2. Arsitektur

```
modules/notification-listener/          modul Expo lokal (Kotlin), di-autolink Gradle
  expo-module.config.json
  android/build.gradle
  android/src/main/AndroidManifest.xml   mendaftarkan service (izin BIND_NOTIFICATION_LISTENER_SERVICE)
  android/src/main/java/expo/modules/mononotificationlistener/
    Allowlist.kt            keputusan murni: teruskan / catat terlihat / buang
    ImportStore.kt          SharedPreferences: allowlist, aplikasi terlihat, waktu baca terakhir
    NotificationBus.kt      antrean memori kecil + pendengar ke JS
    NotificationListener.kt NotificationListenerService
    NotificationListenerModule.kt  jembatan JS (fungsi + event "onNotification")
  src/index.ts              antarmuka TS (dengan cadangan bila modul tak ada: Expo Go, Jest)

src/features/import/
  notifications/
    native.ts               pembungkus modul, aman bila modul tidak ada
    allowlist.ts            filter kedua di sisi JS (lapis cadangan), murni, diuji
    access.ts               status akses notifikasi dan baterai, murni + hook
    sync.ts                 aplikasi terlihat -> import_app_settings; allowlist -> native
    sampler.ts              hanya __DEV__: teks mentah di memori untuk /dev/import-sampler
  parsers/registry.ts       paket -> parser khusus (kosong); menentukan supported_level
src/data/repo/importApps.ts, src/domain/importApps.ts
src/app/settings/import.tsx, src/app/dev/import-sampler.tsx, src/app/settings.tsx (baris masuk)
```

**Kenapa modul sendiri, bukan library.** Syarat utama adalah allowlist di sisi native: notifikasi dari paket yang tidak diaktifkan tidak boleh sampai ke JS. Library yang ada meneruskan semua notifikasi ke JS (headless task) lalu menyaring di sana. Selain itu `react-native-android-notification-listener` terakhir diperbarui Desember 2022 dengan peer dependency React 18 (project ini React 19.3), dan `react-native-notification-listener` Mei 2023 dengan peer yang sama. Jadi modul Expo lokal sendiri; daftar service lewat manifes library modul itu (digabung otomatis), tanpa mengedit `android/` manual.

## 3. Aliran data di native

`onNotificationPosted(sbn)` memutuskan lewat `Allowlist.decide`:

1. Notifikasi milik MONO sendiri, notifikasi berkelanjutan (ongoing), ringkasan grup, dan paket sistem: **buang**.
2. Paket ada di allowlist: **teruskan** (paket, judul, teks, waktu) ke antrean memori (maks. 100) dan event ke JS; waktu baca terakhir dicatat.
3. Paket lain: **catat terlihat** saja: `{package, nama aplikasi, waktu terakhir}`, paling sering sekali per menit per paket. Tidak ada teks, judul, atau isi. Nama aplikasi diambil dari `ApplicationInfo` yang menyertai notifikasi, cadangannya nama paket.

Allowlist disimpan di SharedPreferences, jadi service tetap bekerja walau JS belum jalan. JS mengirim ulang allowlist dari database setiap app dibuka dan setiap pengaturan berubah.

## 4. Tabel (migrasi v3, jangan ubah yang lama)

`import_app_settings`: `package` (PK), `app_name`, `enabled` (0/1), `account_id` (nullable, FK ke `accounts`, RESTRICT), `supported_level` ('full' | 'generic'), `last_seen_at`. `CHECK (enabled = 0 OR account_id IS NOT NULL)`: **tanpa akun tujuan, aplikasi tetap mati**. Trigger `import_needs_idr_account`: akun tujuan tidak boleh akun Valas. Hanya metadata aplikasi; tidak ada kolom isi pesan.

Cadangan: tabel ini **tidak diekspor** (khusus perangkat, pemetaan paket) tetapi **dikosongkan saat restore** (kalau tidak, hapus `accounts` gagal oleh FK). Setelah restore, aplikasi perlu dinyalakan lagi.

## 5. Layar

- **`/settings/import`**: Import-Setup bila belum diatur (izin akses mati dan belum ada aplikasi aktif), Import-Settings bila sudah. Status akses, waktu terakhir membaca, tautan "N transaksi menunggu tinjauan" (nol dulu), kelompok "Didukung penuh" (kosong), kelompok "Aplikasi terdeteksi" (nama aplikasi, saklar, akun tujuan; teks "Dibaca dengan pembacaan umum. Hasilnya selalu perlu kamu periksa."; papan belum menggambarnya, dibuat dengan baris dan saklar yang sama), dan "Kalau ada masalah" (akses mati, penghemat baterai).
- **Lembar panduan izin (Import-Permission)**: empat langkah setelan terbatas Android 13+, tombol "Buka pengaturan Android" dan "Nanti saja"; tidak tampil bila izin sudah aktif.
- **Titik masuk**: Pengaturan, Asisten, Impor otomatis. Default mati.
- **`/dev/import-sampler`** (hanya `__DEV__`): teks mentah notifikasi dari paket yang diaktifkan, di memori saja, tombol Salin. Untuk mengambil sampel nyata yang ditempel ke chat supaya parser dibuat dari teks asli.

## 6. Parser berlapis (tahap berikutnya)

1. **Khusus per institusi**, hanya yang punya sampel nyata. Tidak mengarang format teks. Hasil `{institution, merchant, amountIdr, kind, occurredAt, reference?}`, tingkat "Didukung penuh".
2. **Umum** (`generic.ts`): lolos hanya bila ada nominal rupiah dan kata kunci transaksi; OTP, promo, dan notifikasi tanpa nominal dibuang; jenis tidak jelas berarti "Perlu dicek"; selalu "Ditebak".
3. Selain itu **dibuang**, teksnya tidak disimpan.

Kategori dari memori per merchant lalu aturan kata kunci lokal, kosong bila tidak tahu, tidak pernah ditebak dan tidak pakai AI. Menyimpan lewat fungsi domain yang sama dengan transaksi manual, `source = 'import'`.

## 7. Risiko

- **Penghemat baterai menghentikan service.** Beberapa ponsel mematikan MONO di latar belakang. Mitigasi: baris masalah di Import-Settings dengan tautan ke pengaturan baterai (`ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS`, tanpa izin tambahan); `requestRebind` saat app dibuka bila akses aktif tapi service tidak terhubung.
- **"Setelan terbatas" Android 13+.** MONO dipasang di luar Play Store, jadi akses notifikasi terkunci sampai pengguna membuka Info aplikasi, titik tiga, "Izinkan setelan terbatas". Dijelaskan di lembar panduan; status dibaca lewat `NotificationManagerCompat.getEnabledListenerPackages`, dicek ulang tiap app kembali aktif.
- **Antrean memori hilang bila proses mati.** Disengaja: tidak ada teks di disk. Dampaknya satu-dua notifikasi bisa terlewat.
- **Daftar "Aplikasi terdeteksi" bisa panjang**: semua aplikasi non-sistem yang pernah memberi notifikasi tercatat (hanya nama). Diurutkan terbaru dulu dan dibatasi 50 baris.
- **Modul native tidak terbukti di sini.** Kotlin dan allowlist native hanya bisa dibuktikan di perangkat setelah build ulang. Karena itu ada filter kedua di JS, diuji di Jest.
- **Perekam sampel** memegang teks mentah di memori. Dibatasi `__DEV__`, hanya paket yang diaktifkan, tidak ditulis ke DB maupun disk.

## 8. Urutan kerja

1. Rencana ini. 2. Migrasi v3 + repo + domain + tes (aktivasi tanpa akun ditolak). 3. Modul native + manifes + pembungkus TS + filter JS + tes allowlist. 4. Pencatat aplikasi terdeteksi + sinkron ke DB + tes (tidak menyimpan teks). 5. Layar `/settings/import` dan panduan izin, baris masuk di Pengaturan. 6. `/dev/import-sampler`. 7. Docs dan CLAUDE.md. 8. Tahap berikutnya: parser umum, antrean, Import-Review, Import-Review-Edit.

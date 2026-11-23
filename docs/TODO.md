# Yang harus dikerjakan pemilik (dites manual)

Daftar ini untuk hal yang tidak bisa dibuktikan lewat Jest. Centang kalau sudah.

## Impor notifikasi (kode sudah jadi, belum dites di perangkat)

- [ ] Build ulang dev build supaya modul native ikut: `npx expo run:android --port 8081`.
- [ ] Pengaturan → Impor otomatis → aktifkan akses notifikasi (Android 13+: buka dulu "pengaturan terbatas", ada panduannya di layar).
- [ ] Di emulator: `/dev/import-sampler` → nyalakan sakelar "izinkan app sistem", nyalakan `com.android.shell` di Impor otomatis dengan satu akun rupiah, lalu kirim notifikasi palsu:
  `adb shell cmd notification post -t "Pembayaran berhasil" tes1 "Kamu membayar Rp25.000 di Kopi Kenangan"`
- [ ] Cek kartunya muncul di "N transaksi menunggu tinjauan" (`/import/review`), bertanda "Ditebak".
- [ ] Buka kartu (`/import/edit/[id]`): ubah jenis, nominal, kategori, tanggal; tekan Simpan; cek transaksinya muncul di Transaksi dan saldo akun berubah.
- [ ] Tes Tolak: kartu hilang dan notifikasi yang sama tidak muncul lagi.
- [ ] Tes "Ingat kategori untuk toko ini": kirim notifikasi dari toko yang sama, kategorinya sudah terisi.
- [ ] Tes notifikasi yang masuk saat app tertutup: tutup app, kirim notifikasi, buka app, kartunya ada.
- [ ] Tes Sembunyikan nominal: angka di Tinjau dan Periksa tersembunyi.
- [ ] Cek teks 200% (rows membesar, angka tidak terpotong).

## Parser per bank (butuh sampel asli)

- [ ] Di HP sungguhan yang punya app bank atau e-wallet: ambil teks notifikasi lewat `/dev/import-sampler`.
- [ ] Kumpulkan 2–3 contoh per jenis: pengeluaran, pemasukan, transfer keluar, top up, dan satu contoh notifikasi non-transaksi (promo, OTP, info saldo).
- [ ] Samarkan nomor rekening, nama orang, dan saldo, lalu tempel ke chat. Parser khusus dibuat dari sampel itu.

## Lain-lain yang masih menggantung

- [ ] Build ulang dev build juga diperlukan untuk expo-video dan MapLibre.
- [ ] Tes manual: baris "Tinjau transaksi" di Lainnya muncul hanya kalau ada yang menunggu, dan membuka `/import/review`.
- [ ] Tes manual: layar Welcome punya baris "Foto profil"; pilih satu, tekan Mulai, cek avatar di Ringkasan. (Baris ini tambahan, tidak ada di papan Welcome; kalau tidak suka, bilang.)
- [ ] Tes manual nama panggilan: Pengaturan → Profil → Nama panggilan; cek sapaan di Ringkasan berubah, dan kosongkan lalu cek kembali ke sapaan bawaan.
- [ ] Tes manual pengeluaran tetap: buat satu dengan nominal lebih besar dari saldo akun, lalu buka sheet konfirmasinya; harus ada teks merah "Short by …" dan tombol Catat mati. Ubah/ simpan template saat database menolak: harus ada pesan di atas Simpan, bukan diam.
- [ ] Belum di-commit: seluruh pekerjaan impor notifikasi dan NetCashFlowCard.

## Scan kartu e-money (NFC): kode sudah jadi, belum pernah dicoba dengan kartu fisik

Emulator tidak punya NFC. Untuk melihat semua layar tanpa kartu: Lainnya, Dev tools, nyalakan "Pretend card", pilih skenario, "Open Scan card".

- [ ] Build ulang dev build supaya modul `react-native-nfc-manager` ikut: `npx expo run:android --port 8081` (di ponsel yang punya NFC).
- [ ] Mandiri e-money: scan, cek "Saldo di kartu" sama dengan struk atau aplikasi Livin'. Ini adaptor yang diberi status stabil, tetapi letak nomor kartu di jawaban `00 B3` belum ada di sumber publik, jadi nomor dicari lewat awalan 6032. Kalau terbaca "belum didukung", kirim hasil `/dev/import-sampler`-nya atau bilang ke aku.
- [ ] Flazz (generasi 2), TapCash, Brizzi: scan, lalu cocokkan angkanya dengan struk atau aplikasi banknya. Semua percobaan; TapCash paling tidak pasti (nomor kartu belum tentu terbaca, kalau begitu kartunya dibilang belum didukung). Brizzi bisa berlabel "perkiraan".
- [ ] Flazz generasi 1 dan JakCard: harus "Kartu ini belum didukung" (Flazz gen 1 saldonya terenkripsi, JakCard belum ada cara baca nomornya).
- [ ] Kartu debit atau kredit: harus "Kartu ini belum didukung", dan tidak ada nomor kartu bank yang pernah tampil.
- [ ] Kartu terlepas di tengah baca: "Kartu terlepas terlalu cepat", lalu "Coba lagi" jalan.
- [ ] NFC dimatikan lalu dinyalakan: "NFC belum aktif", "Buka pengaturan NFC" membuka pengaturan, kembali ke MONO langsung menunggu kartu.
- [ ] Ponsel tanpa NFC: tombol "Scan kartu" dan "Isi dari kartu e-money" tersembunyi, dan aplikasi tetap bisa dipasang.
- [ ] Auto-buka (butuh build baru, karena manifest berubah): tutup MONO sepenuhnya lalu tempelkan kartu e-money ke belakang ponsel: MONO terbuka di layar Scan kartu dan membaca. Ulangi dengan MONO terbuka di layar lain, dan dengan MONO di latar belakang.
- [ ] Auto-buka dengan kartu debit/kredit: MONO ikut terbuka (Android tidak bisa membedakan), layar Scan kartu menolak dengan pesan yang jelas dan tidak membaca nomornya.
- [ ] Kalau ada aplikasi lain yang juga menangani IsoDep, Android bisa menampilkan pemilih aplikasi; catat apakah mengganggu.
- [ ] Scan kartu yang sama dua kali: kali kedua langsung dikenali (halaman hasil, bukan "Kartu baru").
- [ ] Buat cadangan, pulihkan, scan lagi: kartu tetap dikenali.
- [ ] "Catat penyesuaian": cek saldo akun jadi sama dengan kartu, transaksinya bertuliskan "Penyesuaian saldo dari kartu", dan "Urungkan" mengembalikannya.
- [ ] Akun e-wallet yang tertaut: Ubah akun, "Lepas tautan kartu" hanya melepas tautan; akun dan transaksinya tetap.
- [ ] Keputusan: kategori "Penyesuaian saldo" kini ada di daftar kategori semua orang (dibuat oleh migrasi). Kalau tidak mau muncul untuk yang tidak memakai NFC, bilang; bisa diubah jadi dibuat saat penyesuaian pertama.

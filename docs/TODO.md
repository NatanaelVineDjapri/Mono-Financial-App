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

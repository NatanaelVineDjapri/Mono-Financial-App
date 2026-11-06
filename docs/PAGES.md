# MONO Finance — penjelasan per halaman

Setiap papan di kanvas desain: tujuan, tata letak, keadaan, dan catatan. Nama berkas papan sama dengan kolom Board di SCREENS.md. Semua angka adalah data contoh (placeholder).

## Dokumentasi desain

### DS-1 · Design system · Fondasi

Papan: `DS-Foundations` · 1280 × 5440 (papan lebar)

**Tujuan.** Satu halaman rujukan untuk semua token visual: warna, tipografi, jarak, bentuk, ikon, dan logo.

**Tata letak dan komponen**

- 01 Logo: ikon aplikasi (launcher, splash, About), ruang kosong, ukuran minimum, dan aturan pemakaian.
- 02 Warna: kotak token beserta nama kode (MonoColors.bg, bg2, card, elevated, text, text2, muted, meta, border, inverse, onInverse), hex, kegunaan, dan rasio kontras (misalnya 18,2:1 untuk teks utama). Ditambah deret grafik #F5F5F5 · #A3A3A3 · #6B6B6B · #4A4A4A.
- 03 Tipografi: contoh langsung tiap gaya (Display, Title L, Figure L, Title M, Body, Figure row, Body S, Label, Mono) dengan spesifikasi keluarga huruf, bobot, ukuran/leading.
- 04 Jarak, radius, garis: skala jarak 4–64, radius 10 · 12 · 16, garis 1 px #2B2B2B, grid 8 poin.
- Metrik tata letak: padding sisi layar 16, jarak antar kartu 16–24, tinggi minimum baris 60, target sentuh minimum 48 (44 bila sempit), navigasi bawah 72.

**Keadaan**

- Halaman statis, hanya untuk dibaca.

**Catatan**

- Sebagian besar keputusan visual dibuat di sini lalu dipakai ulang oleh papan layar. Jika token berubah, ubah di sini dulu.

### DS-2 · Design system · Komponen

Papan: `DS-Components` · 1280 × 3960

**Tujuan.** Katalog komponen UI beserta keadaannya, supaya developer tidak perlu menebak.

**Tata letak dan komponen**

- 01 Tombol dan kontrol: tombol 48 tinggi radius 12 (Save transaction, Cancel, Skip for now, Delete account, keadaan Saving…), tombol ikon dan FAB, chip (Expense, Income, Transfer, Food · 3), segmented, penyeleksi bulan, tab.
- 02 Input: keadaan kolom teks (normal, wajib diisi, terkunci setelah transaksi pertama), kolom nominal dengan chip tambah cepat, pencarian, dan pemilih akun, kategori, tanggal.
- 03 Baris dan daftar: baris transaksi dan akun, baris anggaran (normal dan melebihi batas), baris target.
- 04 Progres dan grafik: bar progres (0%, 48%, 85,14%, melebihi batas dengan segmen bergaris), gaya grafik dengan seri dibedakan lewat tingkat terang, tabel nilai di samping grafik, dan panduan kapan perlu grafik.
- 05 Navigasi: bottom navigation 72 tinggi dan variasi app bar.
- 06 Permukaan dan umpan balik: bottom sheet, dialog konfirmasi merusak (Replace all data?), snackbar dengan Undo, banner dan empty state.

**Keadaan**

- Setiap komponen ditampilkan dalam keadaan default, terpilih, fokus, nonaktif, dan error bila relevan.

**Catatan**

- Status error dan sukses dibedakan lewat ikon, label, dan ketebalan garis. Warna tidak pernah dipakai sebagai pembeda.

### DS-3 · Navigasi dan alur pengguna

Papan: `Flows` · 1280 × 1500

**Tujuan.** Peta bagaimana layar saling terhubung dan tiga alur utama dari awal sampai selesai.

**Tata letak dan komponen**

- 1 · Peta navigasi: tabel Layar / Pemeriksaan / Blokir atau error / Hasil untuk Overview, Transactions, Accounts, Budgets, dan More beserta anak layarnya.
- 2 · Transfer antar akun: ketuk Transfer, isi form (dari, ke, jumlah, tanggal, catatan), cek valid (akun berbeda dan jumlah ≤ saldo). Valid: tersimpan (BCA −Rp500.000, Jago Pocket +Rp500.000, kekayaan bersih tidak berubah). Tidak valid: Simpan nonaktif, selisih disebut, perbaiki, cek ulang; form mempertahankan isian.
- 3 · Membuat anggaran: pilih kategori yang belum punya anggaran, tetapkan batas (Rp500.000, ulangi tiap bulan), cek alokasi Rp5.500.000 terhadap Rp5.000.000. Lolos: tersimpan. Melebihi Rp500.000: Simpan nonaktif sampai batas dinaikkan atau anggaran diturunkan.
- 4 · Backup dan restore: Create backup now → share sheet → Backup saved (tanggal cadangan terakhir di More dan Overview diperbarui). Restore → pilih berkas → validasi (JSON, penanda, versi skema, total) → konfirmasi (bandingkan jumlah, cadangan pengaman, centang) → data diganti dan Overview dihitung ulang. Gagal: daftar cek menunjukkan pemeriksaan yang gagal dan data tidak tersentuh.

**Keadaan**

- Setiap alur disusun sebagai langkah, pemeriksaan, jalur gagal, dan hasil.

**Catatan**

- Berkas yang tidak valid tidak pernah memulihkan sebagian data.

### DS-4 · Serah terima React Native

Papan: `Handoff` · 1280 × 4720

**Tujuan.** Catatan pengerjaan untuk engineer: tema, format, pemetaan komponen ke widget, aturan akuntansi, skema data, dan pengujian.

**Tata letak dan komponen**

- 1 · Token warna dan tema (src/theme/tokens.ts).
- 2 · Tipografi dan format uang (src/core/money.ts), dengan formatter rupiah dan persen buatan sendiri.
- 3 · Peta komponen: Button dan IconButton berbasis Pressable, FAB 56 radius 16 (hanya di Transactions), Chip 40 tinggi, Segmented, Field dan AmountField berbasis TextInput (hanya digit, menyimpan int), tab bar expo-router 72, sheet dan dialog lewat rute transparentModal (hapus semua meminta ketik ERASE), Toast dengan Undo, ProgressBar 8 tinggi dengan segmen bergaris saat melebihi, grafik victory-native dengan tabel nilai, kartu bank yang digambar dengan Skia, dan MonoSwitch kustom.
- 4 · Aturan akuntansi, sumber kebenaran tunggal (src/domain): tidak ada saldo tersimpan, transfer, kekayaan bersih, arus bulanan, anggaran terpakai, target, pembulatan, dan penjaga.
- 5 · Stack dan paket (package.json) dan 6 · Ringkasan skema SQLite v1 (src/data/db), dengan berkas lengkap di papan Database.
- 7 · Format berkas cadangan (src/data/backup) dan urutan pemulihan: periksa penanda mono-finance dan schema_version, validasi total, lalu invalidasi cache TanStack Query sehingga Overview dihitung ulang dari baris hasil pemulihan.
- 8 · Struktur folder berbasis fitur dan 9 · Pengujian yang ditulis lebih dulu pada lapisan domain.

**Keadaan**

- Halaman statis.

**Catatan**

- Uang disimpan sebagai bilangan bulat rupiah. Persentase dihitung dari basis point.

### DS-5 · Database · skema v1

Papan: `Database` · 1280 × 4340

**Tujuan.** Rancangan database lokal: diagram relasi antartabel, fungsi tiap tabel, data turunan, penjaga, cadangan, dan migrasi.

**Tata letak dan komponen**

- 1 · Diagram relasi (ERD) 14 tabel dengan kunci utama, kunci asing, dan satu tautan lunak (month antara budgets dan monthly_limits).
- 2 · Tabel: isi dan hal yang perlu diketahui tiap tabel.
- 3 · Data turunan yang tidak pernah disimpan: 17 view (kantong, kurs, saldo, kekayaan bersih, arus periode, tingkat tabungan, status anggaran, progres target, jatuh tempo, audit integritas).
- 4 · Konvensi: uang bilangan bulat, rasio basis point, tanggal ISO, periode mengikuti month_start_day, arsip bukan hapus.
- 5 · Penjaga: 15 trigger dengan 7 kode galat dan pesan yang disarankan (saldo tidak minus, tanpa tanggal masa depan, anggaran dalam batas bulanan).
- 6 · Cadangan dan restore: tabel yang ikut berkas, dan enam langkah restore di sisi database.
- 7 · Pilihan yang sengaja diambil dan 8 · Migrasi berdasarkan schema_version.

**Keadaan**

- Halaman statis.

**Catatan**

- Berkas SQL lengkap (mono_schema_v1.sql) sudah dijalankan dan diuji di SQLite dengan data contoh yang sama dengan semua layar. Belum dijalankan di perangkat lewat expo-sqlite.

## A · Overview

### A0 · Welcome (first launch)

Papan: `Welcome` · 390 × 844

**Tujuan.** Sambutan sekali saja setelah aplikasi pertama kali dipasang, dengan maskot MONO.

**Tata letak dan komponen**

- Header 56 px dengan tanda dan wordmark MONO. Tidak ada navigasi bawah.
- Video maskot 300 × 300 di tengah (rubah berhoodie "M" yang melambai lalu menunjuk). Tanpa suara, berulang, dengan latar hitam yang menyatu ke #0A0A0A dan tepi yang memudar.
- Judul "Selamat datang di MONO" dalam Newsreader 32/36 (momen serif satu-satunya) dan deskripsi satu kalimat.
- Tiga janji dengan ikon: hanya di perangkat ini tanpa akun, tanpa login bank atau nomor kartu, semua angka dihitung dari catatan.
- Kolom "Nama panggilan" (opsional, contoh Nael) dengan keterangan bahwa nama hanya dipakai untuk sapaan di Overview.
- Tombol utama "Mulai" menuju Overview kosong, dan tautan "Punya berkas cadangan? Pulihkan" menuju layar Backup.

**Keadaan**

- Video diputar otomatis tanpa suara dan berulang. Poster (bingkai diam) tampil sebelum video siap.
- Jika sistem meminta kurangi gerakan, tampilkan poster saja.

**Catatan**

- Video bersifat dekoratif dan tidak membawa informasi. Berkas 1,1 MB, 7 detik, 24 fps, tanpa audio; di React Native dibundel di assets.
- Nama panggilan perlu disimpan sebagai satu nilai pengaturan lokal.

### A1 · Overview (data contoh)

Papan: `Main` · 390 × 2890

**Tujuan.** Layar pembuka. Menjawab "berapa kekayaan saya sekarang dan bagaimana bulan ini?" dalam satu gulir.

**Tata letak dan komponen**

- Header 64 px: tanda dan wordmark MONO di kiri, tanggal (Rab, 28 Okt 2026) dan tombol pengaturan di kanan.
- Sapaan "Selamat datang, Nael" (IBM Plex Sans 600, 20/26).
- Kekayaan bersih: label kecil, tombol Sembunyikan/Tampilkan, angka Rp8.880.000 dalam Newsreader 48/52 (satu-satunya momen serif di layar ini), baris perubahan +Rp3.243.000 (+57,53%) dan "vs 30 Sep 2026".
- Bagian "Your accounts": carousel kartu akun bergaya bank (312 × 184) yang bisa digeser, tautan "All accounts", catatan bahwa total kartu sama dengan kekayaan bersih.
- Kartu "Fixed expenses": Gym membership jatuh tempo hari ini (Rp200.000) dengan tombol "Review and record", lalu "Next: Internet · 5 Nov" Rp385.000.
- Bulan ini: pemasukan, pengeluaran, selisih bersih.
- Riwayat kekayaan bersih: grafik garis Mei–Okt dengan garis target Rp30 juta, disertai tabel nilai.
- Pemasukan vs pengeluaran: grafik batang enam bulan, disertai tabel nilai.
- Posisi uang: bar bertumpuk per akun (BCA 77,05% · Jago Pocket 14,36% · Cash wallet dan GoPay 8,59%).
- Transaksi terbaru, ringkasan anggaran dengan peringatan melebihi batas, kartu target.
- Navigasi bawah lima item, Overview aktif.

**Keadaan**

- Tombol sembunyikan mengganti semua angka menjadi Rp•••••••• tanpa mengubah lebar tata letak.
- Carousel berhenti (snap) di tiap kartu; kartu menuju layar Detail Akun.

**Catatan**

- Semua angka diturunkan dari catatan. Tidak ada total yang diketik manual.
- Naik/turun ditandai tanda + dan − serta ikon; hijau dan merah hanya menguatkan, tidak pernah jadi satu-satunya penanda.

### A2 · Overview — keadaan kosong

Papan: `Overview-Empty` · 390 × 844

**Tujuan.** Tampilan pertama setelah instalasi, sebelum ada akun.

**Tata letak dan komponen**

- Header yang sama seperti A1.
- Sapaan "Selamat datang, Nael", lalu kekayaan bersih Rp0 dan kalimat "Belum ada catatan. Kekayaan bersih dihitung dari akun Anda."
- Daftar "Set up in four steps" (0 dari 4 selesai): tambah akun, catat transaksi, atur anggaran bulanan, buat cadangan.
- Catatan privasi: data hanya ada di perangkat ini.

**Keadaan**

- Setiap langkah adalah tautan ke layar terkait (Account-Edit, Tx-Add, Budget-Create, Backup).

**Catatan**

- Tidak ada grafik nol dan tidak ada kartu akun karena belum ada akun.

## B · Transaksi

### B1 · Transactions (data contoh)

Papan: `Transactions` · 390 × 1600

**Tujuan.** Menelusuri dan menyaring semua catatan uang masuk, keluar, dan transfer.

**Tata letak dan komponen**

- Judul, jumlah transaksi dalam rentang (34 transaksi, 1–28 Okt 2026) dan tombol Filters.
- Pencarian, chip tipe (All, Income, Expenses, Transfers), chip kategori dan akun.
- Ringkasan: pemasukan +Rp7.500.000, pengeluaran −Rp4.257.000, bersih +Rp3.243.000, dan catatan "Tidak dihitung: 3 transfer antar akun (Rp2.200.000)".
- Daftar Oktober dikelompokkan per hari dengan total harian. Tiap baris: judul dan nominal, lalu kategori · akun · tanggal dan label tipe.
- September ditampilkan tertutup (Pengeluaran Rp3.940.000); bulan lama dimuat saat menggulir.
- Tombol aksi mengambang + (56) membuka layar chat AI langsung. Hanya layar ini yang memilikinya.

**Keadaan**

- Pencarian dan filter berjalan di perangkat.
- Hasil kosong menampilkan empty state "No matches".

**Catatan**

- Pemasukan tebal dengan +, pengeluaran dengan − sejati (U+2212), transfer tanpa tanda dan berwarna abu-abu.

### B2 · Lembar filter transaksi

Papan: `Tx-Filters` · 390 × 844

**Tujuan.** Menyaring daftar berdasarkan beberapa kriteria sekaligus.

**Tata letak dan komponen**

- Bottom sheet dengan judul Filters dan tautan "Reset all".
- Tipe: Income, Expenses, Transfers.
- Rentang tanggal: This month, Last month, 3 months, This year, Custom, dengan dua kolom tanggal (1 Okt 2026 – 28 Okt 2026).
- Kategori dan akun dalam bentuk chip.
- Tombol bawah: Cancel dan "Show 11 transactions" (jumlah hasil ditampilkan sebelum diterapkan).

**Keadaan**

- Chip terpilih berisi terang dengan ikon centang. Latar belakang ditutup scrim hitam.

**Catatan**

- Jumlah hasil pada tombol mencegah pengguna menerapkan filter yang menghasilkan daftar kosong.

## C · Tambah transaksi

### C1 · Tambah transaksi — pengeluaran

Papan: `Tx-Add` · 390 × 844

**Tujuan.** Mencatat pengeluaran secepat mungkin.

**Tata letak dan komponen**

- App bar dengan judul dan segmented control Income / Expense / Transfer.
- Kolom nominal besar (Rp 125.000) dengan chip tambah cepat +10.000, +50.000, +100.000.
- Kategori dalam chip (Food & drink, Transport, Shopping, Bills, More).
- Akun (BCA Tabungan) dengan teks "Saldo setelah: Rp6.717.500".
- Tanggal 28 Okt 2026 dengan pintasan Today dan Yesterday, lalu deskripsi dan catatan opsional.
- Tombol Cancel dan "Save expense".
- Tombol "Chat" di header kanan membuka layar Catat lewat chat.

**Keadaan**

- Setelah disimpan muncul snackbar "Expense saved. BCA Tabungan is now Rp6.717.500." dengan Undo.

**Catatan**

- "Saldo setelah" menunjukkan dampak sebelum pengguna menyimpan.

### C2 · Tambah transaksi — validasi

Papan: `Tx-Add-Errors` · 390 × 960

**Tujuan.** Menunjukkan bagaimana kesalahan dijelaskan dan diperbaiki.

**Tata letak dan komponen**

- Form yang sama dengan C1 dengan nominal Rp1.500.000 dan akun Cash wallet (saldo Rp450.000).
- Kategori belum dipilih: pesan "Choose a category so this counts toward the right budget."
- Saldo kurang: "Cash wallet only has Rp450.000. Pick another account, lower the amount, or transfer money in first." dengan tautan ke form transfer.
- Ringkasan "2 fields need attention before this can be saved." dan tombol Save expense nonaktif.

**Keadaan**

- Kolom bermasalah berbingkai 1,5 px terang, ikon peringatan, dan teks. Tidak memakai warna merah.

**Catatan**

- Pesan menyebut apa yang salah, berapa selisihnya, dan cara memperbaikinya.

### C3 · Tambah transaksi — transfer

Papan: `Tx-Add-Transfer` · 390 × 844

**Tujuan.** Memindahkan uang antar akun milik sendiri.

**Tata letak dan komponen**

- Segmented control dengan Transfer aktif.
- Nominal yang dipindahkan (Rp500.000).
- Dari: BCA Tabungan (saldo setelah Rp6.342.500). Ke: Jago Pocket (saldo setelah Rp1.775.000). Tombol tukar di antaranya.
- Banner info: kekayaan bersih tidak berubah dan transfer bukan pemasukan atau pengeluaran.
- Tanggal, deskripsi opsional, tombol Cancel dan "Save transfer".

**Keadaan**

- Akun asal dan tujuan tidak boleh sama; nominal tidak boleh melebihi saldo asal.

**Catatan**

- Satu baris transfer mengubah dua saldo sekaligus tetapi tidak mengubah kekayaan bersih.

## D · Akun

### D1 · Accounts (data contoh)

Papan: `Accounts` · 390 × 1400

**Tujuan.** Melihat semua akun dan saldonya sebagai kartu bergaya bank.

**Tata letak dan komponen**

- Judul layar dan kartu ringkasan "Total balance · net worth" Rp8.880.000 untuk 4 akun, dengan catatan bahwa transfer tidak mengubah total.
- Grup Bank, Cash, E-wallet, Savings. Tiap grup memiliki label dan subtotal, lalu satu kartu selebar layar. Bila ada akun Valas, lihat papan `Accounts-Valas` (bagian V).
- Kartu: papan ini masih menampilkan gaya monokrom lama (BCA gelap dengan garis diagonal, Cash dengan garis putus-putus, GoPay abu-abu, Jago putih). Keputusan terbaru menggantikannya: kartu berwarna brand bank dengan logo (BCA biru, GoPay cyan, Jago kuning, Cash grafit dengan rosette), lihat DESIGN.md Account cards. Tata letak dan urutan grup di papan tetap berlaku.
- Tombol "Transfer between accounts" (utama) dan "Add account" (sekunder).
- Catatan bahwa MONO tidak meminta login bank dan akun hanyalah label di perangkat.

**Keadaan**

- Ketuk kartu untuk membuka Detail Akun. Pada mode sembunyi, saldo tampil Rp••••••••.

**Catatan**

- Kartu memakai warna dan logo bank (aturan baru). Tidak ada nomor rekening bertopeng; nomor •••• 4821 di papan hanyalah contoh lama.

### D2 · Detail akun

Papan: `Account-Detail` · 390 × 1100

**Tujuan.** Menjelaskan dari mana saldo sebuah akun berasal.

**Tata letak dan komponen**

- App bar dengan nama akun (BCA Tabungan), jenis, dan saldo saat ini Rp6.842.500.
- Rekonsiliasi: saldo awal (1 Jan 2026) Rp1.200.000, uang masuk +Rp15.000.000, uang keluar −Rp9.357.500, saldo saat ini Rp6.842.500.
- Pintasan Add dan Transfer.
- Aktivitas Oktober, terbaru dulu, dengan filter All / In / Out. Tiap baris menampilkan saldo berjalan seperti mutasi rekening.
- Tautan "View all transactions for this account".

**Keadaan**

- Transfer keluar tampil tanpa tanda dengan label "Transfer out".

**Catatan**

- Saldo = saldo awal + pemasukan − pengeluaran ± transfer; tidak ada saldo yang disimpan.

### D3 · Buat / ubah akun

Papan: `Account-Edit` · 390 × 844

**Tujuan.** Menambah atau mengubah akun.

**Tata letak dan komponen**

- Pilihan tipe berupa ubin: Bank, Cash, E-wallet, Savings, dan Valas (lihat `Valas-Edit` di bagian V).
- Nama akun dan saldo awal (Rp1.200.000) per tanggal 1 Jan 2026 dengan penjelasan bahwa mengubahnya akan menghitung ulang saldo saat ini.
- Pilihan ikon (opsional).
- Catatan: tidak perlu login bank atau nomor kartu.
- Tombol Cancel dan "Create account".

**Keadaan**

- Ubin terpilih memakai bingkai 1,5 px terang.

**Catatan**

- Nomor kartu pada tampilan kartu hanyalah tampilan contoh dan bukan data yang diminta aplikasi.

## F · Anggaran

### F1 · Budgets (data contoh)

Papan: `Budgets` · 390 × 1400

**Tujuan.** Memantau pengeluaran bulan ini terhadap batas.

**Tata letak dan komponen**

- Judul, penyeleksi bulan (Oktober 2026).
- Ringkasan: terpakai Rp4.257.000 dari batas Rp5.000.000 (85,14%), sisa Rp743.000, 3 hari tersisa, tersedia per hari Rp247.667.
- Perbandingan dengan September: Rp3.940.000 (78,80%); Oktober +Rp317.000 (+8,05%).
- Per kategori, yang paling terpakai di atas: Shopping (melebihi Rp112.000, 116,00%), Bills, Transport, Food & drink, Leisure, Health. Bar progres 8 px dan label sisa.
- Catatan: hanya pengeluaran konsumsi yang dihitung, transfer dikecualikan.
- Tombol "Add category budget" dan tautan "Review spending by category".

**Keadaan**

- Baris yang melebihi batas memakai ikon peringatan, teks "Over by", dan bar dengan garis miring pada bagian lebih.

**Catatan**

- Sisa total = batas total − total terpakai, sehingga kategori yang jebol mengurangi sisa.

### F2 · Buat / ubah anggaran

Papan: `Budget-Create` · 390 × 844

**Tujuan.** Menetapkan batas kategori tanpa melewati batas bulanan.

**Tata letak dan komponen**

- Langkah 1: pilih kategori yang belum punya anggaran (Housing, Education, Gifts, Other).
- Langkah 2: batas bulanan untuk kategori (Rp500.000) dan sakelar "Repeat every month".
- Kartu "Allocation check": batas bulanan Rp5.000.000, sudah dialokasikan Rp5.000.000, anggaran ini +Rp500.000, total Rp5.500.000.
- Pesan "Over the monthly limit by Rp500.000." dan tombol "Raise monthly limit to Rp5.500.000".
- Tombol Cancel dan Save budget (nonaktif).

**Keadaan**

- Simpan aktif kembali setelah batas dinaikkan atau anggaran diturunkan.

**Catatan**

- Transfer tidak pernah bisa punya anggaran.

### F3 · Tinjauan pengeluaran per kategori

Papan: `Budget-Category` · 390 × 1200

**Tujuan.** Memahami mengapa sebuah kategori melebihi atau mendekati batas.

**Tata letak dan komponen**

- Judul Shopping · Oktober 2026, terpakai Rp812.000 dari batas Rp700.000 (melebihi Rp112.000, 116,00%).
- Perbandingan September: Rp590.000, perubahan +Rp222.000 (+37,63%).
- Grafik batang empat bulan (Jul, Agu, Sep, Okt) dengan garis putus-putus sebagai batas, plus nilai pasti.
- Daftar 4 pengeluaran dalam kategori (Headphones, Backpack, T-shirt, Phone case).
- Tombol "Edit Shopping budget" dan "Open in Transactions".
- Catatan: menaikkan Shopping Rp112.000 akan melebihi batas bulanan, jadi MONO meminta batas dinaikkan juga.

**Keadaan**

- Keadaan melebihi batas dinyatakan dengan teks dan ikon.

**Catatan**

- Setiap grafik disertai angka pasti.

## G · Lainnya

### M · Menu More

Papan: `More` · 390 × 930

**Tujuan.** Pintu ke fitur sekunder.

**Tata letak dan komponen**

- Judul dan kartu status cadangan: "Disimpan hanya di perangkat ini", cadangan terakhir 21 Okt 2026 20:14 WIB, tautan Back up.
- Grup Money: Financial goals, Fixed expenses ("1 due today"), Reports, Categories.
- Grup Data and app: Backup and restore, Settings.
- Footer lockup MONO dengan "Version 1.0.0 · Works offline · No account, no sync".

**Keadaan**

- Tab More aktif di navigasi bawah.

**Catatan**

- Status cadangan diletakkan di atas supaya risiko kehilangan data selalu terlihat.

### G1 · Target keuangan

Papan: `Goals` · 390 × 1040

**Tujuan.** Melihat progres target yang dihitung dari saldo nyata.

**Tata letak dan komponen**

- Tiga target. Tiap kartu: nama, tanggal target, sumber (akun tertaut), jumlah saat ini dari target, persen selesai, sisa, bar progres, dan "Needed pace" per bulan.
- Total assets: Rp8.880.000 dari Rp30.000.000 (29,60%), sisa Rp21.120.000, Rp2.640.000 per bulan, target 30 Jun 2027.
- Emergency fund: Rp6.842.500 dari Rp15.000.000 (45,62%), terhubung ke BCA Tabungan, Rp582.679 per bulan, target 31 Des 2027.
- Travel fund: Rp0 dari Rp8.000.000 (0,00%), belum tertaut dan tanpa tanggal.
- Tombol Add goal dan catatan bahwa progres tidak pernah diketik.

**Keadaan**

- Target tanpa tautan menampilkan ajakan menautkan akun.

**Catatan**

- Tempo hanya perkiraan dan diberi label demikian.

### G2 · Buat / ubah target

Papan: `Goal-Edit` · 390 × 844

**Tujuan.** Mengatur target dan sumber progres.

**Tata letak dan komponen**

- Nama target (Emergency fund).
- Progres dihitung dari: One account atau Total assets.
- Akun tertaut (BCA Tabungan) dengan saldo Rp6.842.500 dibaca dari catatan.
- Jumlah target Rp15.000.000 dan tanggal target 31 Des 2027 (opsional).
- Pratinjau dari catatan tersimpan: terkumpul Rp6.842.500, sisa Rp8.157.500, 14 bulan tersisa, Rp582.679 per bulan.
- Tombol Cancel dan Save goal; catatan bahwa menghapus target tidak mengubah akun atau transaksi.

**Keadaan**

- Pratinjau berubah saat target atau tanggal diubah.

**Catatan**

- Pratinjau mencegah target yang tidak realistis disimpan tanpa disadari.

### K · Kategori

Papan: `Categories` · 390 × 900

**Tujuan.** Mengelola kategori pemasukan dan pengeluaran.

**Tata letak dan komponen**

- Pengeluaran (10): Food & drink, Transport, Shopping, Bills, Health, Leisure (punya anggaran), Housing, Education, Gifts, Other.
- Pemasukan (4): Salary, Freelance, Interest and dividends, Other income.
- Sistem (tidak bisa diubah): Transfer, bukan pemasukan dan bukan pengeluaran.
- Catatan: mengganti nama memperbarui transaksi lama; kategori yang dipakai dapat diarsipkan, tidak dihapus.

**Keadaan**

- Baris kategori yang punya anggaran menampilkan label "Budget set".

**Catatan**

- Transfer ditampilkan agar pengguna paham mengapa transfer tidak masuk laporan.

## H · Laporan

### H · Reports (data contoh)

Papan: `Reports` · 390 × 2190

**Tujuan.** Analisis periode: arus kas, tren, pengeluaran per kategori, kekayaan bersih.

**Tata letak dan komponen**

- Penyeleksi periode (Month, 3 months, 6 months, Year) dan bulan terpilih.
- Arus kas: pemasukan +Rp7.500.000, pengeluaran −Rp4.257.000, bersih +Rp3.243.000, tingkat tabungan 43,24%.
- Tren enam bulan: grafik batang dan tabel (Rp juta, Mei sampai Okt).
- Pengeluaran per kategori: tabel jumlah dan porsi (Food & drink 33,47%, Bills 27,01%, Shopping 19,07%, Transport 12,68%, Leisure 4,93%, Health 2,82%).
- Kekayaan bersih akhir bulan: tabel nilai dan perubahan, dengan angka pasti hari ini Rp8.880.000.
- Ekspor CSV: transaksi dan saldo akun, tersimpan di perangkat dan tidak diunggah.

**Keadaan**

- Kurang dari satu bulan data menampilkan empty state "Not enough data for a report".

**Catatan**

- Setiap grafik disertai tabel dan label teks sehingga tidak bergantung pada warna.

## I · Cadangan

### I1 · Backup dan restore

Papan: `Backup` · 390 × 1130

**Tujuan.** Menjaga data lokal tetap aman.

**Tata letak dan komponen**

- Banner: data hanya ada di perangkat ini; jika ponsel hilang, data hilang kecuali ada berkas cadangan.
- Cadangan terakhir: 21 Okt 2026 20:14 WIB, mono-backup-2026-10-21.json (IBM Plex Mono), 38 KB, 8 transaksi berubah sejak itu.
- Tombol "Create backup now" yang membuka share sheet.
- Isi cadangan: 4 akun, 71 transaksi, 6 anggaran · 3 target · 14 kategori, 4 pengeluaran tetap, pengaturan. Format schema versi 1, tidak dienkripsi.
- Pemulihan: "Choose backup file" dan tautan contoh berkas tidak valid.
- Cadangan terbaru: tiga berkas terakhir dengan tanggal dan ukuran.

**Keadaan**

- Backup berhasil memunculkan snackbar "Backup saved." dengan nama berkas.

**Catatan**

- Berkas cadangan contoh berisi 63 transaksi sehingga berbeda dari perangkat (71); ini disengaja untuk menunjukkan perbandingan.

### I2 · Restore — konfirmasi penggantian

Papan: `Restore-Confirm` · 390 × 884

**Tujuan.** Memastikan pengguna paham bahwa data akan diganti.

**Tata letak dan komponen**

- Info berkas: mono-backup-2026-10-21.json, dibuat 21 Okt 2026 20:14 WIB, 38 KB, schema v1, dan keterangan berkas lolos pemeriksaan.
- Tabel perbandingan Perangkat ini vs Berkas: akun 4 / 4, transaksi 71 / 63, anggaran · target 6 · 3 / 6 · 3, kategori 14 / 14, pengeluaran tetap 4 / 4.
- Peringatan: pemulihan mengganti semua data; 8 transaksi setelah 21 Okt akan hilang.
- Sakelar "Save a safety backup first".
- Kotak centang wajib "I understand current data will be replaced."
- Tombol Cancel dan "Replace my data" (nonaktif sampai dicentang).

**Keadaan**

- Replace baru aktif setelah kotak dicentang.

**Catatan**

- Tindakan merusak diberi bingkai penekanan 1,5 px, bukan warna merah (merah dipakai untuk uang keluar dan kesalahan).

### I3 · Restore — berkas tidak kompatibel

Papan: `Restore-Invalid` · 390 × 844

**Tujuan.** Menolak berkas dengan jelas tanpa mengubah data.

**Tata letak dan komponen**

- Berkas: mono-backup-future.json, diubah 26 Okt 2026, 41 KB.
- Judul "This file can't be restored" dengan penjelasan: dibuat oleh versi MONO yang lebih baru; data di perangkat tidak berubah.
- Daftar pemeriksaan: bisa dibaca sebagai JSON (lolos), bertanda cadangan MONO (lolos), versi skema 3 tidak didukung (gagal, aplikasi ini membaca versi 1), total dan referensi (dilewati).
- Tombol Back dan "Choose another file".

**Keadaan**

- Tiap butir pemeriksaan memakai ikon dan teks; warna tidak pernah jadi satu-satunya penanda.

**Catatan**

- Berkas yang buruk tidak pernah memulihkan sebagian data.

## J · Pengaturan

### J · Settings

Papan: `Settings` · 390 × 1720

**Tujuan.** Privasi, format, dan data.

**Tata letak dan komponen**

- Privacy: App lock (sidik jari atau PIN), Hide amounts on launch, Block screenshots and app preview.
- Format: Currency (rupiah, tanpa desimal, uang asing ada di akun Valas, ikon gembok), Exchange rates (terakhir diperbarui 28 Okt 2026 09:00, membuka papan Rates), Number format, Month starts on, Time zone (WIB, UTC+7).
- Data: Monthly backup reminder, Fixed expense reminders (sakelar, 09:00, nominal tidak ditampilkan di notifikasi bila Hide amounts aktif), Backup and restore (cadangan terakhir 21 Okt 2026), Categories.
- Assistant: sakelar "Catat lewat chat (AI)" (mati secara default) dan baris "API key Gemini" yang membuka layar setup.
- Erase: "Erase all data on this device" dengan bingkai penekanan.
- About: tanda MONO, MONO Finance, versi 1.0.0 build 1 schema 1, "Works offline" (hanya chat AI opsional dan pembaruan kurs opsional yang memakai internet), lisensi sumber terbuka.

**Keadaan**

- Sakelar nyala = isi terang dengan bulatan gelap; mati = isi gelap dengan garis.

**Catatan**

- Kata "Rp••••••••" pada deskripsi menunjukkan bentuk tampilan saat disembunyikan.

## K · Catat lewat chat (AI, opsional)

### K1 · AI chat — setup dan persetujuan

Papan: `AI-Setup` · 390 × 1000

**Tujuan.** Menjelaskan apa yang dikirim ke AI dan meminta API key Gemini milik pengguna sebelum fitur bisa dipakai.

**Tata letak dan komponen**

- Header dengan tombol kembali ke Pengaturan. Avatar maskot, label "Fitur opsional", judul "Catat lewat chat" (Newsreader 32/36) dan satu paragraf penjelasan.
- Kartu dua bagian. "Dikirim ke Gemini": pesan yang diketik, nama akun dan kategori, tanggal hari ini. "Tidak dikirim": saldo, riwayat transaksi, anggaran, target, berkas cadangan.
- Kolom "API key Gemini" (disamarkan) dengan aksi Tempel dan tautan "Kunci ditolak?". Catatan: dibuat di Google AI Studio, disimpan hanya di ponsel (Android Keystore), tidak ikut cadangan, MONO tidak punya server.
- Peringatan: pesan diproses Google lewat API key pengguna, pemakaian mengikuti kuota atau tagihan key itu, fitur ini perlu internet sementara bagian lain MONO tetap offline.
- Tombol "Simpan dan tes kunci" dan "Nanti saja". Tes hanya mengirim satu pesan singkat tanpa data keuangan.

**Keadaan**

- Fitur mati sampai kunci tersimpan dan lolos tes.
- Kunci ditolak membawa ke keadaan pada papan K3.

**Catatan**

- Ini satu-satunya layar yang menyebut jaringan. Janji "tanpa izin jaringan" di Pengaturan diubah menjadi "hanya chat AI opsional yang memakai internet".

### K2 · AI chat — mencatat lewat chat

Papan: `AI-Chat` · 390 × 1260

**Tujuan.** Mengetik transaksi seperti ngobrol, AI menyiapkan draf, pengguna yang menyimpan.

**Tata letak dan komponen**

- Header 64 px: kembali ke Transactions, "Catat lewat chat" dengan keterangan "Hanya membuat draf", tombol "Catat manual" (membuka form tambah transaksi biasa), dan ikon kunci ke pengaturan AI.
- Gelembung pengguna berisi terang di kanan; gelembung asisten bergaya kartu di kiri dengan avatar maskot.
- Kartu draf bergaris putus-putus (belum tersimpan): tag jenis, judul, nominal, kategori, akun, tanggal, saldo setelah. Tombol Simpan, Ubah, dan tautan Batal.
- Beberapa transaksi dalam satu pesan menjadi satu kartu berkotak centang dengan total, saldo setelah, dan tombol "Simpan 2 transaksi" atau "Ubah satu per satu".
- Bilah bawah: chip saran (misalnya "Beli bensin 40rb"), kolom ketik, tombol kirim yang nonaktif selama kolom kosong, dan catatan "AI bisa salah. Selalu cek draf sebelum menyimpan."

**Keadaan**

- Draf belum tersimpan sampai Simpan ditekan; setelah itu kartu menjadi garis penuh dan muncul snackbar dengan Urungkan.

**Catatan**

- Contoh: "kopi 25rb pake gopay" menjadi −Rp25.000 Food & drink pada GoPay (saldo setelah Rp287.500). "makan siang 48rb cash, parkir 5rb" menjadi dua draf pada Cash wallet (saldo setelah Rp397.000).
- Angka pada draf hanyalah contoh dan tidak mengubah data contoh lain.

### K3 · AI chat — keadaan dan pesan

Papan: `AI-Chat-States` · 1280 × 900

**Tujuan.** Menyeragamkan cara AI bertanya balik, menolak, dan gagal.

**Tata letak dan komponen**

- 1 · Perlu klarifikasi: "bayar 150rb" dijawab dengan chip akun dan kategori. Cukup satu ketukan, AI tidak menebak yang tidak disebut.
- 2 · Tidak bisa diproses: akun "Budi" tidak dikenal (transfer hanya antar akun sendiri, tawarkan catat sebagai pengeluaran) dan draf headphone Rp1.500.000 dari Cash wallet yang hanya Rp450.000 (kurang Rp1.050.000, Simpan nonaktif).
- 3 · Pesan sistem: pengeluaran tersimpan dengan Urungkan, tidak ada internet (tombol Catat manual), kunci Gemini ditolak (tombol Buka pengaturan AI), kuota habis, dan balasan AI tidak terbaca.

**Keadaan**

- Setiap kegagalan menyebut apa yang terjadi, memastikan tidak ada data berubah, dan menawarkan jalan lain.

**Catatan**

- Draf melewati penjaga yang sama dengan form manual: saldo, tanggal, dan transfer ke akun yang sama.
- Tidak ada warna: ikon, teks, dan ketebalan garis.

### K4 · AI chat — ubah draf satu per satu

Papan: `AI-Draft-Edit` · 390 × 900

**Tujuan.** Memeriksa dan memperbaiki draf AI satu demi satu sebelum disimpan.

**Tata letak dan komponen**

- Header: tutup (kembali ke chat), judul "Ubah draf", penghitung "1 dari 2", dan bilah progres dua segmen.
- Kutipan pesan asal ("Dari pesanmu") dalam kartu bergaris putus-putus supaya terlihat apa yang ditafsirkan AI.
- Pilihan jenis (Pemasukan, Pengeluaran, Transfer), kolom jumlah besar dengan chip tambah cepat.
- Kategori dan tanggal diberi label "Ditebak AI" karena disimpulkan, bukan disebut pengguna. Akun menampilkan "Saldo setelah: Rp402.000". Deskripsi terisi "Makan siang".
- Catatan bahwa draf 2 (Parkir Rp5.000) dihitung dari saldo setelah draf ini (Rp402.000 menjadi Rp397.000).
- Bilah bawah: "Buang" untuk membuang draf ini dan "Simpan, lanjut ke draf 2". Pada draf terakhir tombol menjadi "Simpan".

**Keadaan**

- Validasi sama seperti form manual (saldo, tanggal, transfer ke akun yang sama).
- Satu draf yang diubah memakai layar yang sama dengan "1 dari 1".

**Catatan**

- Label "Ditebak AI" mengarahkan perhatian ke kolom yang paling mungkin salah.

## L · Pengeluaran tetap

### L1 · Fixed expenses (daftar)

Papan: `Recurring` · 390 × 1080

**Tujuan.** Mengelola biaya rutin bulanan seperti gym, internet, dan langganan dengan model konfirmasi dulu.

**Tata letak dan komponen**

- Judul "Fixed expenses" dan satu kalimat: biaya yang dibayar terjadwal, tidak ada yang tercatat sebelum dikonfirmasi.
- Kartu ringkasan: "Per month, estimated" Rp1.201.990 (4 pengeluaran tetap, satu berupa perkiraan), jatuh tempo hari ini Rp200.000, berikutnya Internet 5 Nov.
- Needs confirmation: kartu berbingkai 1,5 px untuk Gym membership (Health, BCA Tabungan, tiap tanggal 28, Rp200.000, tag "Due today") dengan tombol "Record now" dan "Skip this month".
- Coming up: Internet 5 Nov Rp385.000, Music subscription 12 Nov Rp54.990, Electricity token 24 Nov "about Rp562.000" dengan label Amount varies.
- Tombol "Add fixed expense" dan catatan pengingat: notifikasi sehari sebelum dan saat jatuh tempo; bulan yang terlewat menunggu di sini, terlama dulu.
- Navigasi bawah dengan More aktif.

**Keadaan**

- Ketuk baris untuk membuka form ubah. "Record now" membuka sheet konfirmasi.

**Catatan**

- Pengeluaran tetap adalah template: tidak mengubah saldo, kekayaan bersih, anggaran, atau laporan sampai dikonfirmasi.

### L2 · Fixed expense — buat / ubah

Papan: `Recurring-Edit` · 390 × 1180

**Tujuan.** Membuat atau mengubah satu pengeluaran tetap.

**Tata letak dan komponen**

- Nama, lalu kartu jumlah (Rp200.000) dengan sakelar "Amount varies each month": bila aktif, jumlah menjadi perkiraan dan nominal sebenarnya diisi saat konfirmasi (cocok untuk listrik).
- Kategori dalam chip (Health terpilih) dan "Pay from" (BCA Tabungan, saldo Rp6.842.500).
- Repeats: tanggal tiap bulan dengan tombol kurang/tambah (28), tanggal jatuh tempo pertama (28 Okt 2026), dan batas akhir (tanpa batas). Tanggal 29–31 jatuh pada hari terakhir bulan yang lebih pendek.
- Sakelar "Remind me": notifikasi 09:00, sehari sebelum dan saat jatuh tempo.
- Tautan "Stop this fixed expense" (transaksi yang sudah tercatat tetap ada), lalu tombol Cancel dan Save.

**Keadaan**

- Sakelar "Amount varies" mati secara default.

**Catatan**

- Penghitung tanggal memakai target sentuh 44 px.

### L3 · Fixed expense — konfirmasi saat jatuh tempo

Papan: `Recurring-Confirm` · 390 × 844

**Tujuan.** Satu ketukan untuk mencatat tagihan yang jatuh tempo, dengan kesempatan menyesuaikan.

**Tata letak dan komponen**

- Bottom sheet di atas layar yang diredupkan: "Record Gym membership?", keterangan "Due today, 28 Oct 2026 · repeats monthly", tombol tutup.
- Jumlah dapat diubah (Rp200.000, "Usual amount. Change it if this month differs.").
- Ringkasan: kategori Health, Pay from BCA Tabungan, tanggal 28 Okt 2026, "BCA Tabungan after" Rp6.642.500.
- Dampak anggaran: "Health budget goes over by Rp20.000" (Rp120.000 + Rp200.000 = Rp320.000 dari Rp300.000), tetap bisa dicatat.
- Tombol Record expense (utama), Skip this month, dan Remind me tomorrow. Catatan: melewati tidak mencatat apa pun, jatuh tempo berikutnya 28 Nov 2026.

**Keadaan**

- Saldo tidak cukup memblokir Record seperti form manual; melebihi anggaran hanya peringatan.

**Catatan**

- Mengonfirmasi membuat satu transaksi pengeluaran biasa dan satu catatan peristiwa dalam satu transaksi SQLite.

## V · Valas (mata uang asing)

Satu akun bernama Valas memegang banyak mata uang. Tiap mata uang adalah satu kantong dengan saldonya sendiri; akun hanya menampilkan total dalam rupiah, diperkirakan dari kurs terbaru dan ditandai ≈. Data contoh papan-papan ini terpisah dari data contoh lainnya: US$250,00 dan S$180,00 pada kurs US$1 = Rp16.250 dan S$1 = Rp12.500 (28 Okt 2026, 09:00), jadi Valas ≈ Rp6.312.500 dan kekayaan bersih dengan Valas ≈ Rp15.192.500.

### V1 · Accounts dengan akun Valas

Papan: `Accounts-Valas` · 390 × 1800

**Tujuan.** Menunjukkan bagaimana akun Valas tampil di daftar akun.

**Tata letak dan komponen**

- Sama seperti D1, tetapi kartu total menampilkan "≈ Rp15.192.500" untuk 5 akun dan catatan bahwa uang asing dinilai dengan kurs terbaru (28 Okt 2026, 09:00) sehingga totalnya perkiraan.
- Grup "Foreign currency" dengan subtotal ≈ Rp6.312.500 dan satu kartu Valas: tag "2 CURRENCIES", dua koin mata uang yang saling menumpuk (US$, S$), nilai ≈ Rp6.312.500, dan jumlah asli di bawahnya (US$250,00 · S$180,00).
- Baris "Exchange rates · updated 28 Oct, 09:00" yang membuka papan Rates.
- Catatan di bawah menyebut bahwa akun Valas menyimpan tiap mata uang di kantongnya sendiri.

**Keadaan**

- Bila kurs sebuah mata uang belum ada, total ditandai tidak lengkap dan Valas menampilkan jumlah aslinya tanpa nilai rupiah.

**Catatan**

- Kartu Valas di papan ini masih bergaya monokrom. Keputusan terbaru: kartu Valas memakai kartu netral grafit dengan bendera bulat (USD, EUR, SGD, JPY, GBP, AUD) yang saling menumpuk dan ikon globe; lihat DESIGN.md bagian Account cards.

### V2 · Detail akun Valas

Papan: `Valas-Detail` · 390 × 1100

**Tujuan.** Melihat setiap kantong mata uang dan aktivitasnya.

**Tata letak dan komponen**

- App bar "Valas" dengan tombol ubah. Label "Multi-currency account · value today" dan angka besar "≈ Rp6.312.500" dengan penjelasan bahwa nilainya perkiraan dari kurs 28 Okt 2026, 09:00.
- Kartu kantong: satu baris per mata uang berisi kode (USD, SGD), nama, kurs yang dipakai (Rp16.250 per US$1), jumlah asli (US$250,00) dan nilai rupiah (≈ Rp4.062.500).
- Tombol putus-putus "Add currency" dan dua tombol: Add (utama) dan Exchange.
- Aktivitas Oktober, terbaru dulu, dengan chip All / USD / SGD. Pengeluaran S$20,00 "Dinner, Singapore" (15 Okt) tampil −S$20,00 berwarna merah dengan nilai ≈ Rp250.000; saldo awal tiap kantong tampil sebagai baris "Opening".
- Tautan "View all transactions for this account", baris "Exchange rates · 28 Oct, 09:00", dan catatan bahwa setiap transaksi menyimpan nilai rupiah pada hari dicatat sehingga anggaran dan laporan tidak berubah saat kurs berubah.

**Keadaan**

- Kantong yang kosong tetap tampil dan bisa diarsipkan; kantong yang masih berisi tidak.

**Catatan**

- Tidak ada satu saldo tunggal untuk Valas. Angka besar selalu total dalam rupiah.

### V3 · Buat akun Valas

Papan: `Valas-Edit` · 390 × 1040

**Tujuan.** Membuat akun Valas dengan satu atau lebih mata uang.

**Tata letak dan komponen**

- Ubin tipe: Bank, Cash, E-wallet, Savings, dan ubin lebar "Valas · foreign currency" yang terpilih (bingkai 1,5 px terang, "Several currencies in one account").
- Nama akun (Valas).
- Daftar "Currencies": tiap mata uang punya kode, nama, tombol hapus dan satu kolom saldo awal (US$ 250,00, S$ 200,00).
- Tombol "Add currency" yang membuka lembar V4.
- Tanggal buka (1 Okt 2026) berlaku untuk semua mata uang yang ditambahkan sekarang; mata uang yang ditambahkan nanti punya tanggalnya sendiri.
- Catatan: akun Valas tidak punya satu saldo, tidak perlu login bank. Tombol Cancel dan "Create account".

**Keadaan**

- Tanpa satu pun mata uang, tombol "Create account" nonaktif.

**Catatan**

- Saldo awal akun Valas selalu 0 di tabel `accounts`; saldo awal sebenarnya ada di `account_currencies`.

### V4 · Lembar tambah mata uang

Papan: `Valas-Add-Currency` · 390 × 844

**Tujuan.** Memilih mata uang yang akan menjadi kantong baru.

**Tata letak dan komponen**

- Lembar bawah di atas layar yang diredupkan: pegangan, judul "Add currency", tombol tutup, kolom cari "Search currency or code".
- Daftar 12 mata uang yang didukung (USD, SGD, EUR, MYR, AUD, GBP, JPY, CNY, HKD, KRW, THB, SAR). Yang sudah ada ditandai "Added" dan diredupkan.
- Catatan bahwa tiap mata uang butuh kurs untuk menampilkan nilai rupiah: MONO mengambilnya setelah ditambahkan, atau pengguna mengetik sendiri di Exchange rates.

**Keadaan**

- Pencarian tanpa hasil menampilkan "Tidak ada mata uang yang cocok".

**Catatan**

- Daftar mata uang berasal dari tabel statis `currencies`.

### V5 · Tambah pengeluaran di kantong Valas

Papan: `Tx-Add-Valas` · 390 × 820

**Tujuan.** Mencatat pengeluaran dalam mata uang asing.

**Tata letak dan komponen**

- Sama seperti C1. Label jumlah "Amount in SGD", angka S$20,00 dan baris "≈ Rp250.000 · Rp12.500 per S$1" yang langsung terhitung.
- Baris akun menampilkan Valas dengan "Balance after: S$160,00", lalu chip kantong USD dan SGD (SGD terpilih) dengan label "Which currency pays".
- Tanggal 15 Okt 2026 dengan Today dan Yesterday, deskripsi "Dinner, Singapore".
- Catatan bahwa transaksi dihitung ke anggaran Food & drink sebesar kira-kira Rp250.000, nilai pada hari dicatat, dan nilainya tetap walau kurs berubah.

**Keadaan**

- Jumlah melebihi saldo kantong: pesan "The SGD pocket has S$245,00. This expense is S$300,00." Kurs belum ada: "Add an exchange rate for SGD first."

**Catatan**

- Hanya kantong milik akun yang dapat dipilih. Pada akun biasa chip kantong tidak muncul.

### V6 · Tukar mata uang

Papan: `Tx-Exchange` · 390 × 1040

**Tujuan.** Menukar uang antar mata uang, misalnya rupiah ke USD.

**Tata letak dan komponen**

- Sama seperti C3 dengan tab Transfer terpilih dan kotak info "Different currencies. Enter both amounts exactly as your bank or exchange gave them."
- Kartu dua bagian: From "BCA Tabungan · IDR" (Balance after Rp5.217.500) dengan "You send Rp1.625.000", tombol tukar arah, lalu To "Valas · USD" (Balance after US$350,00) dengan "You receive US$100,00".
- Kartu ringkasan kurs: Your rate Rp16.250 per US$1, Latest stored rate, dan Difference 0,00%.
- Penjelasan bahwa MONO menyimpan kedua jumlah dan menghitung kurs sendiri; kekayaan bersih hanya berubah sebesar selisih kurs pengguna dengan kurs tersimpan.
- Tanggal, deskripsi opsional ("Buy USD"), tombol Cancel dan "Save exchange".

**Keadaan**

- Akun asal dan tujuan sama dengan mata uang sama ditolak. Dalam satu akun Valas, penukaran hanya boleh antar dua kantong berbeda.

**Catatan**

- Penukaran adalah satu baris transfer dengan `amount` dan `amount_to`.

### V7 · Kurs

Papan: `Rates` · 390 × 860

**Tujuan.** Mengatur dan memperbarui kurs yang dipakai untuk menilai uang asing.

**Tata letak dan komponen**

- Kartu: sakelar "Update automatically" (mati secara default, sehari sekali saat MONO terbuka dan online) dan baris "Update rates now" dengan waktu pembaruan terakhir.
- "Rates in use": satu baris per mata uang yang dipegang, dengan sumber dan waktu (28 Okt, 09:00), kurs Rp16.250,00 per US$1, dan chevron. Ketuk untuk mengetik kurs sendiri; kurs manual bertahan sampai pembaruan berikutnya.
- Kotak "Couldn't update rates." berbingkai merah dengan ikon peringatan: tidak ada internet, MONO tetap memakai kurs 28 Okt, tidak ada yang berubah atau hilang.
- "How rates are used": total akun dan kekayaan bersih menilai kantong dengan kurs di atas (ditandai ≈), sedangkan tiap transaksi menyimpan nilai rupiah pada hari dicatat.
- Catatan privasi (hanya kode mata uang yang dikirim, tidak pernah catatan pengguna) dan atribusi "Rates By Exchange Rate API".

**Keadaan**

- Memperbarui: tombol menampilkan indikator dan dinonaktifkan. Gagal: kotak merah di atas. Batas permintaan (HTTP 429): pesan "Coba lagi nanti" dan tombol nonaktif 20 menit.

**Catatan**

- Layanan: satu permintaan GET `https://open.er-api.com/v6/latest/USD` (semua kurs dalam satu respons), kurs rupiah per X = rates.IDR ÷ rates[X]. Simpan hasilnya sebagai `rate_e4` dengan `source = 'api'`. Respons di-cache minimal satu jam (disarankan sehari). Sudah dicek pada 4 Nov 2026: respons berisi `result: "success"`, IDR, dan ke-12 mata uang yang didukung; diperbarui sekali sehari (`time_next_update_utc`). Cek lagi saat membangun, dan perlakukan `result` selain `success` sebagai gagal.

## N · Impor otomatis (opsional)

Dua sumber opsional mengisi satu antrean tinjauan: notifikasi Android dari aplikasi bank dan e-wallet yang dipilih pengguna (di ponsel, tanpa internet, tanpa login) dan Gmail (login Google di ponsel, izin baca saja, tanpa server). Keduanya mati secara default dan berdiri sendiri. Tidak ada yang tersimpan sebagai transaksi sebelum pengguna menekan Simpan, dan yang disimpan hanya hasil bacanya, bukan isi pesan. Contoh di papan (Kopi Kenangan, Indomaret, nama@gmail.com) terpisah dari data contoh utama.

### N1 · Impor otomatis, belum diatur

Papan: `Import-Setup` · 390 × 1080

**Tujuan.** Menjelaskan fitur dan apa yang dibaca sebelum pengguna memberi izin apa pun.

**Tata letak dan komponen**

- App bar "Impor otomatis" dan satu paragraf pengantar.
- Kartu "Notifikasi Android" (tag "Belum aktif", penjelasan, tombol utama "Aktifkan akses notifikasi" yang membuka panduan izin) dan kartu "Gmail" (tag "Belum terhubung", tombol "Hubungkan Gmail", ditandai sebagai pilihan tambahan).
- Daftar "Yang dibaca MONO" dan "Yang tidak dibaca atau disimpan", lalu catatan bahwa keduanya opsional dan transaksi yang sudah disimpan tetap ada bila diputus.

**Keadaan**

- Pengguna boleh memakai notifikasi saja, Gmail saja, atau keduanya.

**Catatan**

- Tidak ada login yang diwajibkan.

### N2 · Impor otomatis, terhubung dan masalah

Papan: `Import-Settings` · 390 × 1400

**Tujuan.** Mengelola sumber yang aktif dan melihat apa yang bermasalah.

**Tata letak dan komponen**

- Tautan "4 transaksi menunggu tinjauan" ke antrean.
- Bagian Notifikasi Android: status akses, waktu terakhir membaca, dan satu baris per aplikasi (BCA mobile, GoPay, Jago, DANA) dengan saklar dan akun MONO tujuannya. Aplikasi yang belum dipetakan ke akun tetap mati.
- Bagian Gmail: akun Google, waktu sinkron terakhir, izin (hanya baca; token tersimpan di ponsel dan tidak ikut cadangan), tombol Sinkronkan dan Putuskan, catatan bahwa memutus tidak mengubah transaksi yang sudah disimpan.
- Bagian "Kalau ada masalah": akses notifikasi mati (tautan ke panduan), "Perlu hubungkan ulang" (login Google kedaluwarsa atau dicabut), tidak ada internet, dan penghemat baterai yang menghentikan MONO.

**Keadaan**

- Pesan masalah memakai bingkai merah 1,5 px, ikon peringatan, dan kata-kata; bukan warna saja.

**Catatan**

- Hubungkan ulang harus cukup satu ketukan. Notifikasi tetap terbaca walau Gmail bermasalah, dan sebaliknya.

### N3 · Tinjau transaksi hasil impor

Papan: `Import-Review` · 390 × 1200

**Tujuan.** Memeriksa transaksi yang terdeteksi sebelum disimpan.

**Tata letak dan komponen**

- Ringkasan "4 transaksi terdeteksi … Belum ada yang tersimpan", dikelompokkan per hari.
- Tiap kartu: bank, merchant, nominal bertanda (pemasukan hijau dengan +, pengeluaran merah dengan −), waktu, tag akun, kategori yang disarankan atau "Pilih kategori" (putus-putus), dan sumber (Notifikasi, Gmail, atau Notifikasi + Gmail). Tombol Tolak, Ubah, Simpan.
- Kartu yang sama-sama terdeteksi dari dua sumber digabung dan diberi catatan.
- Kartu "Perlu dicek": jenis tidak jelas, pengguna harus memilih Pemasukan atau Pengeluaran dulu.
- Bilah bawah "Simpan 2 yang lengkap" dengan jumlah yang masih perlu dilengkapi.

**Keadaan**

- Simpan nonaktif untuk kartu tanpa kategori atau yang jenisnya belum dipilih.
- Mode "Sembunyikan nominal" menyembunyikan angka di antrean.

**Catatan**

- Yang ditolak tidak muncul lagi. Menyimpan memakai fungsi domain yang sama dengan transaksi manual, jadi semua penjaga (saldo cukup, tanggal masa depan, tanggal sebelum saldo awal) berlaku.

### N4 · Ubah transaksi hasil impor

Papan: `Import-Review-Edit` · 390 × 1000

**Tujuan.** Melengkapi atau memperbaiki satu transaksi yang terdeteksi.

**Tata letak dan komponen**

- Catatan sumber ("Terbaca dari notifikasi GoPay, 5 Nov 2026, 07:12") dan penjelasan tag "Ditebak".
- Form seperti Tambah transaksi: jenis, nominal, kategori (tag "Ditebak"), akun dengan "Saldo setelah", tanggal, deskripsi.
- Saklar "Ingat kategori untuk \"Kopi Kenangan\"" supaya kategori terisi otomatis lain kali.
- Bilah bawah: Tolak dan Simpan.

**Keadaan**

- Saldo tidak cukup dan kesalahan lain memakai pesan yang sama dengan form manual.

**Catatan**

- Isi pesan asli tidak disimpan; hanya field hasil bacanya.

### N5 · Panduan izin akses notifikasi

Papan: `Import-Permission` · 390 × 844 (lembar)

**Tujuan.** Memandu pengguna melewati "setelan terbatas" Android 13+ untuk aplikasi di luar Play Store.

**Tata letak dan komponen**

- Lembar bawah "Aktifkan akses notifikasi" dengan empat langkah: Info aplikasi MONO, titik tiga lalu "Izinkan setelan terbatas", Akses notifikasi, nyalakan MONO.
- Catatan bahwa izin bisa dicabut kapan saja dan hanya aplikasi yang dipilih yang dibaca.
- Tombol "Buka pengaturan Android" dan "Nanti saja".

**Keadaan**

- Saat izin sudah aktif, panduan tidak tampil lagi.

**Catatan**

- MONO mendeteksi izin yang belum aktif dan menampilkan panduan ini dari bagian masalah di N2.

## Keadaan sistem

### S1 · Keadaan kosong

Papan: `States-Empty` · 1280 × 800

**Tujuan.** Memastikan layar tanpa data tetap berguna.

**Tata letak dan komponen**

- Enam panel: Transactions, Accounts, Budgets, Goals, Reports (kurang dari satu bulan data), dan Search/filters tanpa hasil.
- Tiap panel: satu ikon garis, satu kalimat alasan, satu tombol aksi (Add transaction, Add account, Add budget, Add goal, Clear filters).

**Keadaan**

- Tidak ada grafik bernilai nol.

**Catatan**

- Satu ikon, satu kalimat, satu aksi.

### S2 · Validasi dan umpan balik

Papan: `States-Validation` · 1280 × 1100

**Tujuan.** Menyeragamkan cara pesan kesalahan dan konfirmasi ditulis.

**Tata letak dan komponen**

- 1 · Saldo tidak cukup: pengeluaran Rp1.500.000 pada Cash wallet (Rp450.000), kurang Rp1.050.000, tombol "Move cash first".
- 2 · Konfirmasi tersimpan: snackbar dengan angka hasil dan Undo ("Expense saved. BCA Tabungan is now Rp6.717.500.", "Transfer saved … Net worth unchanged.", "Backup saved.").
- 3 · Konfirmasi merusak: "Erase all data?" dengan rincian (4 akun, 71 transaksi, 6 · 3 · 14), ketik ERASE, tautan Back up first.
- 4 · Katalog pesan: tabel Kolom, Aturan, Pesan untuk nominal, kategori, saldo, transfer, anggaran, tanggal.

**Keadaan**

- Undo berlaku sebatas snackbar (4 detik).

**Catatan**

- Pesan yang sama dipakai di mana pun aturan itu berlaku.


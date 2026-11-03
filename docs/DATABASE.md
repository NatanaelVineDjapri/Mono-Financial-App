# MONO Finance — Desain Database (schema v1)

Dokumen ini menjelaskan database lokal MONO Finance. Sumber kebenarannya adalah berkas `mono_schema_v1.sql`. Berkas itu sudah dijalankan di SQLite dan diuji dengan data contoh yang sama dengan semua layar desain. Papan "Database" di canvas desain memuat diagram dan tabel yang sama. Jika dokumen ini dan berkas SQL berbeda, berkas SQL yang menang.

## 1. Prinsip

1. **Tidak ada saldo yang disimpan.** Saldo akun, kekayaan bersih, progres anggaran, progres target, dan semua laporan dihitung dari tabel `accounts` dan `transactions` lewat view. Angka turunan tidak bisa salah sinkron karena tidak pernah ditulis.
2. **Satu kejadian uang, satu baris.** Transfer adalah satu baris dengan `to_account_id`. Karena itu transfer tidak bisa terhitung sebagai pemasukan atau pengeluaran, dan tidak mengubah kekayaan bersih.
3. **Aturan ada di database, bukan hanya di layar.** Bentuk satu baris dijaga CHECK. Aturan yang butuh baris lain (saldo tidak boleh minus, tanggal tidak boleh di masa depan, anggaran tidak melebihi batas bulanan) dijaga trigger yang melempar kode galat bernama.
4. **Riwayat tidak boleh yatim.** Semua foreign key `ON DELETE RESTRICT`, kecuali `recurring_events` yang ikut terhapus bersama transaksinya. Akun, kategori, dan pengeluaran tetap diarsipkan, bukan dihapus.
5. **Uang bilangan bulat.** Rupiah utuh sebagai INTEGER, persen sebagai basis point (10000 = 100%), tanggal sebagai teks ISO 8601. Pembulatan setengah menjauhi nol, dilakukan di SQL.

## 2. Tabel

| Tabel | Isi | Catatan |
|---|---|---|
| `meta` | `schema_version`, `guards_off` | `guards_off` adalah saklar sementara saat restore. Dibuat ulang, tidak ikut cadangan. |
| `settings` | satu baris per pengaturan | `month_start_day`, `timezone`, `ai_enabled`, dan lainnya. Kunci Gemini tidak ada di sini, tersimpan di secure storage. |
| `accounts` | bank, tunai, e-wallet, tabungan | Tanpa kolom saldo. Hanya `opening_balance` dan `opening_date`. Nama unik tanpa membedakan huruf besar kecil. |
| `categories` | label pemasukan dan pengeluaran | `UNIQUE(name, kind)`. Transfer bukan kategori, UI menampilkannya sebagai kategori virtual. |
| `transactions` | income, expense, transfer | `description` (judul di daftar), `note` (detail opsional), `source` (manual, ai, recurring). |
| `monthly_limits` | batas total per bulan | `repeat = 1` berarti bulan berikutnya dibuat dari baris ini. |
| `budgets` | batas per kategori pengeluaran per bulan | `UNIQUE(category_id, month)`. Jumlah semua anggaran tidak boleh melebihi batas bulan itu. |
| `goals` | target per akun atau total aset | Progres diturunkan dari saldo. |
| `recurring` | templat pengeluaran tetap | Tidak mengubah apa pun sampai pengguna mengonfirmasi. |
| `recurring_events` | konfirmasi atau lewati per tanggal jatuh tempo | PK `(recurring_id, due_on)`. Menghapus transaksinya menghapus event, jadi bulan itu jatuh tempo lagi. |
| `backup_log` | riwayat cadangan di perangkat | Tidak ikut berkas cadangan dan tidak disentuh restore. |

### Relasi

- `accounts` 1—N `transactions` lewat `account_id`, dan 1—N lewat `to_account_id` (hanya transfer).
- `categories` 1—N `transactions`, `budgets`, `recurring`.
- `accounts` 1—N `goals` (mode akun) dan 1—N `recurring`.
- `recurring` 1—N `recurring_events`, dan `recurring_events.transaction_id` menunjuk ke satu transaksi.
- `budgets` dan `monthly_limits` terhubung lewat kolom `month` tanpa foreign key. Keterkaitannya dijaga trigger.

## 3. Batasan di tingkat baris (CHECK)

- `amount > 0`, `opening_balance >= 0`, `limit_amount > 0`, `target_amount > 0`.
- Transfer jika dan hanya jika `to_account_id` terisi.
- Transfer jika dan hanya jika `category_id` kosong.
- Akun asal tidak sama dengan akun tujuan.
- Goal mode `account` jika dan hanya jika `account_id` terisi.
- Event `recorded` jika dan hanya jika `transaction_id` terisi.
- Semua kolom tanggal harus tanggal ISO yang valid.

## 4. Penjaga (trigger)

15 trigger, 7 kode galat. Aplikasi memetakan tiap kode ke satu pesan.

| Kode | Memblokir | Pesan yang disarankan |
|---|---|---|
| `future_date` | transaksi bertanggal setelah hari ini | "Tanggal tidak boleh di masa depan." |
| `before_opening_date` | transaksi sebelum tanggal buka akun | "Sebelum akun ada." |
| `category_kind_mismatch` | pengeluaran dengan kategori pemasukan, atau sebaliknya | "Pilih kategori pengeluaran." |
| `insufficient_balance` | perubahan apa pun yang membuat saldo akun di bawah nol, termasuk mengubah atau menghapus baris lama dan mengubah saldo awal | "Kurang Rp1.050.000." |
| `budget_needs_expense_category` | anggaran untuk kategori pemasukan | "Anggaran hanya untuk pengeluaran." |
| `over_monthly_limit` | anggaran yang jumlahnya melebihi batas bulan, atau menurunkan batas di bawah anggaran | "Naikkan batas bulanan dulu." |
| `budgets_exist_for_month` | menghapus batas bulan yang masih punya anggaran | "Hapus anggarannya dulu." |

Semua trigger berhenti bekerja bila `meta.guards_off = '1'`. Itu hanya dipakai saat restore (bagian 7).

## 5. View (data turunan)

| View | Fungsi |
|---|---|
| `v_tx` | Setiap transaksi beserta periodenya. Periode mengikuti `month_start_day`. |
| `v_account_balance` | Saldo akun: saldo awal + pemasukan + transfer masuk − pengeluaran − transfer keluar. |
| `v_net_worth` | Jumlah semua saldo akun. |
| `v_period_flow` | Pemasukan, pengeluaran, selisih, dan total transfer per periode. |
| `v_savings_rate` | Selisih dibagi pemasukan, dalam basis point. Kosong bila pemasukan 0. |
| `v_category_spend` | Pengeluaran per kategori per periode. |
| `v_budget_status` | Terpakai, sisa, `used_bp`, dan `is_over` per anggaran. |
| `v_month_budget` | Batas, teralokasi, terpakai, dan sisa untuk satu bulan. |
| `v_goal_progress` | Jumlah saat ini, sisa, dan `progress_bp` per target. |
| `v_account_activity` | Riwayat akun dengan saldo berjalan. |
| `v_net_worth_by_month` | Kekayaan bersih akhir bulan untuk grafik tren. |
| `v_recurring_due` | Tanggal jatuh tempo yang belum dikonfirmasi. Tanggal 29 sampai 31 jatuh di hari terakhir bulan yang lebih pendek. |
| `v_integrity_issues` | Daftar audit. Harus kosong setelah restore. |

## 6. Hasil uji dengan data contoh

Data contoh sama dengan desain (hari acuan Rabu, 28 Oktober 2026). Semua nilai ini keluar dari SQLite, bukan diketik manual.

| Pemeriksaan | Hasil |
|---|---|
| Saldo BCA, Cash, GoPay, Jago | Rp6.842.500, Rp450.000, Rp312.500, Rp1.275.000 |
| Kekayaan bersih | Rp8.880.000 |
| Oktober: pemasukan, pengeluaran, selisih | Rp7.500.000, Rp4.257.000, +Rp3.243.000 |
| Tingkat tabungan | 4324 bp (43,24%) |
| Pemakaian anggaran (basis point) | Shopping 11600, Bills 9583, Transport 9000, Food 7917, Leisure 5250, Health 4000 |
| Progres target | Total aset 2960 bp, Dana darurat 4562 bp |
| Kekayaan bersih September | Rp5.637.000 |
| Jatuh tempo tanggal 31 (Listrik) | 31 Agustus, 30 September, 31 Oktober |
| 13 kasus uji penjaga | semuanya diblokir seperti seharusnya |
| `month_start_day = 25` | 24 Sep masuk periode Agustus, 25 Sep sampai 24 Okt masuk September, 25 Okt masuk Oktober |
| Konfirmasi pengeluaran tetap | tagihan hilang dari daftar. Menghapus transaksinya memunculkannya lagi |
| Muat massal dengan `guards_off` | audit `v_integrity_issues` menemukan saldo negatif |
| Rentang tanggal | memakai indeks `ix_tx_date` |

## 7. Cadangan dan restore

Berkas JSON memuat sembilan tabel: `accounts`, `categories`, `transactions`, `budgets`, `monthly_limits`, `goals`, `recurring`, `recurring_events`, `settings`. Semua punya jumlah di `counts`. Tidak ikut: `meta` (dibuat ulang), `backup_log` (milik perangkat), dan kunci Gemini (secure storage).

Urutan restore di sisi database:

1. Validasi berkas (penanda aplikasi, versi, jumlah, checksum, referensi di dalam berkas).
2. Buka satu transaksi SQLite. Tulis cadangan pengaman dulu bila sakelarnya aktif.
3. `UPDATE meta SET value = '1' WHERE key = 'guards_off'`. Berkas adalah potret, bukan rangkaian suntingan, jadi penjaga saldo dan tanggal berhenti sementara.
4. Hapus semua baris berurutan menurut ketergantungan, lalu masukkan baris dari berkas. `backup_log` dibiarkan.
5. Kembalikan `guards_off` ke 0, jalankan `PRAGMA foreign_key_check` dan `SELECT * FROM v_integrity_issues`.
6. Ada galat atau ada baris yang kembali: batalkan semuanya. Berkas yang buruk tidak pernah terpulihkan sebagian.

## 8. Migrasi

- Versi ada di `meta.schema_version`. Saat dibuka, aplikasi membacanya dan menjalankan migrasi yang belum ada, berurutan.
- Tiap migrasi satu fungsi dan satu transaksi SQLite. Langkah yang gagal dibatalkan dan aplikasi tetap di versi lama.
- Sebelum migrasi, aplikasi menulis cadangan pengaman. View dan trigger dibuang lalu dibuat ulang tiap kali, karena tidak menyimpan data.
- Berkas cadangan mencatat `schema_version`-nya sendiri. Versi lebih lama dimigrasi di memori sebelum restore. Versi lebih baru ditolak.

## 9. Pilihan yang sengaja diambil (silakan digugat)

- **Penjaga saldo hanya memeriksa saldo saat ini**, tidak memutar ulang tiap hari di masa lalu. Mencatat pengeluaran bertanggal lampau diizinkan selama saldo hari ini tidak minus.
- **`repeat` pada anggaran dan batas bulanan** diwujudkan dengan menyalin baris ke bulan baru saat bulan itu pertama dibuka (`ensure_month` di lapisan domain). Tidak ada tugas terjadwal.
- **Riwayat chat AI tidak disimpan.** Yang tersimpan hanya transaksi yang pengguna simpan, bertanda `source = 'ai'`.
- **Nomor kartu bertopeng** di kartu akun hanyalah hiasan dan tidak ada di skema. Gaya kartu diturunkan dari `accounts.type`.
- **Pengubahan dari desain lama:** kolom `note` tunggal kini `description` dan `note`, karena form Tambah transaksi punya dua kolom itu. Ditambah `source`, `repeat`, tabel `backup_log`, dan `created_at`/`updated_at`.
- **Trigger, bukan CHECK,** untuk "saldo tidak minus" dan "tanggal tidak di masa depan", karena keduanya bergantung pada baris lain atau jam sistem.

## 10. Yang belum dilakukan

- Skema diuji di SQLite biasa (Python `sqlite3`), belum dijalankan di perangkat lewat `expo-sqlite`. Rencana: bundel berkas `.sql` sebagai aset dan jalankan dengan `db.execAsync`, lalu uji ulang SQL yang sama dengan `better-sqlite3` di Jest. Pastikan SQLite di Android lama mendukung window function (3.25 ke atas), karena `v_account_activity` memakainya.
- Rendering papan Database dan Handoff yang diperbarui diperiksa dengan peramban lokal tanpa mengambil font Google, jadi tinggi sebenarnya dengan IBM Plex bisa sedikit berbeda.
- Pesan galat di tabel bagian 4 adalah usulan teks, belum masuk katalog pesan di papan States-Validation.

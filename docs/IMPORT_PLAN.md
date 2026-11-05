# MONO Finance — Rencana impor transaksi otomatis

Dokumen ini HANYA rencana. Tidak ada kode produksi di sini, dan tidak ada komponen atau layar yang ada yang diubah untuk menulis ini. Sesuai CLAUDE.md Build order langkah 11: ditulis dan disetujui pemilik dulu, baru boleh ada kode.

Rujukan yang dipakai: `CLAUDE.reference.md` (aturan 1–14, dari `~/Downloads/docs-import-update`), `docs/DESIGN.md` bagian N dan "Account cards" (folder yang sama — versi ini yang berlaku untuk fitur ini bila beda dari `docs/DESIGN.md` repo), `docs/PAGES.md` N1–N5, `docs/SCREENS.md`, `docs/DATABASE.md` (repo), skema `src/data/db/mono_schema_v1.sql`, dan kode yang sudah ada di `src/domain/transactions.ts`, `src/data/repo/transactions.ts`, `src/data/db/migrations/`, `src/data/backup/export.ts`. Papan `Import-Setup`, `Import-Settings`, `Import-Review`, `Import-Review-Edit`, `Import-Permission` sudah final — rencana ini mengikuti papan itu, tidak menggambar ulang.

Fitur: dua sumber opsional, mati secara default, berdiri sendiri, mengisi satu antrean tinjauan. Satu app, bukan dua build — semuanya satu kode, dinyalakan lewat pengaturan runtime (`import_sources`, bukan varian build). Tidak ada fitur yang mewajibkan login. Tidak diunggah ke Play Store, tidak diverifikasi Google.

---

## 1. Arsitektur

Dua batas native/jaringan yang independen, satu antrean bersama di SQLite, satu set parser.

```
src/features/import/
  parsers/
    types.ts              -- NormalizedMessage, ParsedTx
    index.ts               -- registry: institution key -> parser module
    bca.ts, gopay.ts, jago.ts, dana.ts, ...   -- satu modul per institusi, murni TS
    categoryRules.ts        -- kata kunci -> nama kategori (bukan AI, lihat 3b)
    __tests__/               -- fixture teks asli per institusi
  notifications/
    listener.ts               -- sisi JS: pakai modul lokal Expo (modules/notification-listener/, lihat
                                  di bawah; sudah punya antarmuka TS sendiri lewat create-expo-module),
                                  drain antrean native, normalisasi, lempar ke domain/import.ts
  gmail/
    auth.ts                   -- OAuth 2.0 PKCE (expo-auth-session), token di expo-secure-store
    client.ts                  -- panggilan Gmail API (satu-satunya tempat fetch di folder ini)
    sync.ts                     -- orkestrasi: ambil pesan baru -> normalisasi -> parser -> domain/import.ts
    __tests__/                  -- jaringan di-mock
  dedup.ts                      -- logika kunci dedup lintas sumber (bagian 4), dipakai listener.ts dan sync.ts

src/domain/import.ts     -- aturan bisnis: confirmCandidate, rejectCandidate, kategori dari ingatan,
                              menulis lewat domain/transactions.ts (addIncome/addExpense/addTransfer)
src/data/repo/importCandidates.ts   -- CRUD SQL murni untuk tabel baru (pola sama dengan repo/*.ts lain)

modules/notification-listener/     -- Expo local module (expo-modules-core), bukan folder android/ manual
  expo-module.config.json
  android/
    build.gradle                    -- digenerate oleh `create-expo-module`, tidak diutak-atik tangan
    src/main/java/.../NotificationListenerModule.kt   -- jembatan JS <-> native, daftar otomatis lewat
                                                           autolinking Expo (tidak sentuh MainApplication.kt)
    src/main/java/.../NotificationListener.kt          -- extends NotificationListenerService
plugins/
  withNotificationListener.ts  -- Expo config plugin (withAndroidManifest): satu-satunya bagian yang
                                   HARUS plugin, karena <service> tidak bisa didaftarkan lewat kode —
                                   nambah entri service + izin BIND_NOTIFICATION_LISTENER_SERVICE ke
                                   AndroidManifest.xml, dijalankan saat `expo prebuild`
```

**Soal Gradle.** Project ini tidak punya folder `android/` yang di-commit (dicek: hanya ada `app.json` + plugin Expo biasa) — dibuat ulang tiap `expo prebuild` (continuous native generation). Artinya kode Kotlin tidak bisa ditaruh di path `android/app/src/...` biasa, karena akan hilang tiap prebuild. Dua bagian yang perlu beda jalur:
- **Kode & jembatan JS↔Kotlin** → **Expo local module** (`npx create-expo-module --local notification-listener`), bukan native module RN klasik. Modul lokal Expo sudah punya `android/build.gradle` sendiri dan otomatis ter-autolink lewat Gradle plugin autolinking Expo yang sudah ada di project ini (`expo-modules-core`/`expo-modules-autolinking` sudah jadi dependensi `expo`) — **tidak perlu edit `android/app/build.gradle` atau `MainApplication.kt` manual**.
- **Entri `<service>` di manifest** → tidak bisa lewat Expo Modules API (itu untuk kode, bukan komponen manifest) → tetap butuh **config plugin klasik** (`withAndroidManifest`) khusus untuk suntik `<service>` + izin `BIND_NOTIFICATION_LISTENER_SERVICE`.

Jadi arsitekturnya hibrida: modul lokal Expo untuk Kotlin + jembatannya (Gradle beres sendiri lewat autolinking), plugin config kecil khusus manifest.

**Alur data.** Kedua sumber menghasilkan satu bentuk masukan ternormalisasi:

```ts
interface NormalizedMessage {
  source: 'notification' | 'gmail';
  identifier: string;   // packageName (notifikasi) atau alamat pengirim (gmail)
  receivedAt: string;   // ISO timestamp
  title: string;
  body: string;
}
```

Parser murni TypeScript, satu modul per institusi, fungsi murni tanpa akses DB atau jaringan:

```ts
function parse(msg: NormalizedMessage): ParsedTx | null;

interface ParsedTx {
  institution: string;
  kind: 'income' | 'expense' | null;   // null = ambigu, lihat 3b
  amount: number;          // integer, satuan terkecil mata uang
  currency: string;         // 'IDR' kecuali institusi valas
  occurredAt: string;        // dari isi pesan bila ada, kalau tidak dari receivedAt
  merchant?: string;
  refId?: string;
}
```

`parsers/index.ts` memilih parser lewat `import_sources.institution` (dipetakan dari `packageName`/alamat pengirim saat pemilik mengatur di Import-Settings) — bukan dari isi pesan, jadi parser yang dipanggil selalu benar untuk institusi itu.

**Notifikasi (a).** Modul native Kotlin `NotificationListenerService`:
- Hanya mendengarkan `packageName` yang ADA di `import_sources` (kind='notification', enabled=1). Filter ini di sisi native, sebelum apa pun disentuh JS — notifikasi dari aplikasi yang tidak didukung tidak pernah dibaca atau disimpan, sesuai aturan 14.
- Setiap notifikasi yang lolos filter ditulis ke **antrean native persisten** (lihat bagian 5) dengan kunci `StatusBarNotification.key` (pembaruan notifikasi yang sama menimpa, bukan menduplikasi).
- Expo config plugin (`withNotificationListener.ts`) menambahkan service itu ke `AndroidManifest.xml` dengan `BIND_NOTIFICATION_LISTENER_SERVICE`, dijalankan saat `expo prebuild`.
- Tanpa jaringan sama sekali — sesuai aturan 8, bagian notifikasi tetap di luar tiga tempat yang boleh `fetch`.

**Gmail (b).** `src/features/import/gmail/`:
- `auth.ts`: OAuth 2.0 PKCE di perangkat lewat `expo-auth-session` (alasan pemilihan di bagian 7). Scope `gmail.readonly` saja. Refresh token ke `expo-secure-store`, access token di memori/dicache pendek.
- `client.ts`: `messages.list` dengan kueri dibatasi ke pengirim yang ada di `import_sources` (kind='gmail') dan rentang tanggal (lihat bagian 5), lalu `messages.get` untuk isi pesan yang lolos filter saja.
- Isi email diproses di memori lewat parser, lalu dibuang. Hanya `ParsedTx` yang disimpan — isi pesan asli tidak pernah masuk SQLite atau log.
- `sync.ts` dipanggil saat app dibuka atau pengguna menekan "Sinkronkan sekarang" (bagian 5), tidak pernah otomatis di latar belakang dan tidak pernah memblokir render.

**Kenapa pemisahan repo/domain/features ini:** `src/data/repo/importCandidates.ts` mengikuti pola file lain di `src/data/repo/` (SQL murni, satu file per agregat). `src/domain/import.ts` mengikuti pola `src/domain/transactions.ts` — pre-check ramah, lalu memanggil fungsi domain transaksi yang sama supaya semua penjaga dan `amount_idr` berlaku (bagian 3). `src/features/import/` menampung yang menyentuh dunia luar (modul native, OAuth, fetch) — sejalan dengan `src/features/fx` yang sudah ada untuk kurs.

---

## 2. Perubahan skema (usulan SQL, belum dijalankan)

**Keputusan pemilik: tanpa migrasi.** Belum ada data pengguna asli (masih fase pengembangan), jadi `src/data/db/mono_schema_v1.sql` diubah LANGSUNG di tempat (CHECK `source` menerima `'import'`, 4 tabel baru ditambahkan ke file yang sama) — bukan lewat `migrations[1]`. `meta.schema_version` tetap `'1'`; mekanisme migrasi (`src/data/db/migrations/`) tidak disentuh dan tetap kosong, siap dipakai nanti begitu ada data asli yang harus dijaga lewat upgrade terkelola.

**Langkah menghapus database dev saat skema berubah.** `src/data/db/open.ts` hanya menjalankan `mono_schema_v1.sql` ketika `meta.schema_version` BELUM ada (database baru) — database yang sudah pernah dibuka dengan skema lama tidak otomatis mendapat tabel baru, karena tidak ada langkah migrasi yang memicunya. Jadi:
- **Expo dev client di perangkat/emulator:** hapus data app (Android: Setelan → Aplikasi → MONO → Penyimpanan → Hapus data) atau copot-pasang ulang dev client, supaya `openDb()` melihat database kosong dan menjalankan skema baru dari awal.
- **Jest (`better-sqlite3` lewat `openTestDb.ts`):** tidak perlu langkah apa pun — `openTestDb.ts` membaca `mono_schema_v1.sql` langsung dari disk tiap kali dipanggil dan selalu membuat database baru untuk tiap test, jadi otomatis ikut skema terbaru begitu file berubah.

**`docs/DATABASE.md` diperbarui** (bagian 2/3/4/7 — lihat commit ini) untuk mencantumkan 4 tabel baru dan perubahan CHECK `source`, ditandai jelas sebagai bagian yang direncanakan fitur impor (lihat addendum barunya) supaya dokumen itu tidak menyatakan sesuatu yang belum benar-benar ada di file skema sampai fitur ini diimplementasikan.

**Test skema yang terdampak saat implementasi nanti** (dicatat di sini, belum dikerjakan — "hanya dokumen"):
- `src/data/backup/__tests__/export.test.ts`, `restore.test.ts`, `validate.test.ts` — jumlah tabel cadangan 11 → 14 (lihat tabel keputusan di bawah).
- Test mana pun yang menegaskan nilai `transactions.source` yang valid (CHECK baru menerima `'import'`).
- `src/data/db/migrations/__tests__/migrations.test.ts` — **tidak berubah**, karena keputusan di atas sengaja tidak memakai jalur migrasi untuk perubahan ini.

```sql
-- Antrean kandidat: satu baris per item terdeteksi yang belum diputuskan. Baris dihapus
-- begitu diputuskan (confirmCandidate menulis ke transactions lalu menghapus baris ini;
-- rejectCandidate langsung menghapus). Tidak pernah menyimpan teks pesan asli.
CREATE TABLE import_candidates (
  id               INTEGER PRIMARY KEY,
  source           TEXT    NOT NULL CHECK (source IN ('notification','gmail','notification+gmail')),
  institution      TEXT    NOT NULL,                      -- kunci parser, mis. 'bca'
  kind             TEXT    CHECK (kind IN ('income','expense')),  -- NULL = "Perlu dicek"
  amount           INTEGER NOT NULL CHECK (amount > 0),    -- satuan terkecil `currency`
  currency         TEXT    NOT NULL DEFAULT 'IDR' REFERENCES currencies(code),
  occurred_at      TEXT    NOT NULL,                        -- timestamp ISO lengkap (jam:menit dari pesan)
  merchant         TEXT,
  ref_id           TEXT,                                     -- nomor referensi bank, bila ada di pesan
  dedup_key        TEXT    NOT NULL,                          -- lihat bagian 4
  account_id       INTEGER REFERENCES accounts(id) ON DELETE RESTRICT,   -- dari import_sources; NULL seharusnya tidak terjadi (app tanpa pemetaan tetap mati)
  category_id      INTEGER REFERENCES categories(id) ON DELETE RESTRICT, -- dari ingatan merchant / kata kunci; NULL = "Pilih kategori"
  category_guessed INTEGER NOT NULL DEFAULT 0 CHECK (category_guessed IN (0,1)),
  raw_source_ids   TEXT,    -- JSON array id pesan native/Gmail yang digabung jadi kandidat ini (untuk dedup, bukan isi pesan)
  created_at       TEXT    NOT NULL
);
CREATE INDEX ix_import_candidates_dedup    ON import_candidates (dedup_key);
CREATE INDEX ix_import_candidates_created  ON import_candidates (created_at);

-- Kunci kandidat yang sudah diputuskan (disimpan atau ditolak), supaya kejadian yang sama
-- yang terdeteksi ulang (Gmail menyapu ulang jendela tanggal, dsb.) tidak muncul lagi.
CREATE TABLE import_seen_keys (
  dedup_key  TEXT PRIMARY KEY,
  decision   TEXT NOT NULL CHECK (decision IN ('confirmed','rejected')),
  decided_at TEXT NOT NULL
) WITHOUT ROWID;

-- Aplikasi sumber notifikasi, atau pengirim Gmail, dipetakan ke institusi (parser) dan
-- akun MONO. Mengendalikan allow-list sisi native DAN pemilihan parser. Baris dengan
-- account_id NULL berarti belum dipetakan — tetap mati (N2: "aplikasi yang belum
-- dipetakan ke akun tetap mati").
CREATE TABLE import_sources (
  id                INTEGER PRIMARY KEY,
  kind              TEXT    NOT NULL CHECK (kind IN ('notification','gmail')),
  identifier        TEXT    NOT NULL,     -- packageName, atau alamat/domain pengirim
  institution       TEXT    NOT NULL,     -- kunci parser
  account_id        INTEGER REFERENCES accounts(id) ON DELETE RESTRICT,
  enabled           INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0,1)),
  unparsed_count    INTEGER NOT NULL DEFAULT 0 CHECK (unparsed_count >= 0),  -- pesan lolos filter app/pengirim tapi parser balik null
  last_unparsed_at  TEXT,                                                     -- kapan terakhir, bukan isi pesannya
  UNIQUE (kind, identifier)
);

-- Ingatan merchant -> kategori, diisi HANYA dari pilihan pemilik di layar tinjauan
-- (saklar "Ingat kategori untuk <merchant>"), tidak pernah ditebak atau dari AI.
CREATE TABLE import_merchant_categories (
  merchant    TEXT PRIMARY KEY COLLATE NOCASE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  updated_at  TEXT    NOT NULL
) WITHOUT ROWID;
```

Plus satu perubahan pada tabel yang ada: `transactions.source` butuh nilai baru `'import'`. Karena ini diedit langsung di `mono_schema_v1.sql` (bukan `ALTER TABLE` pada database yang sudah berjalan), ini cuma mengubah satu baris CHECK di definisi `CREATE TABLE transactions` yang ada — tidak perlu trik baku SQLite untuk membangun ulang tabel (itu hanya relevan kalau mengubah CHECK pada database yang SUDAH berisi data dan sudah berjalan, yang tidak berlaku di sini karena keputusan "tanpa migrasi" di atas justru berarti setiap database lama dibuang, bukan diubah di tempat). `src/data/repo/transactions.ts`'s `TxSource` union juga bertambah `'import'`.

**Keputusan masuk cadangan — dikonfirmasi pemilik:**

| Tabel | Masuk cadangan? | Alasan |
|---|---|---|
| `import_sources` | **Ya** | Pemetaan pilihan pemilik (app/pengirim → akun), bukan rahasia, sayang hilang saat pindah perangkat. |
| `import_merchant_categories` | **Ya** | Ingatan yang berguna disimpan, sama semangatnya dengan `recurring`. |
| `import_seen_keys` | **Ya** | Tanpa ini, restore di perangkat baru bisa memunculkan ulang item yang sudah diputuskan sebelumnya saat Gmail menyapu ulang jendela tanggalnya. |
| `import_candidates` | **Tidak** | Antrean yang sedang berjalan, sama seperti `backup_log` — status perangkat saat ini, bukan catatan keuangan. Pemilik bisa menyapu ulang sumbernya untuk mengisi antrean lagi setelah restore. |

**Token TIDAK masuk cadangan** — ini dijamin oleh arsitektur, bukan dengan mengingat-ingat mengecualikan kolom: refresh token Gmail tidak pernah masuk SQLite sama sekali, hanya hidup di `expo-secure-store` (seperti kunci Gemini). Tidak ada kolom token di tabel manapun di atas.

**Status koneksi Gmail: di `settings`, TAPI kuncinya dikecualikan dari cadangan.** Status (akun Google tersambung, waktu sinkron terakhir, dsb.) disimpan sebagai baris-baris `settings` berawalan `import_` (mis. `import_gmail_connected_email`, `import_gmail_last_sync`) — bukan tabel baru, mengikuti pola `ai_enabled` yang sudah ada. Tapi berbeda dari baris `settings` lain: `src/data/backup/export.ts` harus menyaring KELUAR baris berawalan `import_` saat membentuk data cadangan untuk tabel `settings` (satu-satunya tabel di daftar cadangan yang butuh filter sebagian isi, bukan ekspor utuh). Alasan: token tidak ikut cadangan, jadi kalau status "tersambung sebagai x@gmail.com" ikut tapi tokennya tidak, hasil restore akan BERBOHONG — tampak tersambung padahal sinkron pertama pasti gagal. Setelah restore, baris `import_*` di `settings` memang tidak ada, jadi UI otomatis jatuh ke "Belum terhubung" tanpa kode khusus tambahan — konsisten dengan tidak adanya token.

**Dampak ke berkas cadangan (perlu diperbarui saat implementasi):**
- `BACKUP_TABLES` di `src/data/backup/export.ts` bertambah dari 11 ke **14** tabel: `+import_sources`, `+import_merchant_categories`, `+import_seen_keys`.
- `counts` di berkas JSON bertambah 3 kunci baru (satu per tabel di atas), konsisten dengan pola `counts` yang sudah ada.
- Checksum (atas `canonicalDataJson`, lihat `src/data/backup/export.ts`) otomatis ikut berubah bentuk karena mencakup tabel baru — tidak ada logika checksum baru yang ditulis tangan, hanya daftar tabelnya yang bertambah.
- **Urutan restore** harus menghormati FK: `accounts` dan `categories` (sudah lebih dulu di urutan yang ada) harus masuk SEBELUM `import_sources` (rujuk `accounts`) dan `import_merchant_categories` (rujuk `categories`); `import_seen_keys` tidak punya FK jadi urutannya bebas. Urutan hapus-lalu-insert yang ada di `docs/DATABASE.md` bagian 7 tinggal menambahkan tiga tabel ini di posisi yang sesuai ketergantungannya.
- `src/data/backup/__tests__/restore.test.ts` butuh assert baru: ketiga tabel baru round-trip dengan benar, DAN baris `settings` berawalan `import_` tidak ikut terbawa ke berkas cadangan (test negatif, bukan cuma positif).

Penjaga database (13 kode yang ada) tetap berlaku seutuhnya — tidak ada trigger baru yang dibutuhkan untuk tabel di atas sendiri (CHECK level-baris sudah cukup untuk bentuknya); penjaga lintas-baris (saldo, tanggal) tetap dilewati lewat `domain/transactions.ts` saat konfirmasi, lihat bagian 3.

---

## 3. Alur konfirmasi

```
kandidat (import_candidates) --tinjau (Import-Review/-Edit)--> keputusan pemilik
  --Simpan--> domain/import.ts confirmCandidate()
                -> domain/transactions.ts addIncome/addExpense (source: 'import')
                -> (semua penjaga: saldo, tanggal depan, tanggal sebelum buka, jenis kategori)
                -> hapus baris import_candidates, tulis import_seen_keys (confirmed)
                -> bila saklar "Ingat kategori" aktif: upsert import_merchant_categories
  --Tolak--> domain/import.ts rejectCandidate()
                -> hapus baris import_candidates, tulis import_seen_keys (rejected)
```

`confirmCandidate` TIDAK insert langsung ke `transactions` — ia memanggil `addIncome`/`addExpense` yang sudah ada (menerima `source?: TxSource`, lihat `src/domain/transactions.ts:90` dan `:117`), persis fungsi yang dipakai form Tambah transaksi manual. Ini otomatis memberi `amount_idr` yang benar dan seluruh penjaga SQL/domain tanpa kode baru di jalur itu.

### 3b. Kategori dan jenis

**Kategori**, urutan sumber (tidak pernah ditebak di luar ini, tidak ada AI). **Ingatan pemilik SELALU menimpa aturan kata kunci** — urutan ini tidak bisa dibalik:
1. `import_merchant_categories` per nama merchant (case-insensitive) — diisi hanya dari pilihan pemilik sebelumnya (saklar "Ingat kategori"). Dicek pertama, dan kalau ada, kata kunci di langkah 2 tidak pernah dilihat sama sekali untuk merchant itu.
2. Aturan kata kunci bawaan di `categoryRules.ts`, hanya dipakai saat tidak ada ingatan pemilik untuk merchant itu.
3. Kosong ("Pilih kategori", garis putus-putus di N3) bila tidak ada yang cocok di langkah 1 maupun 2.

**Daftar kata kunci bawaan — draf awal, perlu dikonfirmasi/diedit pemilik** (sekitar 15 merchant umum, memakai nama kategori yang sudah terkonfirmasi ada di data contoh: Shopping, Bills, Transport, Food & drink, Leisure, Health — katalog 10 pengeluaran/4 pemasukan yang lengkap belum terdaftar di satu tempat manapun di repo ini, jadi daftar di bawah sengaja hanya memakai yang sudah pasti ada):

| Kata kunci (cocok sebagian, tanpa peduli huruf besar/kecil) | Kategori |
|---|---|
| indomaret, alfamart, alfamidi | Shopping |
| tokopedia, shopee, lazada | Shopping |
| kopi kenangan, starbucks, janji jiwa | Food & drink |
| gofood, grabfood, shopeefood | Food & drink |
| gojek, grab | Transport |
| pln, pdam, indihome, telkomsel | Bills |
| netflix, spotify, cgv, xxi | Leisure |
| guardian, watsons, apotik | Health |

Hasil dari aturan ini ditandai jelas secara terpisah dari ingatan merchant di UI (tag "Ditebak" yang sama dipakai N4 untuk field tebakan — kategori dari kata kunci TETAP berlabel "Ditebak", kategori dari ingatan merchant TIDAK, karena yang kedua adalah pilihan pemilik sendiri, bukan tebakan).

**Jenis (income/expense)**: parser per institusi menentukan dari kata kunci bank itu sendiri (mis. "Pembayaran berhasil" vs "Dana diterima") — bukan aturan umum, karena kata-katanya beda tiap bank. Ambigu → `kind: null`, kartu N3 menandai "Perlu dicek", Simpan nonaktif sampai pemilik memilih Pemasukan/Pengeluaran secara eksplisit di kartu itu (ini gerbang di UI, bukan panggilan domain — tidak ada `DomainError` yang terlibat di titik ini).

**Saran pasangan transfer (tahap lanjut, bukan bagian build awal):** ketika ada dua kandidat BEDA SUMBER AKUN dengan jenis berlawanan, nominal sama, dan waktu berdekatan, usulkan ke pemilik untuk menggabungkannya jadi satu `addTransfer` alih-alih dua baris income/expense terpisah. Selalu usulan yang dikonfirmasi eksplisit, tidak pernah otomatis. Ditandai di sini sebagai usulan tahap lanjut sesuai instruksi; tidak termasuk dalam rencana tahap 1–3 di bagian 7.

---

## 4. Dedup lintas sumber

**Kunci.** Saat `ref_id` ADA (SMS/notifikasi bank sering menyertakan nomor referensi): `institution + ref_id`. Ini nyaris unik dengan sendirinya — tidak butuh jendela waktu sama sekali.

Saat `ref_id` TIDAK ADA: `institution + kind + amount + currency`, dicocokkan terhadap kandidat/`import_seen_keys` lain yang ada DALAM jendela waktu, dicek lewat kueri rentang (`ABS(julianday(a) - julianday(b)) <= DEDUP_WINDOW_MINUTES/1440`), bukan kolom "ember" waktu yang dibulatkan — pembulatan ke ember punya masalah batas (dua waktu di tepi ember berlawanan bisa dekat tapi dihitung beda ember).

**`DEDUP_WINDOW_MINUTES` — satu konstanta bernama** (`src/features/import/dedup.ts`), **mulai dari 10 menit**, dipakai sama persis oleh sisi notifikasi dan Gmail (bukan dua angka terpisah yang bisa melenceng satu sama lain). refId selalu diutamakan di atas — jendela waktu hanya jalan sebagai fallback saat refId tidak ada. Angka 10 menit ini **masih harus divalidasi dengan sampel notifikasi+email asli** dari kejadian yang sama (bagian 7, Tahap 0) sebelum dianggap final; dipilih lebih lebar dari usulan awal (2 menit) karena Gmail kadang menunda beberapa menit dibanding notifikasi instan, dan mengurangi makin lama-makin salah lebih mudah daripada memperlebar setelah banyak institusi terpasang.

**Aturan penting: penggabungan HANYA lintas sumber.** Dua kandidat dari sumber yang SAMA (dua notifikasi, atau dua email) dengan nominal dan waktu mirip tidak digabung oleh kunci ini — kemungkinan besar dua kejadian nyata yang berbeda (lihat kasus tepi di bawah), bukan duplikat satu kejadian. Penggabungan hanya terjadi saat satu kandidat `source: 'notification'` dan satu lagi `source: 'gmail'` punya kunci yang sama; hasilnya satu baris `import_candidates` dengan `source: 'notification+gmail'` dan `raw_source_ids` memuat id pesan dari kedua sisi.

**Kasus tepi**

| Kasus | Penanganan |
|---|---|
| Dua transaksi identik dalam semenit (mis. dua kopi Rp15.000) | Tidak digabung kalau dari sumber yang sama (lihat aturan di atas). Kalau kebetulan satu lewat notifikasi dan satu lewat Gmail dengan kunci sama — risiko nyata, diterima sebagai batasan; tinjauan harus menyadarinya secara manual (lihat usulan tampilan di bawah). |
| Notifikasi muncul dua kali (OS repost) atau diperbarui aplikasi (edit di tempat) | Ditangani di lapisan native, bukan di sini: dikunci dengan `StatusBarNotification.key`; pembaruan menimpa entri antrean native yang sama, repost identik tidak diproses ulang (bagian 5). |
| Notifikasi dan email beda jam (mis. SMS instan, Gmail baru masuk nanti) | Kalau `ref_id` ada: tetap cocok berapa pun jaraknya. Kalau tidak ada `ref_id` dan jaraknya di luar `DEDUP_WINDOW_MINUTES`: TIDAK cocok, jadi dua kandidat terpisah — keterbatasan yang diterima, bukan dipaksa "diperbaiki". |

**Usulan non-wajib:** di Import-Review, kelompokkan secara visual kandidat dengan nominal dan hari yang sama supaya kemungkinan duplikat (kasus baris pertama tabel di atas) gampang dikenali pemilik dan ditolak manual. Bukan bagian wajib tahap 1.

---

## 5. Keandalan

### Notifikasi

- **Layanan dimatikan sistem (optimasi baterai).** Minta pengecualian baterai saat pengaturan awal (N1/N5 sudah menyinggung ini secara umum); N2 sudah punya baris masalah "penghemat baterai yang menghentikan MONO" — diisi dengan memeriksa status lewat `PowerManager.isIgnoringBatteryOptimizations`.
- **Status akses dicabut.** Periksa `NotificationManagerCompat.getEnabledListenerPackages()` saat app dibuka; bila MONO tidak ada di daftar, tampilkan baris masalah N2 dengan tautan ke panduan N5.
- **Notifikasi terpotong atau digabung** (Android menggabungkan banyak notifikasi satu aplikasi jadi satu ringkasan). Ringkasan tidak dipakai untuk parsing (teksnya bukan satu transaksi) — hanya notifikasi individual (anak dari grup) yang diteruskan ke parser; Android tetap mengirim keduanya secara terpisah ke listener.
- **Dihapus pengguna.** Tidak relevan — listener menerima `onNotificationPosted` secara langsung, tidak bergantung notifikasi masih ada di shade.
- **Restart HP.** `NotificationListenerService` otomatis terikat ulang setelah boot selama akses sudah diberikan — perilaku Android baku, tidak perlu kode tambahan.
- **Antrean native persisten sebelum JS siap.** Modul native menulis tiap notifikasi yang lolos filter ke penyimpanan native sendiri (file/SharedPreferences, dikunci dengan key notifikasi untuk anti-duplikat) SEBELUM mencoba mengirim ke JS. JS, begitu siap (app dibuka), memanggil `drainQueue()` sekali untuk menarik semua yang menumpuk, menormalisasi, lempar ke parser, lalu kosongkan antrean native itu.

### Gmail

- **Gagal jaringan / kuota API.** `sync.ts` gagal dengan rapi, status lama dipertahankan, pesan masalah N2 "tidak ada internet" (dicoba lagi saat MONO dibuka — sesuai PAGES.md).
- **Sinkron parsial.** Simpan kursor "pesan terakhir diproses" per sinkron; kursor hanya dipindahkan SETELAH semua kandidat dari batch itu berhasil ditulis, supaya kegagalan di tengah jalan tidak kehilangan progres maupun melewati pesan.
- **Tidak membaca ulang email yang sudah diproses.** Id pesan Gmail stabil; dicek terhadap kursor DAN `import_seen_keys`/dedup kandidat (dua lapis, supaya baik "pernah disentuh" maupun "sudah diputuskan" sama-sama tidak diproses ulang).
- **Kueri dibatasi.** Dibangun dari `import_sources` (kind='gmail', pengirim yang dipetakan) plus kualifier tanggal (`after:`), dibatasi ke sejak tanggal buka akun paling awal atau kursor sinkron terakhir.
- **Sinkron hanya saat app dibuka atau "Sinkronkan sekarang", tidak pernah memblokir UI** — `sync.ts` dipanggil fire-and-forget (query/mutation yang tidak menahan render), sejalan dengan aturan 8.

### 5b. Umur token Gmail

- Refresh token ditulis sekali setelah consent awal ke `expo-secure-store`, dibaca tiap sinkron, **tidak pernah dihapus otomatis** — hanya dihapus saat pemilik menekan Putuskan.
- Access token (pendek, sekitar 1 jam) diperbarui otomatis pakai refresh token sebelum tiap sinkron, transparan bagi pemilik.
- Sinkron-saat-dibuka menjaga token "hangat" / dalam jendela "baru dipakai" Google, mengurangi (bukan meniadakan) risiko kedaluwarsa karena tidak dipakai.
- **Penanganan `invalid_grant`** (mencakup: dicabut manual lewat pengaturan akun Google, 6 bulan tidak dipakai, ganti password, atau tergusur batas jumlah token aktif per klien OAuth): respons 401/`invalid_grant` apa pun dari Gmail API menandai status koneksi Gmail (baris `settings` berawalan `import_gmail_*`, bagian 2) jadi "Perlu hubungkan ulang" di N2, satu ketukan menjalankan ulang alur OAuth yang sama. Transaksi yang sudah tersimpan (`transactions` dengan `source='import'`) dan kandidat yang sudah di antrean sama sekali tidak tersentuh — keduanya lepas dari token.
- **Tidak menjanjikan token abadi ke pemilik.** Teks di N2/Import-Settings menjelaskan pemicu kedaluwarsa di atas, bukan "akan selalu tersambung". Perilaku token Production-tanpa-verifikasi harus dites langsung begitu klien OAuth ada (lihat bagian 7) — bukan asumsi dari dokumentasi Google.

---

## 6. Dampak aturan

- **Aturan 8 (offline-first).** `src/features/import/gmail` jadi tempat ketiga yang boleh `fetch`; bagian notifikasi tetap tanpa jaringan sama sekali. Aturan ESLint pembatas `fetch` (sudah ada untuk `src/features/ai_chat`) perlu daftar glob-nya ditambah folder ini.
- **Manifest dan izin.** `BIND_NOTIFICATION_LISTENER_SERVICE` lewat config plugin (`withNotificationListener.ts`, lihat bagian 1); pastikan `android.blockedPermissions` (strip default Expo) tidak ikut membuang izin ini. Gmail lewat `expo-auth-session` tidak butuh izin Android native tambahan (alur browser OAuth, bukan Account Manager).
- **Teks consent dan penjelasan izin.** Semua string baru (daftar "yang dibaca"/"yang tidak dibaca" di N1, empat langkah N5, pesan masalah N2) masuk `src/i18n/id.ts` saat implementasi — tidak ditulis di rencana ini, hanya dicatat lokasinya.
- **Mode sembunyi nominal di antrean.** PAGES.md N3 eksplisit: mode ini menyembunyikan angka di antrean juga. Artinya nominal di kartu Import-Review harus lewat `<Amount>`/`shown()` yang sama seperti di seluruh app (aturan 12) — tidak ada jalur baru, cuma pastikan dipakai di layar ini juga.
- **Izin dicabut / akun diputus.** Token dihapus seketika (`deleteItemAsync`); baris `import_sources` untuk sumber itu dibiarkan ada tapi tidak aktif (tanpa token, sinkron tidak jalan); transaksi yang sudah diimpor (`source='import'`) sama sekali tidak terpengaruh karena sudah jadi baris `transactions` biasa. **Keputusan pemilik: kandidat tertunda TETAP ADA** (tidak dihapus otomatis saat sumbernya diputus) — ditambah aksi eksplisit **"Kosongkan antrean"** di menu header Import-Review untuk pemilik yang mau membersihkan manual. Aksi ini setara menolak semua kandidat sekaligus: tiap baris `import_candidates` dihapus dan `import_seen_keys` diisi `rejected` untuk masing-masing, supaya item yang sama tidak langsung muncul lagi kalau sumbernya disambung ulang nanti.
- **Parser gagal mem-parsing** (format notifikasi berubah karena update aplikasi, dsb.). **Keputusan pemilik:** tidak gagal senyap. Tiap kegagalan parse pada pesan yang sudah lolos filter app/pengirim menaikkan `import_sources.unparsed_count` dan memperbarui `last_unparsed_at` (kolom baru, bagian 2) — TANPA menyimpan teks pesannya. Bagian masalah Import-Settings (N2) menampilkan baris baru per aplikasi/pengirim yang punya hitungan > 0: "N notifikasi tidak dikenali" + waktu terakhir, sejalan dengan baris masalah lain yang sudah ada di papan itu (bingkai 1,5 px, ikon, kata-kata — bukan warna saja, sesuai N2 "Keadaan").
- **Play Store diabaikan**, tapi Android 13+ "restricted settings" tetap berlaku untuk app di luar Play Store — N5/Import-Permission sudah dirancang persis untuk ini: deteksi lewat `getEnabledListenerPackages()`, tampilkan panduan bila belum aktif.
- **Pengecualian tunggal, disengaja, untuk aturan 14's "tidak pernah menyimpan teks pesan".** Tahap 0 (bagian 7) menulis judul+isi notifikasi mentah ke berkas lokal — ini SATU-SATUNYA tempat di seluruh fitur ini yang menyimpan teks mentah ke disk. Dibatasi ketat: `__DEV__` saja (tidak pernah tercompile ke build rilis), aplikasi sumbernya dipilih manual oleh pemilik (bukan allow-list produksi), dan berkasnya dihapus pemilik sendiri setelah fixture test dibuat. Ini bukan pelanggaran aturan 14 — aturan itu soal perilaku fitur di tangan pengguna akhir; mode rekam sampel adalah alat pengembangan yang tidak pernah ada di luar mesin pemilik sendiri.

---

## 7. Tahap

| Tahap | Lingkup | File disentuh | Risiko | Test |
|---|---|---|---|---|
| **0** | **Mode rekam sampel** (khusus dev build) — mekanisme untuk MENDAPATKAN fixture teks asli, bukan fitur impor itu sendiri. Lihat rincian di bawah. | `modules/notification-listener/` (kode perekam, di balik gerbang `__DEV__`), satu layar/aksi dev sederhana untuk menyalakan/mematikan perekaman dan membagikan berkasnya | Teks mentah tersimpan sementara di disk (lihat bagian 6, pengecualian disengaja) — risikonya dibatasi lewat `__DEV__`, pilihan app manual, dan penghapusan manual pemilik, bukan dihilangkan dengan tidak merekam sama sekali | Tidak ada test otomatis berarti untuk tahap ini (alat pengumpulan data, bukan logika bisnis) |
| **1** | Satu sumber (**notifikasi**, keputusan pemilik — lihat di bawah), satu institusi, ujung ke ujung: tabel baru, `domain/import.ts`, Import-Settings (minimal), Import-Review, Import-Review-Edit | 4 tabel baru langsung di `src/data/db/mono_schema_v1.sql` (bagian 2, tanpa migrasi), `src/data/repo/importCandidates.ts`, `src/domain/import.ts`, parser institusi pertama + fixture (dari Tahap 0), layar N2/N3/N4 minimal, `modules/notification-listener/` (mode produksi, bukan mode rekam) + `plugins/withNotificationListener.ts` + `src/features/import/notifications/` | Sumber tunggal berarti dedup (bagian 4) belum teruji nyata — kunci dibangun tapi jalur "dua sumber sama" belum pernah dilewati sungguhan | Skema baru lewat Jest/better-sqlite3 (otomatis, lihat bagian 2); parser institusi pertama lawan fixture asli dari Tahap 0; `confirmCandidate`/`rejectCandidate` lewat semua penjaga (pinjam pola test `domain/transactions.test.ts` yang ada); test cadangan 14-tabel (bagian 2) |
| **2** | Sumber kedua (**Gmail**) ditambahkan, dedup/gabung lintas sumber benar-benar aktif | `src/features/import/gmail/` lengkap (`auth.ts`, `client.ts`, `sync.ts`), dependensi `expo-auth-session` baru, `dedup.ts` diuji dengan kedua sumber hidup bareng | Kasus tepi bagian 4 (dua kejadian identik, refId hilang) baru kelihatan nyata di sini; token/OAuth (bagian 5b) belum pernah diuji sungguhan sampai di sini | Fixture dua sumber mendeteksi kejadian yang sama → satu kandidat `notification+gmail`; kasus tepi di tabel bagian 4 masing-masing jadi satu test; `DEDUP_WINDOW_MINUTES` divalidasi ulang dengan sampel asli dua sumber (bagian 4) |
| **3+** | Institusi ditambah satu per satu | `parsers/<institusi>.ts` + fixture baru tiap kali (dari Tahap 0 atau salinan manual pemilik untuk email), baris `import_sources` default/`categoryRules.ts` diperluas | Mengklaim dukungan tanpa sampel asli (dilarang aturan 14) | Tiap institusi: test fixture sendiri sebelum diklaim didukung di N2 |

**Urutan sumber — diputuskan: notifikasi dulu (Tahap 1), Gmail di Tahap 2.** Alasan pemilik: tidak butuh setup Google Cloud untuk mulai mencoba.

### Tahap 0 — mode rekam sampel (dev build saja)

Masalah yang diselesaikan: tidak ada tempat berisi contoh teks notifikasi/email asli (bagian 8), dan pemilik tidak perlu menyalin teks notifikasi satu-satu secara manual (untuk email, tetap manual — pemilik menyalin teks ke berkas, jauh lebih mudah daripada notifikasi karena email sudah berupa teks yang bisa disalin langsung dari aplikasi Gmail).

- Modul native (`modules/notification-listener/`, bagian 1) punya DUA mode: mode produksi (filter ketat ke `import_sources` yang dipetakan, hanya hasil parse yang disimpan) dan **mode rekam**, menyala HANYA di balik `if (__DEV__)` — tidak pernah masuk build rilis sama sekali, bukan sekadar dimatikan secara default.
- Mode rekam: pemilik memilih aplikasi (mis. BCA mobile, GoPay) di layar dev sederhana; listener menulis **judul dan isi mentah** tiap notifikasi dari aplikasi itu ke satu berkas lokal (JSON Lines atau teks biasa, satu notifikasi per baris, dengan `packageName` dan waktu).
- Berkas itu bisa dibagikan pemilik (share sheet Android biasa, sama seperti ekspor cadangan) untuk dijadikan fixture test di `parsers/<institusi>/__tests__/`.
- **Pemilik menghapus berkasnya sendiri** setelah fixture dibuat — bukan dihapus otomatis oleh aplikasi, supaya pemilik yang pegang kendali penuh kapan teks mentah itu berhenti ada di perangkat.
- Untuk Gmail: tidak perlu mode rekam terpisah. Pemilik membuka email bank di Gmail, salin teksnya langsung ke berkas (atau ke dalam percakapan ini sebagai fixture), karena isi email sudah berupa teks yang gampang disalin tanpa alat tambahan.

**Setup Google untuk pemilik** (dibutuhkan sebelum Gmail bisa dites, kapan pun tahapnya):
1. Buat project di Google Cloud Console, aktifkan Gmail API.
2. OAuth consent screen, tipe **External** (karena akun Google pribadi, bukan Workspace).
3. Publish status ke **"In production"** TANPA mengajukan verifikasi — layar peringatan "aplikasi belum diverifikasi" akan muncul sekali saat login dan diterima manual, dibatasi 100 pengguna (cukup untuk satu pemilik). Ini WAJIB untuk menghindari refresh token kedaluwarsa tiap 7 hari yang berlaku di status Testing.
4. Buat OAuth client tipe **Android**, perlu nama paket (`com.anonymous.monofinance`, dari `app.json`) dan SHA-1 keystore debug/release.
5. **Perilaku token di Production-tanpa-verifikasi harus dites langsung** setelah klien ini ada — jangan dijadikan asumsi dari dokumentasi Google (lihat 5b).

**Pilihan pustaka OAuth: `expo-auth-session`.** Alasan: modul resmi Expo (sejalan dengan filosofi "jangan nambah dependensi di luar daftar stack tanpa tanya" — tapi ini memang perlu ditambahkan, ditandai eksplisit di tabel tahap 1 di atas), mendukung PKCE bawaan (`AuthRequest` dengan `usePKCE: true`), sudah terintegrasi dengan sistem config plugin Expo yang sudah dipakai project ini, dan punya preset discovery document untuk Google tanpa perlu menulis endpoint OAuth manual. Alternatif seperti `react-native-app-auth` ditolak karena bukan modul Expo-first dan butuh config plugin terpisah untuk hal yang sudah dicakup `expo-auth-session`.

---

## 8. Pertanyaan terbuka untuk pemilik

**Sudah diputuskan pemilik (bukan pertanyaan lagi, dicatat di sini supaya riwayatnya jelas):** urutan sumber (notifikasi dulu, bagian 7); penyimpanan status koneksi Gmail (`settings`, dikecualikan dari cadangan, bagian 2); status parser gagal (hitungan per aplikasi di N2, bagian 2/6); pembersihan kandidat saat sumber diputus (tetap ada + aksi "Kosongkan antrean", bagian 6); `import_candidates` tidak masuk cadangan, tiga tabel lain masuk (bagian 2); jendela dedup jadi satu konstanta `DEDUP_WINDOW_MINUTES`, mulai 10 menit (bagian 4); daftar kata kunci kategori bawaan, draf ~15 merchant (bagian 3b); skema diedit langsung tanpa migrasi (bagian 2); Tahap 0 mode rekam sampel ditambahkan (bagian 7).

**Masih terbuka:**

1. **Validasi `DEDUP_WINDOW_MINUTES = 10`** dengan sampel notifikasi+email asli dari kejadian yang sama (baru benar-benar bisa diuji di Tahap 2, saat dua sumber hidup bareng) — angka awal, bukan final.
2. **Draf daftar kata kunci kategori bawaan** (bagian 3b) — tolong konfirmasi, koreksi, atau tambah merchant yang sering dipakai; 10 kategori pengeluaran + 4 pemasukan yang lengkap juga belum terdaftar di satu tempat manapun di repo ini (hanya 6 nama pengeluaran yang terkonfirmasi lewat test), di luar lingkup rencana ini untuk diputuskan sendiri.

**Daftar institusi yang butuh contoh teks notifikasi dan email asli.** Belum ada satu pun saat rencana ini ditulis — tidak ditebak formatnya. **Tahap 0 (bagian 7) sekarang memberi cara mengumpulkannya** (mode rekam untuk notifikasi, salin manual untuk email), jadi ini bukan lagi pemblokir buntu — langkah berikutnya yang konkret adalah menjalankan Tahap 0 untuk institusi di bawah, bukan menunggu:

- BCA (mobile banking) — disebut eksplisit di N2 sebagai contoh baris aplikasi
- GoPay — disebut eksplisit di N2
- Jago — disebut eksplisit di N2
- DANA — disebut eksplisit di N2
- Institusi lain yang pemilik pakai sehari-hari dan ingin didukung

Tahap 1 (bagian 7) tetap tidak bisa mulai menulis parser sungguhan sampai minimal SATU institusi punya fixture nyata dari Tahap 0.

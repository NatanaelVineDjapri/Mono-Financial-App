# MONO Finance — screens to build

36 things to build: 30 full screens and 6 sheets (screens 25 to 27 are the optional automatic-import screens, described in DESIGN.md section N and PAGES.md N1 to N5; Import-Setup and Import-Settings share screen 25). Routes are a **proposal** (expo-router). The "Board" column is the file name on the design canvas (`project/<Board>.dc.html`), where the layout, copy and states live. Sizes: phone boards are 390 wide.

## Full screens

| # | Screen | Route | Board | Also covers |
|---|---|---|---|---|
| 1 | Welcome (first launch, mascot video) | `/welcome` | Welcome | Shown once; "Punya berkas cadangan? Pulihkan" goes to Backup |
| 2 | Overview (tab) | `/(tabs)/index` | Main | Empty state: Overview-Empty. Account card carousel, fixed-expenses card, greeting "Selamat datang, Nael" |
| 3 | Transactions (tab) | `/(tabs)/transactions` | Transactions | Filters sheet (see sheets). The centre + button of the tab bar opens the add menu (scan, AI chat, manual) |
| 4 | Accounts (tab) | `/(tabs)/accounts` | Accounts | Wallet-style card stack (total as top card, one card open). Variants: Accounts-Open, Accounts-Valas |
| 5 | Budgets (tab) | `/(tabs)/budgets` | Budgets | Monthly limit, per-category bars, over-limit state |
| 6 | More (pushed screen from the avatar on Overview) | `/more` | More | Entry to Goals, Categories, Reports, Backup, Settings, Fixed expenses. Backup card: none, older than 30 days, recent. Opened from the avatar on Overview; no tab bar on More or its child screens |
| 7 | Add / edit transaction | `/tx/add`, `/tx/[id]/edit` | Tx-Add | Variants: Tx-Add-Errors (validation), Tx-Add-Transfer, Tx-Add-Valas (pocket chips, rupiah value line), Tx-Exchange (two amounts, rate summary). One form, three kinds. Validation: domain layer first (validate.ts), DB guards as backstop, DB error codes mapped by `mapDbError`. |
| 8 | Account detail | `/account/[id]` | Account-Detail | Running balance from `v_account_activity`. The pencil opens the account form; Add and Transfer open the transaction form with this account chosen. |
| 9 | Create / edit account | `/account/edit`, `/account/edit?id=` | Account-Edit | Opening balance locked after first transaction. Type "Valas": Valas-Edit (name, one opening balance per currency, "Add currency") |
| 10 | Create / edit budget | `/budget/edit` | Budget-Create | Allocation check against the monthly limit |
| 11 | Category spending review | `/budget/category/[id]` | Budget-Category | |
| 12 | Goals | `/goals` | Goals | Progress is derived, never typed |
| 13 | Create / edit goal | `/goal/edit` | Goal-Edit | |
| 14 | Categories | `/categories` | Categories | Transfer is virtual, not listed |
| 15 | Reports | `/reports` | Reports | Charts with exact-value tables |
| 16 | Backup & restore | `/backup` | Backup | Create backup, share, recent backups |
| 17 | Restore — confirm replace | `/backup/restore-confirm` | Restore-Confirm | Incompatible file: Restore-Invalid |
| 18 | Settings | `/settings` | Settings | Assistant section, reminders, Exchange rates row, About |
| 19 | AI chat — setup & consent | `/ai-setup` | AI-Setup | Gemini key (bring your own), disclosure |
| 20 | AI chat | `/ai-chat` | AI-Chat | States and system messages: AI-Chat-States. Rules and mechanism: AI-Rules. No "Catat manual" button in the header; a failed message offers it. Entry: the gold + button of the tab bar (or `/ai-setup` when no key is saved) |
| 21 | Fixed expenses | `/recurring` | Recurring | |
| 22 | Create / edit fixed expense | `/recurring/edit` | Recurring-Edit | |
| 23 | Valas account detail | `/account/[id]` (type forex) | Valas-Detail | One pocket per currency with rupiah value, Add and Exchange, activity with currency chips |
| 24 | Exchange rates | `/settings/rates` | Rates | Auto-update switch (off by default), update now, rates in use, manual rate, failure state, attribution |
| 25 | Auto import settings | `/settings/import` | Import-Setup, Import-Settings | Not set up: Import-Setup (what is read and not read, "Aktifkan akses notifikasi"). Set up: link "N transaksi menunggu tinjauan" (zero until the queue exists), notification access status and last read time, two groups of apps: **"Didukung penuh"** (apps with a parser of their own; empty until there are real samples) and **"Aplikasi terdeteksi"** (every other app that posted a notification: name, switch, destination account; read by the general parser, always tagged "Ditebak"), and "Kalau ada masalah" (access off, service stopped, battery saver). An app can only be switched on with a rupiah account. Gmail is postponed and not drawn. The permission guide (Import-Permission) is a sheet and is shown only while access is off. Entry: Settings, Asisten, Impor otomatis |
| 26 | Review detected transactions | `/import/review` | Import-Review | **Not built yet** (next stage). Queue with Tolak, Ubah, Simpan; incomplete items and "Perlu dicek" (type unclear: Pemasukan or Pengeluaran must be chosen, Simpan disabled); tag "Ditebak" on every item from the general parser |
| 27 | Edit a detected transaction | `/import/edit/[id]` | Import-Review-Edit | **Not built yet** (next stage). Like Tx-Add, guessed fields tagged "Ditebak", remember-category switch |
| 28 | Transaction detail | `/tx/[id]` | Tx-Detail | Read-only view of one record, reached by tapping a row in Transactions, Account detail, Overview or Budget category. Variants: Tx-Detail-Transfer (from and to with balance after each), Tx-Detail-Valas (currency, rupiah value, rate used). Edit opens Tx-Add pre-filled; Delete opens the Tx-Delete dialog |
| 29 | Scan a receipt (camera) | `/tx/scan` | Receipt-Scan | Viewfinder with corner frame, flash, gallery, shutter, "Isi manual" (replaces this screen with `/tx/add`). Camera permission denied: explanation with "Buka pengaturan" and "Pilih dari galeri". Reading ("Membaca struk…") and failure ("Struk belum terbaca. Coba foto ulang atau isi manual.", also for a foreign-currency receipt) are states of this screen. Entry: the Scan choice of the + menu, and the "Scan struk" button in the header of Add transaction |
| 30 | Scan result (review) | `/tx/scan/review` | Receipt-Review | The draft expense a scan produced: shop, date, total chips (every close candidate, best first, plus "Ketik sendiri"), category, account with "Saldo setelah", a notice for a similar expense, Batal and "Simpan pengeluaran". Saved through the same function as the manual form with `source = 'scan'`. "Rapikan dengan AI" (boards Receipt-Consent and Receipt-Review-AI): a consent dialog every time, then a suggested shop name, category and account from Gemini (the chat's key and rules); never the total or the date |

## Sheets and dialogs

| Sheet | Opens from | Board |
|---|---|---|
| Notification access guide | Import-Setup, Import-Settings (access off) | Import-Permission |
| Transaction filters | Transactions | Tx-Filters |
| Edit AI draft one by one | AI chat | AI-Draft-Edit |
| Confirm a fixed expense when due | Overview card, Fixed expenses | Recurring-Confirm |
| Add currency | Valas-Edit, Valas-Detail | Valas-Add-Currency |

Also: the "Delete this transaction?" dialog (Tx-Delete), the destructive "Erase all data?" dialog (type ERASE), snackbars with Undo, and the message catalogue are on States-Validation and States-Empty.

## Not screens (documentation boards)

DS-Foundations, DS-Components, Flows, Handoff, Database. Their content is in `DESIGN.md` and `DATABASE.md`.

## Entry points worth getting right

- The **gold + button in the middle of the tab bar** opens three round icon buttons on an arc around it, from every tab: **Scan** a receipt, **AI chat** and **Manual** (the form). The Overview has no chat bar (removed on purpose). Scan opens `/tx/scan`; the same screen is reached from the "Scan struk" button in the header of Add transaction (which replaces the form, so saving or closing does not land on an empty form).
- The gold + button in the middle of the tab bar opens the AI chat from every tab (as the AI chat choice of its menu); `/ai-setup` opens instead until a key is saved and tested.
- The chat header has no "Catat manual" button; the form is reached from the + menu, and a failed chat message offers "Catat manual". The form has a "Chat" button back.
- Add transaction is also reached from Account detail and the empty states.
- **Tapping any transaction row** (Transactions, Account detail, Overview recent, Budget category) opens Transaction detail; Edit there opens the form pre-filled, Delete asks first and then shows a snackbar with Undo.

## Build status

- 4.3b Transaction filters sheet: built. Filter state lives in the Transactions zustand store; the same SQL params feed the list and the stats ring. Ring limit mode only when the range is the current full month and no account/category/amount filter is active.
- 4.4 Budgets tab, Budget-Create, Budget-Category: built. Spent and remaining are always derived; allocation check blocks saving when the sum of category allocations exceeds the monthly limit.
- Automatic import from notifications (25, foundation): built. Native listener with the allowlist in Kotlin (`modules/notification-listener/`), table `import_app_settings` (migration v3), detected-apps recorder (name and time only), settings screen, permission guide, Settings screen with the Asisten group, and the dev sample recorder `/dev/import-sampler`. Not built: parsers (general and per institution), the review queue and screens 26 and 27. Gmail is postponed.
- Receipt scan (29, 30): built. On-device OCR (ML Kit, development build only), pure `parse.ts` with tests, draft review, `source = 'scan'` (schema migration v1 to v2). The optional Gemini tidy-up (Receipt-Consent, Receipt-Review-AI) is built too, in `src/features/ai_chat/receiptTidy.ts`. Differences from the boards: on the review the shop, total, category, account and date can all be changed. The picture stays in the cache only while the review is open (for its thumbnail) and is deleted when it closes.
- 4.6 Overview: built. Account carousel uses BankCard (brand art); the Main board still shows the old monochrome cards and is out of date on that point.

# MONO Finance — screens to build

28 things to build: 24 full screens and 4 sheets. Routes are a **proposal** (expo-router). The "Board" column is the file name on the design canvas (`project/<Board>.dc.html`), where the layout, copy and states live. Sizes: phone boards are 390 wide.

## Full screens

| # | Screen | Route | Board | Also covers |
|---|---|---|---|---|
| 1 | Welcome (first launch, mascot video) | `/welcome` | Welcome | Shown once; "Punya berkas cadangan? Pulihkan" goes to Backup |
| 2 | Overview (tab) | `/(tabs)/index` | Main | Empty state: Overview-Empty. Account card carousel, fixed-expenses card, greeting "Selamat datang, Nael" |
| 3 | Transactions (tab) | `/(tabs)/transactions` | Transactions | + FAB opens the AI chat; filters sheet (see sheets) |
| 4 | Accounts (tab) | `/(tabs)/accounts` | Accounts | Wallet-style card stack (total as top card, one card open). Variants: Accounts-Open, Accounts-Valas |
| 5 | Budgets (tab) | `/(tabs)/budgets` | Budgets | Monthly limit, per-category bars, over-limit state |
| 6 | More (tab) | `/(tabs)/more` | More | Entry to Goals, Categories, Reports, Backup, Settings, Fixed expenses |
| 7 | Add / edit transaction | `/tx/add`, `/tx/[id]` | Tx-Add | Variants: Tx-Add-Errors (validation), Tx-Add-Transfer, Tx-Add-Valas (pocket chips, rupiah value line), Tx-Exchange (two amounts, rate summary). One form, three kinds |
| 8 | Account detail | `/account/[id]` | Account-Detail | Running balance from `v_account_activity` |
| 9 | Create / edit account | `/account/edit` | Account-Edit | Opening balance locked after first transaction. Type "Valas": Valas-Edit (name, one opening balance per currency, "Add currency") |
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
| 20 | AI chat | `/ai-chat` | AI-Chat | States and system messages: AI-Chat-States. "Catat manual" opens Tx-Add |
| 21 | Fixed expenses | `/recurring` | Recurring | |
| 22 | Create / edit fixed expense | `/recurring/edit` | Recurring-Edit | |
| 23 | Valas account detail | `/account/[id]` (type forex) | Valas-Detail | One pocket per currency with rupiah value, Add and Exchange, activity with currency chips |
| 24 | Exchange rates | `/settings/rates` | Rates | Auto-update switch (off by default), update now, rates in use, manual rate, failure state, attribution |

## Sheets and dialogs

| Sheet | Opens from | Board |
|---|---|---|
| Transaction filters | Transactions | Tx-Filters |
| Edit AI draft one by one | AI chat | AI-Draft-Edit |
| Confirm a fixed expense when due | Overview card, Fixed expenses | Recurring-Confirm |
| Add currency | Valas-Edit, Valas-Detail | Valas-Add-Currency |

Also: the destructive "Erase all data?" dialog (type ERASE), snackbars with Undo, and the message catalogue are on States-Validation and States-Empty.

## Not screens (documentation boards)

DS-Foundations, DS-Components, Flows, Handoff, Database. Their content is in `DESIGN.md` and `DATABASE.md`.

## Entry points worth getting right

- The **+ FAB on Transactions opens the AI chat**, not the form. The Overview has no chat bar (removed on purpose).
- The chat has "Catat manual" to reach the form. The form has a "Chat" button back.
- Add transaction is also reached from Account detail and the empty states.

## Build status

- 4.3b Transaction filters sheet: built. Filter state lives in the Transactions zustand store; the same SQL params feed the list and the stats ring. Ring limit mode only when the range is the current full month and no account/category/amount filter is active.

# MONO Finance

Premium, strictly monochrome, local-first personal finance app for Android. Rupiah (IDR) only, no accounts, no sync. Built with React Native (Expo), TypeScript, Expo SQLite and Expo Router. The only network use is an optional AI chat with the user's own Gemini key.

The design is finished and lives in a Claude Design canvas (owner's claude.ai account): `https://claude.ai/artifact/2vo4tyC5vNz1HR3uhxEgXX`. Everything needed to build is also in this repo. **Follow the design; if something is unclear or you want to deviate, ask first.**

## Read these first

| File | What it holds |
|---|---|
| `docs/DESIGN.md` | Full spec: tokens, components, every screen, accounting rules, flows, messages, sample dataset (section 10), React Native handoff (section 16) |
| `docs/SCREENS.md` | The 22 screens + 3 sheets, proposed routes, board name per screen |
| `docs/DATABASE.md` | Database design, guards, views, backup and restore |
| `docs/TYPOGRAPHY.md` | Type scale with React Native styles and font loading |
| `db/mono_schema_v1.sql` | **Canonical schema.** Tables, 13 views, 15 triggers, seed. If a doc disagrees with this file, the file wins |
| `db/sample_data.sql` | The sample dataset as inserts (load after the schema) |
| `db/verify_schema.py` | Reference test that proves the schema against the sample numbers. Port it to Jest |
| `docs/screens/` | Optional screenshots of the boards, named after the board |

## Non-negotiable rules

1. **Money is an integer of whole rupiah.** No float anywhere. Percentages are basis points (10000 = 100%), rounded half away from zero. Format with the own `rp()` and `pct()` in `src/core/money.ts` (spec in DESIGN.md section 16), not `Intl`.
2. **No stored balances.** Account balance, net worth, budget progress, goal progress, savings rate and reports are read from the SQL views. Never write a derived number to a table.
3. **A transfer is one row** (`to_account_id` set, no category). It changes two balances and never net worth, income or expense.
4. **Rules live in the database.** CHECKs and triggers raise named codes: `future_date`, `before_opening_date`, `category_kind_mismatch`, `insufficient_balance`, `budget_needs_expense_category`, `over_monthly_limit`, `budgets_exist_for_month`. The domain layer may pre-check for friendly messages, but the schema is the real guard. Message wording is in DESIGN.md section 14.
5. **Strictly monochrome.** Nine colour tokens only (`src/theme/tokens.ts`). No hue, ever. Gain/loss, error/success, over-budget are shown by sign, label, icon and line weight. `#737373` is for disabled and placeholder text only; small captions use `#8A8A8A`.
6. **Type.** IBM Plex Sans for UI and figures (tabular numbers), Newsreader for screen titles and hero balances only, at most one serif moment per screen. IBM Plex Mono never for money. Fonts are bundled, never fetched.
7. **Accessibility.** Touch targets 44 to 48dp. Support text scale to 200%: rows grow, numbers never truncate. Every chart has an accessibility label and an exact-value table beneath. Never use `Alert` for styled dialogs.
8. **Offline-first.** Only `src/features/ai_chat` may call the network (plain `fetch`, 20 s timeout). Enforce with an ESLint rule. No analytics, no crash SDK, no Firebase.
9. **AI only proposes.** Nothing is written until the user taps Simpan. Names map to ids by exact match; unknown or missing names become a clarification, never a guess. Sent to Gemini: typed text, today's date, account names, category names. Never sent: balances, transactions, budgets, goals, backups. The key lives in `expo-secure-store` and is excluded from backups and logs.
10. **Fixed expenses are templates.** They change nothing until the user confirms a due date. Confirming writes one expense and one `recurring_events` row in one exclusive transaction. Due dates are computed (`v_recurring_due`), not stored.
11. **Restore is all-or-nothing.** One exclusive transaction: set `meta.guards_off` to 1, delete, insert, set it back to 0, `PRAGMA foreign_key_check`, read `v_integrity_issues`. Any error or any returned row rolls back. `backup_log` and `meta` are not exported.
12. **Hidden amounts mode** goes through one gate (`shown()`); every currency figure passes it.

## Stack and layout

Expo (development build, not Expo Go only), `expo-router`, `expo-sqlite`, `@tanstack/react-query` (reads, invalidate after writes), `zustand` (UI-only state), `react-native-reanimated`, `react-native-gesture-handler`, `@shopify/react-native-skia`, `victory-native` (two charts), `expo-font` + `@expo-google-fonts/*`, `expo-video`, `expo-sharing`, `expo-document-picker`, `expo-file-system`, `expo-asset`, `expo-crypto`, `expo-local-authentication`, `expo-screen-capture`, `expo-notifications`, `expo-secure-store`. Dev: `jest`, `better-sqlite3`, `eslint`. Styling: `StyleSheet` plus the token file. Pin versions with `expo-doctor`.

```
app/          expo-router routes only, thin
src/theme  core  data (db, repo, backup)  domain  features  components
assets/       brand, mascot
__tests__/    domain and SQL tests
```

Full tree in DESIGN.md section 16. The schema is loaded from a bundled `.sql` asset (add `sql` to Metro `assetExts`) and run with `db.execAsync`. Always `PRAGMA foreign_keys = ON`. Add `.sql` migrations from v2 onwards, each in one transaction, with a safety backup first.

Android manifest: Expo declares INTERNET by default. Keep it for the AI chat only, strip unused permissions with `android.blockedPermissions`, read the merged manifest after prebuild, and check that `expo-notifications` does not require the exact-alarm permission.

## Sample data

Reference "today" in the design is **Wed 28 Oct 2026**. Every figure in the boards is a placeholder produced from one dataset, verified against real SQLite:

- Balances: BCA Tabungan Rp6.842.500, Cash wallet Rp450.000, GoPay Rp312.500, Jago Pocket Rp1.275.000. Net worth Rp8.880.000 (September: Rp5.637.000).
- October: income Rp7.500.000, expenses Rp4.257.000, net +Rp3.243.000, savings rate 43,24% (4324 bp). Monthly limit Rp5.000.000.
- Budgets (limit / spent): Shopping 700k/812k (over by 112k, 116,00%), Bills 1,2jt/1,15jt, Transport 600k/540k, Food & drink 1,8jt/1,425jt, Leisure 400k/210k, Health 300k/120k.
- Goals: Total assets 29,60%, Emergency fund 45,62% (BCA), Travel fund 0.
- Fixed expenses: Gym Rp200.000 (28th, due today), Internet Rp385.000 (5th), Music subscription Rp54.990 (12th), Electricity token about Rp562.000 (24th, varies).

`db/sample_data.sql` holds 11 transactions that reproduce the totals, plus two fixed expenses (Gym, and Electricity on day 31 on purpose, to test the end-of-month clamp; the boards show it on the 24th). The transaction lists in the boards (names, merchants) are illustrative and are not all in the seed. Use the seed for tests and a dev "load sample data" action, never ship it as real data.

## Build order

1. **Foundation:** Expo project, TypeScript, `tokens.ts`, `typography.ts`, `money.ts` with tests, fonts, theme.
2. **Database:** schema asset, `open.ts`, repos, domain functions. Port `db/verify_schema.py` to Jest with `better-sqlite3` and reproduce every number above and all 7 guard codes.
3. **Components:** Button, Chip, Segmented, Field, AmountField, Sheet, Toast, ProgressBar, MonoSwitch, BankCard, ChartTable.
4. **Tabs:** Overview, Transactions, Accounts, Budgets, More.
5. **Entry:** Add/edit transaction (expense, income, transfer, errors), then account, budget and goal create/edit, categories.
6. **Insight:** Account detail, category review, Goals, Reports with charts.
7. **Data safety:** Backup, restore (with guards_off flow), Settings, app lock, hide amounts, screenshot block.
8. **Fixed expenses:** list, edit, confirm sheet, reminders.
9. **AI chat:** setup and consent, chat, draft edit sheet, error states.
10. **Welcome** and polish (empty states, validation catalogue, 200% text scale pass).

Definition of done per screen: matches its board (layout, copy, states), uses only token colours, passes the rules above, has no number computed outside SQL views or `src/domain`.

## Open decisions (ask the owner)

- **UI language.** The boards mix English (most screens) and Indonesian (Welcome, AI chat, fixed-expense confirm). Decide whether to ship one language or both before writing strings; keep all copy in one module so it can change.
- Token names in the DS-Foundations board (`MonoColors.bg2`, `elevated`, `text2`, `muted`) differ from `tokens.ts` (`surface`, `raised`, `textSecond`, `textDisabled`). Use the `tokens.ts` names; the colours are identical.
- The schema was tested in plain SQLite only. Verify on a device that Android's SQLite supports window functions (3.25+), used by `v_account_activity`; otherwise bundle SQLite.
- Error messages for the 7 guard codes in DATABASE.md are proposed wording, not yet in the design's message catalogue.

## Working agreements

- Keep changes small and tested. Run the Jest suite before saying something works.
- Do not add dependencies outside the stack list without asking.
- Do not store anything the views can derive.
- When the design and the schema disagree, tell the owner rather than silently picking one.

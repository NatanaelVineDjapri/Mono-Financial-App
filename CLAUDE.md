# MONO Finance

Premium, monochrome with one amber accent for graphics plus red/green for loss/gain, local-first personal finance app for Android. Rupiah (IDR) is the base currency; one optional **Valas** account holds foreign money in one pocket per currency, valued in rupiah. No accounts, no sync. Built with React Native (Expo), TypeScript, Expo SQLite and Expo Router. Network use is limited to two optional features: the AI chat with the user's own Gemini key, and a refresh of exchange rates.

The design is finished and lives in a Claude Design canvas (owner's claude.ai account): `https://claude.ai/artifact/2vo4tyC5vNz1HR3uhxEgXX`. Everything needed to build is also in this repo. **Follow the design; if something is unclear or you want to deviate, ask first.**

## Read these first

| File | What it holds |
|---|---|
| `docs/DESIGN.md` | Full spec: tokens, components, every screen, accounting rules, flows, messages, sample dataset (section 10), React Native handoff (section 16) |
| `docs/SCREENS.md` | The 24 screens + 4 sheets, proposed routes, board name per screen |
| `docs/DATABASE.md` | Database design, guards, views, backup and restore |
| `docs/TYPOGRAPHY.md` | Type scale with React Native styles and font loading |
| `docs/PAGES.md` | Per board (Indonesian): purpose, layout and components, states, notes. Board names match SCREENS.md |
| `src/data/db/mono_schema_v1.sql` | **Canonical schema.** 14 tables, 17 views, 23 triggers, seed (13 currencies). If a doc disagrees with this file, the file wins |
| `tools/sample_data.sql` | The sample dataset as inserts (load after the schema) |
| `tools/verify_schema.py` | Reference test that proves the schema against the sample numbers. Port it to Jest |
| `docs/screens/` | Screenshots of the boards, named after the board (Main.png, Tx-Add.png). Added by the owner phase by phase |

You cannot open the design canvas. For the visuals of a screen, look in docs/screens/<Board>.png first, then docs/PAGES.md and docs/DESIGN.md section 11. If a layout detail is unclear or no screenshot exists for the screen you are building, ask the owner for the screenshot instead of guessing.

## Non-negotiable rules

1. **Money is an integer in the minor unit of its currency.** Whole rupiah for IDR, cents for USD or SGD, `currencies.minor_factor` says which. No float anywhere. Percentages are basis points (10000 = 100%), rounded half away from zero. Format with the own `rp()`, `money()` and `pct()` in `src/core/money.ts` (spec in DESIGN.md section 16), not `Intl`. Exchange rates are integers too: `rate_e4` is rupiah per 1 major unit times 10.000 (USD at Rp16.250 is `162500000`).
2. **No stored balances.** Account balance, net worth, budget progress, goal progress, savings rate and reports are read from the SQL views. Never write a derived number to a table.
3. **A transfer is one row** (`to_account_id` set, no category). It changes two balances and never net worth, income or expense. A transfer between two different currencies is an **exchange**: the same row stores `amount` (source currency) and `amount_to` (destination), and a transfer inside one Valas account is allowed only between two different pockets.
4. **Rules live in the database.** CHECKs and triggers raise named codes: `future_date`, `before_opening_date`, `category_kind_mismatch`, `insufficient_balance`, `budget_needs_expense_category`, `over_monthly_limit`, `budgets_exist_for_month`, `currency_not_in_account`, `missing_fx_rate`, `pocket_needs_forex_account`, `pocket_not_empty`, `account_type_locked`, `recurring_needs_idr_account`. The domain layer may pre-check for friendly messages, but the schema is the real guard. Message wording is in DESIGN.md section 14.
5. **Monochrome plus three colours with strict jobs.** Twelve colour tokens in `src/theme/tokens.ts`. `accent: '#E3C27A'` (amber) is ONLY for graphics: main chart series, progress-bar fills, selected bar; never text, icons, buttons or status. `positive: '#4ADE80'` (green) and `negative: '#FF6B6B'` (red) mark gain and loss: plus/minus amounts, over-budget, errors. Colour only reinforces a sign, icon or word and is never the only signal. Colour follows meaning, the sign follows arithmetic (spending up is `+Rp…` in red). Transfers are never coloured. Over-budget bars keep a striped (red) overflow segment plus icon and "Over by" text. No other hue, ever — except a `BankCard`'s own surface: each card's background and logo use that bank's real brand colour (`src/components/BankCard/bankCards.ts`, `idn-finlogos` for the logo mark), the one deliberate exception, scoped to the card surface itself (DESIGN.md section 11 "Account cards" is superseded for this one component — see the note there). The nominal shown on a card still never turns green or red; it stays the card's own `fg`. `#737373` is for disabled and placeholder text only; small captions use `#8A8A8A`.
6. **Type.** IBM Plex Sans for UI and figures (tabular numbers), Newsreader for screen titles and hero balances. At most one serif moment per screen, except Accounts and Overview, which may pair a serif title with a serif hero number (per the design board). IBM Plex Mono never for money. Fonts are bundled, never fetched.
7. **Accessibility.** Touch targets 44 to 48dp. Support text scale to 200%: rows grow, numbers never truncate. Every chart has an accessibility label and an exact-value table beneath. Never use `Alert` for styled dialogs.
8. **Offline-first.** Only two places may call the network, each with plain `fetch` and a 20 s timeout: `src/features/ai_chat` and `src/features/fx` (exchange-rate refresh). Enforce with an ESLint rule. The rate refresh runs only when the user taps "Update rates now" or has switched on "Update automatically" (off by default), sends no user data (one GET with no body), and never blocks the app: on failure keep the stored rates. No analytics, no crash SDK, no Firebase.
9. **AI only proposes.** Nothing is written until the user taps Simpan. Names map to ids by exact match; unknown or missing names become a clarification, never a guess. Sent to Gemini: typed text, today's date, account names, category names. Never sent: balances, transactions, budgets, goals, backups. The key lives in `expo-secure-store` and is excluded from backups and logs.
10. **Fixed expenses are templates.** They change nothing until the user confirms a due date. Confirming writes one expense and one `recurring_events` row in one exclusive transaction. Due dates are computed (`v_recurring_due`), not stored.
11. **Restore is all-or-nothing.** One exclusive transaction: set `meta.guards_off` to 1, delete, insert, set it back to 0, `PRAGMA foreign_key_check`, read `v_integrity_issues`. Any error or any returned row rolls back. `backup_log` and `meta` are not exported.
12. **Hidden amounts mode** goes through one gate (`shown()`); every currency figure passes it.
13. **Valas and rupiah values.** Only a `forex` account has pockets (`account_currencies`); every other account is implicitly IDR. Every transaction stores `amount_idr`, the rupiah value on the day it was recorded, and budgets, reports, income and expense use only that. Account totals and net worth value each pocket at the latest rate (`v_latest_fx`) and show `≈`; when a pocket has no rate, net worth is flagged `incomplete` and the UI says so. Fixed expenses can only use IDR accounts.

## Stack and layout

Expo (development build, not Expo Go only), `expo-router`, `expo-sqlite`, `@tanstack/react-query` (reads, invalidate after writes), `zustand` (UI-only state), `react-native-reanimated`, `react-native-gesture-handler`, `@shopify/react-native-skia`, `victory-native` (two charts), `idn-finlogos` + `react-native-svg` (real Indonesian bank/e-wallet logos on `BankCard`, see `assets/bank-cards/` and `src/components/BankCard/`), `expo-font` + `@expo-google-fonts/*`, `expo-video`, `expo-sharing`, `expo-document-picker`, `expo-file-system`, `expo-asset`, `expo-crypto`, `expo-local-authentication`, `expo-screen-capture`, `expo-notifications`, `expo-secure-store`. Dev: `jest`, `better-sqlite3`, `eslint`. Styling: `StyleSheet` plus the token file. Pin versions with `expo-doctor`.

```
src/app/      expo-router routes only, thin
src/theme  core  data (db, repo, backup)  domain  features  components  i18n
assets/       brand, mascot
```

Tests are co-located in a `__tests__/` folder next to the code they cover (e.g. `src/domain/__tests__/transactions.test.ts`), not one root folder.

Component tests (`@testing-library/react-native` v14): `render()` is async — always `await render(...)`. The `components` Jest project sets `resolver: react-native-reanimated/jest/resolver` (required for Reanimated v4); don't add per-test Reanimated mocks on top of it. A component whose accessibility role isn't individually queryable by RTL (e.g. a `radiogroup` container) should accept a `testID` prop so tests can reach it directly instead of reaching into style internals another way. Queries exclude elements hidden from accessibility by default (e.g. a decorative `Icon`, `accessibilityElementsHidden`) — pass `{ includeHiddenElements: true }` to reach them. This RTL version has no `UNSAFE_getByProps`/`UNSAFE_getByType`; match by `testID` instead. `fireEvent` (and `fireEvent.press`/`.changeText`/etc.) is itself async — `await` it whenever the handler causes a re-render you then assert on (e.g. focus/blur toggling local state); a fired-and-forgotten call can leave the assertion reading the pre-update tree. `accessibilityViewIsModal` on an element also hides its *siblings* from role/testID queries by default (real iOS modal semantics — RTL models it) — reach a sibling with `{ includeHiddenElements: true }` too. A component reading safe-area insets needs its test wrapped in `<SafeAreaProvider initialMetrics={{ insets, frame }}>` or `useSafeAreaInsets` throws. A bare `View` with just `accessibilityRole` set is not matched by `getByRole` unless `accessible` is also set explicitly — real native auto-derives it, this test renderer doesn't; `Pressable` already defaults it, so this only bites plain `View`s given a role. `act()` from this library is async too — `await` it when calling a store setter (e.g. a Zustand action) directly in a test, or the render that follows can still see the old state.

`@shopify/react-native-skia` ships ESM-only at its main entry; the `components` Jest project's `transformIgnorePatterns` was extended (keeping jest-expo's own list, just adding this package) and `setupFiles` points at its official `jestSetup.js`, which mocks `Canvas`/drawing primitives to plain host components — no `canvaskit-wasm` or custom test environment needed. A Skia `<Canvas>` has no usable `onLayout`/measurement in tests (real device measurement, unsupported on the new architecture per the library's own warning) — draw against a fixed generous virtual coordinate space and let the canvas's own bounds clip it, rather than sizing the drawing from a measured width.

`idn-finlogos/react-native` also ships ESM-only (`dist/react-native/index.mjs`); extending `transformIgnorePatterns` alone isn't enough because the package's `"exports"` map resolves the `"react-native"` condition straight to the `.mjs` file before a transform ever runs, so the `components` project also `moduleNameMapper`s that bare specifier to the package's own `dist/react-native/index.js` (the plain-CJS build it ships alongside the ESM one).

Metro's asset pipeline treats a `@2x`/`@3x` suffix as a **density marker**, not part of the filename: `require('./foo.png')` is correct even when only `foo@3x.png` exists on disk (Metro discovers the density sibling itself); `require('./foo@3x.png')` literally fails to resolve. A build script generating asset `require()` calls (like `tools/gen-card-assets.ts`) must emit the undecorated name. Jest's resolver has no such density-aware scanning, though, so a generated bare-name `require('assets/bank-cards/png/<slug>.png')` needs its own `moduleNameMapper` entry pointing at the real `@3x` file on disk — this only surfaced when Metro actually bundled the route (`npx expo export --platform web`), not in Jest, which mocks image requires rather than resolving them for real; a component that newly `require()`s an asset is worth a real export pass, not just a green test suite.

Full tree in DESIGN.md section 16. The schema is loaded from a bundled `.sql` asset (add `sql` to Metro `assetExts`) and run with `db.execAsync`. Always `PRAGMA foreign_keys = ON`. Add `.sql` migrations from v2 onwards, each in one transaction, with a safety backup first.

Android manifest: Expo declares INTERNET by default. Keep it for the AI chat and the rate refresh only, strip unused permissions with `android.blockedPermissions`, read the merged manifest after prebuild, and check that `expo-notifications` does not require the exact-alarm permission.

## Sample data

Reference "today" in the design is **Wed 28 Oct 2026**. Every figure in the boards is a placeholder produced from one dataset, verified against real SQLite:

- Balances: BCA Tabungan Rp6.842.500, Cash wallet Rp450.000, GoPay Rp312.500, Jago Pocket Rp1.275.000. Net worth Rp8.880.000 (September: Rp5.637.000).
- October: income Rp7.500.000, expenses Rp4.257.000, net +Rp3.243.000, savings rate 43,24% (4324 bp). Monthly limit Rp5.000.000.
- Budgets (limit / spent): Shopping 700k/812k (over by 112k, 116,00%), Bills 1,2jt/1,15jt, Transport 600k/540k, Food & drink 1,8jt/1,425jt, Leisure 400k/210k, Health 300k/120k.
- Goals: Total assets 29,60%, Emergency fund 45,62% (BCA), Travel fund 0.
- Fixed expenses: Gym Rp200.000 (28th, due today), Internet Rp385.000 (5th), Music subscription Rp54.990 (12th), Electricity token about Rp562.000 (24th, varies).

The Valas boards use a **separate** sample: Valas holds US$250,00 and S$180,00 (after a S$20 dinner on 15 Oct) at the rates of 28 Oct 2026 09:00, US$1 = Rp16.250 and S$1 = Rp12.500, so Valas is about Rp6.312.500 and net worth with Valas about Rp15.192.500. `tools/verify_schema.py` and `src/data/db/__tests__/schema.test.ts` build it as a fixture on top of the IDR dataset; the IDR numbers above never change.

`tools/sample_data.sql` holds 11 transactions that reproduce the totals, plus two fixed expenses (Gym, and Electricity on day 31 on purpose, to test the end-of-month clamp; the boards show it on the 24th). The transaction lists in the boards (names, merchants) are illustrative and are not all in the seed. Use the seed for tests and a dev "load sample data" action, never ship it as real data.

## Build order

1. **Foundation:** Expo project, TypeScript, `tokens.ts`, `typography.ts`, `money.ts` with tests, fonts, theme.
2. **Database:** schema asset, `open.ts`, repos, domain functions. Port `tools/verify_schema.py` to Jest with `better-sqlite3` and reproduce every number above, the Valas section, and all 13 guard codes. **Done.** `src/data/db/open.ts` (expo-sqlite) and `openTestDb.ts` (better-sqlite3, Jest) share one `Db` interface; `src/data/repo/*` is one file per aggregate plus `netWorth.ts`/`reports.ts` for the cross-account views; `src/domain/*` (accounts, transactions, balances, net-worth, budget, goals, recurring, reports, errors, fx) has every business rule, with friendly pre-checks in front of the SQL guards (`src/domain/errors.ts` + `src/i18n/id.ts` map the 13 codes); `src/data/backup/*` (export, validate, restore) implements the guards-off restore sequence. `src/domain/__tests__/sample-data.test.ts` reproduces every sample number — IDR and Valas — through these functions alone. Not done: no screen calls any of this yet (no UI this phase).
3. **Components:** Button, Chip, Segmented, Field, AmountField, Sheet, Toast, ProgressBar, MonoSwitch, BankCard, ChartTable. **Done.** `Icon` (24 grid, 10 names used so far) came first since `Chip`, `Field` and `ProgressBar` all need it. `Button`/`IconButton`/`Fab`/`Chip`/`Segmented` are plain `Pressable` + tokens; `Field`/`AmountField` share one focus-ring/error/disabled chrome (`AmountField` reuses `Field` via an `inputStyle` escape hatch); `Sheet`/`Toast` are the first Reanimated consumers in `src/components` (declarative `entering`/`exiting`, not manual shared values); `MonoSwitch` animates its own track/thumb with `useAnimatedStyle`; `ProgressBar`'s over-limit stripe is the first `@shopify/react-native-skia` usage; `ChartTable` is the exact-value table CLAUDE.md rule 7 requires under every chart. `BankCard` is the one deliberate break from rule 5's monochrome-except-sign-colours rule — see that rule's current wording and DESIGN.md section 11's note for why; its assets came from a design hand-off (`assets/bank-cards/`, generated into `src/components/BankCard/cardAssets.ts` by `tools/gen-card-assets.ts`, never hand-edited) with idn-finlogos supplying the real bank/e-wallet marks. A dev-only gallery (`src/app/dev/gallery.tsx`, redirects away unless `__DEV__`) renders every component in every state side by side for screenshot comparison against the DS boards. Not done: no real screen calls any of this yet (still no UI phase); `src/app/_layout.tsx`/`app-tabs.tsx` are still the unmodified Expo starter scaffold, not DESIGN.md section 9's five tabs.
4. **Tabs:** Overview, Transactions, Accounts, Budgets, More.
5. **Entry:** Add/edit transaction (expense, income, transfer, errors), then account, budget and goal create/edit, categories.
6. **Insight:** Account detail, category review, Goals, Reports with charts.
7. **Data safety:** Backup, restore (with guards_off flow), Settings, app lock, hide amounts, screenshot block.
8. **Fixed expenses:** list, edit, confirm sheet, reminders.
9. **AI chat:** setup and consent, chat, draft edit sheet, error states.
10. **Valas and exchange rates:** Valas account and pockets, exchange, rates screen and refresh. The schema, domain layer and fx wiring landed in step 2 (`src/features/fx/fetchRates.ts`, `throttle.ts`, `src/domain/fx.ts`'s `refreshRates`) — this step is the UI only.
11. **Welcome** and polish (empty states, validation catalogue, 200% text scale pass).

Definition of done per screen: matches its board (layout, copy, states), uses only token colours, passes the rules above, has no number computed outside SQL views or `src/domain`.

## Open decisions (ask the owner)

- **UI language.** The boards mix English (most screens) and Indonesian (Welcome, AI chat, fixed-expense confirm). Decide whether to ship one language or both before writing strings; keep all copy in one module so it can change.
- Token names in the DS-Foundations board (`MonoColors.bg2`, `elevated`, `text2`, `muted`) differ from `tokens.ts` (`surface`, `raised`, `textSecond`, `textDisabled`). Use the `tokens.ts` names; the colours are identical.
- The schema was tested in plain SQLite only. Verify on a device that Android's SQLite supports window functions (3.25+), used by `v_account_activity`; otherwise bundle SQLite.
- Error messages for the 13 guard codes in DATABASE.md are proposed wording; draft Indonesian ("kamu" style) versions now live in `src/i18n/id.ts`, but neither has been confirmed by the owner or folded into the design's message catalogue.

## Working agreements

- Keep changes small and tested. Run the Jest suite before saying something works.
- Do not add dependencies outside the stack list without asking.
- Do not store anything the views can derive.
- When the design and the schema disagree, tell the owner rather than silently picking one.

# MONO Finance — Design Specification

Premium, monochrome with one amber accent for graphics plus red and green for loss and gain, local-only personal finance app. Android, React Native (Expo) + SQLite, rupiah base with an optional multi-currency Valas account.
All figures below are **sample placeholders** computed from one consistent sample dataset. Stock features were removed; the app tracks accounts, transactions, budgets and goals only.

---

## 1. Principles

- Monochrome, plus three colours with strict jobs. **Amber** (`#E3C27A`) is for graphics only: the main chart series, progress-bar fills and the selected bar. **Green** (`#4ADE80`) and **red** (`#FF6B6B`) mark gain and loss: plus-signed and minus-signed amounts, over-budget and errors. Colour only reinforces a **sign, icon or word**; it is never the only signal, so every screen still reads in greyscale.
- Local only: no account, no sync, no analytics. Two optional exceptions use the network: the AI chat (off by default, the user's own Gemini key, see section K) and the exchange-rate refresh for the Valas account (user-triggered, or automatic if switched on; sends only currency codes; see section M).
- Every dashboard figure is derived from stored records. Nothing is typed in as a total.
- Money is an integer in the minor unit of its currency (whole rupiah, or cents for foreign currency). Exchange rates are integers (rate × 10.000). Percentages are computed in basis points.
- Every chart has an exact-value table and a text label.
- Touch targets are 44–48 dp. Chips are 40 dp tall. Text scales to 200% without hiding numbers.

## 2. Logo

Supplied mark, wordmark, lockup and app icon (white on transparent for dark surfaces).
Asset names: `mono-mark.png`, `mono-wordmark.png`, `mono-lockup.png`, `mono-appicon.png`.
Used in the Overview header (mark + wordmark), More footer (lockup), Settings About (mark), and the design system page.

## 3. Colour tokens

| Token | Hex | Use |
|---|---|---|
| bg | #0A0A0A | App background |
| surface | #111111 | Sunken areas, empty states |
| card | #171717 | Cards, inputs |
| raised | #202020 | Pressed, selected tiles, sheets |
| text | #F5F5F5 | Primary text, icons, primary fill |
| textSecond | #A3A3A3 | Secondary text |
| textMeta | #8A8A8A | Small captions (**derived**, 5.6:1 on bg) |
| textDisabled | #737373 | Disabled and placeholder text only |
| border | #2B2B2B | 1 px hairlines |
| accent | #E3C27A | Graphics only: main chart series, progress fills, selected bar. Never text, status, buttons or icons |
| positive | #4ADE80 | Plus-signed amounts (income, net worth up, spending down). Always with the + sign |
| negative | #FF6B6B | Minus-signed amounts, spending up, over-budget, errors. Always with a sign, icon or words |

**Deviation from the brief:** `#8A8A8A` was added because `#737373` is only 4.2:1 on `#0A0A0A`, below AA for small text. `#737373` is kept for disabled text, placeholders, and secondary outlines. Chart greys used in allocation bars: `#A3A3A3`, `#6B6B6B`, `#4A4A4A`.

**Colour rules.** `accent`, `positive` and `negative` are tokens 10 to 12. (1) Amber only on graphics: the primary series of a chart, the fill of a progress bar, the selected bar. Never on text, icons, buttons, borders or tab indicators. (2) Green and red follow *meaning*, the sign follows *arithmetic*: income, net worth up and spending down are green with a `+`; expenses, net worth down and spending up are red (so "+Rp317.000 spending vs last month" keeps its plus and is red). Transfers are never coloured. (3) Over-budget uses a red alert icon and words ("Over by Rp…"), and the overflow segment of the bar is striped red; the stripes plus the words keep it readable without colour. Errors use a red 1.5 px border, a red icon and a sentence. (4) Colour is never the only signal; every red or green value also has a sign, icon or word. Roughly 1 in 12 men are red-green colour blind, which is why this rule exists. (5) Never pair amber and white as two chart series (about 1.6:1 apart in lightness); a second series uses `#A3A3A3`/`#6B6B6B` and a dash. (6) Contrast on `#0A0A0A`: amber 11.6:1, green 11.4:1, red 7.1:1. On card `#171717`: 10.5, 10.3, 6.5. (7) Each chart still has its value table and text label.

## 4. Typography

| Style | Spec | Use |
|---|---|---|
| Display | Newsreader 48/52 | Net worth |
| Title L | Newsreader 32/36 | Screen titles |
| Figure L | IBM Plex Sans 500, 32/40 tabular | Amount entry |
| Title M | IBM Plex Sans 600, 17 | Section and sheet titles |
| Figure | IBM Plex Sans 500, 22/28 tabular | Card totals |
| Body | IBM Plex Sans 400, 15 | Default |
| Figure row | IBM Plex Sans 500, 14/20 tabular | List amounts |
| Body S | IBM Plex Sans 400, 13/18 | Helper text |
| Label | IBM Plex Sans 500, 11/14, caps, +0.08em | Section captions |
| Mono | IBM Plex Mono 500, 13/18 | File names, timestamps |

Fonts are **bundled** (offline app). All numbers use tabular figures.

## 5. Spacing, shape, elevation

- Spacing: 4-based scale (4, 8, 12, 16, 24, 32). Page gutter 16. Phone frame 390 × 844.
- Radii: card 12, input 10–12, chip 10, button 12, FAB 16, sheet top 16, switch 14.
- Borders: 1 px `border`; emphasis 1.5 px `text` (selected, error, destructive).
- No shadows. Depth comes from surface steps (bg → surface → card → raised) and borders.
- Focus: 2 px light outline, 2 px offset.
- Scrim: black at 62%.

## 6. Money and sign conventions

| Case | Format |
|---|---|
| Income | `+Rp7.000.000`, semibold, labelled "Income" |
| Expense | `−Rp38.500` (true minus U+2212), regular, labelled "Expense" |
| Transfer | `Rp1.000.000`, no sign, grey, labelled "Transfer" |
| Change | `+Rp3.243.000 · +57,53%` with the comparison period |
| Over budget | alert icon + "Over by Rp112.000 · 116,00% used" |
| Hidden mode | `Rp••••••••` for every figure, toggled from Overview and Settings |

Locale `id_ID`: dot thousands, comma decimals, no decimals for IDR, percentages to two places.

## 7. Icons

48 inline line icons, 24 px grid, 1.5 px stroke, round caps and joins. 20 px default, 16 px inline, 26 px in empty states.

## 8. Components

Buttons (primary light fill, secondary outlined with `#737373`, disabled), icon button, FAB (56, Transactions only), chips (selected = light fill plus check icon), segmented control, month selector, tabs, text field (default, focus, error, disabled), amount field with quick-add chips, pickers, transaction row, account row, budget row (normal and over-limit with striped overflow), goal row, progress bar (8 px), chart style, bottom navigation (72 px zone, 5 items, active = a floating pill, not a bar above the icon), app bars, bottom sheet, dialog, snackbar (with Undo), banners, empty state.

Header action buttons (Filters, month chip, edit) share one style: 40 high (the same as the Accounts "+"), radius 10, fill #171717, 1px #2B2B2B border.

## 9. Navigation

Bottom tabs: **Overview · Transactions · Accounts · Budgets · More**.
More contains: Backup status card, Goals, Reports, Categories, Backup and restore, Settings.

## 10. Sample dataset

Wed 28 Oct 2026, WIB.

| Account | Type | Balance |
|---|---|---|
| BCA Tabungan | Bank | Rp6.842.500 |
| Cash wallet | Cash | Rp450.000 |
| GoPay | E-wallet | Rp312.500 |
| Jago Pocket | Savings | Rp1.275.000 |
| **Net worth** | | **Rp8.880.000** |

October: income Rp7.500.000 · expenses Rp4.257.000 · net +Rp3.243.000 · savings rate 43,24%.
Net worth at 30 Sep: Rp5.637.000 → change +Rp3.243.000 (+57,53%).

Monthly flow (Rp million): May 6,8 / 6,8 · Jun 7,0 / 6,6 · Jul 7,0 / 6,3 · Aug 7,2 / 5,8 · Sep 7,0 / 3,9 · Oct 7,5 / 4,3.
Net worth month-end (Rp million): May 0,0 · Jun 0,4 · Jul 1,1 · Aug 2,5 · Sep 5,6 · Oct 8,9.

**Valas sample (only on the Valas boards, not part of the figures above):** pockets US$250,00 (≈ Rp4.062.500 at Rp16.250) and S$180,00 (≈ Rp2.250.000 at Rp12.500, after a S$20 expense "Dinner, Singapore" on 15 Oct), Valas ≈ Rp6.312.500, net worth with Valas ≈ Rp15.192.500, rates updated 28 Oct 2026 09:00. Exchange example: Rp1.625.000 from BCA Tabungan becomes US$100,00 at Rp16.250 (BCA after Rp5.217.500, USD pocket after US$350,00).

Budgets, October (monthly limit Rp5.000.000, spent Rp4.257.000, 85,14% used, Rp743.000 left):

| Category | Limit | Spent | Used |
|---|---|---|---|
| Shopping | 700.000 | 812.000 | 116,00% (over by 112.000) |
| Bills | 1.200.000 | 1.150.000 | 95,83% |
| Transport | 600.000 | 540.000 | 90,00% |
| Food & drink | 1.800.000 | 1.425.000 | 79,17% |
| Leisure | 400.000 | 210.000 | 52,50% |
| Health | 300.000 | 120.000 | 40,00% |

Goals: Total assets Rp8.880.000 of Rp30.000.000 (29,60%, remaining Rp21.120.000, target 30 Jun 2027, needs about Rp2.640.000/month) · Emergency fund Rp6.842.500 of Rp15.000.000 (45,62%, linked to BCA Tabungan, target 31 Dec 2027) · Travel fund Rp0 of Rp8.000.000.

## 11. Screens

Phone boards are 390 wide. Each is linked to the others as a clickable prototype.

**Welcome (first launch)**
Shown once after install. Header with logo, then the mascot video (muted, looping, 300×300, black background blended into #0A0A0A and faded at the edges), title "Selamat datang di MONO" (the one serif moment), a short description, three promises (device only, no bank login, figures computed from records), optional nickname field (feeds the Overview greeting), primary button "Mulai" → Overview (empty), link "Punya berkas cadangan? Pulihkan" → Backup. No bottom navigation. The video is decorative: it carries no information, has no sound, and should freeze on its poster frame when the system asks to reduce motion.

**A. Overview** (interactive)
Header with logo and date, greeting "Selamat datang, Nael", net worth with hide/reveal toggle, change vs 30 Sep, "Your accounts" carousel of bank-style cards (BCA Tabungan, Jago Pocket, GoPay, Cash wallet; swipe sideways), "Fixed expenses" card (Gym membership due today Rp200.000 with "Review and record", next: Internet 5 Nov Rp385.000), This month (income, expenses, net), net worth history line chart with goal line at Rp30 jt and a value table, income vs expenses bars with table, "Where your money is" stacked bar by account (BCA 77,05% · Jago 14,36% · Cash & GoPay 8,59%), recent transactions, budget summary with over-limit alert, goal card.
*Empty variant:* greeting, Rp0, 4-step setup checklist (account, transaction, budget, backup), private-by-design note.

**B. Transactions**
Search, date range, type chips, category and account chips, summary (income, expenses, net, "not counted: 3 transfers Rp2.200.000"), October grouped by day with daily totals, September collapsed, FAB. *Filters sheet:* type, date range, category, account, "Show 11 transactions".

**Revised (Fase 4.3a):** Summary rows are stacked (income, expenses, net), never in columns, so figures never truncate. Rows show "category · account" without the date because they sit under a day header. A day with only transfers shows no total. The FAB stays fixed to the screen at full size while scrolling, 16 above the bottom navigation's visible edge.

**C. Add transaction**
Segmented Income / Expense / Transfer. Expense form: amount with quick chips, category chips, account with "Balance after", date, description, notes. Transfer form: from/to with swap, info banner that net worth is unchanged. *Validation variant:* missing category, insufficient funds (Rp450.000 vs Rp1.500.000), "2 fields need attention".

**D. Accounts**
Total balance (equals net worth), one full-width bank-style card per account grouped by type (see Account cards below), Transfer and Add account buttons, no-bank-login note. *Detail:* balance reconciliation (opening + in − out) and statement-style activity with running balances. *Edit:* type tiles (Bank, Cash, E-wallet, Savings, **Valas**), name, opening balance and date, icon. See section M for the Valas account.

**Account cards** (Overview carousel 312×184, Accounts list full width, radius 16)
| Account | Treatment | Tag |
|---|---|---|
| BCA Tabungan | Dark #202020, fine diagonal lines, chip outline | DEBIT |
| Jago Pocket | Light #F5F5F5, concentric rings, dark text | SAVINGS POCKET |
| GoPay | Grey #A3A3A3, dot pattern, dark text | E-WALLET |
| Cash wallet | #111111, dashed outline | CASH |

Layout: bank/e-wallet logo mark (top left, where the plain text wordmark used to be), tag pill (top right), account name, balance (24, tabular) and masked number "•••• 4821" (bottom). **Revised from the original brief:** real bank and e-wallet logos are now used, via `idn-finlogos` + `react-native-svg` (assets in `assets/card/`), rather than the placeholder wordmark-only treatment — the one deliberate exception to the strictly-monochrome rule (CLAUDE.md rule 5), scoped to this logo mark only; everything else on the card (background, text, borders) stays on-token. Exact logo size/placement within the card is not yet specified here — follow `assets/card/bankCards.ts` / the owner's screenshot when building this screen. Tapping a card opens Account detail. In hidden mode the balance shows Rp••••••••.

**Superseded again, further than the paragraph above:** the card surface itself — not just the logo mark — now uses each bank's real brand colour (background gradient + fg text/logo colour), implemented in `src/components/BankCard/BankCard.tsx` and `src/components/BankCard/bankCards.ts` (assets at `assets/bank-cards/`, not the older `assets/card/` path above). The generic per-type treatment table above (flat greys, diagonal-line/ring/dot patterns) and the masked account number "•••• 4821" are both dropped — there is no masked-number row, since nothing in the schema backs one. CLAUDE.md rule 5's exception now reads "a `BankCard`'s own surface," not "this logo mark only." Nominal on a card still always uses the card's own `fg`, never `positive`/`negative` — colour-by-sign stays everywhere else in the app. See `bankCards.ts`'s own header comment for the contrast requirement (≥ 4.5:1, fg against both ends of the gradient) and `tools/gen-card-assets.ts`'s header comment for why each brand logo is pre-recoloured to a single flat fill rather than rendered through `idn-finlogos`'s own (here, no-op) recolouring.

**Superseded once more (Fase 4.2c): Accounts screen = card stack (wallet style).** The total is the top card (inverse light gradient #F5F5F5 to #C7C7C7, text #0A0A0A, 140 high, serif hero amount, count of accounts, note). Below it each account is a card overlapping the previous one by 12: a strip is 68 high (56 visible): logo or wordmark and account name left, balance right (16/20, 600, fg). The card art is anchored to the top. Exactly one card is open (184 high): by default the last card; tapping a strip brings that card forward and collapses the open one to a strip (Reanimated 200 ms ease-out, none under reduce-motion). Tapping the open card opens Account detail. An open card that is not last keeps its balance 12 higher (bottom 30) so the next strip does not cover it. Order by type (Bank, Cash, E-wallet, Savings, Valas), then saved order; no group headers or subtotals. Strips grow with text scale. Valas card: no tag pill; name, balance prefixed with ≈, native amounts line, six round flags; the "Exchange rates" row sits under the stack. Buttons: "Transfer" (primary) and "Add account" side by side, single-line labels.

**F. Budgets**
Month selector, summary, September comparison, six categories sorted by usage, over-limit row with striped overflow. *Create:* category chips, amount, repeat toggle, allocation check (over the monthly limit by Rp500.000), "Raise monthly limit", disabled Save. *Category review:* four-month bars against the limit and its expenses.

**G. Goals**
Three goals with computed progress and needed pace; Goal-Edit with source (one account or all accounts), target, date and a preview from stored records.

**H. Reports**
Period selector, cash flow (savings rate), six-month trend with table, spending by category with shares, net worth month-end table, CSV export (transactions, account balances).

**I. Backup and restore**
Local-only banner, last backup, "Create backup now", contents list, restore entry, recent backups. *Restore confirm:* file info, comparison of this device versus file, warning, safety-backup switch, required tick, disabled Replace until ticked. *Invalid file:* explicit checklist (readable JSON ✓, MONO marker ✓, schema version ✕, totals skipped), data untouched.

**J. Settings**
Privacy (app lock, hide amounts on launch, block screenshots), assistant (AI chat switch, Gemini API key), format (rupiah currency, exchange rates, number format, month start, time zone), data (backup reminder, backup, categories), erase all data, About.

**K. AI chat (optional): add transactions by chatting**
- *AI-Setup (consent and key):* title "Catat lewat chat", what is sent to Gemini (typed message, account and category names, today's date) versus never sent (balances, transaction history, budgets, goals, backups), API key field (masked, Paste), note that the key stays on the phone (Android Keystore), is excluded from backups and that MONO has no server, warning that usage follows the key's quota or billing and that this feature needs the internet, button "Simpan dan tes kunci".
- *AI-Chat:* header (back, "Catat lewat chat", key icon), mascot avatar on assistant messages, user bubbles in light fill, assistant bubbles in card style. The AI replies with **draft cards** (dashed border = not saved): kind tag, title, amount, category, account, date, balance after, buttons Simpan / Ubah / Batal. Several items in one message become one card with checkboxes and "Simpan 2 transaksi". Input bar with suggestion chips, text field and a send button that is disabled until there is text. Footer: "AI bisa salah. Selalu cek draf sebelum menyimpan."
- *AI-Chat-States:* clarification (missing account or category, answered by one tap on a chip), unrecognised account ("Budi" is not one of your accounts, offer to record as an expense), balance guard (Rp1.500.000 against Rp450.000, short by Rp1.050.000, Save disabled), saved snackbar with Undo, no internet, key rejected, quota exhausted, unreadable reply. Each failure says what happened, confirms nothing was saved, and offers another path.
- *AI-Draft-Edit ("Ubah" and "Ubah satu per satu"):* a form like Add transaction, pre-filled from the draft. Header with close and "1 dari 2" plus a two-segment progress bar, the original message quoted ("Dari pesanmu"), type switch, amount with quick chips, category and date marked "Ditebak AI" where the AI inferred them, account with "Saldo setelah", description. Bottom bar: "Buang" (discard this draft) and "Simpan, lanjut ke draf 2" (becomes "Simpan" on the last draft). Later drafts are computed from balances after the earlier ones (Cash wallet Rp402.000 then Rp397.000). A single draft opens the same form as "1 dari 1".
- *Entry points:* the **+ button on Transactions opens the chat directly**; inside the chat a "Catat manual" button opens the manual Add transaction form; the manual form has a "Chat" button to switch back; Settings → Assistant (switch, off by default, and "API key Gemini").
- *Rules:* the AI only proposes, nothing is written until Simpan; names map to ids by exact match, unknown names trigger a question; drafts pass the same guards as manual entry; the key never goes into backups or logs.
- *Open point:* the INTERNET permission must now be declared in the Android manifest. "No network permission" is no longer true for the app as a whole; only the AI chat code and the exchange-rate refresh may open connections.

**M. Valas (foreign currency)**
One account called Valas holds any number of currencies the user adds (USD, SGD, EUR, MYR, AUD, GBP, JPY, CNY, HKD, KRW, THB, SAR). Each currency is a *pocket* with its own balance. There is no single Valas balance: the account shows a total in rupiah, estimated from the latest stored rate and marked ≈. Sample data for these boards is separate from the rest of the design: US$250,00 and S$180,00 at US$1 = Rp16.250 and S$1 = Rp12.500 (28 Oct 2026, 09:00), Valas ≈ Rp6.312.500, net worth with Valas ≈ Rp15.192.500.
- *Accounts with a Valas account (Accounts-Valas):* total shows ≈ with a note that foreign currency uses the latest rates; the Valas card (six round flags, no tag pill, ≈ value, native amounts beneath) sits last in the card stack, and an "Exchange rates · updated 28 Oct, 09:00" row sits under the stack.
- *Valas detail (Valas-Detail):* ≈ total, one row per pocket (code, name, rate used, native balance, rupiah value), "Add currency", Add and Exchange buttons, October activity with currency chips (All, USD, SGD), rate link and a note that each transaction keeps the rupiah value of its day.
- *Create Valas account (Valas-Edit):* type tile "Valas", name, one opening balance per currency with remove buttons, "Add currency", opening date. No single balance field.
- *Add currency (sheet):* searchable list of the 12 supported currencies, added ones marked, note that a rate is needed to show rupiah values.
- *Add expense in a pocket (Tx-Add-Valas):* amount in the pocket's currency with a live "≈ Rp250.000 · Rp12.500 per S$1" line, account row with the pocket chips (USD, SGD), "Balance after" in that currency, budget note that it counts as the rupiah value of the day.
- *Exchange (Tx-Exchange):* a transfer between two different currencies. "You send" and "You receive" are both typed as the bank or exchange gave them; the card shows the user's rate, the latest stored rate and the difference, and says net worth only moves by that difference.
- *Exchange rates (Rates):* switch "Update automatically" (off by default), "Update rates now", the rates in use (source and time, tap to type a manual rate), a failure message that keeps the old rates, an explanation of how rates are used, a privacy line (only currency codes are sent) and the attribution link "Rates By Exchange Rate API".
- *Rules:* only a Valas account has pockets; a transaction can use only a pocket the account has; income and expense in a pocket store the rupiah value of that day (`amount_idr`), and budgets and reports use only that; a currency with no rate blocks new transactions until a rate exists; fixed expenses cannot use a Valas account; exchange rates come from one free API request (all rates in one response) or from a manual entry.

**L. Fixed expenses (recurring monthly costs)**
Confirm-first model: a fixed expense is a template, and the transaction is created only when the user confirms.
- *Fixed expenses (list):* title and one-line explanation; summary card "Per month, estimated Rp1.201.990" (4 fixed expenses, one estimated), due today Rp200.000, next Internet 5 Nov; **Needs confirmation** card with a 1.5 px border (Gym membership, Health, BCA Tabungan, every month on the 28th, Rp200.000, tag "Due today") and buttons "Record now" / "Skip this month"; **Coming up** list (Internet 5 Nov Rp385.000, Music subscription 12 Nov Rp54.990, Electricity token 24 Nov "about Rp562.000", Amount varies); "Add fixed expense"; note about reminders and missed months.
- *Fixed expense form:* name, amount, switch "Amount varies each month" (the amount becomes an estimate, the real one is entered at confirmation), category chips, Pay from, Repeats (day of month stepper 1–31, first due date, end date), Remind me switch (09:00, a day before and on the due date), "Stop this fixed expense" (keeps recorded transactions).
- *Confirm when due (bottom sheet):* "Record Gym membership?", editable amount (Rp200.000), category, pay from, date, "BCA Tabungan after Rp6.642.500", budget impact banner ("Health budget goes over by Rp20.000: Rp120.000 + Rp200.000 = Rp320.000 of Rp300.000. You can still record it."), buttons Record expense / Skip this month / Remind me tomorrow. Skipping records nothing; the next due date is 28 Nov 2026.
- *Entry points:* More → Money → Fixed expenses; the "Fixed expenses" card on Overview; Settings → Data → "Fixed expense reminders" (amounts are left out of notifications when Hide amounts is on).
- *Backup:* recurring and recurring_events are included (Backup shows "Fixed expenses 4", Restore compares 4 / 4).

**More** and **Categories** (10 expense, 4 income, system Transfer row).

## 12. Accounting rules

1. No stored balances. Balance = opening + income − expense ± transfers.
2. A transfer is one row with two accounts: it changes both balances, never net worth, income or expense.
3. Net worth = sum of account balances.
4. Net cash flow = income − expense. Savings rate = net ÷ income.
5. Budget spent = sum of expense rows in the category and month. Transfers are excluded. The monthly limit must cover the sum of category budgets.
6. Goals read a linked account balance, or the total of all accounts. Progress is never typed.
7. Rounding is half away from zero to the minor unit. A foreign amount becomes rupiah as `amount × rate_e4 ÷ 10.000 ÷ minor_factor`, rounded once. Percentages come from integers in basis points.
8. Fixed expenses are templates. They change no balance, net worth, budget or report until confirmed. Confirming creates one normal expense row plus one event row (unique per template and due date); skipping creates only an event row. Over budget is a warning, insufficient balance is a block.
9. Guards: no balance below zero, no future dates, no transfer to the same account — in the domain layer and again as SQL CHECKs.

## 13. User flows

**Transfer:** Accounts → Transfer form → check (accounts differ, amount ≤ balance) → saved (BCA −Rp500.000, Jago +Rp500.000, net worth unchanged). If short: Save disabled, gap named, fix, re-check.

**Create a budget:** Budgets → pick category → set limit → check allocation. Within the limit: saved. Over: Save disabled, offer "Raise limit" or lower the budget, re-check.

**Backup / restore:** Create backup → share sheet → file saved. Restore → choose file → validate → valid: confirm screen → data replaced and Overview recalculates; invalid: checklist, choose another file. A bad file never partly restores.

## 14. Validation messages

| Field | Rule | Message |
|---|---|---|
| Amount | > 0, whole rupiah | Enter an amount above Rp0. |
| Pocket balance | not below zero | The SGD pocket has S$245,00. This expense is S$300,00. |
| Exchange rate | needed for a foreign currency | Add an exchange rate for SGD first. |
| Rate update | network or API failure | Couldn't update rates. MONO keeps using the rates from 28 Oct. |
| Category | required for income/expense | Choose a category. |
| Account balance | not below zero | Cash wallet has Rp450.000. This expense is Rp1.500.000. |
| Transfer accounts | differ | Pick two different accounts. |
| Budget | within monthly limit | Over the monthly limit by Rp500.000. |
| Date | not after today | Date cannot be later than 28 Oct 2026. |

Confirmation snackbars state the result in numbers ("Expense saved. BCA Tabungan is now Rp6.717.500." + Undo). Erase-all requires typing ERASE.

## 15. Empty states

One line icon, one sentence of why, one action. Panels: Transactions, Accounts, Budgets, Goals, Reports (under one month of data), Search/filters with no match.

## 16. React Native handoff

Stack: React Native with Expo (development build), TypeScript, Expo SQLite, Expo Router, Reanimated, Victory Native. Styling is `StyleSheet` plus one token file.

### Theme (`src/theme/tokens.ts`)

```ts
export const MonoColors = {
  bg:           '#0A0A0A', // app background
  surface:      '#111111', // sunken areas, empty states
  card:         '#171717', // cards, inputs
  raised:       '#202020', // pressed, selected tiles
  text:         '#F5F5F5', // primary text, icons
  textSecond:   '#A3A3A3', // secondary text
  textMeta:     '#8A8A8A', // small captions (AA 5.6:1)
  textDisabled: '#737373', // disabled and placeholder ONLY
  border:       '#2B2B2B', // 1px hairlines
  accent:       '#E3C27A', // graphics ONLY: chart series, progress fill, selected bar
  positive:     '#4ADE80', // + amounts, gain (always with the sign)
  negative:     '#FF6B6B', // - amounts, over budget, errors (with icon/words)
} as const;

export const radius = { sm: 10, md: 12, lg: 16 } as const;

// expo-router uses React Navigation's theme: override it once.
export const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors,
    background: MonoColors.bg, card: MonoColors.bg,
    text: MonoColors.text, border: MonoColors.border,
    primary: MonoColors.text, notification: MonoColors.text },
};
```

`android_ripple` is never set, so there are no coloured ripples. Pressed state is a `MonoColors.raised` fill.

### Money formatting (`src/core/money.ts`)

```ts
const dots = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export function rp(v: number, sign = false): string {
  const n = dots(Math.abs(v));
  if (v < 0) return `\u2212Rp${n}`;          // true minus sign
  return sign && v > 0 ? `+Rp${n}` : `Rp${n}`;
}

// Foreign amounts. minor_factor comes from `currencies` (100 for USD, 1 for JPY and KRW).
const SYMBOL: Record<string, string> = { USD: 'US$', SGD: 'S$', EUR: '€', GBP: '£', JPY: '¥', AUD: 'A$', HKD: 'HK$', CNY: 'CN¥', MYR: 'RM', KRW: '₩', THB: '฿', SAR: 'SAR ' };
export function money(minor: number, code: string, minorFactor: number, sign = false): string {
  const a = Math.abs(minor);
  const digits = String(minorFactor).length - 1;                    // 100 -> 2, 1 -> 0
  const whole = dots(Math.floor(a / minorFactor));
  const frac = digits ? ',' + String(a % minorFactor).padStart(digits, '0') : '';
  const body = `${SYMBOL[code] ?? code + ' '}${whole}${frac}`;
  return minor < 0 ? `\u2212${body}` : sign && minor > 0 ? `+${body}` : body;
}
// amount (minor units) at rate_e4 -> whole rupiah, half away from zero, one rounding.
// BigInt because minor * rateE4 passes 2^53 for amounts above about US$5.000.000.
export function toIdr(minor: number, rateE4: number, minorFactor: number): number {
  const n = BigInt(minor) * BigInt(rateE4), d = BigInt(10000 * minorFactor);
  const a = n < 0n ? -n : n;
  const r = (a * 2n + d) / (2n * d);
  return Number(n < 0n ? -r : r);
}

// 6810 -> "68,10%". Integer maths only.
export function pct(bp: number): string {
  const a = Math.abs(bp);
  const s = `${Math.floor(a / 100)},${String(a % 100).padStart(2, '0')}%`;
  return bp < 0 ? `\u2212${s}` : s;
}
```

Own formatter on purpose: Hermes `Intl` support differs by device. Fonts are bundled through `expo-font` and `@expo-google-fonts` packages, never fetched. Figures use `fontVariant: ['tabular-nums']`.

### Component map

| Component | React Native |
|---|---|
| Primary / secondary button | `Button` (Pressable + Text), 48 tall, radius 12 |
| Icon button, FAB | `IconButton`, `Fab` (Pressable with hitSlop), FAB 56 radius 16, Transactions only |
| Chip | `Chip` (Pressable), 40 tall, check icon when selected |
| Segmented control | `Segmented` (row of Pressable, role radio) |
| Text field | `Field` (TextInput in a View), error = 1.5px light border + icon + helper text |
| Amount field | `AmountField` (TextInput, number-pad), strips non-digits, stores int |
| Bottom navigation | expo-router `Tabs` with a custom floating-pill tab bar: a 72-tall zone (plus the bottom safe-area inset) holding one 56-tall, radius-28 bar; the active tab is a 44-tall, radius-22 pill filled `text`, icon+label on `bg`; inactive tabs are icon-only |
| Sheets, dialogs | transparentModal route + Reanimated slide, scrim black 64% (not `Alert`) |
| Snackbar | `Toast` (Reanimated), polite live region, Undo |
| Progress bar | `ProgressBar` (View, 8), fill `accent`, striped overflow segment in `negative` drawn with Skia, plus alert icon and words (never amber) |
| Charts | `victory-native` `CartesianChart`, main series `accent` (amber), others differ by lightness and dash, value table beneath |
| Account cards | `BankCard` (`ImageBackground` + `idn-finlogos` `Logo`), style from `accounts.icon`, falling back to `accounts.type` when the icon is null or unrecognised |
| Switch | `MonoSwitch` (Pressable, role switch) |

### SQLite schema v1

The canonical, tested schema is `db/mono_schema_v1.sql`, described in `MONO-Finance-Database.md` and on the Database board. Summary:

- 14 tables: `meta`, `settings`, `currencies`, `fx_rates`, `accounts`, `account_currencies`, `categories`, `transactions`, `monthly_limits`, `budgets`, `goals`, `recurring`, `recurring_events`, `backup_log`.
- No stored balances. 17 views derive pocket balances and values, account balances, net worth, period flow, savings rate, budget status, goal progress, due fixed expenses and an integrity audit.
- 23 triggers (13 error codes) enforce the rules that need other rows, among them currency and pocket rules: no negative balance, no future date, no date before an account's opening date, category kind must match, budgets within the monthly limit.
- Money is INTEGER in the currency's minor unit (rupiah for IDR), rates are `rate_e4` integers, ratios are basis points, dates are ISO text, foreign keys are RESTRICT.
- Transactions carry `description`, `note` and `source` (manual, ai, recurring), plus `currency`, `to_currency`, `amount_to` and `amount_idr` (the rupiah value at recording time).

### Backup file

The file lists eleven tables (the earlier nine plus `account_currencies` and `fx_rates`). `currencies` is a static seed and is not exported.

```json
{
  "app": "mono-finance",
  "schema_version": 1,
  "exported_at": "2026-10-21T20:14:00+07:00",
  "currency": "IDR",
  "counts": {
    "accounts": 4,
    "account_currencies": 0,
    "fx_rates": 0,
    "categories": 14,
    "transactions": 63,
    "budgets": 6,
    "monthly_limits": 2,
    "goals": 3,
    "recurring": 4,
    "recurring_events": 3,
    "settings": 10
  },
  "data": {
    "accounts": [],
    "account_currencies": [],
    "fx_rates": [],
    "categories": [],
    "transactions": [],
    "budgets": [],
    "monthly_limits": [],
    "goals": [],
    "recurring": [],
    "recurring_events": [],
    "settings": []
  },
  "checksum": "sha256:<hash of the canonical data object>"
}
```

File name `mono-backup-YYYY-MM-DD.json`. Readable, not encrypted. Not included: `meta` (recreated), `backup_log` (device-local) and the Gemini key (secure storage).

**Restore sequence:** parse JSON → check `app` and `schema_version` → check counts, checksum and foreign keys → show comparison and require the tick → optional safety backup → one SQLite transaction (set `meta.guards_off` to 1, delete all, insert, set it back to 0, then `PRAGMA foreign_key_check` and read `v_integrity_issues`; any error or any returned row rolls back) → invalidate providers.

### Packages (`package.json`)

`expo`, `expo-router`, `expo-sqlite`, `@tanstack/react-query`, `zustand`, `react-native-reanimated`, `react-native-gesture-handler`, `@shopify/react-native-skia`, `victory-native`, `expo-font` with `@expo-google-fonts/*`, `expo-video`, `expo-sharing`, `expo-document-picker`, `expo-file-system`, `expo-asset`, `expo-crypto`, `expo-local-authentication`, `expo-screen-capture`, `expo-notifications`, `expo-secure-store`. Dev: `jest`, `better-sqlite3`, `eslint`. Deliberately absent: `axios`, `firebase`, analytics and crash SDKs.

Expo's default Android manifest already declares INTERNET. Keep it for the optional AI chat only, strip unused permissions with `android.blockedPermissions`, read the merged manifest after prebuild, and ban `fetch` outside `src/features/ai_chat` with an ESLint rule. `expo-screen-capture` sets FLAG_SECURE when "Block screenshots" is on. Add `.sql` to Metro `assetExts`.

### Folder structure

```
app/            expo-router routes only (_layout, (tabs), tx, account, budget, goal, recurring, ai-chat, backup)
src/
  theme/        tokens.ts, typography.ts
  core/         money.ts, dates.ts, result.ts
  data/         db/ (mono_schema_v1.sql, open.ts, migrations), repo/, backup/ (export, validate, restore)
  domain/       balances.ts, budget.ts, net-worth.ts, goals.ts   (pure TypeScript)
  features/     overview, transactions, accounts, budgets, goals, reports, backup, settings, recurring, ai_chat
  components/   Button, Chip, Segmented, Field, AmountField, Sheet, Toast, ProgressBar, MonoSwitch, BankCard, ChartTable
assets/
  brand/        mono-mark.png, mono-wordmark.png, mono-lockup.png, mono-appicon.png
  mascot/       welcome.mp4, welcome-poster.jpg
__tests__/      domain and SQL tests with the sample dataset
```

### Tests to write first

- A transfer of Rp500.000 changes two balances and leaves net worth identical.
- An expense above the account balance is rejected and names the shortfall (Rp1.500.000 against Rp450.000 gives Rp1.050.000).
- Net worth equals the sum of account balances; its monthly change equals net cash flow.
- Budget spent ignores transfers and recomputes on month change.
- Backup then restore returns identical counts and the same net worth.
- SQL tests run the real `mono_schema_v1.sql` through `better-sqlite3` and trigger each of the 7 guard codes.

---

*Generated from the MONO Finance design canvas. Sample data only; no real financial records.*

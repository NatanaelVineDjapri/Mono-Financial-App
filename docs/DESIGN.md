# MONO Finance — Design Specification
 
Premium, charcoal and gold, local-only personal finance app (visual direction v2, Nov 2026: warm black surfaces, soft rounded cards, one gold accent). Android, React Native (Expo) + SQLite, rupiah base with an optional multi-currency Valas account.
All figures below are **sample placeholders** computed from one consistent sample dataset. Stock features were removed; the app tracks accounts, transactions, budgets and goals only.
 
---
 
## 1. Principles
 
- Charcoal and gold. **Gold** (`#E3C27A`) is the single accent: the centre + button, icon discs, chart series, progress fills. **Green** (`#4ADE80`) is only for positive money: income, rises, plus-signed amounts. Primary buttons, selected chips and the active tab are solid light (`#F5F5F5`) with dark text, with no gradient. **Red** (`#FF6B6B`) marks loss, over-limit and errors. There is no green. Colour only reinforces a **sign, icon or word**; it is never the only signal, so every screen still reads in greyscale. Brand colours appear only on account cards.
- Local only: no account, no sync, no analytics. Optional exceptions use the network: the AI chat (off by default, the user's own Gemini key, see section K), the exchange-rate refresh for the Valas account (user-triggered, or automatic if switched on; sends only currency codes; see section M) and, if the user connects it, Gmail for automatic import (read-only, section N). Reading Android notifications for import uses no network at all.
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
| surface | #101011 | Sunken areas, empty states |
| card | #151516 | Cards (vertical gradient #171718 to #131314), inputs |
| raised | #1D1D1E | Pressed, selected tiles, icon tiles, sheets |
| text | #F5F5F5 | Primary text, icons, and the solid fill of primary buttons, selected chips and the active tab pill (dark text on top) |
| textSecond | #A3A3A3 | Secondary text |
| textMeta | #8A8A8A | Small captions (**derived**, 5.6:1 on bg) |
| textDisabled | #737373 | Disabled and placeholder text only |
| border | #272728 | 1 px hairlines |
| accent | #E3C27A | Gold: centre + button, icon discs, chart series, progress fills, the hero background image on Overview |
| positive | #4ADE80 | Positive money only: plus-signed amounts (income, net worth up, gains). Always with the + sign or an up icon. Never used for buttons, icons or decoration |
| negative | #FF6B6B | Minus-signed amounts, spending up, over-budget, errors. Always with a sign, icon or words |
 
**Deviation from the brief:** `#8A8A8A` was added because `#737373` is only 4.2:1 on `#0A0A0A`, below AA for small text. `#737373` is kept for disabled text, placeholders, and secondary outlines. Chart greys used in allocation bars: `#A3A3A3`, `#6B6B6B`, `#4A4A4A`.
 
**Colour rules.** (1) Gold is the one accent. It may fill the centre + button, icon discs, chart series and progress fills. (2) Colour follows *meaning*, the sign follows *arithmetic*: income and net worth up are green (`#4ADE80`) with a `+`; expenses and losses are red with a `−`; spending that went up keeps its plus sign and stays neutral (red only for over-limit and loss). Transfers are never coloured. (3) Over-budget uses a red alert icon and words ("Over by Rp…"), and the overflow segment of the bar is striped red; stripes plus words keep it readable without colour. Errors use a red 1.5 px border, a red icon and a sentence. (4) Colour is never the only signal. (5) Never pair gold and white as two chart series (about 1.6:1 apart in lightness); a second series uses `#A3A3A3`/`#737373` and a dash. Category colours in rings: largest gold, then `#A3A3A3`, `#737373`, `#525252`, Others `#3A3A3A`. (6) Contrast on `#0A0A0A`: gold 11.6:1, green 10.6:1, red 7.1:1. (7) Each chart still has its value table and text label. (8) Exception: the surface of an account card may use the bank's brand colour (see Account cards); amounts on it stay in the card's text colour. (9) No gradients on controls: buttons, chips, tabs and bars are solid. The only gradients are the barely visible card fill, the total card on Accounts, and the wave behind the Overview header.
 
## 4. Typography
 
| Style | Spec | Use |
|---|---|---|
| Display | IBM Plex Sans 700, 40/46, −0.02em, tabular | Hero balances (net worth, total, account, budget) |
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
- Radii: header button, field, chip, icon tile 14; button 16; card and bank card 20; sheet top 24; floating tab bar 30; centre + button and avatar full circle; switch 14.
- Borders: 1 px `border`; emphasis 1.5 px `text` (selected, error, destructive).
- Elevation is a surface step plus a one-pixel border. The only shadows sit under the floating tab bar and the centre + button. Depth comes from surface steps (bg → surface → card → raised) and borders.
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
 
Buttons (primary solid light, secondary #151516 with border, disabled), bordered header button (48, radius 14), centre + button (64, gold circle), chips (selected = light fill plus check icon), segmented control, month chip, tabs, text field (default, focus, error, disabled), amount field with quick-add chips, pickers, transaction row, account row, budget row (normal and over-limit with striped overflow), goal row, progress bar (8 px, gold), chart style, bottom navigation (floating bar 64 high in a 112 zone, four tabs with labels and a raised centre + button), app bars, bottom sheet, dialog, snackbar (with Undo), banners, empty state.
 
AI draft card: dashed 1.5 px #737373 border, #101011 fill, radius 16; becomes a solid 1 px border once saved. User bubble solid light, assistant bubble card with mascot avatar. Error and check-amount boxes use a 1.5 px #FF6B6B border with an icon and a sentence.
 
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
 
**A. Overview** (interactive, redesigned in v2)
Header: MONO mark and wordmark, notification bell, round avatar "N" (opens More). Hero (a soft gold ribbon image behind it): serif greeting "Selamat datang, Nael" (28/34), "Net worth" with hide/reveal, balance in sans 700 40/46, a green change chip ("▲ +Rp3.243.000 (+57,53%)") and "vs 30 Sep 2026", then a second chip for the year to date ("▲ +Rp… (+…%)" and "YTD · vs 31 Dec 2025"; not shown when the records start this year). The top of the screen has one background image, `assets/images/mono-overview-bg.jpg` (portrait artwork, 936×1681), behind everything from the MONO logo down to the balance: scaled uniformly to the screen width and shifted so the thin gold ribbon runs through the top-right corner above the greeting and the balance, with the image's own bottom edge fading into the screen background (#0A0A0A) so there is no visible edge. The header and the hero have no fill of their own (the header scrolls with the content). The Hide/Show amounts control is plain text with no fill and no border: an 18 eye icon and "Hide amounts" in the same grey as the "NET WORTH" label (#8A8A8A, 13/18, 500), right-aligned with a 44 high touch area; under 360dp it reads "Hide". Two cards side by side: **Expenses** and **Income** for the month, each with a gold icon disc and its label on one line, amount (20/26, 700) and change vs September (8,05% neutral, 7,14% green), then a slim "Net cash flow" row. "Your accounts" 3D coverflow carousel of brand-colour bank cards (300×154 art): the focused card is centred at full size with a soft shadow, its neighbours peek on both sides at scale 0.88, rotated about 26° around the Y axis and dimmed; snap to centre, the row loops (the last card sits to the left of the first, the first to the right of the last), dots below show the position, tap the focused card to open Account detail (a neighbour first comes to the centre), **Cash flow** card (six-month income vs expenses bars with gridlines, a baseline and a y axis in Rp million, plus the value table), **Top categories** card (ring 140 with the largest share in the centre, legend with percents, link to Reports for amounts), "Fixed expenses" card (gold 1.5 px border, Gym membership due today, "Review and record"), recent transactions, budget summary with over-limit alert, goal card, net worth history (line chart with gridlines, a y axis in Rp million, the dashed goal line, a callout on the latest point, a 6M / 1Y / All switch and the value table), "Where your money is" stacked bar with one row per account (every account listed on its own, never folded into "Others"). Hidden mode masks every amount and every percentage on this screen.
*Empty variant:* header, hero with the background image and Rp0, 4-step setup checklist (account, transaction, budget, backup), private-by-design note.
 
**B. Transactions**
Search, date range, type chips, category and account chips, then the **statistics area** (collapsible, "Hide stats"): a card with a ring chart and three stacked rows (income, expenses, net, never in columns, so figures never truncate) with "not counted: 3 transfers Rp2.200.000", and a card with an Income / Expense switch and one row per category (icon, name, share bar, percent). Then October grouped by day with daily totals (a day with only transfers shows no total), September collapsed, FAB. Rows show "category · account" without the date because they sit under a day header (search results that are not grouped by day keep the date).
 
**Statistics ring.** 220 px ring, 16 px stroke, round caps with a visible gap. The ring represents the **monthly limit** (when the range is the current month): each category is an arc of its spending, the unused part is the dark track `#202020`; the centre shows "Spent", the total and "of Rp5.000.000 limit". For other ranges or when no monthly limit is set the ring is the full circle split by share. Colours: largest category `accent` (amber), the rest a grey ramp `#A3A3A3`, `#737373`, `#525252`, then `#3A3A3A` for "Others" (top 4 plus Others); colour is never the only signal (name, percent and icon sit in the list, the ring has an accessibility label and the list is the exact-value table). The switch follows the Income / Expenses chip (All shows expenses); Transfers hides the area. Tap a ring segment or a row to filter the list to that category; tap again to clear. Percentages: largest-remainder rounding to one decimal so they add to 100,0%. Collapsed state is remembered (UI store). Data: the same SQL as Reports (spending by category on `amount_idr`). *Filters sheet:* type, date range, category, account, "Show 11 transactions".
 
**C. Add transaction**
Segmented Income / Expense / Transfer. Expense form: amount with quick chips, category chips, account with "Balance after", date, description, notes. Transfer form: from/to with swap, info banner that net worth is unchanged. *Validation variant:* missing category, insufficient funds (Rp450.000 vs Rp1.500.000), "2 fields need attention".
 
**C2. Transaction detail (Tx-Detail, Tx-Detail-Transfer, Tx-Detail-Valas, Tx-Delete)**
Read-only view of one record at `/tx/[id]`, reached by tapping a row. Header with a back arrow and the title (no pencil, no tab bar). Hero card: a 48 category tile (card fill, 1px border, gold icon), description (18/24 semibold), "category · date", a type tag and the amount in sans 700 40/46 (expense red with −, income green with +, transfer neutral). Details card: Account (name with "Balance after", from `v_account_activity`, no icon beside it), Date and time, Category, Source (Manual, AI chat, Fixed expense), Notes. Expenses with a category budget also show a budget card (8 px bar, month total). *Transfer:* From and To rows joined by an arrow, each with its bank tile and balance after; no category or budget. *Valas:* amount in the pocket currency, "Rp… at the time (rate)", rate used, and a note that the rupiah value is fixed at recording. Bottom bar: Delete (outlined, red text, 120 wide) and Edit (solid light). *Delete:* dialog "Delete this transaction?" naming the record, the account balance and the budget after removal, Cancel and Delete (solid light); then a snackbar with Undo that puts the same record back. Deleting a transfer removes both sides.
 
**D. Accounts**
Total balance (equals net worth), one full-width bank-style card per account grouped by type (see Account cards below), Transfer and Add account buttons, no-bank-login note. *Detail:* balance reconciliation (opening + in − out) and statement-style activity with running balances. *Edit:* type tiles (Bank, Cash, E-wallet, Savings, **Valas**), name, opening balance and date, icon. See section M for the Valas account.
 
**Account cards** (Overview carousel 300×154, Accounts list full width 358×184, radius 20)
*Decision after the boards were drawn:* the cards use the bank's brand colour and logo. All Accounts boards and the Overview carousel use this rule; the Account-Edit board still shows the old picker and is superseded by the brand-card picker until it is redrawn.
- One card background per bank or e-wallet (gradient of the brand colour, a faint pattern, PNG at 3x), 51 brands plus three neutral graphite cards: `cash` (guilloche rosette, dashed frame), `default` (radial rings, EMV chip; account with no bank chosen) and `valas` (round flags USD, EUR, SGD, JPY, GBP, AUD, globe glyph). Assets: `assets/bank-cards/`, style table `src/components/BankCard/bankCards.ts` (slug, bg, bgEnd, fg, pattern).
- The bank is chosen in Account-Edit and stored as a slug in `accounts.icon` (no schema change). `null` or an unknown slug falls back by `accounts.type`: cash → `cash`, forex → `valas`, otherwise `default`.
- Logo: the `Logo` component of `idn-finlogos`, drawn in a single colour (`fg`). Stockbit has no logo in that package, so the card shows the text "stockbit" (its colour is a placeholder until the real one is confirmed). A few multi-colour logos turn into plain blocks when flattened (Superbank, Neo Commerce, DOKU, OttoPay, Netzme, AstraPay, Maybank); use a single-colour version or the bank name as text for those.
- Text colour `fg` is white or `#0A0A0A`, whichever has at least 4.5:1 contrast on the brand colour (checked at both ends of the gradient; a brand colour that fails both is darkened). **Amounts on a card always use `fg`, never green or red**; the card colour is decoration only and the colour rules of section 6 apply everywhere else.
- **Accounts screen = card stack (wallet style).** The total is the top card (gold gradient `#F5E6C0` to `#D9B669`, text `#0A0A0A`, 140 high, radius 20, hero amount in sans 700 36/44, count of accounts, note). Below it each account is a card overlapping the previous one by 12: a **strip** is 68 high (56 visible): logo or wordmark and the account name on the left, balance on the right (16/20, 600, `fg`). Exactly one card is **open** (184 high, full layout below): by default the last card; tapping a strip brings that card forward and collapses the open one back to a strip (Reanimated, 200 ms, ease out, none under reduce-motion). Tapping the open card opens Account detail. Order: by type (Bank, Cash, E-wallet, Savings, Valas), then the saved order; type group headers and subtotals are dropped. Strips grow with text scale (68 to about 100 at 200%). Each strip has `accessibilityLabel` "<name>, <balance>. Bring card forward" and the open card "<name>, <balance>. Open account". Hidden mode shows Rp•••••••• on every card, the total included. More than about 8 accounts: the stack scrolls. The Valas row "Exchange rates · updated …" sits under the stack.
- Layout of the open card: logo (top left, 28–30 high), tag pill (top right: DEBIT, TABUNGAN, E-WALLET, TUNAI, VALAS), account name, balance (24, tabular, bottom left). No masked account number (there is no such data). Valas card: no tag pill (the flags and the name are enough), balance prefixed ≈, optional line with the native amounts (US$250,00 · S$180,00). Tapping a card opens Account detail. In hidden mode the balance shows Rp••••••••.
- Licence: the idn-finlogos artwork is CC BY-NC 4.0 and the brands belong to their owners. Fine for a private build; a public or commercial release needs permission.
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
- *AI-Rules:* the AI cannot chat. It may only return structured JSON with three outcomes (`create_transactions`, `clarify`, `out_of_scope`); every sentence the user reads is written by the app. Off-topic, advice, data questions and instruction-override attempts get one fixed app sentence per reason. Drafts pass the same validation as the manual form, plus an amount cross-check (typed "40rb" vs draft Rp4.000 locks Save until the user picks one). Relative dates are computed by the app. No conversation memory, 500 characters per message, one request at a time.
- *AI-Chat-States:* clarification (missing account or category, answered by one tap on a chip), unrecognised account ("Budi" is not one of your accounts, offer to record as an expense), balance guard (Rp1.500.000 against Rp450.000, short by Rp1.050.000, Save disabled), saved snackbar with Undo, no internet, key rejected, quota exhausted, unreadable reply. Each failure says what happened, confirms nothing was saved, and offers another path.
- *AI-Draft-Edit ("Ubah" and "Ubah satu per satu"):* a form like Add transaction, pre-filled from the draft. Header with close and "1 dari 2" plus a two-segment progress bar, the original message quoted ("Dari pesanmu"), type switch, amount with quick chips, category and date marked "Ditebak AI" where the AI inferred them, account with "Saldo setelah", description. Bottom bar: "Buang" (discard this draft) and "Simpan, lanjut ke draf 2" (becomes "Simpan" on the last draft). Later drafts are computed from balances after the earlier ones (Cash wallet Rp402.000 then Rp397.000). A single draft opens the same form as "1 dari 1".
- *Entry points:* the **+ button on Transactions opens the chat directly**; a failed chat message offers "Catat manual", which opens the manual Add transaction form (the chat header has no such button); the manual form has a "Chat" button to switch back; Settings → Assistant (switch, off by default, and "API key Gemini").
- *Rules:* the AI only proposes, nothing is written until Simpan; names map to ids by exact match, unknown names trigger a question; drafts pass the same guards as manual entry; the key never goes into backups or logs.
- *Open point:* the INTERNET permission must now be declared in the Android manifest. "No network permission" is no longer true for the app as a whole; only the AI chat code and the exchange-rate refresh may open connections.
**M. Valas (foreign currency)**
One account called Valas holds any number of currencies the user adds (USD, SGD, EUR, MYR, AUD, GBP, JPY, CNY, HKD, KRW, THB, SAR). Each currency is a *pocket* with its own balance. There is no single Valas balance: the account shows a total in rupiah, estimated from the latest stored rate and marked ≈. Sample data for these boards is separate from the rest of the design: US$250,00 and S$180,00 at US$1 = Rp16.250 and S$1 = Rp12.500 (28 Oct 2026, 09:00), Valas ≈ Rp6.312.500, net worth with Valas ≈ Rp15.192.500.
- *Accounts with a Valas account (Accounts-Valas):* total shows ≈ with a note that foreign currency uses the latest rates; a "Foreign currency" group with the Valas card (round flags, no tag pill, ≈ value, native amounts beneath) and an "Exchange rates · updated 28 Oct, 09:00" row.
- *Valas detail (Valas-Detail):* ≈ total, one row per pocket (code, name, rate used, native balance, rupiah value), "Add currency", Add and Exchange buttons, October activity with currency chips (All, USD, SGD), rate link and a note that each transaction keeps the rupiah value of its day.
- *Create Valas account (Valas-Edit):* type tile "Valas", name, one opening balance per currency with remove buttons, "Add currency", opening date. No single balance field.
- *Add currency (sheet):* searchable list of the 12 supported currencies, added ones marked, note that a rate is needed to show rupiah values.
- *Add expense in a pocket (Tx-Add-Valas):* amount in the pocket's currency with a live "≈ Rp250.000 · Rp12.500 per S$1" line, account row with the pocket chips (USD, SGD), "Balance after" in that currency, budget note that it counts as the rupiah value of the day.
- *Exchange (Tx-Exchange):* a transfer between two different currencies. "You send" and "You receive" are both typed as the bank or exchange gave them; the card shows the user's rate, the latest stored rate and the difference, and says net worth only moves by that difference.
- *Exchange rates (Rates):* switch "Update automatically" (off by default), "Update rates now", the rates in use (source and time, tap to type a manual rate), a failure message that keeps the old rates, an explanation of how rates are used, a privacy line (only currency codes are sent) and the attribution link "Rates By Exchange Rate API".
- *Rules:* only a Valas account has pockets; a transaction can use only a pocket the account has; income and expense in a pocket store the rupiah value of that day (`amount_idr`), and budgets and reports use only that; a currency with no rate blocks new transactions until a rate exists; fixed expenses cannot use a Valas account; exchange rates come from one free API request (all rates in one response) or from a manual entry.
**N. Automatic import (optional)**
Two optional sources feed one review queue: (a) Android notifications from the bank and e-wallet apps the user picks, read on the phone with no network and no login; (b) Gmail, with a Google login on the phone (read-only, no server, no MONO account). Both are off by default and independent: the user may use either, both or none, and disconnecting one does not affect the other. Nothing is saved as a transaction until the user taps Simpan. Only the parsed fields are kept, never the message. The sample items on these boards (Kopi Kenangan, Indomaret, nama@gmail.com) are separate from the main dataset. UI copy is Indonesian.
- *Not set up (Import-Setup):* two cards, "Notifikasi Android" (button "Aktifkan akses notifikasi") and "Gmail" (button "Hubungkan Gmail", marked as an extra, not required); lists of what MONO reads (only selected apps, only known bank senders with read-only access, amount, type, time, merchant, bank) and what it does not read or keep (other notifications and emails, full message text, passwords or PINs).
- *Connected (Import-Settings):* link "N transaksi menunggu tinjauan"; notification section with access status, last read time and one row per supported app (switch, mapped MONO account; an app with no account mapped stays off); Gmail section with Google account, last sync, permission (read only, token kept on the phone and excluded from backups), buttons Sinkronkan and Putuskan; a problems section: notification access off (with link to the guide), "Perlu hubungkan ulang" when the Google login expired or was revoked (saved transactions are safe), no internet (retried when MONO opens), battery saver stopping MONO.
- *Review (Import-Review):* detected items grouped by day, each with bank, merchant, signed amount (income green with +, expense red with −, per section 6), time, tags (account, suggested category or dashed "Pilih kategori", source: Notifikasi, Gmail or Notifikasi + Gmail), buttons Tolak, Ubah, Simpan. An item that is incomplete (no category) or ambiguous ("Perlu dicek": cannot tell income from expense, the user must choose Pemasukan or Pengeluaran) has Simpan disabled. Bottom bar "Simpan 2 yang lengkap" with a count of items still to complete. A duplicate seen through both sources is merged into one item. A rejected item does not come back.
- *Edit (Import-Review-Edit):* a form like Add transaction, filled from the detected data; guessed parts are tagged "Ditebak"; type, amount, category, account with "Saldo setelah", date, description; switch "Ingat kategori untuk <merchant>" (the next time the category is filled automatically). Buttons Tolak and Simpan.
- *Notification access guide (sheet, Import-Permission):* because MONO is installed outside Play Store, Android 13+ blocks Notification access until the user opens App info → ⋮ → "Izinkan setelan terbatas", then Notification access → MONO. Four steps, a reassurance line (permission can be revoked any time; only chosen apps are read), buttons "Buka pengaturan Android" and "Nanti saja".
- *Rules:* saving an item goes through the same domain function as a manual transaction, so every guard (balance, future date, opening date, category kind) and the rupiah value apply. Category comes from a local memory of earlier choices per merchant and keyword rules, empty when unknown, never guessed and never AI. Income or expense comes from per-bank wording; ambiguous means "Perlu dicek". The same event seen twice is matched by institution, type, amount, a short time window and a reference number when there is one. Gmail needs the network (a third network place, `src/features/import/gmail`); notifications never do. The Gmail login is meant to last until the user disconnects, but Google can end it (access revoked, unused for months, password change), so "Perlu hubungkan ulang" must be one tap. Notification reading depends on the phone not stopping the service. Parsers are one module per institution, tested with real sample texts; an institution without real samples is not claimed as supported. The detailed plan is `docs/IMPORT_PLAN.md`, written before any code.
- *Entry points:* Settings → Assistant → Impor otomatis (a banner on Transactions is not drawn yet).
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
| Transfer accounts, date vs opening | account did not exist yet | This account didn't exist yet on that date. |
 
Errors use a 1.5 px #FF6B6B border, a warning icon and a sentence, shown after the field is touched or Save is tapped (insufficient balance shows immediately).

Confirmation snackbars state the result in numbers ("Expense saved. BCA Tabungan is now Rp6.717.500." + Undo). Erase-all requires typing ERASE.
 
## 15. Empty states
 
One line icon, one sentence of why, one action. Panels: Transactions, Accounts, Budgets, Goals, Reports (under one month of data), Search/filters with no match.
 
## 16. React Native handoff
 
Stack: React Native with Expo (development build), TypeScript, Expo SQLite, Expo Router, Reanimated, Victory Native. Styling is `StyleSheet` plus one token file.
 
### Theme (`src/theme/tokens.ts`)
 
```ts
export const MonoColors = {
  bg:           '#0A0A0A', // app background
  surface:      '#101011', // sunken areas, empty states
  card:         '#151516', // cards, inputs (cards use a #171718 to #131314 gradient)
  raised:       '#1D1D1E', // pressed, selected tiles
  text:         '#F5F5F5', // primary text, icons
  textSecond:   '#A3A3A3', // secondary text
  textMeta:     '#8A8A8A', // small captions (AA 5.6:1)
  textDisabled: '#737373', // disabled and placeholder ONLY
  border:       '#272728', // 1px hairlines
  accent:       '#E3C27A', // gold: + button, icon discs, chart series, progress
  positive:     '#4ADE80', // + amounts, gain (always with the sign). Green, money only
  negative:     '#FF6B6B', // - amounts, over budget, errors (with icon/words)
} as const;
 
export const radius = { sm: 14, md: 16, lg: 20, sheet: 24, bar: 30 } as const;
 
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
| Primary / secondary button | `Button` (Pressable + Text), 48 tall, radius 16, primary = solid `text` (#F5F5F5) with dark text, secondary = `card` fill + border |
| Header button, centre + button | `HeaderButton` (48, radius 14, `card` fill, 1px border; also the month chip and Filters), `TabFab` (64 gold circle raised 32 above the bar; tapping it shows three 56 round buttons side by side on an arc around it (icons only: no captions; as the + turns into a × they come out of it one by one from left to right, and go back in right to left; no motion under reduce-motion), Scan a receipt, AI chat and Manual, over a dim scrim, and the + turns into a ×; there is no other FAB) |
| Chip | `Chip` (Pressable), 40 tall, selected = light fill plus check icon |
| Segmented control | `Segmented` (row of Pressable, role radio) |
| Text field | `Field` (TextInput in a View), error = 1.5px light border + icon + helper text |
| Amount field | `AmountField` (TextInput, number-pad), strips non-digits, stores int |
| Bottom navigation | expo-router `Tabs` with a custom floating tab bar: 112 high zone (24 top for the + button, 14 bottom plus safe-area inset), bar 64 high, radius 30, `card` fill `#131314`, 1px `border`, soft shadow above. Order: Overview, Transactions, [+], Accounts, Budgets (four tabs plus the centre + button). Active tab = solid #F5F5F5 pill 48 high, dark icon over a semibold 10.5/12 label; inactive = icon over label in `#9A9A9A`, min width 44, each with `accessibilityLabel`. Labels hide below 340dp width or at large text sizes. More is not a tab: it opens from the avatar on Overview and is a pushed screen with a back arrow |
| Sheets, dialogs | transparentModal route + Reanimated slide, scrim black 64% (not `Alert`) |
| Snackbar | `Toast` (Reanimated), polite live region, Undo |
| Progress bar | `ProgressBar` (View, 8), gold fill, striped overflow segment in `negative` drawn with Skia, plus alert icon and words |
| Charts | `victory-native` `CartesianChart`, main series gold, others differ by lightness and dash, value table beneath |
| Account cards | `BankCard` (background PNG + `idn-finlogos` Logo + text), style from `accounts.icon` (bank slug), fallback by `accounts.type` |
| Switch | `MonoSwitch` (Pressable, role switch) |
| More row | `MoreRow`: min height 64, icon tile 40 (radius 14, `#1D1D1E` fill, 1 px `#2A2A2B` border), title 15/20 600, subtitle 13/18 `#8A8A8A`, chevron, 1 px `#272728` separators inside a `card`. The Backup status card above the groups has three states (none, older than 30 days, recent), each with an icon and a sentence |
 
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
 
# MONO Finance — Typography

Scope: type only. Colour appears here only where it decides legibility. Sample figures are placeholders.

---

## 1. Families

| Family | Weights bundled | Role |
|---|---|---|
| **IBM Plex Sans** | 400, 500, 600 | All UI text and every figure |
| **IBM Plex Mono** | 400, 500 | File names, timestamps, technical strings |
| **Newsreader** | 400 (variable, optical-size axis) | Screen titles and the large balance figures |

Why this mix: the app is monochrome (with one amber accent for graphics, and red and green for loss and gain), so type carries all the personality. Newsreader gives the few big moments (net worth, screen titles) a financial-press editorial tone. IBM Plex Sans has an institutional, bank-document character: firm, slightly stiff, legible at small sizes, with tidy figures. IBM Plex Mono is reserved for strings that should look "technical". None of the three is a current default of startup apps.

Rules
- Bundle all fonts in `assets/fonts`. The app is offline, so never fetch fonts at runtime.
- Newsreader is a variable font. Lock it at weight 400 and leave the optical-size axis on auto, so large figures use the tighter display cut.
- Serif is for titles and hero balances only. No serif in lists, buttons, labels or forms.
- IBM Plex Mono is never used for money.

## 2. Type scale

Sizes are in dp (React Native density-independent px). Line height shown as size/leading.

| Token | Family · weight | Size/leading | Tracking | Colour | Used for |
|---|---|---|---|---|---|
| `displayL` | Newsreader 400 | 48/52 | −0.01em | text | Net worth on Overview |
| `displayM` | Newsreader 400 | 44/48 | −0.01em | text | Single account balance |
| `displayS` | Newsreader 400 | 40/44 | −0.01em | text | Total balance on Accounts |
| `titleL` | Newsreader 400 | 32/36 | 0 | text | Screen titles (More, Goals, Reports…) |
| `titleSerifXL` | Newsreader 400 | 36/40 | 0 | text | Titles on wide documentation boards only |
| `figureXL` | IBM Plex Sans 500 | 44/52 | −0.01em | text | Large amount entry (transfer) |
| `figureL` | IBM Plex Sans 500 | 32/40 | 0 | text | Amount entry (expense, budget) |
| `figureM` | IBM Plex Sans 500 | 22/28 | 0 | text | Card totals, goal progress |
| `figureS` | IBM Plex Sans 500 | 17/24 | 0 | text | Two-up summary cells |
| `titleM` | IBM Plex Sans 600 | 17/24 | 0 | text | Sheet and section titles, app bar titles |
| `h2` | IBM Plex Sans 600 | 15/20 | 0 | text | Card headings |
| `body` | IBM Plex Sans 400 | 15/22 | 0 | text | Default text, inputs |
| `bodyStrong` | IBM Plex Sans 600 | 15/22 | 0 | text | Button labels, emphasis |
| `figureRow` | IBM Plex Sans 500 | 14/20 | 0 | text | Amounts and titles in list rows |
| `bodyS` | IBM Plex Sans 400 | 13/18 | 0 | textSecond | Helper text, banners, key–value rows |
| `caption` | IBM Plex Sans 400 | 12/16 | 0 | textMeta | "Sample data", dates under titles |
| `label` | IBM Plex Sans 500 | 11/14 | +0.08em, UPPERCASE | textMeta | Section captions, table headers |
| `navLabel` | IBM Plex Sans 500 (600 when active) | 10.5/12 | 0 | `#9A9A9A`, dark on the light pill | Bottom navigation (every tab shows its label; hidden below 340dp) |
| `mono` | IBM Plex Mono 500 | 13/18 | 0 | text | Backup file names, timestamps |

Consolidation note for engineering: the canvas shows three serif display sizes (48, 44, 40) because each screen was tuned by eye. In the app, keep **two** (`displayL` 48 for Overview, `displayS` 40 for everything else) and drop `displayM`.

## 3. Numbers

All numerals, everywhere, use **tabular figures** (`FontFeature.tabularFigures()`), so digits line up in columns and amounts do not jitter when values change.

| Case | Format | Weight | Notes |
|---|---|---|---|
| Positive change / income | `+Rp7.000.000` | 600 | Leading plus |
| Negative / expense | `−Rp38.500` | 400 | True minus U+2212, not a hyphen |
| Transfer | `Rp1.000.000` | 400, textSecond | No sign |
| Percent | `57,53%` | same as amount | Two places, comma decimal |
| Change with percent | `+Rp3.243.000 · +57,53%` | 500 | Always followed by the comparison period in `caption` |
| Hidden | `Rp••••••••` | same | Same width class so layout does not jump |
| Table cells | `6,8` / `+0,4` | 400 | Rp millions, one decimal, right-aligned |

- Locale `id_ID`: dot as thousands separator, comma as decimal separator, no decimals for IDR.
- `Rp` is part of the amount, same size and weight. Exception: on amount entry the `Rp` prefix is smaller (18–22 dp) and `textSecond`, so the digits dominate.
- Never abbreviate in a figure (no "8,9jt") except inside chart axis labels and table headers marked "Rp million".
- Sign carries meaning. Never rely on colour to show gain or loss.

## 4. Hierarchy patterns

**Hero balance** (Overview)
`label` "NET WORTH" → `displayL` "Rp8.880.000" → `bodyS` change line "+Rp3.243.000 (+57,53%)" + `caption` "vs 30 Sep 2026".

**Summary card**
`label` caption above, `figureS` or `figureM` value below, `caption` explanation under.

**List row**
Line 1 `figureRow` (title, left; amount, right). Line 2 `caption` (category · account · date, left; type label right). Amounts are right-aligned and tabular.

**Form field**
`label` above the field. Value in `body`. Helper or error in `caption` (12/16). Error text is `negative` red, preceded by an icon, never colour alone.

**Table (chart companion)**
Header row `label`. Body rows `bodyS` with tabular figures, numbers right-aligned, totals in `bodyStrong` weight.

**Empty state**
`titleM` heading, `bodyS` description (max ~300 dp line length), one `bodyStrong` button label.

## 5. Contrast (on `bg` #0A0A0A, approximate)

| Colour | Ratio | Allowed for |
|---|---|---|
| text #F5F5F5 | ~18 : 1 | Everything |
| textSecond #A3A3A3 | ~8 : 1 | Secondary text, any size |
| textMeta #8A8A8A | ~5.6 : 1 (≈5.2 on card) | Captions and labels, any size |
| textDisabled #737373 | ~4.2 : 1 | **Disabled and placeholder only.** Fails AA for small text. |

`#8A8A8A` is a derived token added because the brief's `#737373` fails AA for small text. This is a deliberate deviation from the brief's palette and should be reviewed.

## 6. Rules

- Max two weights per screen region. Hierarchy comes from size and weight, not from italics, underline or colour.
- Underline is only for inline text links ("Back up", "Undo", "Reset all").
- Italics are not used anywhere.
- `label` is always uppercase with tracking. Don't uppercase anything else.
- No text below 11 dp, except `navLabel` (10.5 dp), which hides at large text sizes instead of shrinking. 11 dp is allowed only for `label`.
- Truncate with ellipsis only for names (account, merchant). Amounts, dates and labels that carry a number never truncate: the row grows instead.
- Support system text scale up to 200%. Rows have min-height, not fixed height. At large scale, key–value rows may wrap onto two lines (label above, value below).
- Don't centre-align amounts. Align to the right edge of the row, or to the start for hero figures.
- One serif moment per screen at most (title or hero balance, not both large), except Accounts and Overview, which pair a serif title with a serif hero number (per the design board).

## 7. React Native

```ts
// Android needs one font family name per weight, so never use fontWeight with these.
const UI = { regular: 'IBMPlexSans_400Regular', medium: 'IBMPlexSans_500Medium', semi: 'IBMPlexSans_600SemiBold' };
const SERIF = 'Newsreader_400Regular';
const MONO = 'IBMPlexMono_500Medium';
const tab = { fontVariant: ['tabular-nums'] } as const;

export const MonoText = {
  displayL: { fontFamily: SERIF, fontSize: 48, lineHeight: 52, letterSpacing: -0.48, ...tab },
  displayS: { fontFamily: SERIF, fontSize: 40, lineHeight: 44, letterSpacing: -0.4, ...tab },
  titleL: { fontFamily: SERIF, fontSize: 32, lineHeight: 36 },
  figureXL: { fontFamily: UI.medium, fontSize: 44, lineHeight: 52, letterSpacing: -0.44, ...tab },
  figureL: { fontFamily: UI.medium, fontSize: 32, lineHeight: 40, ...tab },
  figureM: { fontFamily: UI.medium, fontSize: 22, lineHeight: 28, ...tab },
  figureS: { fontFamily: UI.medium, fontSize: 17, lineHeight: 24, ...tab },
  figureRow: { fontFamily: UI.medium, fontSize: 14, lineHeight: 20, ...tab },
  titleM: { fontFamily: UI.semi, fontSize: 17, lineHeight: 24 },
  h2: { fontFamily: UI.semi, fontSize: 15, lineHeight: 20 },
  body: { fontFamily: UI.regular, fontSize: 15, lineHeight: 22, ...tab },
  bodyStrong: { fontFamily: UI.semi, fontSize: 15, lineHeight: 22 },
  bodyS: { fontFamily: UI.regular, fontSize: 13, lineHeight: 18, ...tab },
  caption: { fontFamily: UI.regular, fontSize: 12, lineHeight: 16, ...tab },
  label: { fontFamily: UI.medium, fontSize: 11, lineHeight: 14, letterSpacing: 0.88 },   // render text with toUpperCase()
  mono: { fontFamily: MONO, fontSize: 13, lineHeight: 18 },
} as const;
```

Colour is applied with a spread, for example `{ ...MonoText.body, color: MonoColors.textSecond }`, so the scale stays colour-neutral.

Font loading (`app/_layout.tsx`). The fonts ship inside the app bundle through the `@expo-google-fonts` packages, so nothing is fetched at runtime.

```ts
import { useFonts } from 'expo-font';
import { IBMPlexSans_400Regular, IBMPlexSans_500Medium, IBMPlexSans_600SemiBold } from '@expo-google-fonts/ibm-plex-sans';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import { Newsreader_400Regular } from '@expo-google-fonts/newsreader';

const [loaded] = useFonts({
  IBMPlexSans_400Regular, IBMPlexSans_500Medium, IBMPlexSans_600SemiBold,
  IBMPlexMono_500Medium, Newsreader_400Regular,
});
// keep the splash screen visible until loaded is true
```

Formatting helpers (`src/core/money.ts`)

```ts
const dots = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
export function rp(v: number, sign = false): string {
  const n = dots(Math.abs(v));
  if (v < 0) return `\u2212Rp${n}`;
  return sign && v > 0 ? `+Rp${n}` : `Rp${n}`;
}
// 6810 -> "68,10%". Integer maths only.
export function pct(bp: number): string {
  const a = Math.abs(bp);
  const s = `${Math.floor(a / 100)},${String(a % 100).padStart(2, '0')}%`;
  return bp < 0 ? `\u2212${s}` : s;
}
```

## 8. Open questions for you

1. Keep Newsreader for the hero balance and titles, or go all-IBM Plex Sans for a stricter look?
2. Keep the derived `#8A8A8A` for small text, or enforce the brief's palette and raise the minimum size of `#737373` text instead?
3. Collapse the display sizes to two (48 and 40) as suggested in section 2?

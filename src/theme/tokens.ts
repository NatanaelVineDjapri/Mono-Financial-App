import { DarkTheme } from 'expo-router';

// Strictly monochrome base, plus amber/green/red for graphics and sign. Twelve colour
// tokens total — colour is never the only signal (sign, icon and words always go with
// it). See DESIGN.md section 3.
export const MonoColors = {
  bg: '#0A0A0A', // app background
  surface: '#111111', // sunken areas, empty states
  card: '#171717', // cards, inputs
  raised: '#202020', // pressed, selected tiles
  text: '#F5F5F5', // primary text, icons
  textSecond: '#A3A3A3', // secondary text
  textMeta: '#8A8A8A', // small captions (AA 5.6:1)
  textDisabled: '#737373', // disabled and placeholder ONLY
  border: '#2B2B2B', // 1px hairlines
  accent: '#E3C27A', // graphics ONLY: chart's main series, progress fill, selected bar
  positive: '#4ADE80', // plus-signed amounts: income, net worth up, spending down
  negative: '#FF6B6B', // minus-signed amounts, spending up, over-budget, errors
} as const;

export const radius = { sm: 10, md: 12, lg: 16 } as const;

// Chart-only category colours (Fase 4.3c), not part of the 12 core tokens above —
// DESIGN.md section 3 rule 5 already allows an extra grey shade for a chart's own
// secondary series (e.g. "#6B6B6B") beyond the core palette; these are that same
// allowance, scoped to the Transactions ring chart's "largest category, then 3 more,
// then Others" colouring and never used for interactive UI. Colour is still never the
// only signal here — every slice's name, share and percent are also in the category
// list beneath the ring (CLAUDE.md rule 7's "exact-value table").
export const CHART_CATEGORY_COLORS = [MonoColors.accent, '#A3A3A3', '#737373', '#525252', '#3A3A3A'] as const;

export type AmountKind = 'income' | 'expense' | 'transfer';

// Colour follows meaning, the sign follows arithmetic (DESIGN.md section 3 rule 2):
// income is positive (green), expense is negative (red), a transfer is never coloured.
export function amountColor(kind: AmountKind): string {
  switch (kind) {
    case 'income':
      return MonoColors.positive;
    case 'expense':
      return MonoColors.negative;
    case 'transfer':
      return MonoColors.textSecond;
  }
}

// expo-router uses React Navigation's theme: override it once. The app has one palette
// (dark) only, so this is always applied regardless of system colour scheme.
export const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: MonoColors.bg,
    card: MonoColors.bg,
    text: MonoColors.text,
    border: MonoColors.border,
    primary: MonoColors.text,
    notification: MonoColors.text,
  },
};

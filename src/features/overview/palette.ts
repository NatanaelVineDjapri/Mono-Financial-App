// Overview-only colours (DESIGN.md "A. Overview"): the gold wave and icon discs, and the
// tints behind the change chip. The chip's text and triangle use the `positive` / `negative`
// tokens; the sign and the triangle always say up or down too. Inline here until the theme
// gains tokens for the gold shades.
import { CHART_CATEGORY_COLORS } from '@/theme/tokens';

export const GOLD_LIGHT = '#F0D9A3';
export const GOLD = '#C9A45C';
export const GOLD_DEEP = '#6E5427';
// The change chip's fill: a 14% tint of the sign colour behind its text.
export const CHIP_FILL_POSITIVE = 'rgba(74,222,128,0.14)'; // positive #4ADE80
export const CHIP_FILL_NEGATIVE = 'rgba(255,107,107,0.14)'; // negative #FF6B6B
export const EXPENSE_BAR = '#737373';
// "Where your money is" follows the same progression as the category bars in Transactions:
// gold first, then the same grey steps. The account name and amount remain beside each swatch.
export const SHARE_COLORS = CHART_CATEGORY_COLORS;

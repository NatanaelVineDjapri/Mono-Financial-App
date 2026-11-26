// Overview-only colours (DESIGN.md "A. Overview"): the silver wave and icon discs, and the
// tints behind the change chip. The chip's text and triangle use the `positive` / `negative`
// tokens; the sign and the triangle always say up or down too. Inline here until the theme
// gains tokens for the silver shades.
import { CHART_CATEGORY_COLORS } from '@/theme/tokens';

export const SILVER_LIGHT = '#E8ECF2';
export const SILVER = '#A9B1BC';
export const SILVER_DEEP = '#565E6A';
// The change chip's fill: a 14% tint of the sign colour behind its text.
export const CHIP_FILL_POSITIVE = 'rgba(74,222,128,0.14)'; // positive #4ADE80
export const CHIP_FILL_NEGATIVE = 'rgba(255,107,107,0.14)'; // negative #FF6B6B
export const EXPENSE_BAR = '#737373';
// "Where your money is" follows the same progression as the category bars in Transactions:
// silver first, then the darker steps. The account name and amount remain beside each swatch.
export const SHARE_COLORS = CHART_CATEGORY_COLORS;

// Overview-only colours (DESIGN.md "A. Overview"): the gold wave and icon discs, and the
// tints behind the change chip. The chip's text and triangle use the `positive` / `negative`
// tokens; the sign and the triangle always say up or down too. Inline here until the theme
// gains tokens for the gold shades.
export const GOLD_LIGHT = '#F0D9A3';
export const GOLD = '#C9A45C';
export const GOLD_DEEP = '#6E5427';
// The change chip's fill: a 14% tint of the sign colour behind its text.
export const CHIP_FILL_POSITIVE = 'rgba(74,222,128,0.14)'; // positive #4ADE80
export const CHIP_FILL_NEGATIVE = 'rgba(255,107,107,0.14)'; // negative #FF6B6B
export const EXPENSE_BAR = '#737373';
// "Where your money is": one grey per account, light to dark in order of size. The account
// name and amount are always on the row beside the swatch, so colour is never the only signal.
export const SHARE_COLORS = ['#F5F5F5', '#D4D4D4', '#A3A3A3', '#8A8A8A', '#737373', '#5C5C5C', '#525252', '#3A3A3A'] as const;

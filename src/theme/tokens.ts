import { DarkTheme } from 'expo-router';

// Strictly monochrome. Nine colour tokens only — no hue, ever. See DESIGN.md section 3.
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
} as const;

export const radius = { sm: 10, md: 12, lg: 16 } as const;

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

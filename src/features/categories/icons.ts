// The category icon registry. `categories.icon` stores a KEY from this list (never a path or a
// file name); an empty or unknown key falls back to 'dot'. Every glyph is a single stroked path on
// a 24 grid, drawn 22 px with a 1.5 stroke and round caps by CategoryIcon. The names the person
// sees (the label under each icon in the picker, read by screen readers) live in src/i18n.

export const CATEGORY_ICON_KEYS = [
  'food',
  'coffee',
  'car',
  'plane',
  'bag',
  'shirt',
  'bolt',
  'phone',
  'heart',
  'medical',
  'film',
  'home',
  'book',
  'education',
  'gift',
  'paw',
  'briefcase',
  'wallet',
  'tag',
  'dot',
] as const;

export type CategoryIconKey = (typeof CATEGORY_ICON_KEYS)[number];

export const DEFAULT_NEW_CATEGORY_ICON: CategoryIconKey = 'tag';
export const FALLBACK_CATEGORY_ICON: CategoryIconKey = 'dot';

export const CATEGORY_ICON_PATHS: Record<CategoryIconKey, string> = {
  food: 'M5 3 V8 a2 2 0 0 0 4 0 V3 M7 3 V21 M17 21 V3 C14 5 13.5 9.5 14 12.5 H17',
  coffee: 'M5 8 H16 V15 a4 4 0 0 1 -4 4 H9 a4 4 0 0 1 -4 -4 Z M16 10 H18 a2.5 2.5 0 0 1 0 5 H16 M8 3 V5 M12 3 V5',
  car: 'M4 14 L6 8 H18 L20 14 V18 H4 Z M4 14 H20 M7 18 V20.5 M17 18 V20.5 M7.5 16 V16.1 M16.5 16 V16.1',
  plane: 'M21 3 L3 10.5 L10 13 L12.5 20 Z M10 13 L21 3',
  bag: 'M5 8 H19 L18 20 H6 Z M9 8 V6 a3 3 0 0 1 6 0 V8',
  shirt: 'M8 3 L3 7 L6 10 L8 9 V20 H16 V9 L18 10 L21 7 L16 3 a4 4 0 0 1 -8 0 Z',
  bolt: 'M13 3 L5 14 H11 L10 21 L18 10 H12 Z',
  phone: 'M8 3 H16 V21 H8 Z M11 18 H13',
  heart: 'M12 20 C4 14 3 9 6 6.5 C8.5 4.5 11 5.5 12 8 C13 5.5 15.5 4.5 18 6.5 C21 9 20 14 12 20 Z',
  medical: 'M9 3 H15 V9 H21 V15 H15 V21 H9 V15 H3 V9 H9 Z',
  film: 'M4 5 H20 V19 H4 Z M8 5 V19 M16 5 V19 M4 9 H8 M4 13 H8 M4 17 H8 M16 9 H20 M16 13 H20 M16 17 H20',
  home: 'M3 11 L12 4 L21 11 M5 10 V20 H19 V10 M10 20 V14 H14 V20',
  book: 'M5 4 H18 V20 H7 a2 2 0 0 1 -2 -2 Z M5 18 a2 2 0 0 1 2 -2 H18',
  education: 'M2 9 L12 4 L22 9 L12 14 Z M6 11.5 V16 C8 18 16 18 18 16 V11.5 M22 9 V14',
  gift: 'M4 9 H20 V13 H4 Z M5 13 V20 H19 V13 M12 9 V20 M12 9 C9 9 8 4 11 4 C12.5 4 12 9 12 9 C12 9 11.5 4 13 4 C16 4 15 9 12 9',
  paw: 'M12 20 C8 20 6 17 8 14.5 C9.5 12.5 10.5 12 12 12 C13.5 12 14.5 12.5 16 14.5 C18 17 16 20 12 20 Z M5.5 10 a1.4 1.8 0 1 0 0.01 0 M9.5 6.5 a1.4 1.8 0 1 0 0.01 0 M14.5 6.5 a1.4 1.8 0 1 0 0.01 0 M18.5 10 a1.4 1.8 0 1 0 0.01 0',
  briefcase: 'M3 8 H21 V19 H3 Z M9 8 V5 H15 V8 M3 13 H21',
  wallet: 'M3 7 H21 V18 H3 Z M3 7 L5.5 4 H16 M16 11.5 H19.5 V14.5 H16 Z',
  tag: 'M3 12 V4 H11 L21 14 L14 21 Z M7.5 8 V8.1',
  dot: 'M12 9.5 a2.5 2.5 0 1 0 0.001 0 Z',
};

// A stored key -> a known key. Empty, null or unknown becomes 'dot'.
export function resolveCategoryIcon(key: string | null | undefined): CategoryIconKey {
  return key != null && (CATEGORY_ICON_KEYS as readonly string[]).includes(key) ? (key as CategoryIconKey) : FALLBACK_CATEGORY_ICON;
}

// DESIGN.md section 7: one line-icon set, 24 grid, 1.5 stroke, round caps/joins.
// Sizes 16 (inline), 18 (Overview's hide button), 20 (default), 22 (bottom nav), 26 (empty states), 28 (tab bar +). Colour always comes in via the
// `color` prop (a token from the caller) — never a literal hex in this file.
import { Platform } from 'react-native';
import { Circle, Path, Rect, Svg } from 'react-native-svg';

export type IconName =
  | 'check'
  | 'alert'
  | 'alert-circle'
  | 'close'
  | 'plus'
  | 'minus'
  | 'chevron-down'
  | 'chevron-right'
  | 'eye'
  | 'eye-off'
  // Tab bar (DESIGN.md section 9): Overview, Transactions (flow), Accounts (bank),
  // Budgets (pie), More (dots).
  | 'overview'
  | 'flow'
  | 'bank'
  | 'pie'
  | 'dots'
  // Accounts tab (DESIGN.md "D. Accounts"): Transfer between accounts, the no-bank-login
  // footer note.
  | 'transfer'
  | 'lock'
  // Transactions tab (DESIGN.md "B. Transactions"): the search field and the Filters button.
  | 'search'
  | 'filter'
  // Transactions tab: a row's own leading icon. Generic by kind (income/expense), not yet
  // per-category — see transactions.tsx's txIcon() for why.
  | 'receipt'
  | 'wallet'
  // Accounts tab (Fase 4.2c): the "Exchange rates" row.
  | 'refresh'
  // Transactions tab (Tx-Filters, B2): the date range's own two date fields.
  | 'calendar'
  // Budgets (Fase 4.4): month selector "previous", back, and the edit actions.
  | 'chevron-left'
  | 'pencil'
  // Overview (R3): header bell, the month cards' arrow discs.
  | 'bell'
  | 'arrow-down'
  | 'arrow-up'
  // Transaction detail: delete, and the Food & drink category tile.
  | 'trash'
  | 'food'
  // The + menu: AI chat and receipt scan (Manual uses 'pencil').
  | 'chat'
  | 'scan'
  // The receipt camera: flash, and the gallery.
  | 'flash'
  | 'image'
  // "Rapikan dengan AI"
  | 'spark'
  // The transaction form's transfer banner.
  | 'info'
  // Account form: the type tiles (Bank uses 'bank', Savings 'savings').
  | 'banknote'
  | 'phone'
  | 'savings'
  // More (menu rows): goals, reports, categories, backup and restore, settings.
  | 'target'
  | 'file-text'
  | 'tag'
  | 'database'
  | 'download'
  | 'slider'
  // Categories: archive and restore.
  | 'archive'
  | 'undo';

export interface IconProps {
  name: IconName;
  size?: 16 | 18 | 20 | 22 | 24 | 26 | 28;
  // Stroke width on the 24 grid. Default 1.5; the tab bar's centre "+" uses 2. Applies to the
  // single-path glyphs (plus, chevrons, …).
  strokeWidth?: number;
  color: string;
  // When the icon is the only signal (no adjacent label), pass a label and it is exposed
  // to screen readers. Omitted = decorative: hidden, since the icon sits next to text that
  // already says the same thing.
  label?: string;
  testID?: string;
}

// Icons whose glyph is a single stroked path. The handful that need more than one
// shape (overview, pie, dots) are drawn directly in `renderGlyph` below instead.
const PATHS: Partial<Record<IconName, string>> = {
  check: 'M5 13 L10 18 L19 6',
  alert: 'M12 3 L22 20 L2 20 Z M12 9 L12 14 M12 17.5 L12 17.5',
  'alert-circle': 'M12 3 a9 9 0 1 0 0.001 0 Z M12 8 L12 13 M12 16.5 L12 16.5',
  close: 'M6 6 L18 18 M18 6 L6 18',
  plus: 'M12 5 L12 19 M5 12 L19 12',
  minus: 'M5 12 L19 12',
  'chevron-down': 'M6 9 L12 15 L18 9',
  'chevron-right': 'M9 6 L15 12 L9 18',
  eye: 'M1 12 C4 5 20 5 23 12 C20 19 4 19 1 12 Z M12 9 a3 3 0 1 0 0.001 0 Z',
  'eye-off': 'M1 12 C4 5 20 5 23 12 C20 19 4 19 1 12 Z M12 9 a3 3 0 1 0 0.001 0 Z M3 3 L21 21',
  flow: 'M7 4v16M7 4L3.5 7.5M7 4l3.5 3.5M17 20V4M17 20l-3.5-3.5M17 20l3.5-3.5',
  bank: 'M3 9.5L12 4l9 5.5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20.5h18',
  transfer: 'M4 8 L17 8 M13 4 L17 8 L13 12 M20 16 L7 16 M11 12 L7 16 L11 20',
  lock: 'M6 11 h12 v9 h-12 Z M8 11 V7 a4 4 0 0 1 8 0 v4',
  filter: 'M4 5 H20 L14 13 V19 L10 21 V13 Z',
  receipt: 'M5 3 H19 V21 L16 19.5 L13 21 L10 19.5 L7 21 L5 19.5 Z M8 8 H16 M8 12 H16 M8 16 H13',
  wallet: 'M3 7 H21 V18 H3 Z M3 7 L5.5 4 H16 M16 11.5 H19.5 V14.5 H16 Z',
  refresh: 'M3 12 a9 9 0 0 1 15 -6.7 L21 8 M21 3 V8 H16 M21 12 a9 9 0 0 1 -15 6.7 L3 16 M3 21 V16 H8',
  calendar: 'M4 5 H20 V20 H4 Z M4 9 H20 M8 3 V7 M16 3 V7',
  'chevron-left': 'M15 6 L9 12 L15 18',
  bell: 'M6 16 V11 a6 6 0 0 1 12 0 V16 L19.5 18 H4.5 Z M10 21 H14',
  'arrow-down': 'M12 5 V19 M6 13 L12 19 L18 13',
  'arrow-up': 'M12 19 V5 M6 11 L12 5 L18 11',
  food: 'M5 3 V8 a2 2 0 0 0 4 0 V3 M7 3 V21 M17 21 V3 C14 5 13.5 9.5 14 12.5 H17',
  banknote: 'M3 7 H21 V17 H3 Z M12 9.5 a2.5 2.5 0 1 0 0.001 0 Z M6.5 12 V12.1 M17.5 12 V12.1',
  phone: 'M8 3 H16 V21 H8 Z M11 18 H13',
  savings: 'M6 20 V13 M12 20 V8 M18 20 V4 M4 20 H20',
  info: 'M12 3 a9 9 0 1 0 0.001 0 Z M12 11 V16.5 M12 7.5 V7.6',
  chat: 'M4 5 H20 V16 H11 L6 20 V16 H4 Z M8 9.5 H16 M8 12.5 H13',
  scan: 'M4 8 V4 H8 M16 4 H20 V8 M20 16 V20 H16 M8 20 H4 V16 M4 12 H20',
  flash: 'M13 3 L5 14 H11 L10 21 L18 10 H12 Z',
  spark: 'M12 3 L13.8 8.2 L19 10 L13.8 11.8 L12 17 L10.2 11.8 L5 10 L10.2 8.2 Z M18 16 L18.8 18.2 L21 19 L18.8 19.8 L18 22 L17.2 19.8 L15 19 L17.2 18.2 Z',
  image: 'M4 5 H20 V19 H4 Z M4 17 L9 12 L13 16 L16 13 L20 17 M9 9.5 a1.5 1.5 0 1 0 0.001 0 Z',
  trash: 'M4 7 H20 M9 7 V4 H15 V7 M6 7 L7 20 H17 L18 7 M10 11 V16 M14 11 V16',
  target: 'M12 3 a9 9 0 1 0 0.001 0 Z M12 8 a4 4 0 1 0 0.001 0 Z M12 12 V12.1',
  'file-text': 'M6 3 H14 L19 8 V21 H6 Z M14 3 V8 H19 M9 13 H16 M9 17 H15',
  tag: 'M3 12 V4 H11 L21 14 L14 21 Z M7.5 8 V8.1',
  download: 'M12 4 V15 M7 10 L12 15 L17 10 M5 20 H19',
  database: 'M4 6 C4 4 20 4 20 6 C20 8 4 8 4 6 Z M4 6 V18 C4 20 20 20 20 18 V6 M4 12 C4 14 20 14 20 12',
  slider: 'M4 7 H13 M17 7 H20 M4 17 H7 M11 17 H20 M15 4.5 V9.5 M9 14.5 V19.5',
  archive: 'M3 5 H21 V9 H3 Z M5 9 V19 H19 V9 M10 13 H14',
  undo: 'M9 14 L4 9 L9 4 M4 9 H15 a5 5 0 0 1 0 10 H8',
  pencil: 'M4 20 L4.5 16 L15.5 5 a2.1 2.1 0 0 1 3 3 L7.5 19 Z M13.5 7 L17 10.5',
};

function renderGlyph(name: IconName, color: string, strokeWidth: number) {
  const d = PATHS[name];
  if (d) {
    return <Path d={d} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />;
  }
  switch (name) {
    case 'overview':
      return (
        <>
          <Rect x={4} y={4} width={7} height={9} rx={1.5} stroke={color} strokeWidth={1.5} />
          <Rect x={13} y={4} width={7} height={5} rx={1.5} stroke={color} strokeWidth={1.5} />
          <Rect x={13} y={11} width={7} height={9} rx={1.5} stroke={color} strokeWidth={1.5} />
          <Rect x={4} y={15} width={7} height={5} rx={1.5} stroke={color} strokeWidth={1.5} />
        </>
      );
    case 'pie':
      return (
        <>
          <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.5} />
          <Path d="M12 3v9h9" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'dots':
      return (
        <>
          <Circle cx={5} cy={12} r={1.2} fill={color} />
          <Circle cx={12} cy={12} r={1.2} fill={color} />
          <Circle cx={19} cy={12} r={1.2} fill={color} />
        </>
      );
    case 'search':
      return (
        <>
          <Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={1.5} />
          <Path d="M21 21 L16.3 16.3" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
        </>
      );
    default:
      return null;
  }
}

// react-native-svg's <Svg> doesn't translate RN-only accessibility props for web the
// way react-native-web's own host components do — `accessible`, accessibilityElementsHidden
// (iOS) and importantForAccessibility (Android) all get forwarded to the DOM as literal
// attributes there, and React warns on each one. So web gets only accessibilityLabel
// (which does translate, to aria-label); every other prop here is native-only.
function accessibilityProps(label: string | undefined): Record<string, unknown> {
  if (Platform.OS === 'web') return { accessibilityLabel: label };
  return {
    accessible: !!label,
    accessibilityLabel: label,
    ...Platform.select<Record<string, unknown>>({
      ios: { accessibilityElementsHidden: !label },
      android: { importantForAccessibility: label ? 'yes' : 'no' },
      default: {},
    }),
  };
}

export function Icon({ name, size = 20, color, strokeWidth = 1.5, label, testID }: IconProps) {
  return (
    <Svg testID={testID} width={size} height={size} viewBox="0 0 24 24" fill="none" {...accessibilityProps(label)}>
      {renderGlyph(name, color, strokeWidth)}
    </Svg>
  );
}

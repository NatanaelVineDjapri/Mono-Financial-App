import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { MoreData } from '@/features/more/useMoreData';
import { useMoreData } from '@/features/more/useMoreData';
import { useLanguageSetting } from '@/features/settings/useLanguageSetting';
import { languageChoiceEnabled, useLanguage } from '@/i18n/lang';

import MoreScreen from '../more';

jest.mock('@/features/more/useMoreData');
jest.mock('@/features/settings/useLanguageSetting');
jest.mock('@/i18n/lang', () => ({ ...jest.requireActual('@/i18n/lang'), languageChoiceEnabled: jest.fn(() => true) }));
const mockUseMoreData = useMoreData as jest.MockedFunction<typeof useMoreData>;
const mockUseLanguageSetting = useLanguageSetting as jest.MockedFunction<typeof useLanguageSetting>;
const mockChangeLanguage = jest.fn();

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

let mockVersion: string | undefined = '1.0.0';
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return mockVersion === undefined ? null : { version: mockVersion };
    },
  },
}));

const METRICS = { insets: { top: 0, left: 0, right: 0, bottom: 34 }, frame: { x: 0, y: 0, width: 390, height: 844 } };
const RECENT: MoreData = { backup: { kind: 'recent', whenText: '21 Okt 2026, 20.14 WIB' }, dueCount: 0 };

function renderMore(data: MoreData = RECENT) {
  mockUseMoreData.mockReturnValue(data);
  return render(<SafeAreaProvider initialMetrics={METRICS}>{<MoreScreen />}</SafeAreaProvider>);
}

const HIDDEN = { includeHiddenElements: true };
const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

beforeEach(() => {
  jest.clearAllMocks();
  mockVersion = '1.0.0';
  (languageChoiceEnabled as jest.Mock).mockReturnValue(true);
  mockUseLanguageSetting.mockImplementation(() => ({ language: useLanguage.getState().language, change: mockChangeLanguage }));
});

describe('structure', () => {
  test('the title and the two group labels are headers', async () => {
    const screen = await renderMore();
    expect(screen.getByRole('header', { name: 'More' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'UANG' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'DATA DAN APLIKASI' })).toBeTruthy();
  });

  test('the rows, in order, with their subtitles', async () => {
    const screen = await renderMore();
    for (const text of [
      'Target keuangan',
      'Target dari saldo nyata',
      'Pengeluaran tetap',
      'Gym, internet, langganan',
      'Laporan',
      'Arus kas, pengeluaran, kekayaan bersih, ekspor CSV',
      'Kategori',
      'Kategori pemasukan dan pengeluaran',
      'Cadangan dan pemulihan',
      'Ekspor atau pulihkan cadangan JSON, ekspor CSV',
      'Pengaturan',
      'Mata uang, privasi, format, tentang',
    ]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
  });

  test('a row is at least 64 high and its label reads title and subtitle', async () => {
    const screen = await renderMore();
    const row = screen.getByTestId('more-goals');
    expect(flat(row.props.style).minHeight).toBeGreaterThanOrEqual(64);
    expect(row.props.accessibilityRole).toBe('button');
    expect(row.props.accessibilityLabel).toBe('Target keuangan, Target dari saldo nyata');
  });

  test('the last row of a card has no separator', async () => {
    const screen = await renderMore();
    expect(flat(screen.getByTestId('more-goals').props.style).borderBottomWidth).toBe(1);
    expect(flat(screen.getByTestId('more-categories').props.style).borderBottomWidth).toBeUndefined();
    expect(flat(screen.getByTestId('more-settings').props.style).borderBottomWidth).toBeUndefined();
  });

  test('no amount of money is shown, so hidden-amounts mode has nothing to hide', async () => {
    const screen = await renderMore({ backup: { kind: 'recent', whenText: '21 Okt 2026, 20.14 WIB' }, dueCount: 2 });
    expect(screen.queryByText(/Rp/)).toBeNull();
  });

  test('the footer: the lockup and the line with the version read from the app config', async () => {
    const screen = await renderMore();
    expect(screen.getByLabelText('MONO Finance')).toBeTruthy();
    expect(screen.getByText('Versi 1.0.0 · Bekerja offline · Tanpa akun, tanpa sinkron')).toBeTruthy();
  });

  test('a different version in the config shows up; without one the version is left out, never invented', async () => {
    mockVersion = '2.3.4';
    const a = await renderMore();
    expect(a.getByText('Versi 2.3.4 · Bekerja offline · Tanpa akun, tanpa sinkron')).toBeTruthy();
    mockVersion = undefined;
    const b = await renderMore();
    expect(b.getByText('Bekerja offline · Tanpa akun, tanpa sinkron')).toBeTruthy();
  });

  test('there is no tab bar on this screen', async () => {
    const screen = await renderMore();
    expect(screen.queryByTestId('tab-bar')).toBeNull();
  });
});

describe('the language choice is switched off for now', () => {
  test('with the choice off there is no Language group and no selector', async () => {
    (languageChoiceEnabled as jest.Mock).mockReturnValue(false);
    const screen = await renderMore();
    expect(screen.queryByTestId('language-selector')).toBeNull();
    expect(screen.queryByRole('header', { name: 'BAHASA' })).toBeNull();
    expect(screen.queryByRole('header', { name: 'LANGUAGE' })).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Bahasa Indonesia' })).toBeNull();
  });
});

describe('language', () => {
  test('a language group with English and Bahasa Indonesia; the current one is selected', async () => {
    useLanguage.setState({ language: 'id' });
    const screen = await renderMore();
    expect(screen.getByRole('header', { name: 'BAHASA' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'English' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Bahasa Indonesia' }).props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByRole('radio', { name: 'English' }).props.accessibilityState).toMatchObject({ selected: false });
  });

  test('choosing the other language calls the setting, whichever way', async () => {
    useLanguage.setState({ language: 'id' });
    const a = await renderMore();
    await fireEvent.press(a.getByRole('radio', { name: 'English' }));
    expect(mockChangeLanguage).toHaveBeenLastCalledWith('en');

    useLanguage.setState({ language: 'en' });
    const b = await renderMore();
    await fireEvent.press(b.getByRole('radio', { name: 'Bahasa Indonesia' }));
    expect(mockChangeLanguage).toHaveBeenLastCalledWith('id');
  });

  test('in English the whole screen reads English: title, groups, rows, card and footer', async () => {
    useLanguage.setState({ language: 'en' });
    const screen = await renderMore({ backup: { kind: 'recent', whenText: '21 Oct 2026, 20:14 WIB' }, dueCount: 1 });
    for (const text of [
      'More',
      'Stored only on this device',
      'Last backup 21 Oct 2026, 20:14 WIB',
      'MONEY',
      'Financial goals',
      'Targets measured from real balances',
      'Fixed expenses',
      'Gym, internet, subscriptions · 1 due',
      'Reports',
      'Categories',
      'DATA AND APP',
      'Backup and restore',
      'Settings',
      'LANGUAGE',
      'Version 1.0.0 · Works offline · No account, no sync',
    ]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    expect(screen.getByRole('button', { name: 'Back to Overview' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back up now' })).toBeTruthy();
    expect(screen.queryByText(/Cadangan|Pengaturan|Kategori|Laporan/)).toBeNull();
  });
});

describe('the back arrow', () => {
  test('one button "Overview", at least 44 × 44, labelled "Kembali ke Overview", goes back', async () => {
    const screen = await renderMore();
    const back = screen.getByRole('button', { name: 'Kembali ke Overview' });
    expect(screen.getByText('Overview')).toBeTruthy();
    const style = flat(back.props.style);
    expect(style.minHeight).toBeGreaterThanOrEqual(44);
    expect(style.minWidth).toBeGreaterThanOrEqual(44);
    await fireEvent.press(back);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});

describe('the backup status card (three states)', () => {
  test('never backed up: "Belum ada cadangan" with a warning icon', async () => {
    const screen = await renderMore({ backup: { kind: 'none' }, dueCount: 0 });
    expect(screen.getByText('Disimpan hanya di perangkat ini')).toBeTruthy();
    expect(screen.getByText('Belum ada cadangan')).toBeTruthy();
    expect(screen.getByTestId('backup-warning-icon', HIDDEN)).toBeTruthy();
  });

  test('older than 30 days: the number of days, with a warning icon', async () => {
    const screen = await renderMore({ backup: { kind: 'old', days: 45 }, dueCount: 0 });
    expect(screen.getByText('Cadangan terakhir 45 hari lalu')).toBeTruthy();
    expect(screen.getByTestId('backup-warning-icon', HIDDEN)).toBeTruthy();
  });

  test('recent: the date and time, and no warning icon', async () => {
    const screen = await renderMore();
    expect(screen.getByText('Cadangan terakhir 21 Okt 2026, 20.14 WIB')).toBeTruthy();
    expect(screen.queryByTestId('backup-warning-icon', HIDDEN)).toBeNull();
  });

  test('every state has an icon or a sentence of its own: colour is never the only signal', async () => {
    for (const backup of [{ kind: 'none' }, { kind: 'old', days: 31 }] as const) {
      const screen = await renderMore({ backup, dueCount: 0 });
      expect(screen.getByTestId('backup-warning-icon', HIDDEN)).toBeTruthy();
      expect(screen.getByTestId('backup-line').props.children).toBeTruthy();
    }
  });

  test('the way to back up is a download icon button, at least 44 × 44, that opens /backup', async () => {
    const screen = await renderMore();
    const action = screen.getByRole('button', { name: 'Cadangkan sekarang' });
    const style = flat(action.props.style);
    expect(style.minHeight).toBeGreaterThanOrEqual(44);
    expect(style.minWidth).toBeGreaterThanOrEqual(44);
    expect(screen.queryByText('Cadangkan')).toBeNull(); // an icon, not a word
    await fireEvent.press(action);
    expect(mockPush).toHaveBeenCalledWith('/backup');
  });

  test('the card has the same side padding (16) and gap (14) as the rows, so its text starts where theirs does', async () => {
    const screen = await renderMore();
    expect(flat(screen.getByTestId('backup-card').props.style)).toMatchObject({ paddingHorizontal: 16, gap: 14 });
    expect(flat(screen.getByTestId('more-goals').props.style)).toMatchObject({ paddingHorizontal: 16, gap: 14 });
  });

  test('the lock sits on the same 40 tile as the icons of the rows (radius 14, raised fill, 1 px border)', async () => {
    const screen = await renderMore();
    const lock = flat(screen.getByTestId('backup-lock-tile').props.style);
    const goals = flat(screen.getByTestId('more-goals-tile').props.style);
    expect(lock).toMatchObject({ width: 40, height: 40, borderRadius: 14, borderWidth: 1 });
    expect(lock.backgroundColor).toBeTruthy();
    expect(lock).toEqual(goals); // the very same tile
  });

  test('the card is 20 round, 14 high padding and at least 64 high', async () => {
    const screen = await renderMore();
    expect(flat(screen.getByTestId('backup-card').props.style)).toMatchObject({ paddingVertical: 14, minHeight: 64, borderRadius: 20 });
  });
});

describe('fixed expenses due', () => {
  test('"n jatuh tempo" appears only when something is due', async () => {
    const none = await renderMore({ ...RECENT, dueCount: 0 });
    expect(none.getByText('Gym, internet, langganan')).toBeTruthy();
    expect(none.queryByText(/jatuh tempo/)).toBeNull();

    const due = await renderMore({ ...RECENT, dueCount: 1 });
    expect(due.getByText('Gym, internet, langganan · 1 jatuh tempo')).toBeTruthy();
    const many = await renderMore({ ...RECENT, dueCount: 3 });
    expect(many.getByText('Gym, internet, langganan · 3 jatuh tempo')).toBeTruthy();
  });

  test('a screen reader hears it too', async () => {
    const screen = await renderMore({ ...RECENT, dueCount: 2 });
    expect(screen.getByTestId('more-recurring').props.accessibilityLabel).toBe('Pengeluaran tetap, Gym, internet, langganan · 2 jatuh tempo');
  });
});

describe('every row goes to its own screen', () => {
  test.each([
    ['more-goals', '/goals'],
    ['more-recurring', '/recurring'],
    ['more-reports', '/reports'],
    ['more-categories', '/categories'],
    ['more-backup', '/backup'],
    ['more-settings', '/settings'],
  ])('%s opens %s', async (testID, route) => {
    const screen = await renderMore();
    await fireEvent.press(screen.getByTestId(testID));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith(route);
  });

  test('the Dev tools row exists in __DEV__ and opens /dev', async () => {
    const screen = await renderMore();
    expect(screen.getByText('Dev tools')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('more-dev'));
    expect(mockPush).toHaveBeenCalledWith('/dev');
  });
});

describe('the screen reads fresh data each time it is shown', () => {
  test('it renders what useMoreData gives now: a new backup shows when it returns', async () => {
    const before = await renderMore({ backup: { kind: 'none' }, dueCount: 0 });
    expect(before.getByText('Belum ada cadangan')).toBeTruthy();
    const after = await renderMore();
    expect(after.getByText('Cadangan terakhir 21 Okt 2026, 20.14 WIB')).toBeTruthy();
  });
});

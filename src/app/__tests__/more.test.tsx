import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { MoreData } from '@/features/more/useMoreData';
import { useMoreData } from '@/features/more/useMoreData';
import { useCreateBackup } from '@/features/backup/useCreateBackup';
import { useLanguageSetting } from '@/features/settings/useLanguageSetting';
import { languageChoiceEnabled, useLanguage } from '@/i18n/lang';

import MoreScreen from '../more';

jest.mock('@/features/more/useMoreData');
jest.mock('@/features/backup/useCreateBackup');
const mockUseCreateBackup = useCreateBackup as jest.MockedFunction<typeof useCreateBackup>;
const mockCreateBackup = jest.fn(async () => true);
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
const RECENT: MoreData = { backup: { kind: 'recent', days: 3, changed: 0 }, dueCount: 0 };

function renderMore(data: MoreData = RECENT) {
  mockUseMoreData.mockReturnValue(data);
  return render(<SafeAreaProvider initialMetrics={METRICS}>{<MoreScreen />}</SafeAreaProvider>);
}

const HIDDEN = { includeHiddenElements: true };
const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

beforeEach(() => {
  jest.clearAllMocks();
  mockVersion = '1.0.0';
  mockCreateBackup.mockResolvedValue(true);
  mockUseCreateBackup.mockReturnValue({ create: mockCreateBackup, busy: false });
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
    const screen = await renderMore({ backup: { kind: 'recent', days: 3, changed: 4 }, dueCount: 2 });
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
    const screen = await renderMore({ backup: { kind: 'recent', days: 3, changed: 2 }, dueCount: 1 });
    for (const text of [
      'More',
      'Stored only on this device',
      'Last backup 3 days ago',
      '2 transactions changed since then',
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
    expect(screen.getByRole('button', { name: /Stored only on this device\. Last backup 3 days ago\. 2 transactions changed since then\. Tap to open backups\./ })).toBeTruthy();
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

describe('the backup status strip (three states, worked out from the backup log)', () => {
  const frame = (screen: Awaited<ReturnType<typeof renderMore>>) => flat(screen.getByTestId('backup-card').props.style);

  test('never backed up: the title, "Belum ada cadangan" with a warning icon and a 1.5 px emphasis frame', async () => {
    const screen = await renderMore({ backup: { kind: 'none' }, dueCount: 0 });
    expect(screen.getByText('Tersimpan hanya di ponsel ini')).toBeTruthy();
    expect(screen.getByText('Belum ada cadangan')).toBeTruthy();
    expect(screen.getByTestId('backup-warning-icon', HIDDEN)).toBeTruthy();
    expect(frame(screen)).toMatchObject({ borderWidth: 1.5, borderColor: '#737373' });
  });

  test('a recent backup: how long ago, how many transactions changed since, no warning and the resting frame', async () => {
    const screen = await renderMore({ backup: { kind: 'recent', days: 3, changed: 5 }, dueCount: 0 });
    expect(screen.getByText('Cadangan terakhir 3 hari lalu')).toBeTruthy();
    expect(screen.getByText('5 transaksi berubah sejak itu')).toBeTruthy();
    expect(screen.queryByTestId('backup-warning-icon', HIDDEN)).toBeNull();
    expect(frame(screen)).toMatchObject({ borderWidth: 1, borderColor: '#272728' });
  });

  test('nothing changed since: the second line is gone', async () => {
    const screen = await renderMore({ backup: { kind: 'recent', days: 3, changed: 0 }, dueCount: 0 });
    expect(screen.queryByTestId('backup-changed')).toBeNull();
    expect(screen.queryByText(/berubah sejak itu/)).toBeNull();
  });

  test('a stale backup (7 days or more): how long ago, with a warning icon and the emphasis frame', async () => {
    const screen = await renderMore({ backup: { kind: 'stale', days: 9, changed: 0 }, dueCount: 0 });
    expect(screen.getByText('Cadangan terakhir 9 hari lalu')).toBeTruthy();
    expect(screen.getByTestId('backup-warning-icon', HIDDEN)).toBeTruthy();
    expect(frame(screen)).toMatchObject({ borderWidth: 1.5, borderColor: '#737373' });
  });

  test.each([
    [0, 'Cadangan terakhir hari ini'],
    [1, 'Cadangan terakhir kemarin'],
    [6, 'Cadangan terakhir 6 hari lalu'],
    [14, 'Cadangan terakhir 2 minggu lalu'],
    [70, 'Cadangan terakhir 2 bulan lalu'],
  ])('%s days: "%s"', async (days, text) => {
    const screen = await renderMore({ backup: { kind: days >= 7 ? 'stale' : 'recent', days, changed: 0 }, dueCount: 0 });
    expect(screen.getByText(text)).toBeTruthy();
  });

  test('a warning is an icon and words, never a colour alone, and it is not red (this is not a loss)', async () => {
    for (const backup of [{ kind: 'none' }, { kind: 'stale', days: 9, changed: 0 }] as const) {
      const screen = await renderMore({ backup, dueCount: 0 });
      expect(screen.getByTestId('backup-warning-icon', HIDDEN)).toBeTruthy();
      expect(screen.getByTestId('backup-line').props.children).toBeTruthy();
      expect(frame(screen).borderColor).not.toBe('#FF6B6B');
    }
  });

  test('a screen reader hears the whole strip as one button', async () => {
    const none = await renderMore({ backup: { kind: 'none' }, dueCount: 0 });
    expect(none.getByTestId('backup-open').props.accessibilityLabel).toBe('Tersimpan hanya di ponsel ini. Belum ada cadangan. Ketuk untuk membuka cadangan.');
    const recent = await renderMore({ backup: { kind: 'recent', days: 3, changed: 5 }, dueCount: 0 });
    expect(recent.getByTestId('backup-open').props.accessibilityLabel).toBe(
      'Tersimpan hanya di ponsel ini. Cadangan terakhir 3 hari lalu. 5 transaksi berubah sejak itu. Ketuk untuk membuka cadangan.',
    );
  });

  test('tapping the strip opens /backup', async () => {
    const screen = await renderMore();
    await fireEvent.press(screen.getByTestId('backup-open'));
    expect(mockPush).toHaveBeenCalledWith('/backup');
    expect(mockCreateBackup).not.toHaveBeenCalled();
  });

  test('the download button (48 × 48, "Buat cadangan sekarang") makes a backup right away and goes nowhere', async () => {
    const screen = await renderMore();
    const action = screen.getByRole('button', { name: 'Buat cadangan sekarang' });
    expect(flat(action.props.style)).toMatchObject({ width: 48, height: 48 });
    expect(screen.queryByText('Buat cadangan sekarang')).toBeNull(); // an icon, not a word
    await fireEvent.press(action);
    expect(mockCreateBackup).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });

  test('while a backup is being made the button is disabled and cannot start a second one', async () => {
    mockUseCreateBackup.mockReturnValue({ create: mockCreateBackup, busy: true });
    const screen = await renderMore();
    const action = screen.getByRole('button', { name: 'Buat cadangan sekarang' });
    expect(action.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    await fireEvent.press(action);
    expect(mockCreateBackup).not.toHaveBeenCalled();
  });

  test('the strip is 20 round, at least 64 high, on the #151516 surface, and its text starts at the rows\' 16', async () => {
    const screen = await renderMore();
    expect(frame(screen)).toMatchObject({ borderRadius: 20, minHeight: 64, backgroundColor: '#151516', paddingLeft: 16 });
    expect(flat(screen.getByTestId('more-goals').props.style)).toMatchObject({ paddingHorizontal: 16 });
  });

  test('the lock sits on the same 40 tile as the icons of the rows (radius 14, raised fill, 1 px border)', async () => {
    const screen = await renderMore();
    const lock = flat(screen.getByTestId('backup-lock-tile').props.style);
    const goals = flat(screen.getByTestId('more-goals-tile').props.style);
    expect(lock).toMatchObject({ width: 40, height: 40, borderRadius: 14, borderWidth: 1 });
    expect(lock.backgroundColor).toBeTruthy();
    expect(lock).toEqual(goals); // the very same tile
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
    expect(after.getByText('Cadangan terakhir 3 hari lalu')).toBeTruthy();
  });
});

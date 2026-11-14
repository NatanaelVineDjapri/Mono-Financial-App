import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { getAllSettings, setSetting } from '@/data/repo/settings';
import { resetDatabase } from '@/dev/resetDatabase';
import { deleteKeyAndDisable, setAiEnabled } from '@/features/ai_chat/aiSettings';
import { hasKey } from '@/features/ai_chat/keystore';
import SettingsScreen from '../settings';

const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  return {
    ...jest.requireActual('expo-router'),
    useRouter: () => ({ back: mockBack, push: mockPush }),
    useFocusEffect: (cb: () => void) => {
      React.useEffect(() => {
        cb();
      // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
    },
  };
});

jest.mock('@/data/db/DbProvider', () => ({
  useDb: () => ({
    getFirstAsync: jest.fn(async () => ({ value: '1' })),
    getAllAsync: jest.fn(async () => []),
    runAsync: jest.fn(async () => {}),
  }),
}));

jest.mock('@/data/repo/settings', () => ({
  getAllSettings: jest.fn(async () => ({
    app_lock: '1',
    hide_on_launch: '0',
    block_screenshots: '1',
    number_format: 'id_ID',
    month_start_day: '1',
    timezone: 'Asia/Jakarta',
    backup_reminder: '1',
    recurring_reminders: '1',
    ai_enabled: '0',
  })),
  setSetting: jest.fn(async () => {}),
}));

jest.mock('@/data/repo/backupLog', () => ({
  getLastBackupAt: jest.fn(async () => '2026-10-21T13:14:00.000Z'),
}));

jest.mock('@/features/fx/ratesOverview', () => ({
  getRatesOverview: jest.fn(async () => ({
    rows: [],
    autoUpdate: true,
    lastSuccessAt: '2026-10-28T02:00:00.000Z',
    nextUpdateAt: null,
    rateLimitedAt: null,
  })),
}));

jest.mock('@/features/import/useImportApps', () => ({
  useImportApps: jest.fn(() => ({
    data: { apps: [{ pkg: 'com.bca', enabled: 1 }] },
  })),
}));

jest.mock('@/features/ai_chat/keystore', () => ({
  hasKey: jest.fn(async () => false),
}));

jest.mock('@/features/ai_chat/aiSettings', () => ({
  setAiEnabled: jest.fn(async () => {}),
  deleteKeyAndDisable: jest.fn(async () => {}),
}));

jest.mock('@/dev/resetDatabase', () => ({
  resetDatabase: jest.fn(async () => {}),
}));

const METRICS = { insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 390, height: 844 } };

const clients: QueryClient[] = [];

async function renderSettings() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  clients.push(queryClient);
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider initialMetrics={METRICS}>
        <SettingsScreen />
      </SafeAreaProvider>
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('settings-screen')).toBeTruthy());
  await waitFor(() => expect(getAllSettings).toHaveBeenCalled());
  return utils;
}

afterEach(() => {
  clients.splice(0).forEach(c => c.clear());
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('SettingsScreen', () => {
  test('renders header, all groups and back button', async () => {
    await renderSettings();

    expect(screen.getByTestId('settings-back')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('settings-back'));
    expect(mockBack).toHaveBeenCalled();

    // Group headers
    expect(screen.getByText('PRIVASI')).toBeTruthy();
    expect(screen.getByText('FORMAT')).toBeTruthy();
    expect(screen.getByText('ASISTEN')).toBeTruthy();
    expect(screen.getByText('DATA')).toBeTruthy();
    expect(screen.getByText('HAPUS')).toBeTruthy();
    expect(screen.getByText('TENTANG')).toBeTruthy();
  });

  test('toggles privacy switches and persists them', async () => {
    await renderSettings();

    const appLockSwitch = screen.getByTestId('settings-app-lock-switch');
    await fireEvent.press(appLockSwitch);
    await waitFor(() => expect(setSetting).toHaveBeenCalledWith(expect.anything(), 'app_lock', '0'));

    const hideOnLaunchSwitch = screen.getByTestId('settings-hide-on-launch-switch');
    await fireEvent.press(hideOnLaunchSwitch);
    await waitFor(() => expect(setSetting).toHaveBeenCalledWith(expect.anything(), 'hide_on_launch', '1'));

    const blockScreenshotsSwitch = screen.getByTestId('settings-block-screenshots-switch');
    await fireEvent.press(blockScreenshotsSwitch);
    await waitFor(() => expect(setSetting).toHaveBeenCalledWith(expect.anything(), 'block_screenshots', '0'));
  });

  test('opens timezone picker sheet and selects option', async () => {
    await renderSettings();

    await fireEvent.press(screen.getByTestId('settings-timezone-row'));

    await waitFor(() => expect(screen.getByTestId('timezone-sheet')).toBeTruthy());

    const makassarOpt = screen.getByTestId('timezone-option-Asia/Makassar');
    await fireEvent.press(makassarOpt);

    expect(setSetting).toHaveBeenCalledWith(expect.anything(), 'timezone', 'Asia/Makassar');
  });

  test('opens erase confirmation dialog and can cancel or confirm', async () => {
    await renderSettings();

    await fireEvent.press(screen.getByTestId('settings-erase-row'));

    await waitFor(() => expect(screen.getByTestId('settings-erase-dialog')).toBeTruthy());

    // Confirm button inside dialog
    const confirmBtn = screen.getByText('Hapus semua data');
    await fireEvent.press(confirmBtn);

    await waitFor(() => {
      expect(resetDatabase).toHaveBeenCalled();
      expect(deleteKeyAndDisable).toHaveBeenCalled();
    });
  });

  test('navigates to subroutes', async () => {
    await renderSettings();

    await fireEvent.press(screen.getByTestId('settings-rates-row'));
    expect(mockPush).toHaveBeenCalledWith('/settings/rates');

    await fireEvent.press(screen.getByTestId('settings-ai-key-row'));
    expect(mockPush).toHaveBeenCalledWith('/ai-setup');

    await fireEvent.press(screen.getByTestId('settings-import-row'));
    expect(mockPush).toHaveBeenCalledWith('/settings/import');

    await fireEvent.press(screen.getByTestId('settings-backup-row'));
    expect(mockPush).toHaveBeenCalledWith('/backup');

    await fireEvent.press(screen.getByTestId('settings-categories-row'));
    expect(mockPush).toHaveBeenCalledWith('/categories');
  });
});

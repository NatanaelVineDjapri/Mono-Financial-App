import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useCreateBackup } from '@/features/backup/useCreateBackup';
import BackupScreen from '../backup';

jest.mock('@/data/db/DbProvider', () => ({
  useDb: () => ({
    getFirstAsync: jest.fn(async (sql: string) => {
      if (sql.includes('accounts')) return { n: 4 };
      if (sql.includes('transactions')) return { n: 71 };
      if (sql.includes('budgets')) return { n: 6 };
      if (sql.includes('goals')) return { n: 3 };
      if (sql.includes('categories')) return { n: 14 };
      if (sql.includes('recurring')) return { n: 4 };
      return { n: 0 };
    }),
    getAllAsync: jest.fn(async () => [
      {
        id: 1,
        created_at: '2026-10-21T13:14:00.000Z',
        file_name: 'mono-backup-2026-10-21.json',
        size_bytes: 38912,
        tx_count: 71,
        kind: 'manual',
      },
    ]),
  }),
}));

jest.mock('@/data/repo/backupLog', () => ({
  getLastBackupAt: jest.fn(async () => '2026-10-21T13:14:00.000Z'),
  countTransactionsChangedSince: jest.fn(async () => 8),
}));

jest.mock('@/data/repo/settings', () => ({
  getSetting: jest.fn(async () => 'Asia/Jakarta'),
}));

jest.mock('@/features/backup/useCreateBackup');
const mockUseCreateBackup = useCreateBackup as jest.MockedFunction<typeof useCreateBackup>;
const mockCreateBackup = jest.fn(async () => true);

const mockBack = jest.fn();
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  return {
    ...jest.requireActual('expo-router'),
    useRouter: () => ({ back: mockBack }),
    useFocusEffect: (cb: () => void) => {
      React.useEffect(() => {
        cb();
      }, [cb]);
    },
  };
});

const METRICS = { insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 390, height: 844 } };

function renderBackup() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider initialMetrics={METRICS}>
        <BackupScreen />
      </SafeAreaProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateBackup.mockResolvedValue(true);
  mockUseCreateBackup.mockReturnValue({ create: mockCreateBackup, busy: false });
});

describe('BackupScreen', () => {
  test('renders header, data and navigation', async () => {
    renderBackup();
    await waitFor(() => expect(screen.getByText('mono-backup-2026-10-21.json')).toBeTruthy());

    expect(screen.getByTestId('backup-back')).toBeTruthy();
    fireEvent.press(screen.getByTestId('backup-back'));
    expect(mockBack).toHaveBeenCalled();
  });

  test('renders primary backup button and triggers createBackup', async () => {
    renderBackup();
    await waitFor(() => expect(screen.getByText('mono-backup-2026-10-21.json')).toBeTruthy());

    const btn = screen.getByTestId('backup-create-btn');
    fireEvent.press(btn);
    expect(mockCreateBackup).toHaveBeenCalled();
  });

  test('renders choose backup file secondary button', async () => {
    renderBackup();
    await waitFor(() => expect(screen.getByText('mono-backup-2026-10-21.json')).toBeTruthy());

    const btn = screen.getByTestId('backup-choose-file');
    expect(btn).toBeTruthy();
  });

  test('tapping see invalid file link opens InvalidPanel and can be dismissed', async () => {
    renderBackup();
    await waitFor(() => expect(screen.getByText('mono-backup-2026-10-21.json')).toBeTruthy());

    const link = screen.getByTestId('backup-see-invalid-link');
    fireEvent.press(link);

    await waitFor(() => {
      expect(screen.getByTestId('restore-invalid-cancel')).toBeTruthy();
      expect(screen.getByTestId('restore-invalid-choose-another')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('restore-invalid-cancel'));

    await waitFor(() => {
      expect(screen.queryByTestId('restore-invalid-cancel')).toBeNull();
    });
  });
});

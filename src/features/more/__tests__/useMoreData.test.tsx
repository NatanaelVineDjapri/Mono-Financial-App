import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { countTransactionsChangedSince, getLastBackupAt } from '@/data/repo/backupLog';
import { getSetting } from '@/data/repo/settings';
import { listRecurringDue } from '@/domain/recurring';

import { useMoreData } from '../useMoreData';

jest.mock('@/data/db/DbProvider', () => ({ useDb: () => ({ fake: 'db' }) }));
jest.mock('@/data/repo/backupLog', () => ({ getLastBackupAt: jest.fn(async () => null), countTransactionsChangedSince: jest.fn(async () => 0) }));
jest.mock('@/data/repo/settings', () => ({ getSetting: jest.fn(async () => null) }));
jest.mock('@/domain/recurring', () => ({ listRecurringDue: jest.fn(async () => []) }));

// useFocusEffect needs a navigator; here it runs the callback on mount, and the test can fire it
// again to stand for "the screen got focus again" (coming back from /backup).
const mockFocusCallbacks: (() => void)[] = [];
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useFocusEffect: (callback: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require('react');
    React.useEffect(() => {
      mockFocusCallbacks.push(callback);
      callback();
    }, [callback]);
  },
}));

const mockLast = getLastBackupAt as jest.MockedFunction<typeof getLastBackupAt>;
const mockChanged = countTransactionsChangedSince as jest.MockedFunction<typeof countTransactionsChangedSince>;
const mockSetting = getSetting as jest.MockedFunction<typeof getSetting>;
const mockDue = listRecurringDue as jest.MockedFunction<typeof listRecurringDue>;

const clients: QueryClient[] = [];
function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 } } });
  clients.push(client);
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

afterEach(() => clients.splice(0).forEach(c => c.clear()));
beforeEach(() => {
  jest.clearAllMocks();
  mockFocusCallbacks.length = 0;
  mockLast.mockResolvedValue(null);
  mockChanged.mockResolvedValue(0);
  mockSetting.mockResolvedValue(null);
  mockDue.mockResolvedValue([]);
});

describe('useMoreData', () => {
  test('never backed up and nothing due', async () => {
    const { result } = await renderHook(() => useMoreData(), { wrapper: makeWrapper() });
    await waitFor(() => expect(mockLast).toHaveBeenCalled());
    expect(result.current).toEqual({ backup: { kind: 'none' }, dueCount: 0 });
  });

  test('counts the fixed expenses due today or overdue, as v_recurring_due lists them', async () => {
    mockDue.mockResolvedValue([{ recurring_id: 1 }, { recurring_id: 2 }] as never);
    const { result } = await renderHook(() => useMoreData(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.dueCount).toBe(2));
  });

  test('a backup made today: recent, 0 days, and the transactions changed since come from the database', async () => {
    mockLast.mockResolvedValue(new Date().toISOString());
    mockChanged.mockResolvedValue(4);
    const { result } = await renderHook(() => useMoreData(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.backup).toEqual({ kind: 'recent', days: 0, changed: 4 }));
    expect(mockChanged).toHaveBeenCalledWith({ fake: 'db' }, expect.any(String));
  });

  test('a backup 9 days old is stale', async () => {
    mockLast.mockResolvedValue(new Date(Date.now() - 9 * 86400000).toISOString());
    const { result } = await renderHook(() => useMoreData(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.backup.kind).toBe('stale'));
  });

  test('with no backup yet nothing is counted', async () => {
    const { result } = await renderHook(() => useMoreData(), { wrapper: makeWrapper() });
    await waitFor(() => expect(mockLast).toHaveBeenCalled());
    expect(result.current.backup).toEqual({ kind: 'none' });
    expect(mockChanged).not.toHaveBeenCalled();
  });

  test('the days are counted in the zone of the timezone setting', async () => {
    // The setting is read and handed to the day count (the count itself is tested in backupStatus.test.ts).
    mockLast.mockResolvedValue(new Date().toISOString());
    mockSetting.mockImplementation(async (_db, key) => (key === 'timezone' ? 'Asia/Makassar' : null));
    const { result } = await renderHook(() => useMoreData(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.backup.kind).toBe('recent'));
    expect(mockSetting).toHaveBeenCalledWith({ fake: 'db' }, 'timezone');
  });

  test('coming back from /backup: the card is read again on focus and shows the new backup', async () => {
    const { result } = await renderHook(() => useMoreData(), { wrapper: makeWrapper() });
    await waitFor(() => expect(mockLast).toHaveBeenCalledTimes(1));
    expect(result.current.backup).toEqual({ kind: 'none' });

    // a backup was made on /backup meanwhile
    mockLast.mockResolvedValue(new Date().toISOString());
    await act(async () => {
      mockFocusCallbacks.at(-1)?.();
    });
    await waitFor(() => expect(result.current.backup.kind).toBe('recent'));
    expect(mockLast.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { getLastBackupAt } from '@/data/repo/backupLog';
import { getSetting } from '@/data/repo/settings';
import { listRecurringDue } from '@/domain/recurring';

import { useMoreData } from '../useMoreData';

jest.mock('@/data/db/DbProvider', () => ({ useDb: () => ({ fake: 'db' }) }));
jest.mock('@/data/repo/backupLog', () => ({ getLastBackupAt: jest.fn(async () => null) }));
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

  test('reads the zone from the timezone setting', async () => {
    mockLast.mockResolvedValue(new Date().toISOString());
    mockSetting.mockImplementation(async (_db, key) => (key === 'timezone' ? 'Asia/Makassar' : null));
    const { result } = await renderHook(() => useMoreData(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.backup.kind).toBe('recent'));
    expect(result.current.backup.kind === 'recent' && result.current.backup.whenText).toMatch(/WITA$/);
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

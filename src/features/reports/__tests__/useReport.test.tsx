// The Reports read must not blank the screen when the range or the month changes: the previous report
// stays while the next one loads, and the other ranges of the month are read ahead.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { getReport, type ReportRange } from '@/domain/reports';

import { useReport } from '../useReport';

jest.mock('@/data/db/DbProvider', () => ({ useDb: () => ({}) }));
jest.mock('@/core/clock', () => ({ today: () => '2026-10-28' }));
jest.mock('@/domain/reports', () => ({
  ...jest.requireActual('@/domain/reports'),
  getReport: jest.fn(),
}));

const mockGetReport = getReport as jest.MockedFunction<typeof getReport>;
const reportFor = (period: string, range: ReportRange) => ({ period, range }) as never;

let pending: { period: string; range: ReportRange; resolve: () => void }[] = [];
let holdNext = false;

beforeEach(() => {
  pending = [];
  holdNext = false;
  mockGetReport.mockReset();
  mockGetReport.mockImplementation((_db, { period, range }) => {
    if (holdNext) {
      return new Promise(resolve => {
        pending.push({ period, range, resolve: () => resolve(reportFor(period, range)) });
      });
    }
    return Promise.resolve(reportFor(period, range));
  });
});

function setup(initial: { period: string; range: ReportRange }) {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: 0, gcTime: Infinity } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(({ period, range }: { period: string; range: ReportRange }) => useReport(period, range), { wrapper, initialProps: initial });
}

describe('useReport', () => {
  test('once a report has loaded, the other ranges of the same month are read in the background', async () => {
    const { result } = await setup({ period: '2026-10', range: 'month' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() => expect(mockGetReport).toHaveBeenCalledTimes(4));
    const ranges = mockGetReport.mock.calls.map(([, input]) => input.range).sort();
    expect(ranges).toEqual(['3m', '6m', 'month', 'year']);
  });

  test('switching to a range that was read ahead shows its data at once, with no loading state', async () => {
    const { result, rerender } = await setup({ period: '2026-10', range: 'month' });
    await waitFor(() => expect(mockGetReport).toHaveBeenCalledTimes(4));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    await rerender({ period: '2026-10', range: '6m' });
    expect(result.current.data).toEqual(reportFor('2026-10', '6m'));
    expect(result.current.isPlaceholderData).toBe(false);
    expect(mockGetReport).toHaveBeenCalledTimes(4); // nothing was read again
  });

  test('a month that has not been read yet keeps the previous report on screen until its own arrives', async () => {
    const { result, rerender } = await setup({ period: '2026-10', range: 'month' });
    await waitFor(() => expect(mockGetReport).toHaveBeenCalledTimes(4));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    holdNext = true;
    await rerender({ period: '2026-09', range: 'month' });
    expect(result.current.data).toEqual(reportFor('2026-10', 'month')); // never undefined: no spinner
    expect(result.current.isPlaceholderData).toBe(true);

    await act(async () => pending.find(p => p.period === '2026-09' && p.range === 'month')?.resolve());
    await waitFor(() => expect(result.current.isPlaceholderData).toBe(false));
    expect(result.current.data).toEqual(reportFor('2026-09', 'month'));
  });
});

// The Summary screen against a real database holding the October sample.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as fs from 'fs';
import * as path from 'path';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useHideAmounts } from '@/components/hide-amounts-store';
import { openMigratedTestDb } from '@/data/db/openTestDb';
import type { Db } from '@/data/db/types';

import SummaryScreen from '../summary';

let mockDb: Db;
jest.mock('@/data/db/DbProvider', () => ({ useDb: () => mockDb }));
jest.mock('@/core/clock', () => ({ ...jest.requireActual('@/core/clock'), today: () => '2026-10-28' }));
jest.mock('expo-router', () => ({ ...jest.requireActual('expo-router'), useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));

const SAMPLE_SQL = fs.readFileSync(path.join(__dirname, '../../../tools/sample_data.sql'), 'utf8');
const metrics = { frame: { x: 0, y: 0, width: 390, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

async function setup() {
  mockDb = await openMigratedTestDb();
  await mockDb.execAsync(SAMPLE_SQL);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const view = await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <SummaryScreen />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
  await waitFor(() => expect(view.getByTestId('summary-totals')).toBeTruthy());
  return view;
}

describe('SummaryScreen', () => {
  afterEach(async () => await act(() => useHideAmounts.getState().setHidden(false)));

  test('Current: the October totals, where the money went, and the calendar', async () => {
    const view = await setup();
    expect(view.getByText('+Rp3.243.000')).toBeTruthy();
    expect(view.getByText('−Rp4.257.000')).toBeTruthy();
    expect(view.getByTestId('summary-category-1')).toBeTruthy();
    expect(view.getByTestId('summary-calendar-month')).toBeTruthy();
  });

  test('tapping a day writes what was spent on it', async () => {
    const view = await setup();
    await fireEvent.press(view.getByTestId('summary-day-2026-10-01'));
    expect(view.getByTestId('summary-calendar-note').props.children).toContain('Rp');
  });

  test('a category with sub-categories opens to them', async () => {
    mockDb = await openMigratedTestDb();
    await mockDb.execAsync(SAMPLE_SQL);
    await mockDb.runAsync("insert into subcategories (category_id, name) values (1, 'Sendiri')");
    await mockDb.runAsync('update transactions set subcategory_id = (select id from subcategories) where category_id = 1');
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const view = await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <QueryClientProvider client={queryClient}>
          <SummaryScreen />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );
    await waitFor(() => expect(view.getByTestId('summary-category-1')).toBeTruthy());
    expect(view.queryByTestId('summary-subs-1')).toBeNull();
    await fireEvent.press(view.getByTestId('summary-category-1'));
    expect(view.getByTestId('summary-subs-1')).toBeTruthy();
    expect(view.getByText('Sendiri')).toBeTruthy();
  });

  test('History: six months, newest first, and fewer on request', async () => {
    const view = await setup();
    await fireEvent.press(view.getByTestId('summary-tabs').children[1] as never);
    await waitFor(() => expect(view.getByTestId('summary-month-2026-10')).toBeTruthy());
    expect(view.getByTestId('summary-month-2026-05')).toBeTruthy();
    await fireEvent.press(view.getByTestId('summary-months-3'));
    await waitFor(() => expect(view.queryByTestId('summary-month-2026-05')).toBeNull());
    expect(view.getByTestId('summary-month-2026-08')).toBeTruthy();
  });

  test('hidden amounts: no figure on screen or read aloud', async () => {
    await act(() => useHideAmounts.getState().setHidden(true));
    const view = await setup();
    expect(view.queryByText(/3\.243\.000/)).toBeNull();
    expect(view.getByTestId('summary-category-1').props.accessibilityLabel).not.toMatch(/1\.425\.000/);
  });
});

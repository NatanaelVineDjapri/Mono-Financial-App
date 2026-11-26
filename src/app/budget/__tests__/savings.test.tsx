// The savings budget, end to end against the real schema and the sample October: the card on the Budgets tab
// (income 7.500.000, expenses 4.257.000, saved 3.243.000) and the screen that sets, changes and removes the target.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import * as fs from 'fs';
import * as path from 'path';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useHideAmounts } from '@/components/hide-amounts-store';
import { openMigratedTestDb } from '@/data/db/openTestDb';
import type { Db } from '@/data/db/types';
import { getSavingsTarget, setSavingsTarget } from '@/domain/savings';
import { SavingsCard } from '@/features/budgets/SavingsCard';

import SavingsTargetScreen from '../savings';

const mockRouter = { back: jest.fn(), push: jest.fn() };
let mockDb: Db;

jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => mockRouter,
}));
jest.mock('@/data/db/DbProvider', () => ({ useDb: () => mockDb }));

const SAMPLE_SQL = fs.readFileSync(path.join(__dirname, '../../../../tools/sample_data.sql'), 'utf8');
const METRICS = { insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 400, height: 800 } };

async function renderNode(node: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <QueryClientProvider client={client}>{node}</QueryClientProvider>
    </SafeAreaProvider>,
  );
}

async function showCard(target: number | null, month = '2026-10') {
  await setSavingsTarget(mockDb, target);
  await renderNode(<SavingsCard month={month} />);
  await waitFor(() => expect(screen.getByTestId('savings-card')).toBeTruthy());
}

const barLabel = () => within(screen.getByTestId('savings-bar')).getByRole('progressbar').props.accessibilityLabel;

beforeEach(async () => {
  jest.clearAllMocks();
  await act(async () => useHideAmounts.getState().setHidden(false));
  mockDb = await openMigratedTestDb();
  await mockDb.execAsync(SAMPLE_SQL);
});

describe('the card on the Budgets tab', () => {
  test('without a target: the explanation and a button to set one', async () => {
    await showCard(null);
    expect(screen.getByText('Budget tabungan')).toBeTruthy();
    expect(screen.getByText(/Yang ditabung = pemasukan dikurangi pengeluaran/)).toBeTruthy();
    expect(screen.queryByTestId('savings-bar')).toBeNull();
    await fireEvent.press(screen.getByText('Atur target nabung'));
    expect(mockRouter.push).toHaveBeenCalledWith('/budget/savings');
  });

  test('on the way: the saved amount with +, the target, what is still to go, and the exact figures on the bar', async () => {
    await showCard(5_000_000);
    expect(screen.getByText('+Rp3.243.000')).toBeTruthy();
    expect(screen.getByText('dari Rp5.000.000')).toBeTruthy();
    expect(screen.getByText('Kurang Rp1.757.000')).toBeTruthy();
    expect(barLabel()).toBe('Sudah ditabung Rp3.243.000 dari Rp5.000.000, 64,86%');
    await fireEvent.press(screen.getByLabelText('Ubah target nabung'));
    expect(mockRouter.push).toHaveBeenCalledWith('/budget/savings');
  });

  test('past the target is good news: full bar, no striped overflow, the real share in the label', async () => {
    await showCard(2_000_000);
    expect(screen.getByText('Target tercapai')).toBeTruthy();
    expect(screen.queryByTestId('savings-bar-overflow')).toBeNull();
    expect(barLabel()).toContain('162,15%');
  });

  test('spent more than earned: a minus amount and the sentence saying by how much', async () => {
    // Enough opening money that the accounts stay above zero without the month's income.
    await mockDb.runAsync('update accounts set opening_balance = opening_balance + 10000000');
    await mockDb.runAsync("delete from transactions where kind = 'income'");
    await showCard(1_000_000);
    expect(screen.getByText('−Rp4.257.000')).toBeTruthy();
    expect(screen.getByText('Pengeluaran Rp4.257.000 lebih besar dari pemasukan')).toBeTruthy();
  });

  test('follows the month it is given: a month without records has nothing saved', async () => {
    await showCard(1_000_000, '2026-02');
    expect(screen.getByText('Rp0')).toBeTruthy();
    expect(screen.getByText('Kurang Rp1.000.000')).toBeTruthy();
  });

  test('hidden mode masks every amount, the bar label included', async () => {
    await act(async () => useHideAmounts.getState().setHidden(true));
    await showCard(5_000_000);
    expect(screen.queryByText(/\d\.\d{3}/)).toBeNull();
    expect(barLabel()).not.toMatch(/\d\.\d{3}/);
  });
});

describe('the target screen', () => {
  async function open() {
    await renderNode(<SavingsTargetScreen />);
    await waitFor(() => expect(screen.getByTestId('savings-save')).toBeTruthy());
  }

  test('a new target: Save is off at zero, there is nothing to remove, saving stores the amount', async () => {
    await open();
    expect(screen.queryByTestId('savings-remove')).toBeNull();
    expect(screen.getByTestId('savings-save').props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(screen.getByTestId('savings-amount-input'), '2.000.000');
    expect(screen.getByTestId('savings-save').props.accessibilityState.disabled).toBe(false);
    await fireEvent.press(screen.getByTestId('savings-save'));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(await getSavingsTarget(mockDb)).toBe(2_000_000);
  });

  test('an existing target is prefilled and can be removed', async () => {
    await setSavingsTarget(mockDb, 1_500_000);
    await open();
    expect(screen.getByTestId('savings-amount-input').props.value).toBe('1.500.000');
    await fireEvent.press(screen.getByTestId('savings-remove'));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(await getSavingsTarget(mockDb)).toBeNull();
  });
});

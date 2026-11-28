// The debt screens over a real database: add one, see it listed, pay part of it.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { setClockOverride } from '@/core/clock';
import { openMigratedTestDb } from '@/data/db/openTestDb';
import type { Db } from '@/data/db/types';
import { createAccount } from '@/domain/accounts';
import { listDebts } from '@/domain/debts';

import DebtScreen from '../debt/[id]';
import NewDebtScreen from '../debt/new';
import DebtsScreen from '../debts';

let mockDb: Db;
let mockId = '0';
jest.mock('@/data/db/DbProvider', () => ({ useDb: () => mockDb }));
const mockBack = jest.fn();
jest.mock('expo-router', () => ({ ...jest.requireActual('expo-router'), useRouter: () => ({ back: mockBack, push: jest.fn() }), useLocalSearchParams: () => ({ id: mockId }) }));

const METRICS = { insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 390, height: 844 } };
const NOW = '2026-10-28T10:00:00+07:00';
const wrap = (node: React.ReactElement) => (
  <SafeAreaProvider initialMetrics={METRICS}>
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>{node}</QueryClientProvider>
  </SafeAreaProvider>
);

beforeEach(async () => {
  jest.clearAllMocks();
  setClockOverride(NOW);
  mockDb = await openMigratedTestDb();
  await createAccount(mockDb, { name: 'BCA', type: 'bank', openingBalance: 500000, openingDate: '2026-10-01' }, NOW);
});
afterEach(() => setClockOverride(null));

test('add a loan, find it in the list, record part of it paid', async () => {
  const form = await render(wrap(<NewDebtScreen />));
  await waitFor(() => expect(form.getByText('BCA')).toBeTruthy());
  await fireEvent.changeText(form.getByTestId('debt-person'), 'Budi');
  await fireEvent.changeText(form.getByTestId('tx-amount-input'), '100000');
  await act(async () => {
    await fireEvent.press(form.getByTestId('debt-save'));
  });
  await waitFor(() => expect(mockBack).toHaveBeenCalled());
  const [debt] = await listDebts(mockDb);
  expect(debt).toMatchObject({ person: 'Budi', direction: 'lent', remaining: 100000 });
  await form.unmount();

  const list = await render(wrap(<DebtsScreen />));
  await waitFor(() => expect(list.getByText('Budi')).toBeTruthy());
  expect(list.getByText('Piutangmu')).toBeTruthy();
  await list.unmount();

  mockId = String(debt.account_id);
  const detail = await render(wrap(<DebtScreen />));
  await waitFor(() => expect(detail.getByTestId('debt-pay')).toBeTruthy());
  await fireEvent.changeText(detail.getByTestId('tx-amount-input'), '150000');
  await act(async () => {
    await fireEvent.press(detail.getByTestId('debt-pay-save'));
  });
  await waitFor(() => expect(detail.getByText('Lebih besar dari sisanya.')).toBeTruthy());
  await fireEvent.changeText(detail.getByTestId('tx-amount-input'), '40000');
  await act(async () => {
    await fireEvent.press(detail.getByTestId('debt-pay-save'));
  });
  await waitFor(async () => expect((await listDebts(mockDb))[0].remaining).toBe(60000));
});

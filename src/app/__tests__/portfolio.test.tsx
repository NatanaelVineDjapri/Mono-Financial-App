// The portfolio screens over a real database, with the price service faked: make a portfolio, add a stock by search,
// see its value, choose to count it in net worth.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { openMigratedTestDb } from '@/data/db/openTestDb';
import type { Db } from '@/data/db/types';
import { listPortfolios, listPositions } from '@/domain/portfolio';

import PortfolioScreen from '../portfolio/index';
import PositionScreen from '../portfolio/position';

let mockDb: Db;
let mockParams: Record<string, string> = {};
jest.mock('@/data/db/DbProvider', () => ({ useDb: () => mockDb }));
const mockBack = jest.fn();
jest.mock('expo-router', () => ({ ...jest.requireActual('expo-router'), useRouter: () => ({ back: mockBack, push: jest.fn() }), useLocalSearchParams: () => mockParams }));
const quote = { symbol: 'BBCA.JK', currency: 'IDR', priceE4: 60_000_000, prevCloseE4: null, asOf: '2026-10-28T09:00:00.000Z' };
jest.mock('@/features/portfolio/yahoo', () => ({
  searchSymbols: jest.fn(async () => ({ ok: true, value: [{ symbol: 'BBCA.JK', name: 'Bank Central Asia', exchange: 'Jakarta' }] })),
  fetchQuote: jest.fn(async () => ({ ok: true, value: quote })),
  fetchQuotes: jest.fn(async () => ({ quotes: [quote], failed: null })),
}));

const METRICS = { insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 390, height: 844 } };
const wrap = (node: React.ReactElement) => (
  <SafeAreaProvider initialMetrics={METRICS}>
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>{node}</QueryClientProvider>
  </SafeAreaProvider>
);

test('new portfolio, a stock found by search in lots, its value and the net worth choice', async () => {
  mockDb = await openMigratedTestDb();
  const list = await render(wrap(<PortfolioScreen />));
  await waitFor(() => expect(list.getByTestId('portfolio-empty')).toBeTruthy());
  await fireEvent.press(list.getByTestId('portfolio-new'));
  await fireEvent.changeText(list.getByTestId('portfolio-name'), 'Stockbit');
  await act(async () => {
    await fireEvent.press(list.getByTestId('portfolio-name-save'));
  });
  await waitFor(async () => expect(await listPortfolios(mockDb)).toHaveLength(1));
  await list.unmount();

  const [portfolio] = await listPortfolios(mockDb);
  mockParams = { portfolio: String(portfolio.id) };
  const form = await render(wrap(<PositionScreen />));
  await fireEvent.changeText(form.getByTestId('stock-search'), 'bbca');
  await act(async () => {
    await fireEvent.press(form.getByTestId('stock-search-go'));
  });
  await act(async () => {
    await fireEvent.press(form.getByTestId('match-BBCA.JK'));
  });
  await waitFor(() => expect(form.getByText('Lot (1 lot = 100 lembar)')).toBeTruthy());
  await fireEvent.changeText(form.getByTestId('stock-qty'), '10');
  await fireEvent.changeText(form.getByTestId('stock-price'), '5.000');
  await act(async () => {
    await fireEvent.press(form.getByTestId('stock-save'));
  });
  await waitFor(() => expect(mockBack).toHaveBeenCalled());
  expect((await listPositions(mockDb, portfolio.id))[0]).toMatchObject({ symbol: 'BBCA.JK', qty_e4: 10_000_000, avg_price_e4: 50_000_000, market_idr: 6_000_000, cost_idr: 5_000_000 });
  await form.unmount();

  const again = await render(wrap(<PortfolioScreen />));
  await waitFor(() => expect(again.getByTestId('portfolio-total')).toBeTruthy());
  expect(again.getAllByText('Rp6.000.000').length).toBeGreaterThan(0);
  expect(again.getAllByText('+Rp1.000.000 (+20,00%)').length).toBeGreaterThan(0);
  await act(async () => {
    await fireEvent.press(again.getByText('Nilai pasar'));
  });
  await waitFor(async () => expect(await mockDb.getFirstAsync('select net_worth from v_net_worth')).toEqual({ net_worth: 6_000_000 }));
});

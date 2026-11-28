// Portfolios: values in rupiah from integer prices, the net worth choice, backup, and the Yahoo answers.
import { createHash } from 'crypto';

import { formatE4, lotSize, parseE4 } from '../../core/price';
import { exportBackup } from '../../data/backup/export';
import { restoreBackup } from '../../data/backup/restore';
import { openMigratedTestDb } from '../../data/db/openTestDb';
import type { Db } from '../../data/db/types';
import { insertFxRate, listHeldCurrencies } from '../../data/repo/fx';
import { quoteFromChart } from '../../features/portfolio/yahoo';
import { createAccount } from '../accounts';
import { addPosition, createPortfolio, editPosition, listPortfolios, listPositions, positionProfit, saveQuotes, setInTotal, setNetWorthMode, totalsOf } from '../portfolio';

const NOW = '2026-10-28T10:00:00+07:00';
const sha = async (text: string) => createHash('sha256').update(text).digest('hex');
const netWorth = async (db: Db) => db.getFirstAsync<{ net_worth: number; incomplete: number }>('select * from v_net_worth');

async function setup() {
  const db = await openMigratedTestDb();
  const rdn = await createAccount(db, { name: 'RDN', type: 'bank', openingBalance: 1_000_000, openingDate: '2026-01-01' }, NOW);
  const id = ((await createPortfolio(db, 'Stockbit', rdn, NOW)) as { value: number }).value;
  return { db, rdn, id };
}
// 10 lots (1.000 shares) of BBCA bought at 5.000
const bbca = (portfolioId: number) => ({ portfolioId, symbol: 'BBCA.JK', name: 'Bank Central Asia', exchange: 'Jakarta', currency: 'IDR', qtyE4: 1000 * 10000, avgPriceE4: 5000 * 10000 });
// 2,5 shares of a US stock bought at USD 100
const aapl = (portfolioId: number) => ({ portfolioId, symbol: 'AAPL', name: 'Apple', exchange: 'NASDAQ', currency: 'USD', qtyE4: 25_000, avgPriceE4: 100 * 10000 });
const quote = (symbol: string, currency: string, price: number) => ({ symbol, currency, priceE4: price * 10000, prevCloseE4: null, asOf: NOW });

test('typing and showing prices', () => {
  expect(parseE4('6.000')).toBe(60_000_000);
  expect(parseE4('1.250,5')).toBe(12_505_000);
  expect(parseE4('358.54')).toBe(3_585_400);
  expect(parseE4('2,5')).toBe(25_000);
  expect(parseE4('0')).toBeNull();
  expect(parseE4('abc')).toBeNull();
  expect(formatE4(3_585_400)).toBe('358,54');
  expect(formatE4(60_000_000)).toBe('6.000');
  expect([lotSize('BBCA.JK'), lotSize('AAPL')]).toEqual([100, 1]);
});

test('values: market where priced, cost otherwise; foreign stocks through the exchange rate; profit and loss', async () => {
  const { db, id } = await setup();
  expect(await addPosition(db, bbca(id), NOW)).toEqual({ ok: true, value: null });
  expect(await addPosition(db, bbca(id), NOW)).toEqual({ ok: false, error: 'already_held' });
  await addPosition(db, aapl(id), NOW);
  expect(await listHeldCurrencies(db)).toEqual(['USD']);

  let [p] = await listPortfolios(db);
  expect(p).toMatchObject({ positions: 2, value_idr: 5_000_000, missing: 1, cash_balance: 1_000_000 }); // no USD rate yet
  expect(totalsOf([p])).toMatchObject({ value: 6_000_000, profit: null, incomplete: true });

  await insertFxRate(db, 'USD', 162_500_000, NOW, 'api'); // Rp16.250
  await saveQuotes(db, [quote('BBCA.JK', 'IDR', 6000), quote('AAPL', 'USD', 120)], NOW);
  [p] = await listPortfolios(db);
  // BBCA 6.000.000 + AAPL 2,5 x 120 x 16.250 = 4.875.000
  expect(p).toMatchObject({ market_idr: 10_875_000, value_idr: 10_875_000, cost_idr: 9_062_500, missing: 0 });
  expect(totalsOf([p])).toEqual({ value: 11_875_000, profit: 1_812_500, profitBp: 2000, incomplete: false });
  const [first] = await listPositions(db, id);
  expect(positionProfit(first)).toEqual({ profit: 1_000_000, profitBp: 2000 });
});

test('net worth adds portfolios only as chosen: nothing, market value or what was paid', async () => {
  const { db, id } = await setup();
  await addPosition(db, bbca(id), NOW);
  await saveQuotes(db, [quote('BBCA.JK', 'IDR', 6000)], NOW);
  expect((await netWorth(db))!.net_worth).toBe(1_000_000);
  await setNetWorthMode(db, 'market');
  expect((await netWorth(db))!.net_worth).toBe(7_000_000);
  await setNetWorthMode(db, 'cost');
  expect((await netWorth(db))!.net_worth).toBe(6_000_000);
  const months = await db.getAllAsync<{ net_worth: number }>('select * from v_net_worth_by_month');
  expect(months.every(m => m.net_worth === 6_000_000)).toBe(true);
});

test('big holdings do not overflow', async () => {
  const { db, id } = await setup();
  await insertFxRate(db, 'USD', 162_500_000, NOW, 'api');
  await addPosition(db, { ...aapl(id), qtyE4: 1_000_000 * 10000, avgPriceE4: 700_000 * 10000 }, NOW);
  const [row] = await listPositions(db, id);
  expect(row.cost_idr).toBe(1_000_000 * 700_000 * 16_250);
});

test('editing, leaving a portfolio out of the total, and a backup round trip', async () => {
  const { db, id } = await setup();
  await addPosition(db, bbca(id), NOW);
  const [row] = await listPositions(db, id);
  expect(await editPosition(db, row.id, 2000 * 10000, 4500 * 10000, NOW)).toEqual({ ok: true, value: null });
  await setInTotal(db, id, false);
  await setNetWorthMode(db, 'cost');
  const file = await exportBackup(db, NOW, sha);
  const target = await openMigratedTestDb();
  expect((await restoreBackup(target, JSON.stringify(file), NOW, sha)).ok).toBe(true);
  expect((await listPortfolios(target))[0]).toMatchObject({ name: 'Stockbit', in_total: 0, cost_idr: 9_000_000 });
  expect((await netWorth(target))!.net_worth).toBe(10_000_000);
});

test('Yahoo answers: pence become pounds, a broken answer is refused', () => {
  const body = (meta: object) => ({ chart: { result: [{ meta }] } });
  expect(quoteFromChart('VOD.L', body({ regularMarketPrice: 103.95, currency: 'GBp', chartPreviousClose: 103.05, regularMarketTime: 1_700_000_000 }))).toMatchObject({ currency: 'GBP', priceE4: 10_395, prevCloseE4: 10_305 });
  expect(quoteFromChart('BBCA.JK', body({ regularMarketPrice: 6000, currency: 'IDR' }))).toMatchObject({ priceE4: 60_000_000 });
  expect(quoteFromChart('X', {})).toBeNull();
});

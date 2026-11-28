// Stock portfolios (migration 14 -> 15): SQL in, plain objects out. The rules are src/domain/portfolio.ts.
import type { Db } from '../db/types';

export interface PortfolioRow {
  id: number;
  name: string;
  cash_account_id: number | null;
  cash_name: string | null;
  cash_balance: number | null; // rupiah, from the account views
  in_total: number;
  positions: number;
  market_idr: number; // positions with a price, in rupiah
  value_idr: number; // price where there is one, otherwise what was paid
  cost_idr: number; // what was paid (positions with a rate)
  priced_cost_idr: number; // the cost of exactly the positions counted in market_idr, for profit and loss
  missing: number; // positions that cannot be valued in rupiah yet (no exchange rate)
}

export async function listPortfolioRows(db: Db): Promise<PortfolioRow[]> {
  return db.getAllAsync<PortfolioRow>(
    `select p.id, p.name, p.cash_account_id, a.name as cash_name, b.balance as cash_balance, p.in_total,
            count(v.id) as positions,
            coalesce(sum(v.market_idr), 0) as market_idr,
            coalesce(sum(coalesce(v.market_idr, v.cost_idr)), 0) as value_idr,
            coalesce(sum(v.cost_idr), 0) as cost_idr,
            coalesce(sum(case when v.market_idr is not null then v.cost_idr end), 0) as priced_cost_idr,
            coalesce(sum(v.id is not null and v.cost_idr is null), 0) as missing
       from portfolios p
       left join accounts a on a.id = p.cash_account_id
       left join v_account_balance b on b.id = p.cash_account_id
       left join v_position_value v on v.portfolio_id = p.id
      group by p.id
      order by p.sort_order, p.id`,
  );
}

export interface PositionRow {
  id: number;
  portfolio_id: number;
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  qty_e4: number;
  avg_price_e4: number;
  price_e4: number | null;
  prev_close_e4: number | null;
  as_of: string | null;
  market_idr: number | null;
  cost_idr: number | null;
}

export async function listPositionRows(db: Db, portfolioId: number): Promise<PositionRow[]> {
  return db.getAllAsync<PositionRow>('select * from v_position_value where portfolio_id = $id order by coalesce(market_idr, cost_idr, 0) desc, symbol', { $id: portfolioId });
}

export async function getPositionRow(db: Db, id: number): Promise<PositionRow | null> {
  return db.getFirstAsync<PositionRow>('select * from v_position_value where id = $id', { $id: id });
}

export async function listSymbols(db: Db): Promise<string[]> {
  return (await db.getAllAsync<{ symbol: string }>('select distinct symbol from positions order by symbol')).map(r => r.symbol);
}

export async function insertPortfolio(db: Db, name: string, cashAccountId: number | null, now: string): Promise<number> {
  const result = await db.runAsync('insert into portfolios (name, cash_account_id, created_at) values ($name, $cash, $now)', { $name: name, $cash: cashAccountId, $now: now });
  return result.lastInsertRowId;
}

export async function updatePortfolioRow(db: Db, id: number, patch: { name?: string; cashAccountId?: number | null; inTotal?: boolean }): Promise<void> {
  if (patch.name !== undefined) await db.runAsync('update portfolios set name = $v where id = $id', { $id: id, $v: patch.name });
  if (patch.cashAccountId !== undefined) await db.runAsync('update portfolios set cash_account_id = $v where id = $id', { $id: id, $v: patch.cashAccountId });
  if (patch.inTotal !== undefined) await db.runAsync('update portfolios set in_total = $v where id = $id', { $id: id, $v: patch.inTotal ? 1 : 0 });
}

export async function deletePortfolioRow(db: Db, id: number): Promise<void> {
  await db.runAsync('delete from positions where portfolio_id = $id', { $id: id });
  await db.runAsync('delete from portfolios where id = $id', { $id: id });
}

export interface NewPosition {
  portfolioId: number;
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  qtyE4: number;
  avgPriceE4: number;
}

export async function insertPosition(db: Db, p: NewPosition, now: string): Promise<void> {
  await db.runAsync(
    `insert into positions (portfolio_id, symbol, name, exchange, currency, qty_e4, avg_price_e4, created_at, updated_at)
     values ($portfolio, $symbol, $name, $exchange, $currency, $qty, $avg, $now, $now)`,
    { $portfolio: p.portfolioId, $symbol: p.symbol, $name: p.name, $exchange: p.exchange, $currency: p.currency, $qty: p.qtyE4, $avg: p.avgPriceE4, $now: now },
  );
}

export async function updatePosition(db: Db, id: number, qtyE4: number, avgPriceE4: number, now: string): Promise<void> {
  await db.runAsync('update positions set qty_e4 = $qty, avg_price_e4 = $avg, updated_at = $now where id = $id', { $id: id, $qty: qtyE4, $avg: avgPriceE4, $now: now });
}

export async function deletePosition(db: Db, id: number): Promise<void> {
  await db.runAsync('delete from positions where id = $id', { $id: id });
}

export async function hasPosition(db: Db, portfolioId: number, symbol: string): Promise<boolean> {
  return (await db.getFirstAsync('select 1 as x from positions where portfolio_id = $p and symbol = $s', { $p: portfolioId, $s: symbol })) != null;
}

export async function portfolioNameExists(db: Db, name: string, exceptId: number | null): Promise<boolean> {
  return (await db.getFirstAsync('select 1 as x from portfolios where name = $name and id is not $except', { $name: name, $except: exceptId })) != null;
}

export interface Quote {
  symbol: string;
  currency: string;
  priceE4: number;
  prevCloseE4: number | null;
  asOf: string;
}

export async function saveQuote(db: Db, q: Quote, fetchedAt: string): Promise<void> {
  await db.runAsync(
    `insert into stock_quotes (symbol, currency, price_e4, prev_close_e4, as_of, fetched_at)
     values ($symbol, $currency, $price, $prev, $asOf, $now)
     on conflict(symbol) do update set currency = excluded.currency, price_e4 = excluded.price_e4,
       prev_close_e4 = excluded.prev_close_e4, as_of = excluded.as_of, fetched_at = excluded.fetched_at`,
    { $symbol: q.symbol, $currency: q.currency, $price: q.priceE4, $prev: q.prevCloseE4, $asOf: q.asOf, $now: fetchedAt },
  );
}

export async function getLastQuoteFetch(db: Db): Promise<string | null> {
  return (await db.getFirstAsync<{ at: string | null }>('select max(fetched_at) as at from stock_quotes where symbol in (select symbol from positions)'))!.at;
}

export async function currencyExists(db: Db, code: string): Promise<boolean> {
  return (await db.getFirstAsync('select 1 as x from currencies where code = $code', { $code: code })) != null;
}

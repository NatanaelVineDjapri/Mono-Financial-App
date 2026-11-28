// Stock portfolios (asked for by the owner): several portfolios, each with positions typed in (quantity and average buy
// price); prices come from src/features/portfolio/yahoo.ts. Nothing here moves money between accounts. What portfolios
// add to net worth is the person's choice (settings.portfolio_net_worth).
import * as repo from '../data/repo/portfolio';
import { getSetting, setSetting } from '../data/repo/settings';
import type { NewPosition, PortfolioRow, PositionRow, Quote } from '../data/repo/portfolio';
import type { Db } from '../data/db/types';

export type { NewPosition, PortfolioRow, PositionRow, Quote };
export type NetWorthMode = 'off' | 'market' | 'cost';
export const NET_WORTH_SETTING = 'portfolio_net_worth';

export type PortfolioError = 'name_required' | 'name_taken' | 'symbol_required' | 'qty_required' | 'price_required' | 'unknown_currency' | 'already_held';
export type PortfolioResult<T = null> = { ok: true; value: T } | { ok: false; error: PortfolioError };
const refuse = (error: PortfolioError): { ok: false; error: PortfolioError } => ({ ok: false, error });

export const listPortfolios = (db: Db) => repo.listPortfolioRows(db);
export const listPositions = (db: Db, portfolioId: number) => repo.listPositionRows(db, portfolioId);
export const getPosition = (db: Db, id: number) => repo.getPositionRow(db, id);
export const listSymbols = (db: Db) => repo.listSymbols(db);
export const getLastQuoteFetch = (db: Db) => repo.getLastQuoteFetch(db);

export async function getNetWorthMode(db: Db): Promise<NetWorthMode> {
  const value = await getSetting(db, NET_WORTH_SETTING);
  return value === 'market' || value === 'cost' ? value : 'off';
}

export const setNetWorthMode = (db: Db, mode: NetWorthMode) => setSetting(db, NET_WORTH_SETTING, mode);

export interface Totals {
  value: number; // positions (price, or cost where there is no price) plus the cash accounts, in rupiah
  profit: number | null; // market minus cost of the priced positions; null when nothing is priced
  profitBp: number | null;
  incomplete: boolean;
}

const bp = (part: number, whole: number) => (whole > 0 ? Math.sign(part) * Math.floor((Math.abs(part) * 20000 + whole) / (2 * whole)) : null);

// Of the given portfolios. A cash account linked to two of them is counted once.
export function totalsOf(portfolios: readonly PortfolioRow[]): Totals {
  const cash = new Map<number, number>();
  for (const p of portfolios) if (p.cash_account_id != null) cash.set(p.cash_account_id, p.cash_balance ?? 0);
  const sum = (pick: (p: PortfolioRow) => number) => portfolios.reduce((total, p) => total + pick(p), 0);
  const priced = sum(p => p.priced_cost_idr);
  const market = sum(p => p.market_idr);
  const profit = priced > 0 ? market - priced : null;
  return {
    value: sum(p => p.value_idr) + [...cash.values()].reduce((a, b) => a + b, 0),
    profit,
    profitBp: profit == null ? null : bp(profit, priced),
    incomplete: portfolios.some(p => p.missing > 0),
  };
}

export function positionProfit(p: PositionRow): { profit: number; profitBp: number | null } | null {
  if (p.market_idr == null || p.cost_idr == null) return null;
  const profit = p.market_idr - p.cost_idr;
  return { profit, profitBp: bp(profit, p.cost_idr) };
}

async function checkName(db: Db, raw: string, exceptId: number | null): Promise<PortfolioResult<string>> {
  const name = raw.trim();
  if (!name || name.length > 30) return refuse('name_required');
  if (await repo.portfolioNameExists(db, name, exceptId)) return refuse('name_taken');
  return { ok: true, value: name };
}

export async function createPortfolio(db: Db, name: string, cashAccountId: number | null, now: string): Promise<PortfolioResult<number>> {
  const checked = await checkName(db, name, null);
  if (!checked.ok) return checked;
  return { ok: true, value: await repo.insertPortfolio(db, checked.value, cashAccountId, now) };
}

export async function renamePortfolio(db: Db, id: number, name: string): Promise<PortfolioResult> {
  const checked = await checkName(db, name, id);
  if (!checked.ok) return checked;
  await repo.updatePortfolioRow(db, id, { name: checked.value });
  return { ok: true, value: null };
}

export const setCashAccount = (db: Db, id: number, cashAccountId: number | null) => repo.updatePortfolioRow(db, id, { cashAccountId });
export const setInTotal = (db: Db, id: number, inTotal: boolean) => repo.updatePortfolioRow(db, id, { inTotal });

export async function deletePortfolio(db: Db, id: number): Promise<void> {
  await db.withExclusiveTransactionAsync(async txn => repo.deletePortfolioRow(txn, id));
}

export interface PositionInput extends Omit<NewPosition, 'qtyE4' | 'avgPriceE4'> {
  qtyE4: number | null;
  avgPriceE4: number | null;
}

export async function addPosition(db: Db, input: PositionInput, now: string): Promise<PortfolioResult> {
  if (!input.symbol) return refuse('symbol_required');
  if (!input.qtyE4) return refuse('qty_required');
  if (!input.avgPriceE4) return refuse('price_required');
  if (!(await repo.currencyExists(db, input.currency))) return refuse('unknown_currency');
  if (await repo.hasPosition(db, input.portfolioId, input.symbol)) return refuse('already_held');
  await repo.insertPosition(db, { ...input, qtyE4: input.qtyE4, avgPriceE4: input.avgPriceE4 }, now);
  return { ok: true, value: null };
}

export async function editPosition(db: Db, id: number, qtyE4: number | null, avgPriceE4: number | null, now: string): Promise<PortfolioResult> {
  if (!qtyE4) return refuse('qty_required');
  if (!avgPriceE4) return refuse('price_required');
  await repo.updatePosition(db, id, qtyE4, avgPriceE4, now);
  return { ok: true, value: null };
}

export const removePosition = (db: Db, id: number) => repo.deletePosition(db, id);

export async function saveQuotes(db: Db, quotes: readonly Quote[], fetchedAt: string): Promise<void> {
  for (const quote of quotes) await repo.saveQuote(db, quote, fetchedAt);
}

// Reads for the Valas detail (board Valas-Detail) and its form. Every figure comes from a view: the
// pocket's balance (v_pocket_balance), its rupiah value at the latest rate (v_pocket_value, NULL
// while there is no rate: never 0), the account's total and missing-rate count (v_account_balance).
// Nothing here is stored or computed twice.
import { periodOfDate } from '../../core/date';
import type { Db } from '../../data/db/types';
import { getAccountRecord } from '../../data/repo/accountDetail';
import { listPocketBalances, listPockets } from '../../data/repo/accounts';
import { listLatestRates } from '../../data/repo/fx';
import { getMonthStartDay } from '../../domain/transactionsList';

export interface ValasPocket {
  currency: string;
  minorFactor: number;
  balance: number; // minor units of the currency
  rateE4: number | null; // the rate the value uses; null when there is none
  rateAt: string | null;
  valueIdr: number | null; // rupiah at that rate; null when there is no rate
  openingBalance: number;
  openingDate: string;
}

export interface ValasDetail {
  id: number;
  name: string;
  openingDate: string;
  pockets: ValasPocket[]; // not archived, in currency order
  totalIdr: number; // sum of the pockets that have a rate
  missingRates: number; // pockets with money and no rate
  latestRateAt: string | null; // newest fetched_at among the rates in use
  period: string; // the month the activity shows, 'YYYY-MM'
}

export async function getValasDetail(db: Db, accountId: number, todayIso: string): Promise<ValasDetail | null> {
  const account = await getAccountRecord(db, accountId);
  if (!account || account.type !== 'forex') return null;
  const [balances, values, startDay, total, pocketRows] = await Promise.all([
    listPocketBalances(db, accountId),
    listPockets(db, accountId),
    getMonthStartDay(db),
    db.getFirstAsync<{ balance: number; missing_rates: number }>('select balance, missing_rates from v_account_balance where id = $id', { $id: accountId }),
    db.getAllAsync<{ currency: string; opening_balance: number; opening_date: string }>(
      'select currency, opening_balance, opening_date from v_pocket where account_id = $id and archived = 0',
      { $id: accountId },
    ),
  ]);
  const valueBy = new Map(values.map(v => [v.currency, v] as const));
  const openingBy = new Map(pocketRows.map(p => [p.currency, p] as const));
  const pockets = balances
    .filter(b => b.archived === 0)
    .map<ValasPocket>(b => {
      const v = valueBy.get(b.currency);
      const o = openingBy.get(b.currency);
      return {
        currency: b.currency,
        minorFactor: b.minor_factor,
        balance: b.balance,
        rateE4: v?.rate_e4 ?? null,
        rateAt: v?.rate_at ?? null,
        valueIdr: v?.value_idr ?? null,
        openingBalance: o?.opening_balance ?? 0,
        openingDate: o?.opening_date ?? account.opening_date,
      };
    });
  const rates = await listLatestRates(db);
  const inUse = new Set(pockets.map(p => p.currency));
  const latestRateAt = rates.filter(r => inUse.has(r.currency)).reduce<string | null>((n, r) => (!n || r.fetched_at > n ? r.fetched_at : n), null);
  return {
    id: account.id,
    name: account.name,
    openingDate: account.opening_date,
    pockets,
    totalIdr: total?.balance ?? 0,
    missingRates: total?.missing_rates ?? 0,
    latestRateAt,
    period: periodOfDate(todayIso.slice(0, 10), startDay),
  };
}

export interface ValasActivityItem {
  id: number;
  date: string;
  title: string;
  kind: 'income' | 'expense' | 'transfer_out' | 'transfer_in';
  currency: string;
  minorFactor: number;
  delta: number; // signed, minor units of `currency`
  valueIdr: number | null; // what it was worth the day it was recorded (income and expense only)
}

interface ActivityRow {
  id: number;
  occurred_on: string;
  activity_kind: 'income' | 'expense' | 'transfer' | 'transfer_in';
  currency: string;
  minor_factor: number;
  delta: number;
  amount_idr: number;
  description: string;
  category_name: string | null;
  from_name: string;
  to_name: string | null;
}

// The month's rows of the Valas account, newest first; one currency or all of them.
export async function listValasActivity(
  db: Db,
  accountId: number,
  period: string,
  currency: string | 'all',
  kindFallback: (kind: ValasActivityItem['kind']) => string,
): Promise<ValasActivityItem[]> {
  const only = currency === 'all' ? '' : 'and a.currency = $currency';
  const rows = await db.getAllAsync<ActivityRow>(
    `select a.tx_id as id, a.occurred_on, a.kind as activity_kind, a.currency, c.minor_factor, a.delta,
            t.amount_idr, t.description, cat.name as category_name, fa.name as from_name, ta.name as to_name
     from v_account_activity a
     join v_tx t on t.id = a.tx_id
     join currencies c on c.code = a.currency
     join accounts fa on fa.id = t.account_id
     left join accounts ta on ta.id = t.to_account_id
     left join categories cat on cat.id = t.category_id
     where a.account_id = $id and t.period = $period ${only}
     order by a.occurred_on desc, t.created_at desc, a.tx_id desc`,
    currency === 'all' ? { $id: accountId, $period: period } : { $id: accountId, $period: period, $currency: currency },
  );
  return rows.map(row => {
    const kind: ValasActivityItem['kind'] = row.activity_kind === 'transfer' ? 'transfer_out' : row.activity_kind;
    const description = row.description.trim();
    const title = description || (kind === 'transfer_out' ? `→ ${row.to_name ?? ''}`.trim() : kind === 'transfer_in' ? `← ${row.from_name}` : (row.category_name ?? kindFallback(kind)));
    return {
      id: row.id,
      date: row.occurred_on,
      title,
      kind,
      currency: row.currency,
      minorFactor: row.minor_factor,
      delta: row.delta,
      valueIdr: kind === 'income' || kind === 'expense' ? row.amount_idr : null,
    };
  });
}

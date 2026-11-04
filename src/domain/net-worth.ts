// Net worth is the sum of every account's balance (CLAUDE.md rule 13): when a pocket has
// no fx rate yet, it is valued at nothing for the sum but `incomplete` is set so the UI
// can say so, rather than quietly showing a number that is wrong.
import * as repo from '../data/repo/netWorth';
import type { Db } from '../data/db/types';

export interface NetWorth {
  netWorth: number;
  incomplete: boolean;
}

export async function getNetWorth(db: Db): Promise<NetWorth> {
  const row = await repo.getNetWorth(db);
  return { netWorth: row.net_worth, incomplete: !!row.incomplete };
}

export interface NetWorthMonth {
  month: string;
  netWorth: number;
}

export async function getNetWorthHistory(db: Db): Promise<NetWorthMonth[]> {
  const rows = await repo.listNetWorthByMonth(db);
  return rows.map(r => ({ month: r.month, netWorth: r.net_worth }));
}

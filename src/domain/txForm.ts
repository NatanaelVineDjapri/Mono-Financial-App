// What the transaction form reads: the accounts it may use (balance and opening date), the Valas
// account's pockets and the latest rates, the categories by kind and, when editing, the record itself.
// Everything is a view read; the form writes nothing from here. When editing, each balance is taken
// WITHOUT the record being edited, so changing its amount is judged against what the account (or
// pocket) had before it.
import type { Db } from '../data/db/types';
import { listAccountsForForm } from '../data/repo/accounts';
import { getCategory, listCategories } from '../data/repo/categories';
import { listLatestRates } from '../data/repo/fx';
import { getTransaction, type TransactionRow } from '../data/repo/transactions';
import { getSubcategory, listFormSubcategories } from '../data/repo/subcategories';
import type { FormAccount, FormCategory, FormPocket, FormSubcategory, TxType } from '../core/tx/validate';
import { getTransactionLocation, type TransactionLocation } from '../data/repo/transactionLocations';

export interface TxEditRecord {
  id: number;
  type: TxType;
  accountId: number;
  toAccountId: number | null;
  categoryId: number | null;
  subcategoryId?: number | null;
  amount: number;
  amountTo: number | null;
  date: string;
  description: string;
  note: string;
  currency: string;
  toCurrency: string | null;
  // Every record can be edited: a Valas one through its pocket (its rupiah value is frozen again
  // only when its amount, currency or account changes).
  supported: boolean;
  snapshot: TransactionRow;
  location?: TransactionLocation | null;
}

export interface TxFormData {
  accounts: FormAccount[];
  categories: FormCategory[];
  subcategories?: FormSubcategory[]; // active ones of active categories, plus the edited record's own even if archived
  pockets: FormPocket[]; // the pockets of the Valas account (not archived)
  rates: Record<string, number>; // latest rate_e4 per foreign currency
  record: TxEditRecord | null;
}

type RecordEffect = Pick<TransactionRow, 'kind' | 'account_id' | 'to_account_id' | 'amount' | 'amount_to' | 'currency' | 'to_currency'>;

// The rupiah accounts' balances as they were before `record` existed: its effect taken back out.
// A Valas account is judged by its pockets (withoutRecordPockets), not by this balance.
export function withoutRecord(accounts: FormAccount[], record: Pick<RecordEffect, 'kind' | 'account_id' | 'to_account_id' | 'amount' | 'amount_to'> & Partial<Pick<RecordEffect, 'currency' | 'to_currency'>>): FormAccount[] {
  return accounts.map(account => {
    if (account.type === 'forex') return account;
    let balance = account.balance;
    if (account.id === record.account_id) balance += record.kind === 'income' ? -record.amount : record.amount;
    if (account.id === record.to_account_id) balance -= record.amount_to ?? record.amount;
    return balance === account.balance ? account : { ...account, balance };
  });
}

// The same for the Valas pockets.
export function withoutRecordPockets(pockets: FormPocket[], record: RecordEffect): FormPocket[] {
  return pockets.map(pocket => {
    let balance = pocket.balance;
    if (pocket.accountId === record.account_id && pocket.currency === record.currency) balance += record.kind === 'income' ? -record.amount : record.amount;
    if (pocket.accountId === record.to_account_id && pocket.currency === record.to_currency) balance -= record.amount_to ?? record.amount;
    return balance === pocket.balance ? pocket : { ...pocket, balance };
  });
}

interface PocketRow {
  account_id: number;
  currency: string;
  minor_factor: number;
  balance: number;
  opening_date: string;
}

export async function getTxFormData(db: Db, editId?: number): Promise<TxFormData> {
  const [accountRows, categoryRows, subcategoryRows, row, pocketRows, rateRows] = await Promise.all([
    listAccountsForForm(db),
    listCategories(db),
    listFormSubcategories(db),
    editId != null ? getTransaction(db, editId) : Promise.resolve(null),
    db.getAllAsync<PocketRow>(
      `select b.account_id, b.currency, b.minor_factor, b.balance, p.opening_date
       from v_pocket_balance b
       join v_pocket p on p.account_id = b.account_id and p.currency = b.currency
       join accounts a on a.id = b.account_id
       where a.type = 'forex' and a.archived = 0 and b.archived = 0
       order by b.account_id, b.currency`,
    ),
    listLatestRates(db),
  ]);

  let accounts: FormAccount[] = accountRows.map(a => ({
    id: a.id,
    name: a.name,
    type: a.type,
    icon: a.icon,
    balance: a.balance,
    openingDate: a.opening_date,
  }));
  let pockets: FormPocket[] = pocketRows.map(p => ({ accountId: p.account_id, currency: p.currency, minorFactor: p.minor_factor, balance: p.balance, openingDate: p.opening_date }));
  // The same for an account archived since the record was saved (the Valas account is never archived).
  for (const accountId of [row?.account_id, row?.to_account_id]) {
    if (accountId == null || accounts.some(a => a.id === accountId)) continue;
    const kept = await db.getFirstAsync<{ id: number; name: string; type: FormAccount['type']; icon: string | null; opening_date: string; balance: number }>(
      `select a.id, a.name, a.type, a.icon, a.opening_date, vb.balance
         from accounts a join v_account_balance vb on vb.id = a.id
        where a.id = $id and a.archived = 1`,
      { $id: accountId },
    );
    if (kept) accounts.push({ id: kept.id, name: kept.name, type: kept.type, icon: kept.icon, balance: kept.balance, openingDate: kept.opening_date });
  }
  const categories: FormCategory[] = categoryRows.map(c => ({ id: c.id, name: c.name, kind: c.kind }));
  // A new transaction only offers active categories. A record edited later may still carry a category
  // that has been archived since: it stays selectable here (so the person can keep it) but is not
  // offered to anything else.
  if (row?.category_id != null && !categories.some(c => c.id === row.category_id)) {
    const kept = await getCategory(db, row.category_id);
    if (kept) categories.push({ id: kept.id, name: kept.name, kind: kept.kind });
  }
  const subcategories: FormSubcategory[] = subcategoryRows.map(s => ({ id: s.id, categoryId: s.category_id, name: s.name }));
  // The same for a sub-category archived since the record was saved: the record keeps it.
  if (row?.subcategory_id != null && !subcategories.some(s => s.id === row.subcategory_id)) {
    const kept = await getSubcategory(db, row.subcategory_id);
    if (kept) subcategories.push({ id: kept.id, categoryId: kept.category_id, name: kept.name });
  }
  const rates: Record<string, number> = Object.fromEntries(rateRows.map(r => [r.currency, r.rate_e4]));

  let record: TxEditRecord | null = null;
  if (row) {
    accounts = withoutRecord(accounts, row);
    pockets = withoutRecordPockets(pockets, row);
    record = {
      id: row.id,
      type: row.kind,
      accountId: row.account_id,
      toAccountId: row.to_account_id,
      categoryId: row.category_id,
      subcategoryId: row.subcategory_id ?? null,
      amount: row.amount,
      amountTo: row.amount_to,
      date: row.occurred_on,
      description: row.description,
      note: row.note ?? '',
      currency: row.currency,
      toCurrency: row.to_currency,
      supported: true,
      snapshot: row,
      location: await getTransactionLocation(db, row.id),
    };
  }
  return { accounts, categories, subcategories, pockets, rates, record };
}

// What the transaction form reads: the accounts it may use (balance and opening date), the
// categories by kind and, when editing, the record itself. Everything is a view read; the form
// writes nothing from here. When editing, each account's balance is taken WITHOUT the record
// being edited, so changing its amount is judged against what the account had before it.
import type { Db } from '../data/db/types';
import { listAccountsForForm } from '../data/repo/accounts';
import { listCategories } from '../data/repo/categories';
import { getTransaction, type TransactionRow } from '../data/repo/transactions';
import type { FormAccount, FormCategory, TxType } from '../core/tx/validate';

export interface TxEditRecord {
  id: number;
  type: TxType;
  accountId: number;
  toAccountId: number | null;
  categoryId: number | null;
  amount: number;
  date: string;
  description: string;
  note: string;
  currency: string;
  toCurrency: string | null;
  // Only rupiah records can be edited here; Valas ones come with the Valas form.
  supported: boolean;
  snapshot: TransactionRow;
}

export interface TxFormData {
  accounts: FormAccount[];
  categories: FormCategory[];
  record: TxEditRecord | null;
}

// The accounts' balances as they were before `record` existed: its effect taken back out.
export function withoutRecord(accounts: FormAccount[], record: Pick<TransactionRow, 'kind' | 'account_id' | 'to_account_id' | 'amount' | 'amount_to' | 'currency'>): FormAccount[] {
  if (record.currency !== 'IDR') return accounts;
  return accounts.map(account => {
    let balance = account.balance;
    if (account.id === record.account_id) balance += record.kind === 'income' ? -record.amount : record.amount;
    if (account.id === record.to_account_id) balance -= record.amount_to ?? record.amount;
    return balance === account.balance ? account : { ...account, balance };
  });
}

export async function getTxFormData(db: Db, editId?: number): Promise<TxFormData> {
  const [accountRows, categoryRows, row] = await Promise.all([
    listAccountsForForm(db),
    listCategories(db),
    editId != null ? getTransaction(db, editId) : Promise.resolve(null),
  ]);

  let accounts: FormAccount[] = accountRows.map(a => ({
    id: a.id,
    name: a.name,
    type: a.type,
    icon: a.icon,
    balance: a.balance,
    openingDate: a.opening_date,
  }));
  const categories: FormCategory[] = categoryRows.map(c => ({ id: c.id, name: c.name, kind: c.kind }));

  let record: TxEditRecord | null = null;
  if (row) {
    accounts = withoutRecord(accounts, row);
    record = {
      id: row.id,
      type: row.kind,
      accountId: row.account_id,
      toAccountId: row.to_account_id,
      categoryId: row.category_id,
      amount: row.amount,
      date: row.occurred_on,
      description: row.description,
      note: row.note ?? '',
      currency: row.currency,
      toCurrency: row.to_currency,
      supported: row.currency === 'IDR' && (row.to_currency == null || row.to_currency === 'IDR'),
      snapshot: row,
    };
  }
  return { accounts, categories, record };
}

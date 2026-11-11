import { MonoColors } from '../../../theme/tokens';
import { evaluateDrafts, type Draft } from '../draft';
import { processResponse, type InterpretResult } from '../interpret';
import { amountView, batchSummary, draftRows, draftSpokenLabel, draftTitle, type Names } from '../ui/draftView';
import { ACCOUNTS, CATEGORIES, CTX, response, tx } from './fixtures';

const names: Names = {
  accounts: new Map(ACCOUNTS.map(a => [a.id, a.name])),
  categories: new Map(CATEGORIES.map(c => [c.id, c.name])),
};

function draftsOf(...items: Parameters<typeof tx>[0][]): Draft[] {
  const result: InterpretResult = processResponse(response('create_transactions', items.map(i => tx(i))), `beli ${items.map(i => i?.amount_text).join(', ')}`, CTX);
  if (result.kind !== 'drafts') throw new Error(result.kind);
  return result.drafts;
}

const kopi = { amount: 25000, amount_text: '25rb', description: 'Kopi', category: 'Food & drink', account: 'GoPay' };

describe('amountView', () => {
  test('colour follows meaning and the sign follows arithmetic; a transfer is never coloured', () => {
    expect(amountView('expense', 25000, false)).toEqual({ text: '−Rp25.000', color: MonoColors.negative });
    expect(amountView('income', 8000000, false)).toEqual({ text: '+Rp8.000.000', color: MonoColors.positive });
    expect(amountView('transfer', 500000, false)).toEqual({ text: 'Rp500.000', color: MonoColors.text });
  });

  test('hidden-amounts mode masks every figure', () => {
    for (const kind of ['expense', 'income', 'transfer'] as const) {
      expect(amountView(kind, 25000, true).text).toBe('Rp••••••••');
    }
  });
});

describe('draftRows', () => {
  test('an expense: category, account, date and the balance after, from the local balances', () => {
    const [draft] = draftsOf(kopi);
    expect(draftRows(draft, names, false)).toEqual([
      { key: 'category', label: 'Kategori', value: 'Food & drink' },
      { key: 'account', label: 'Akun', value: 'GoPay' },
      { key: 'date', label: 'Tanggal', value: '28 Oct 2026' },
      { key: 'balance', label: 'Saldo GoPay setelah', value: 'Rp287.500' },
    ]);
  });

  test('a transfer has From and To and no category; the balance row is of the From account', () => {
    const [draft] = draftsOf({ type: 'transfer', amount: 500000, amount_text: '500rb', account: 'BCA Tabungan', to_account: 'Jago Pocket' });
    expect(draftRows(draft, names, false).map(r => [r.key, r.value])).toEqual([
      ['from', 'BCA Tabungan'],
      ['to', 'Jago Pocket'],
      ['date', '28 Oct 2026'],
      ['balance', 'Rp6.342.500'],
    ]);
  });

  test('a draft that is not ready shows no balance after', () => {
    const [draft] = draftsOf({ ...kopi, amount: 99999999, amount_text: '99.999.999' });
    expect(draft.status.kind).toBe('blocked');
    expect(draftRows(draft, names, false).some(r => r.key === 'balance')).toBe(false);
  });

  test('hidden mode masks the balance after', () => {
    const [draft] = draftsOf(kopi);
    expect(draftRows(draft, names, true).find(r => r.key === 'balance')?.value).toBe('Rp••••••••');
  });
});

describe('draftSpokenLabel and title', () => {
  test('a screen reader hears kind, title, signed amount, category, account and state', () => {
    const [draft] = draftsOf(kopi);
    expect(draftSpokenLabel(draft, names, false, false)).toBe('Draf pengeluaran, Kopi, minus Rp25.000, Food & drink, GoPay, belum tersimpan');
    expect(draftSpokenLabel(draft, names, false, true)).toBe('Draf pengeluaran, Kopi, minus Rp25.000, Food & drink, GoPay, tersimpan');
  });

  test('income and transfer', () => {
    const [income] = draftsOf({ type: 'income', amount: 8000000, amount_text: '8jt', description: 'Gaji', category: 'Salary', account: 'BCA Tabungan' });
    expect(draftSpokenLabel(income, names, false, false)).toContain('plus Rp8.000.000');
  });

  test('a draft without a description is titled by its kind', () => {
    const [draft] = draftsOf({ ...kopi, description: '' });
    expect(draftTitle(draft)).toBe('Pengeluaran');
  });
});

describe('batchSummary', () => {
  const two = () => draftsOf(
    { amount: 48000, amount_text: '48rb', description: 'Makan siang', category: 'Food & drink', account: 'Cash wallet' },
    { amount: 5000, amount_text: '5rb', description: 'Parkir', category: 'Transport', account: 'Cash wallet' },
  );

  test('total of the ticked drafts and each account after the last one', () => {
    const drafts = two();
    const summary = batchSummary(drafts, new Set(['d1', 'd2']), false);
    expect(summary.count).toBe(2);
    expect(summary.total).toEqual({ text: '−Rp53.000', color: MonoColors.negative });
    expect(summary.balances).toEqual([{ accountId: 2, balanceAfter: 397000 }]);
  });

  test('only ticked and ready drafts count', () => {
    const drafts = two();
    expect(batchSummary(drafts, new Set(['d2']), false).total.text).toBe('−Rp5.000');
    expect(batchSummary(drafts, new Set(), false).count).toBe(0);
  });

  test('income minus expense, signed; only transfers is the sum moved, uncoloured', () => {
    const mixed = draftsOf(
      { type: 'income', amount: 8000000, amount_text: '8jt', category: 'Salary', account: 'BCA Tabungan' },
      { amount: 48000, amount_text: '48rb', category: 'Food & drink', account: 'Cash wallet' },
    );
    expect(batchSummary(mixed, new Set(['d1', 'd2']), false).total).toEqual({ text: '+Rp7.952.000', color: MonoColors.positive });

    const moved = draftsOf({ type: 'transfer', amount: 500000, amount_text: '500rb', account: 'BCA Tabungan', to_account: 'Jago Pocket' });
    const summary = batchSummary(moved, new Set(['d1']), false);
    expect(summary.total).toEqual({ text: 'Rp500.000', color: MonoColors.text });
    expect(summary.balances.map(b => b.accountId).sort()).toEqual([1, 4]);
  });

  test('re-evaluating with a selection changes what the rest is judged against', () => {
    const drafts = draftsOf(
      { amount: 300000, amount_text: '300rb', category: 'Shopping', account: 'Cash wallet' },
      { amount: 200000, amount_text: '200rb', category: 'Shopping', account: 'Cash wallet' },
    );
    expect(drafts[1].status.kind).toBe('blocked');
    expect(evaluateDrafts(drafts, CTX, new Set(['d2']))[1].status.kind).toBe('ready');
  });

  test('hidden mode masks the total', () => {
    expect(batchSummary(two(), new Set(['d1', 'd2']), true).total.text).toBe('Rp••••••••');
  });
});

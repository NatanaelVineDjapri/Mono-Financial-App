import { openMigratedTestDb } from '@/data/db/openTestDb';
import { createBudget, setMonthlyLimit } from '@/data/repo/budgets';
import { listCategories } from '@/data/repo/categories';
import { createAccount } from '@/domain/accounts';
import { addExpense, addIncome } from '@/domain/transactions';
import { buildAnalysisRequest } from '@/features/ai_chat/analysisAi';

import { getAnalysis } from '../../data';
import { analysisAiFingerprint, buildAnalysisAiInput } from '../aiInput';

const NOW = '2026-10-28T10:00:00+07:00';
const TODAY = '2026-10-28';

async function sample() {
  const db = (await openMigratedTestDb());
  const accountId = await createAccount(db, { name: 'BCA Rahasia', type: 'bank', openingBalance: 1_200_000, openingDate: '2026-05-01' }, NOW);
  const categories = await listCategories(db);
  const byName = (n: string) => categories.find(c => c.name === n)!.id;
  for (const month of ['05', '06', '07', '08', '09']) {
    await addIncome(db, { accountId, currency: 'IDR', categoryId: byName('Salary'), amount: 1_500_000, occurredOn: `2026-${month}-05` }, NOW);
    await addExpense(db, { accountId, currency: 'IDR', categoryId: byName('Food & drink'), amount: 500_000, occurredOn: `2026-${month}-10`, description: 'Makan' }, NOW);
  }
  await addIncome(db, { accountId, currency: 'IDR', categoryId: byName('Salary'), amount: 7_500_000, occurredOn: '2026-10-25' }, NOW);
  const expenses: [string, number, string][] = [
    ['Shopping', 812_000, 'Sepatu lari Toko 081234567890'],
    ['Bills', 1_150_000, 'Listrik'],
    ['Transport', 540_000, 'Bensin'],
    ['Food & drink', 1_425_000, 'Belanja bulanan'],
    ['Leisure', 210_000, 'Bioskop'],
    ['Health', 120_000, 'Vitamin'],
  ];
  for (const [name, amount, description] of expenses) {
    await addExpense(db, { accountId, currency: 'IDR', categoryId: byName(name), amount, occurredOn: '2026-10-20', description }, NOW);
  }
  await setMonthlyLimit(db, '2026-10', 5_000_000);
  await createBudget(db, { categoryId: byName('Shopping'), month: '2026-10', limitAmount: 700_000 });
  await createBudget(db, { categoryId: byName('Bills'), month: '2026-10', limitAmount: 1_200_000 });
  return db;
}

describe('what the AI review is allowed to see', () => {
  test('the figures of the score, spending per category and the biggest expenses of the period', async () => {
    const db = await sample();
    const data = await getAnalysis(db, '2026-10', TODAY);
    const input = await buildAnalysisAiInput(db, data);
    expect(input).not.toBeNull();
    expect(input).toMatchObject({
      period: '2026-10',
      running: true,
      score: expect.any(Number),
      income: 7_500_000,
      expense: 4_257_000,
      savingsRatePct: 43,
    });
    expect(input!.parts.map(p => p.id)).toEqual(['savings', 'budget', 'emergency', 'fixed', 'wealth']);
    expect(input!.budgets).toEqual([
      { category: 'Shopping', limit: 700_000, spent: 812_000 },
      { category: 'Bills', limit: 1_200_000, spent: 1_150_000 },
    ]);
    expect(input!.categories[0]).toEqual({ category: 'Food & drink', amount: 1_425_000, sharePct: 33 });
    expect(input!.trend).toHaveLength(6);
    // biggest first, this period only
    expect(input!.topExpenses.map(t => t.amount)).toEqual([1_425_000, 1_150_000, 812_000, 540_000, 210_000, 120_000]);
    expect(input!.topExpenses[0]).toEqual({ date: '2026-10-20', description: 'Belanja bulanan', category: 'Food & drink', amount: 1_425_000 });
  });

  test('at most 10 expenses and never a transfer', async () => {
    const db = await sample();
    const data = await getAnalysis(db, '2026-10', TODAY);
    expect((await buildAnalysisAiInput(db, data))!.topExpenses.length).toBeLessThanOrEqual(10);
  });

  test('the request that leaves the phone has no account name, and a phone number in a description is blanked', async () => {
    const db = await sample();
    const data = await getAnalysis(db, '2026-10', TODAY);
    const text = buildAnalysisRequest((await buildAnalysisAiInput(db, data))!).contents[0].parts[0].text;
    expect(text).not.toContain('BCA Rahasia');
    expect(text).not.toContain('081234567890');
    expect(text).toContain('Sepatu lari Toko #');
  });

  test('a period that cannot be scored yet gives nothing to send', async () => {
    const db = (await openMigratedTestDb());
    const data = await getAnalysis(db, '2026-10', TODAY);
    expect(await buildAnalysisAiInput(db, data)).toBeNull();
  });
});

describe('when the review is asked again', () => {
  test('the same figures give the same fingerprint, new totals a new one', async () => {
    const db = await sample();
    const first = await getAnalysis(db, '2026-10', TODAY);
    const again = await getAnalysis(db, '2026-10', TODAY);
    expect(analysisAiFingerprint(first)).toBe(analysisAiFingerprint(again));
    const categories = await listCategories(db);
    const accountId = (await db.getFirstAsync<{ id: number }>('select id from accounts'))!.id;
    await addExpense(db, { accountId, currency: 'IDR', categoryId: categories.find(c => c.name === 'Leisure')!.id, amount: 50_000, occurredOn: '2026-10-27' }, NOW);
    expect(analysisAiFingerprint(await getAnalysis(db, '2026-10', TODAY))).not.toBe(analysisAiFingerprint(first));
  });

  test('another period is another review', async () => {
    const db = await sample();
    expect(analysisAiFingerprint(await getAnalysis(db, '2026-09', TODAY))).not.toBe(analysisAiFingerprint(await getAnalysis(db, '2026-10', TODAY)));
  });
});

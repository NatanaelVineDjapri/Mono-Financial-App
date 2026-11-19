import { computeHealth, buildInsights, type InsightInput } from '@/domain/health';
import { useLanguage } from '@/i18n/lang';
import { setNumberFormat } from '@/core/money';

import { countedNote, goodSentence, improvementCard, monthsText, partRows, summarySentence, watchCard } from '../copy';

const OCTOBER: InsightInput = {
  income: 7_500_000,
  expense: 4_257_000,
  budgets: [
    { categoryId: 1, name: 'Shopping', limit: 700_000, spent: 812_000 },
    { categoryId: 2, name: 'Bills', limit: 1_200_000, spent: 1_150_000 },
    { categoryId: 3, name: 'Transport', limit: 600_000, spent: 540_000 },
    { categoryId: 4, name: 'Food & drink', limit: 1_800_000, spent: 1_425_000 },
    { categoryId: 5, name: 'Leisure', limit: 400_000, spent: 210_000 },
    { categoryId: 6, name: 'Health', limit: 300_000, spent: 120_000 },
  ],
  balance: 8_880_000,
  fixedMonthly: 1_201_990,
  netWorthSeries: [1_000_000, 2_000_000, 3_000_000, 4_000_000, 5_637_000, 8_880_000],
  dayOfPeriod: 28,
  previousExpense: 3_900_000,
  transactionCount: 11,
  dataSpanDays: 28,
  accountCount: 4,
  daysLeft: 3,
};

const ctx = { money: (n: number) => `Rp${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}` };

function run(input: InsightInput) {
  const result = computeHealth(input);
  if (!result.eligible) throw new Error('expected a score');
  return { result, insights: buildInsights(input, result) };
}

beforeEach(() => {
  setNumberFormat('id_ID');
});

describe('Indonesian copy for the October sample (the Analyze board)', () => {
  const { result, insights } = run(OCTOBER);

  test('the sentence on the score card', () => {
    const text = summarySentence({ band: result.band, running: true, period: '2026-10', components: result.components, insights, overBudgets: 1 });
    expect(text).toBe('Bulan ini keuanganmu sehat. Tabunganmu kuat, tapi dana darurat baru 2,1 bulan dan satu anggaran melebihi batas.');
  });

  test('the five rows', () => {
    const rows = partRows(result.components, insights.weakestId, OCTOBER);
    expect(rows.map(r => [r.name, `${r.points}/${r.max}`])).toEqual([
      ['Tingkat tabungan', '25/25'], ['Disiplin anggaran', '21/25'], ['Dana darurat', '7/20'], ['Pengeluaran tetap', '15/15'], ['Arah kekayaan bersih', '15/15'],
    ]);
    expect(rows.map(r => r.detail)).toEqual([
      '43,24% dari pemasukan · target 20% atau lebih',
      '5 dari 6 anggaran dalam batas',
      '2,1 bulan pengeluaran · target 6 bulan',
      '16,03% dari pemasukan · sehat di bawah 20%',
      'Naik 5 bulan berturut-turut',
    ]);
    expect(rows.filter(r => r.lowest).map(r => r.id)).toEqual(['emergency']);
  });

  test('what could raise it', () => {
    const [budget, emergency] = insights.improvements.map(i => improvementCard(i, ctx, '2026-10'));
    expect(budget.title).toBe('Shopping melebihi batas');
    expect(budget.chip).toBe('+4 poin');
    expect(budget.body).toBe('Terpakai Rp812.000 dari batas Rp700.000, lebih Rp112.000. Kalau semua anggaran dalam batas, nilai disiplin anggaran penuh.');
    expect(budget.foot).toBe('116,00% terpakai · 3 hari tersisa');
    expect(budget.bar).toEqual({ kind: 'over', fillBp: 11600, overAmount: 112_000 });
    expect(budget.link.target).toEqual({ pathname: '/budget/category/[id]', params: { id: '1', month: '2026-10' } });
    expect(emergency.title).toBe('Dana darurat baru 2,1 bulan');
    expect(emergency.chip).toBe('+3 poin');
    expect(emergency.body).toBe('Saldo semua akunmu setara 2,1 bulan pengeluaran. Menambah Rp3.891.000 membawanya ke 3 bulan.');
    expect(emergency.link.target).toEqual({ pathname: '/goals' });
  });

  test('heads up', () => {
    const card = watchCard(insights.watch!, ctx);
    expect(card.title).toBe('Bills hampir penuh');
    expect(card.body).toBe('Bills sudah 95,83% dari batas Rp1.200.000 dan hanya tersisa Rp50.000 untuk 3 hari. Transport juga sudah 90,00%.');
  });

  test('already going well', () => {
    const sentences = insights.good.map(g => goodSentence(g, ctx, 'September'));
    expect(sentences).toEqual([
      'Kamu menabung 43,24% dari pemasukan, jauh di atas target 20%.',
      'Pengeluaran tetap Rp1.201.990 per bulan, hanya 16,03% dari pemasukan.',
      'Kekayaan bersih Rp8.880.000, naik Rp3.243.000 (+57,53%) dari akhir September.',
    ]);
  });

  test('every part is counted: no note', () => {
    expect(countedNote(result.components, result.countedOf)).toBeNull();
  });
});

describe('parts skipped for lack of data (3 of 5)', () => {
  const input = { ...OCTOBER, budgets: [], fixedMonthly: 0 };
  const { result, insights } = run(input);

  test('the note and the nudge', () => {
    expect(result.score).toBe(79);
    expect(countedNote(result.components, result.countedOf)).toBe('Skor ini dihitung dari 3 dari 5 hal, karena belum ada anggaran dan pengeluaran tetap.');
    const text = summarySentence({ band: result.band, running: true, period: '2026-10', components: result.components, insights, overBudgets: 0 });
    expect(text).toBe('Bulan ini keuanganmu cukup baik. Tabunganmu kuat dan kekayaan bersihmu terus naik. Tambahkan anggaran dan pengeluaran tetap supaya skor lebih lengkap.');
  });

  test('skipped rows say so and link to where it is fixed', () => {
    const rows = partRows(result.components, insights.weakestId, input);
    const budget = rows.find(r => r.id === 'budget')!;
    expect(budget.skipped).toBe(true);
    expect(budget.skippedLink).toEqual({ label: 'Buat anggaran', target: { pathname: '/(tabs)/budgets' } });
    expect(rows.find(r => r.id === 'fixed')!.skippedLink?.label).toBe('Tambah pengeluaran tetap');
  });
});

describe('a low score keeps a calm tone', () => {
  test('no blame, one gentle observation', () => {
    const input: InsightInput = { ...OCTOBER, income: 5_000_000, expense: 4_800_000, balance: 99_000_000, fixedMonthly: 0, netWorthSeries: [5, 4, 3, 4, 3, 2], budgets: [] };
    const { result, insights } = run(input);
    expect(['weak', 'needs_work']).toContain(result.band);
    const text = summarySentence({ band: result.band, running: true, period: '2026-11', components: result.components, insights, overBudgets: 0 });
    expect(text).toContain('Pengeluaran hampir sama dengan pemasukan, jadi hanya sedikit yang tersisa untuk ditabung.');
    expect(text.toLowerCase()).not.toMatch(/buruk|gagal|salah|boros/);
  });
});

describe('English', () => {
  test('the same facts in English', () => {
    useLanguage.setState({ language: 'en' });
    const { result, insights } = run(OCTOBER);
    const text = summarySentence({ band: result.band, running: true, period: '2026-10', components: result.components, insights, overBudgets: 1 });
    expect(text).toBe('Your finances look healthy this month. Your savings are strong, but the emergency fund is only 2,1 months and one budget is over its limit.');
  });
});

test('monthsText rounds half up to one decimal, or shows two', () => {
  expect(monthsText(209)).toBe('2,1');
  expect(monthsText(205)).toBe('2,1');
  expect(monthsText(204)).toBe('2,0');
  expect(monthsText(600)).toBe('6,0');
  expect(monthsText(209, 2)).toBe('2,09');
  expect(monthsText(7, 2)).toBe('0,07');
  setNumberFormat('en_US');
  expect(monthsText(209)).toBe('2.1');
});

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useHideAmounts } from '@/components/hide-amounts-store';
import { buildInsights, computeHealth, type InsightInput } from '@/domain/health';
import type { AnalysisData, TrendPoint } from '@/features/analysis/data';
import { useAnalysis } from '@/features/analysis/useAnalysis';

import AnalysisScreen from '../analysis';

jest.mock('@/features/analysis/useAnalysis');
jest.mock('@/features/analysis/ai/useAiAnalysis', () => ({ useAiAnalysis: () => ({ state: { kind: 'hidden' }, allow: jest.fn(), turnOff: jest.fn(), notNow: jest.fn(), retry: jest.fn() }) }));
jest.mock('@/features/reports/useReport', () => ({ useMonthStartDay: () => 1 }));
const mockUseAnalysis = useAnalysis as jest.MockedFunction<typeof useAnalysis>;

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

const METRICS = { insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 390, height: 844 } };

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
  netWorthSeries: [2_200_000, 3_200_000, 4_200_000, 5_000_000, 5_637_000, 8_880_000],
  dayOfPeriod: 28,
  previousExpense: 3_900_000,
  transactionCount: 18,
  dataSpanDays: 180,
  accountCount: 2,
  daysLeft: 3,
};

const TREND: TrendPoint[] = [
  { period: '2026-05', score: null, band: null, partial: false },
  { period: '2026-06', score: 52, band: 'weak', partial: false },
  { period: '2026-07', score: 61, band: 'fair', partial: false },
  { period: '2026-08', score: 70, band: 'fair', partial: false },
  { period: '2026-09', score: 77, band: 'fair', partial: false },
  { period: '2026-10', score: 83, band: 'healthy', partial: true },
];

function dataFor(input: InsightInput, patch: Partial<AnalysisData> = {}): AnalysisData {
  const result = computeHealth(input);
  return {
    period: '2026-10',
    currentPeriod: '2026-10',
    running: true,
    rangeStart: '2026-10-01',
    rangeEnd: '2026-10-28',
    today: '2026-10-28',
    earliestPeriod: '2026-05',
    analysis: {
      period: '2026-10',
      input,
      result,
      insights: result.eligible ? buildInsights(input, result) : null,
      overBudgets: input.budgets.filter(b => b.spent > b.limit).length,
    },
    previousPeriod: '2026-09',
    previousScore: 77,
    trend: TREND,
    ...patch,
  };
}

async function show(data: AnalysisData | undefined, extra: Partial<ReturnType<typeof useAnalysis>> = {}) {
  mockUseAnalysis.mockReturnValue({ data, isError: false, refetch: jest.fn(), ...extra } as unknown as ReturnType<typeof useAnalysis>);
  return await render(<SafeAreaProvider initialMetrics={METRICS}><AnalysisScreen /></SafeAreaProvider>);
}

// The text inside a rendered element, read from its props (nested elements included).
function walk(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(walk).join('');
  return walk((node as { props?: { children?: unknown } }).props?.children);
}
const text = (id: string) => walk(screen.getByTestId(id).props.children);

beforeEach(async () => {
  jest.clearAllMocks();
  await act(async () => {
    useHideAmounts.setState({ hidden: false });
  });
});

describe('the October 2026 score (board Analyze)', () => {
  test('header, period and the score card', async () => {
    await show(dataFor(OCTOBER));
    expect(screen.getByText('Analisis')).toBeTruthy();
    expect(screen.getByLabelText('Month: October 2026. Change month')).toBeTruthy();
    expect(text('analysis-period-range')).toBe('1 – 28 Oct 2026 · periode berjalan');
    expect(text('analysis-ring-value')).toBe('83');
    expect(text('analysis-band')).toBe('Sehat');
    expect(text('analysis-delta')).toContain('+6 dari September');
    expect(text('analysis-summary')).toBe('Bulan ini keuanganmu sehat. Tabunganmu kuat, tapi dana darurat baru 2,1 bulan dan satu anggaran melebihi batas.');
    expect(screen.getByText(/Dihitung di ponsel ini dari catatanmu. Bukan AI dan tidak dikirim ke mana pun./)).toBeTruthy();
    expect(screen.getByLabelText('Skor kesehatan keuangan 83 dari 100, Sehat')).toBeTruthy();
  });

  test('the five parts with points, details and the "Terendah" tag on the emergency fund only', async () => {
    await show(dataFor(OCTOBER));
    for (const [id, label] of [
      ['savings', 'Tingkat tabungan: 25 dari 25 poin. 43,24% dari pemasukan · target 20% atau lebih'],
      ['budget', 'Disiplin anggaran: 21 dari 25 poin. 5 dari 6 anggaran dalam batas'],
      ['emergency', 'Dana darurat: 7 dari 20 poin. 2,1 bulan pengeluaran · target 6 bulan'],
      ['fixed', 'Pengeluaran tetap: 15 dari 15 poin. 16,03% dari pemasukan · sehat di bawah 20%'],
      ['wealth', 'Arah kekayaan bersih: 15 dari 15 poin. Naik 5 bulan berturut-turut'],
    ]) {
      expect(screen.getByTestId(`analysis-part-${id}`).props.accessibilityLabel).toBe(label);
    }
    expect(screen.getAllByText('Terendah')).toHaveLength(1);
    expect(screen.getByText('Dari apa skor ini')).toBeTruthy();
    expect(screen.getByText('83 dari 100')).toBeTruthy();
  });

  test('what could raise it, with the striped over-limit bar and links', async () => {
    await show(dataFor(OCTOBER));
    expect(screen.getByText('Shopping melebihi batas')).toBeTruthy();
    expect(screen.getByText('+4 poin')).toBeTruthy();
    expect(screen.getByText(/Terpakai Rp812.000 dari batas Rp700.000, lebih Rp112.000/)).toBeTruthy();
    expect(screen.getByText('Dana darurat baru 2,1 bulan')).toBeTruthy();
    expect(screen.getByText('+3 poin')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('analysis-improve-budget_over-link'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/budget/category/[id]', params: { id: '1', month: '2026-10' } });
    await fireEvent.press(screen.getByTestId('analysis-improve-emergency-link'));
    expect(mockPush).toHaveBeenCalledWith('/goals');
  });

  test('heads up and already going well', async () => {
    await show(dataFor(OCTOBER));
    expect(screen.getByText('Bills hampir penuh')).toBeTruthy();
    expect(screen.getByText('Perhatikan')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('analysis-watch-link'));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/budgets');
    expect(screen.getByText('Yang sudah baik')).toBeTruthy();
    expect(screen.getByText('Kekayaan bersih Rp8.880.000, naik Rp3.243.000 (+57,53%) dari akhir September.')).toBeTruthy();
  });

  test('six months: bars and, beneath them, the exact values with the running month starred', async () => {
    await show(dataFor(OCTOBER));
    expect(screen.getByLabelText(/Skor kesehatan keuangan 6 bulan terakhir: .*October 83/)).toBeTruthy();
    expect(text('analysis-trend-row-2026-10')).toBe('October *83Sehat');
    expect(text('analysis-trend-row-2026-05')).toContain('Belum cukup data');
    expect(screen.getByText('* sampai 28 Oct')).toBeTruthy();
  });

  test('"Cara menghitung" opens the how-to page', async () => {
    await show(dataFor(OCTOBER));
    await fireEvent.press(screen.getByTestId('analysis-how-link'));
    expect(mockPush).toHaveBeenCalledWith('/analysis/how');
  });

  test('hidden amounts mode hides every rupiah figure in the sentences', async () => {
    await act(async () => {
      useHideAmounts.setState({ hidden: true });
    });
    await show(dataFor(OCTOBER));
    expect(screen.queryByText(/Rp8\.880\.000/)).toBeNull();
    expect(screen.queryByText(/Rp812\.000/)).toBeNull();
  });
});

describe('moving between periods (the same calendar as Budgets and Reports)', () => {
  test('the chip opens the month calendar, which stops at the first period with a record', async () => {
    await show(dataFor(OCTOBER));
    expect(screen.queryByTestId('budget-month-sheet')).toBeNull();
    await fireEvent.press(screen.getByTestId('analysis-month-chip'));
    expect(screen.getByTestId('budget-month-sheet')).toBeTruthy();
    expect(screen.getByTestId('budget-month-option-2026-10').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('budget-month-option-2026-05').props.accessibilityState.disabled).toBe(false);
    expect(screen.getByTestId('budget-month-option-2026-04').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('budget-month-option-2026-11').props.accessibilityState.disabled).toBe(true);
  });

  test('picking a month and confirming asks for that period; cancelling changes nothing', async () => {
    await show(dataFor(OCTOBER));
    await fireEvent.press(screen.getByTestId('analysis-month-chip'));
    await fireEvent.press(screen.getByTestId('budget-month-option-2026-07'));
    await fireEvent.press(screen.getByTestId('budget-month-cancel'));
    expect(mockUseAnalysis).toHaveBeenLastCalledWith(null);
    await fireEvent.press(screen.getByTestId('analysis-month-chip'));
    await fireEvent.press(screen.getByTestId('budget-month-option-2026-07'));
    await fireEvent.press(screen.getByTestId('budget-month-confirm'));
    expect(mockUseAnalysis).toHaveBeenLastCalledWith('2026-07');
  });

  test('choosing the running month goes back to following it', async () => {
    await show(dataFor(OCTOBER, { period: '2026-07', running: false, rangeStart: '2026-07-01', rangeEnd: '2026-07-31' }));
    await fireEvent.press(screen.getByTestId('analysis-month-chip'));
    await fireEvent.press(screen.getByTestId('budget-month-option-2026-10'));
    await fireEvent.press(screen.getByTestId('budget-month-confirm'));
    expect(mockUseAnalysis).toHaveBeenLastCalledWith(null);
  });

  test('a past period shows its own range with no "running"', async () => {
    await show(dataFor(OCTOBER, { period: '2026-05', running: false, rangeEnd: '2026-05-31', rangeStart: '2026-05-01' }));
    expect(text('analysis-period-range')).toBe('1 – 31 May 2026');
    expect(text('analysis-month-chip')).toContain('May 2026');
  });

  test('no change shown when the previous period could not be scored', async () => {
    await show(dataFor(OCTOBER, { previousScore: null }));
    expect(screen.queryByTestId('analysis-delta')).toBeNull();
  });

  test('a falling score is written, not coloured red', async () => {
    await show(dataFor(OCTOBER, { previousScore: 90 }));
    expect(text('analysis-delta')).toContain('−7 dari September');
  });
});

describe('parts skipped for lack of data (board Analyze-States)', () => {
  const input = { ...OCTOBER, budgets: [], fixedMonthly: 0 };

  test('the note, the shared weights and the links that fix it', async () => {
    await show(dataFor(input));
    expect(text('analysis-counted-note')).toBe('Skor ini dihitung dari 3 dari 5 hal, karena belum ada anggaran dan pengeluaran tetap.');
    expect(text('analysis-ring-value')).toBe('79');
    expect(screen.getByTestId('analysis-part-savings').props.accessibilityLabel).toContain('42 dari 42 poin');
    expect(screen.getByTestId('analysis-part-budget').props.accessibilityLabel).toBe('Disiplin anggaran: Tidak dihitung');
    await fireEvent.press(screen.getByTestId('analysis-part-budget-link'));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/budgets');
    await fireEvent.press(screen.getByTestId('analysis-part-fixed-link'));
    expect(mockPush).toHaveBeenCalledWith('/recurring/edit');
  });
});

describe('a low score (band Rawan)', () => {
  test('calm: the band is written, nothing is red, no blame', async () => {
    const input: InsightInput = { ...OCTOBER, income: 5_000_000, expense: 4_800_000, balance: 99_000_000, fixedMonthly: 0, netWorthSeries: [5, 4, 3, 4, 3, 2], budgets: [] };
    await show(dataFor(input));
    expect(['Rawan', 'Perlu dibenahi']).toContain(text('analysis-band'));
    const badge = screen.getByTestId('analysis-band');
    expect(JSON.stringify(badge.props.style)).not.toContain('#FF6B6B');
    expect(text('analysis-summary')).toContain('Pengeluaran hampir sama dengan pemasukan');
  });
});

describe('not ready yet (board Analyze-States)', () => {
  test('lists what is needed with what is there, and a button to add a transaction', async () => {
    await show(dataFor({ ...OCTOBER, transactionCount: 6, dataSpanDays: 9, accountCount: 4 }));
    expect(screen.getByText('Skor belum bisa dihitung')).toBeTruthy();
    expect(screen.getByText('Yang dibutuhkan')).toBeTruthy();
    expect(screen.getByText('4 akun sudah ada')).toBeTruthy();
    expect(screen.getByText('Baru 6 tercatat')).toBeTruthy();
    expect(screen.getByText('Minimal 10 transaksi')).toBeTruthy();
    expect(screen.getByText('Baru ada data 9 hari')).toBeTruthy();
    expect(screen.queryByTestId('analysis-summary')).toBeNull();
    await fireEvent.press(screen.getByTestId('analysis-add-transaction'));
    expect(mockPush).toHaveBeenCalledWith('/tx/add');
  });
});

describe('loading and errors', () => {
  test('shows a calm loading line, then nothing invented', async () => {
    await show(undefined);
    expect(screen.getByTestId('analysis-loading')).toBeTruthy();
    expect(screen.queryByTestId('analysis-ring-value')).toBeNull();
  });

  test('an error offers a retry', async () => {
    const refetch = jest.fn();
    await show(undefined, { isError: true, refetch } as never);
    await fireEvent.press(screen.getByText('Coba lagi'));
    expect(refetch).toHaveBeenCalled();
  });
});

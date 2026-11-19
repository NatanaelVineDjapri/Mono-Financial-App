import {
  ANALYSIS_SYSTEM_PROMPT,
  analyzeFinances,
  buildAnalysisRequest,
  groundResponse,
  knownAmounts,
  namedAmounts,
  parseAnalysisResponse,
  sanitizeDescription,
  type AnalysisAiInput,
} from '../analysisAi';
import type { GeminiResult } from '../client';

const INPUT: AnalysisAiInput = {
  language: 'id',
  period: '2026-10',
  running: true,
  today: '2026-10-28',
  score: 83,
  band: 'healthy',
  parts: [{ id: 'savings', points: 25, max: 25, ratioPct: 100, counted: true }],
  income: 7_500_000,
  expense: 4_257_000,
  savingsRatePct: 43,
  emergencyMonths: 2.1,
  fixedMonthly: 1_201_990,
  budgets: [
    { category: 'Shopping', limit: 700_000, spent: 812_000 },
    { category: 'Bills', limit: 1_200_000, spent: 1_150_000 },
  ],
  categories: [{ category: 'Food & drink', amount: 1_425_000, sharePct: 33 }],
  trend: [{ period: '2026-09', score: 77 }, { period: '2026-10', score: 83 }],
  topExpenses: [{ date: '2026-10-20', description: 'Belanja bulanan Superindo 081234567890', category: 'Food & drink', amount: 640_000 }],
};

const GOOD = {
  summary: 'Bulan ini keuanganmu sehat. Kamu menabung 43% dari pemasukan.',
  findings: [{ title: 'Shopping melebihi batas', body: 'Terpakai Rp812.000 dari batas Rp700.000.' }],
  tips: ['Coba sisihkan sekitar Rp112.000 untuk menutup selisih Shopping.'],
};

describe('what is sent', () => {
  test('the data object only, in a strict JSON request with the system prompt', () => {
    const request = buildAnalysisRequest(INPUT);
    expect(request.systemInstruction.parts[0].text).toBe(ANALYSIS_SYSTEM_PROMPT);
    expect(request.generationConfig).toMatchObject({ responseMimeType: 'application/json' });
    const body = JSON.parse(request.contents[0].parts[0].text);
    expect(Object.keys(body)).toEqual(['data']);
    expect(body.data.score).toBe(83);
  });

  test('no account name, balance or note travels even if the object passed in carries them', () => {
    const extra = { ...INPUT, accountNames: ['BCA'], balance: 8_880_000, note: 'rahasia' } as unknown as AnalysisAiInput;
    const text = buildAnalysisRequest(extra).contents[0].parts[0].text;
    expect(text).not.toMatch(/BCA|8880000|rahasia|accountNames|balance|note/);
    expect(Object.keys(JSON.parse(text).data).sort()).toEqual(Object.keys(INPUT).sort());
  });

  test('a description is shortened and long digit runs, links and e-mail addresses are blanked', () => {
    expect(sanitizeDescription('Belanja bulanan Superindo 081234567890')).toBe('Belanja bulanan Superindo #');
    expect(sanitizeDescription('Lihat https://x.id/abc atau budi@mail.com')).toBe('Lihat atau');
    expect(sanitizeDescription('a'.repeat(100))).toHaveLength(40);
    const body = JSON.parse(buildAnalysisRequest(INPUT).contents[0].parts[0].text);
    expect(body.data.topExpenses[0].description).toBe('Belanja bulanan Superindo #');
  });

  test('at most the 10 biggest expenses go', () => {
    const many = { ...INPUT, topExpenses: Array.from({ length: 15 }, (_, i) => ({ date: '2026-10-01', description: `t${i}`, category: 'c', amount: 1000 + i })) };
    expect(JSON.parse(buildAnalysisRequest(many).contents[0].parts[0].text).data.topExpenses).toHaveLength(10);
  });
});

describe('the reply shape', () => {
  test('accepts the agreed shape', () => {
    expect(parseAnalysisResponse(JSON.stringify(GOOD))).toEqual(GOOD);
  });

  test.each([
    ['not JSON', 'halo'],
    ['an extra field', JSON.stringify({ ...GOOD, advice: 'beli saham' })],
    ['no summary', JSON.stringify({ findings: [], tips: [] })],
    ['four findings', JSON.stringify({ ...GOOD, findings: Array(4).fill({ title: 'a', body: 'b' }) })],
    ['three tips', JSON.stringify({ ...GOOD, tips: ['a', 'b', 'c'] })],
    ['a too long summary', JSON.stringify({ ...GOOD, summary: 'x'.repeat(500) })],
  ])('rejects %s', (_name, text) => {
    expect(parseAnalysisResponse(text)).toBeNull();
  });
});

describe('no invented figures', () => {
  test('amounts in wording: exact digits and rounded units', () => {
    expect(namedAmounts('Terpakai Rp812.000 dari Rp700.000')).toEqual([{ value: 812_000, exact: true }, { value: 700_000, exact: true }]);
    expect(namedAmounts('sekitar Rp1,2 juta dan 300 ribu')).toEqual([{ value: 1_200_000, exact: false }, { value: 300_000, exact: false }]);
    expect(namedAmounts('naik 12% dari 3 bulan lalu')).toEqual([]);
  });

  test('the amounts we sent are the ones that may be named', () => {
    const known = knownAmounts(INPUT);
    expect(known).toContain(812_000);
    expect(known).toContain(112_000); // a budget overshoot is in the data
    expect(known).toContain(3_243_000); // so is the month's net
  });

  test('a grounded reply passes unchanged', () => {
    expect(groundResponse(GOOD, INPUT)).toEqual(GOOD);
  });

  test('a sentence naming an amount that was never sent is dropped, the rest stays', () => {
    const r = groundResponse({ ...GOOD, summary: 'Bulan ini sehat. Kamu hemat Rp9.999.000 dari rata-rata.' }, INPUT);
    expect(r?.summary).toBe('Bulan ini sehat.');
  });

  test('a finding with nothing grounded left goes away; a tip too', () => {
    const r = groundResponse({ ...GOOD, findings: [{ title: 'Aneh', body: 'Pengeluaran Rp5.555.000.' }], tips: ['Tabung Rp7.777.000.'] }, INPUT);
    expect(r?.findings).toEqual([]);
    expect(r?.tips).toEqual([]);
  });

  test('a rounded wording within 5% is fine, a loose one is not', () => {
    const ok = groundResponse({ ...GOOD, summary: 'Pengeluaran sekitar 4,3 juta.' }, INPUT); // 4.257.000
    expect(ok?.summary).toBe('Pengeluaran sekitar 4,3 juta.');
    expect(groundResponse({ ...GOOD, summary: 'Pengeluaran sekitar 6 juta.' }, INPUT)).toBeNull();
  });

  test('without a surviving summary there is no review', () => {
    expect(groundResponse({ ...GOOD, summary: 'Total Rp9.999.000.' }, INPUT)).toBeNull();
  });
});

describe('analyzeFinances', () => {
  const ok = (body: unknown): GeminiResult => ({ ok: true, text: JSON.stringify(body) });

  test('no saved key: key_rejected, nothing is sent', async () => {
    const call = jest.fn();
    expect(await analyzeFinances(INPUT, { getKey: async () => null, call })).toEqual({ ok: false, code: 'key_rejected' });
    expect(call).not.toHaveBeenCalled();
  });

  test('a good reply comes back with the key and the request', async () => {
    const call = jest.fn(async () => ok(GOOD));
    const result = await analyzeFinances(INPUT, { getKey: async () => 'KEY', call });
    expect(result).toEqual({ ok: true, ...GOOD });
    expect(call).toHaveBeenCalledTimes(1);
    expect((call.mock.calls[0] as unknown[])[1]).toBe('KEY');
  });

  test('a reply that is not the agreed shape is tried once more, then given up on', async () => {
    const call = jest.fn(async (): Promise<GeminiResult> => ({ ok: true, text: 'bukan json' }));
    expect(await analyzeFinances(INPUT, { getKey: async () => 'KEY', call })).toEqual({ ok: false, code: 'unreadable' });
    expect(call).toHaveBeenCalledTimes(2);
  });

  test('a second try can succeed', async () => {
    const call = jest.fn()
      .mockResolvedValueOnce({ ok: true, text: 'rusak' })
      .mockResolvedValueOnce(ok(GOOD));
    expect(await analyzeFinances(INPUT, { getKey: async () => 'KEY', call })).toMatchObject({ ok: true });
  });

  test.each(['no_internet', 'quota', 'timeout', 'key_rejected', 'busy'] as const)('%s is passed on as a code, never retried', async code => {
    const call = jest.fn(async (): Promise<GeminiResult> => ({ ok: false, code }));
    expect(await analyzeFinances(INPUT, { getKey: async () => 'KEY', call })).toEqual({ ok: false, code });
    expect(call).toHaveBeenCalledTimes(1);
  });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useAiConfigured } from '@/features/ai_chat/aiEntry';
import { analyzeFinances } from '@/features/ai_chat/analysisAi';

import type { AnalysisData } from '../../data';
import { AI_ANALYSIS_CONSENT_SETTING, clearAiAnalysisCache, useAiAnalysis } from '../useAiAnalysis';

const store: Record<string, string> = {};
const mockDb = {};
jest.mock('@/data/db/DbProvider', () => ({ useDb: () => mockDb }));
jest.mock('@/data/repo/settings', () => ({
  getSetting: jest.fn(async (_db: unknown, key: string) => store[key] ?? null),
  setSetting: jest.fn(async (_db: unknown, key: string, value: string) => {
    store[key] = value;
  }),
}));
jest.mock('@/features/ai_chat/aiEntry', () => ({ useAiConfigured: jest.fn() }));
jest.mock('@/features/ai_chat/analysisAi', () => ({ analyzeFinances: jest.fn() }));
jest.mock('../aiInput', () => ({
  analysisAiFingerprint: (d: { period: string; analysis: { result: { score: number } } }) => `${d.period}|${d.analysis.result.score}`,
  buildAnalysisAiInput: jest.fn(async () => ({ period: '2026-10' })),
}));

const mockConfigured = useAiConfigured as jest.MockedFunction<typeof useAiConfigured>;
const mockAnalyze = analyzeFinances as jest.MockedFunction<typeof analyzeFinances>;

const REVIEW = { summary: 'Bulan ini sehat.', findings: [], tips: [] };

function dataFor(period: string, score: number | null): AnalysisData {
  return {
    period,
    analysis: { result: score === null ? { eligible: false, checks: [] } : { eligible: true, score } },
  } as unknown as AnalysisData;
}

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(store)) delete store[key];
  clearAiAnalysisCache();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  mockConfigured.mockReturnValue(true);
  mockAnalyze.mockResolvedValue({ ok: true, ...REVIEW });
});

async function render(data: AnalysisData | undefined) {
  return await renderHook(({ d }: { d: AnalysisData | undefined }) => useAiAnalysis(d), { wrapper, initialProps: { d: data } });
}

describe('when the card shows what', () => {
  test('a period that cannot be scored shows nothing and asks nothing', async () => {
    store[AI_ANALYSIS_CONSENT_SETTING] = '1';
    const hook = await render(dataFor('2026-10', null));
    expect(hook.result.current.state).toEqual({ kind: 'hidden' });
    expect(mockAnalyze).not.toHaveBeenCalled();
  });

  test('no key or switch off: the card offers the setup, nothing is asked', async () => {
    mockConfigured.mockReturnValue(false);
    store[AI_ANALYSIS_CONSENT_SETTING] = '1';
    const hook = await render(dataFor('2026-10', 83));
    expect(hook.result.current.state).toEqual({ kind: 'setup' });
    expect(mockAnalyze).not.toHaveBeenCalled();
  });

  test('configured but never allowed: the consent card, and nothing is sent', async () => {
    const hook = await render(dataFor('2026-10', 83));
    await waitFor(() => expect(hook.result.current.state).toEqual({ kind: 'consent' }));
    expect(mockAnalyze).not.toHaveBeenCalled();
  });

  test('"Not now" hides the card for this visit and still sends nothing', async () => {
    const hook = await render(dataFor('2026-10', 83));
    await waitFor(() => expect(hook.result.current.state.kind).toBe('consent'));
    await act(async () => hook.result.current.notNow());
    expect(hook.result.current.state).toEqual({ kind: 'hidden' });
    expect(mockAnalyze).not.toHaveBeenCalled();
  });
});

describe('allowing, and the automatic review', () => {
  test('Allow saves the consent and the review is written without another tap', async () => {
    const hook = await render(dataFor('2026-10', 83));
    await waitFor(() => expect(hook.result.current.state.kind).toBe('consent'));
    await act(async () => {
      await hook.result.current.allow();
    });
    expect(store[AI_ANALYSIS_CONSENT_SETTING]).toBe('1');
    await waitFor(() => expect(hook.result.current.state).toEqual({ kind: 'ready', result: REVIEW }));
    expect(mockAnalyze).toHaveBeenCalledTimes(1);
  });

  test('with consent already given it writes the review on its own', async () => {
    store[AI_ANALYSIS_CONSENT_SETTING] = '1';
    const hook = await render(dataFor('2026-10', 83));
    await waitFor(() => expect(hook.result.current.state.kind).toBe('ready'));
    expect(mockAnalyze).toHaveBeenCalledTimes(1);
  });

  test('the same figures again ask nothing more: the answer is kept for this run of the app', async () => {
    store[AI_ANALYSIS_CONSENT_SETTING] = '1';
    const hook = await render(dataFor('2026-10', 83));
    await waitFor(() => expect(hook.result.current.state.kind).toBe('ready'));
    await hook.rerender({ d: dataFor('2026-10', 83) });
    const again = await render(dataFor('2026-10', 83));
    await waitFor(() => expect(again.result.current.state.kind).toBe('ready'));
    expect(mockAnalyze).toHaveBeenCalledTimes(1);
  });

  test('a refresh of every query (any write in the app) never becomes a new request', async () => {
    store[AI_ANALYSIS_CONSENT_SETTING] = '1';
    const hook = await render(dataFor('2026-10', 83));
    await waitFor(() => expect(hook.result.current.state.kind).toBe('ready'));
    await act(async () => {
      await client.invalidateQueries();
    });
    expect(hook.result.current.state.kind).toBe('ready');
    expect(mockAnalyze).toHaveBeenCalledTimes(1);
  });

  test('another period or a new score is a new review', async () => {
    store[AI_ANALYSIS_CONSENT_SETTING] = '1';
    const hook = await render(dataFor('2026-10', 83));
    await waitFor(() => expect(hook.result.current.state.kind).toBe('ready'));
    await hook.rerender({ d: dataFor('2026-09', 77) });
    await waitFor(() => expect(mockAnalyze).toHaveBeenCalledTimes(2));
  });

  test('"Turn off" saves the refusal: the consent card is back and nothing more is asked', async () => {
    store[AI_ANALYSIS_CONSENT_SETTING] = '1';
    const hook = await render(dataFor('2026-10', 83));
    await waitFor(() => expect(hook.result.current.state.kind).toBe('ready'));
    await act(async () => {
      await hook.result.current.turnOff();
    });
    expect(store[AI_ANALYSIS_CONSENT_SETTING]).toBe('0');
    await waitFor(() => expect(hook.result.current.state.kind).toBe('consent'));
    await hook.rerender({ d: dataFor('2026-11', 60) });
    expect(hook.result.current.state.kind).toBe('consent');
    expect(mockAnalyze).toHaveBeenCalledTimes(1);
  });
});

describe('failures', () => {
  test('an error shows as a code the app words itself, and a retry asks again', async () => {
    store[AI_ANALYSIS_CONSENT_SETTING] = '1';
    mockAnalyze.mockResolvedValueOnce({ ok: false, code: 'no_internet' });
    const hook = await render(dataFor('2026-10', 83));
    await waitFor(() => expect(hook.result.current.state).toEqual({ kind: 'error', code: 'no_internet' }));
    await act(async () => hook.result.current.retry());
    await waitFor(() => expect(hook.result.current.state.kind).toBe('ready'));
    expect(mockAnalyze).toHaveBeenCalledTimes(2);
  });

  test('a failed request is not remembered as an answer', async () => {
    store[AI_ANALYSIS_CONSENT_SETTING] = '1';
    mockAnalyze.mockResolvedValueOnce({ ok: false, code: 'quota' });
    const first = await render(dataFor('2026-10', 83));
    await waitFor(() => expect(first.result.current.state.kind).toBe('error'));
    const second = await render(dataFor('2026-10', 83));
    await waitFor(() => expect(second.result.current.state.kind).toBe('ready'));
    expect(mockAnalyze).toHaveBeenCalledTimes(2);
  });
});

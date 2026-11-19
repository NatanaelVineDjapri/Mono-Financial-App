// The optional AI review of the Analysis screen (CLAUDE.md rules 9 and 23): what the card should show and when the
// request is made. It asks Gemini, with the person's own key, only when ALL of these hold: a key is saved and the AI
// switch is on, the person has allowed it (one consent, kept in settings and revocable from the card), and the
// period can be scored. Then it writes the review automatically when the screen shows a period, once per
// (period, score, totals): the answer is kept in memory only, so coming back to the same figures asks nothing.
// It is a plain request with its own state, not a react-query read: a write elsewhere in the app refreshes every
// query, and that must never turn into a new call to Gemini. Nothing here changes the score or any data.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useDb } from '@/data/db/DbProvider';
import { invalidateAfterWrite, queryKeys } from '@/data/queryKeys';
import { getSetting, setSetting } from '@/data/repo/settings';
import { useAiConfigured } from '@/features/ai_chat/aiEntry';
import { analyzeFinances, type AnalysisResponse } from '@/features/ai_chat/analysisAi';
import type { AiErrorCode } from '@/features/ai_chat/client';

import type { AnalysisData } from '../data';
import { analysisAiFingerprint, buildAnalysisAiInput } from './aiInput';

export const AI_ANALYSIS_CONSENT_SETTING = 'ai_analysis_consent';
const consentKey = [...queryKeys.settings, 'ai-analysis-consent'] as const;

// Memory only, for this run of the app. Bounded so a long session cannot grow it without end.
const MAX_CACHED = 12;
const cache = new Map<string, AnalysisResponse>();
export function clearAiAnalysisCache(): void {
  cache.clear();
}
function remember(key: string, value: AnalysisResponse): void {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value as string);
}

export type AiAnalysisState =
  | { kind: 'hidden' } // nothing to show: the period cannot be scored yet, or the person said "not now"
  | { kind: 'setup' } // no key or the AI switch is off
  | { kind: 'consent' }
  | { kind: 'loading' }
  | { kind: 'ready'; result: AnalysisResponse }
  | { kind: 'error'; code: AiErrorCode };

type Run = { key: string; error: AiErrorCode | null };

export function useAiAnalysis(data: AnalysisData | undefined) {
  const db = useDb();
  const queryClient = useQueryClient();
  const configured = useAiConfigured();
  const consentQuery = useQuery({ queryKey: consentKey, queryFn: async () => (await getSetting(db, AI_ANALYSIS_CONSENT_SETTING)) === '1', staleTime: 0 });
  const consent = consentQuery.data;

  const eligible = data?.analysis.result.eligible === true;
  const fingerprint = data && eligible ? analysisAiFingerprint(data) : null;
  const [run, setRun] = useState<Run | null>(null);
  const [nonce, setNonce] = useState(0);
  const [snoozed, setSnoozed] = useState(false);
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  });

  const cached = fingerprint ? cache.get(fingerprint) : undefined;
  const wanted = fingerprint !== null && configured && consent === true && !cached;

  useEffect(() => {
    const current = dataRef.current;
    if (!wanted || !fingerprint || !current) return;
    const controller = new AbortController();
    let alive = true;
    void (async () => {
      const input = await buildAnalysisAiInput(db, current);
      if (!alive) return;
      if (!input) return;
      const result = await analyzeFinances(input, { signal: controller.signal });
      if (!alive) return;
      if (result.ok) {
        remember(fingerprint, { summary: result.summary, findings: result.findings, tips: result.tips });
        setRun({ key: fingerprint, error: null });
      } else if (result.code !== 'aborted') {
        setRun({ key: fingerprint, error: result.code });
      }
    })();
    return () => {
      alive = false;
      controller.abort();
    };
  }, [wanted, fingerprint, nonce, db]);

  const setConsent = useCallback(
    async (allowed: boolean) => {
      await setSetting(db, AI_ANALYSIS_CONSENT_SETTING, allowed ? '1' : '0');
      await queryClient.invalidateQueries({ queryKey: consentKey });
      void invalidateAfterWrite(queryClient);
    },
    [db, queryClient],
  );

  const retry = useCallback(() => {
    if (fingerprint) cache.delete(fingerprint);
    setRun(null);
    setNonce(n => n + 1);
  }, [fingerprint, setRun, setNonce]);

  let state: AiAnalysisState;
  if (!data || !eligible) state = { kind: 'hidden' };
  else if (!configured) state = { kind: 'setup' };
  else if (consent === undefined) state = { kind: 'hidden' };
  else if (!consent) state = snoozed ? { kind: 'hidden' } : { kind: 'consent' };
  else if (cached) state = { kind: 'ready', result: cached };
  else if (run && run.key === fingerprint && run.error) state = { kind: 'error', code: run.error };
  else state = { kind: 'loading' };

  return {
    state,
    allow: () => setConsent(true),
    turnOff: () => setConsent(false),
    notNow: () => setSnoozed(true),
    retry,
  };
}

// A pretend card reader, for development builds only (the Android emulator has no NFC). It goes through the same
// pipeline as a real card from the point where a card number is known: the same fingerprint, the same salt, the same
// accounts and links in the real database. Only the radio part is pretended. The Dev tools screen switches it on and
// picks the scenario; nothing in a release build can reach it (see cardReaderProvider.ts).
import { create } from 'zustand';

import { fingerprintOf, last4Of, type Sha256Hex } from '../../../domain/cards/fingerprint';
import { createAccountFromCard, findCardAccount } from '../../../domain/cards/links';
import type { CardInfo, CardIssuer } from '../../../domain/cards/types';
import type { Db } from '../../../data/db/types';
import { getAccountBalanceNow } from '../../../data/repo/cardLinks';
import type { CardReader, ReadResult } from '../reader';

export const MOCK_SCENARIOS = [
  { id: 'known_less', label: 'Known Mandiri, card has less than MONO' },
  { id: 'known_more', label: 'Known Mandiri, card has more than MONO' },
  { id: 'known_same', label: 'Known Mandiri, same balance as MONO' },
  { id: 'new_mandiri', label: 'New Mandiri card' },
  { id: 'flazz_experimental', label: 'Flazz (experimental support)' },
  { id: 'unsupported', label: 'Card that is not supported' },
  { id: 'lost', label: 'Card removed too quickly' },
  { id: 'nfc_off', label: 'NFC switched off' },
] as const;

export type MockScenario = (typeof MOCK_SCENARIOS)[number]['id'];

interface MockCardState {
  enabled: boolean;
  scenario: MockScenario;
  stepMs: number; // how long each step of the pretend scan takes
  setEnabled: (enabled: boolean) => void;
  setScenario: (scenario: MockScenario) => void;
  setStepMs: (stepMs: number) => void;
}

// In memory only: a development build starts with the real reader again.
export const useMockCardStore = create<MockCardState>(set => ({
  enabled: false,
  scenario: 'known_less',
  stepMs: 700,
  setEnabled: enabled => set({ enabled }),
  setScenario: scenario => set({ scenario }),
  setStepMs: stepMs => set({ stepMs }),
}));

export function isMockActive(): boolean {
  return __DEV__ && useMockCardStore.getState().enabled;
}

const KNOWN_PAN = '6032000000007731';
const NEW_PAN = '6032000000001234';
const FLAZZ_PAN = '6013000000005566';
const MOCK_ACCOUNT = 'E-money Mandiri (mock)';

export interface MockReaderDeps {
  db: Db;
  getSalt: () => Promise<string>;
  sha256Hex: Sha256Hex;
  now: () => string;
  getScenario?: () => MockScenario;
  stepMs?: number; // how long each step of the pretend scan takes (0 in tests)
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0 || signal.aborted) return Promise.resolve();
  return new Promise(resolve => {
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    }
    signal.addEventListener('abort', done);
  });
}

export function createMockReader(deps: MockReaderDeps): CardReader {
  const scenario = () => (deps.getScenario ? deps.getScenario() : useMockCardStore.getState().scenario);
  const step = deps.stepMs ?? useMockCardStore.getState().stepMs;

  async function card(issuer: CardIssuer, pan: string, balance: number): Promise<CardInfo> {
    return { issuer, last4: last4Of(pan), fingerprint: await fingerprintOf(pan, await deps.getSalt(), deps.sha256Hex), balance, readAt: deps.now(), estimated: false };
  }

  // The known card: made once as a real e-wallet account with a real link, so the whole result flow runs on real data.
  async function knownCard(delta: number): Promise<CardInfo> {
    const base = await card('mandiri', KNOWN_PAN, 0);
    let link = await findCardAccount(deps.db, base.fingerprint);
    if (!link) {
      const made = await createAccountFromCard(deps.db, { card: base, name: MOCK_ACCOUNT, openingBalance: 100_000, now: deps.now() });
      if (!made.ok) throw new Error('could not prepare the pretend card');
      link = await findCardAccount(deps.db, base.fingerprint);
    }
    const appBalance = (await getAccountBalanceNow(deps.db, link!.account_id)) ?? 0;
    return { ...base, balance: Math.max(0, appBalance + delta) };
  }

  return {
    isSupported: async () => true,
    isEnabled: async () => scenario() !== 'nfc_off',

    async read(signal, hooks): Promise<ReadResult> {
      const chosen = scenario();
      if (chosen === 'nfc_off') return { ok: false, error: 'nfcOff' };
      await wait(step, signal);
      if (signal.aborted) return { ok: false, error: 'cancelled' };
      hooks?.onTag?.();
      await wait(step / 2, signal);
      if (signal.aborted) return { ok: false, error: 'cancelled' };

      switch (chosen) {
        case 'unsupported':
          return { ok: false, error: 'unsupported' };
        case 'lost':
          return { ok: false, error: 'lost' };
        case 'known_less':
          return { ok: true, card: await knownCard(-16_000) };
        case 'known_more':
          return { ok: true, card: await knownCard(20_000) };
        case 'known_same':
          return { ok: true, card: await knownCard(0) };
        case 'new_mandiri':
          return { ok: true, card: await card('mandiri', NEW_PAN, 84_000) };
        case 'flazz_experimental':
          return { ok: true, card: await card('flazz', FLAZZ_PAN, 55_000) };
      }
    },

    onEnabledChange: () => () => undefined,
    openSettings: async () => undefined,
  };
}

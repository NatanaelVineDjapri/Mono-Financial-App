// The pure parts of the card scan: the comparison, the fingerprint and the states of the scan screen.
import { createHash } from 'crypto';

import { fingerprintOf, last4Of, normalizePan, saltFromBytes } from '../fingerprint';
import { reconcile } from '../reconcile';
import { initialScanState, scanReducer, type ScanEvent, type ScanState } from '../scanState';
import type { CardInfo } from '../types';

const sha256Hex = async (text: string) => createHash('sha256').update(text).digest('hex');

describe('reconcile', () => {
  test('less on the card than in MONO is an expense of the difference', () => {
    expect(reconcile(84_000, 100_000)).toEqual({ diff: -16_000, action: 'expense', amount: 16_000 });
  });

  test('more on the card is an income', () => {
    expect(reconcile(120_500, 100_000)).toEqual({ diff: 20_500, action: 'income', amount: 20_500 });
  });

  test('the same amount needs nothing', () => {
    expect(reconcile(100_000, 100_000)).toEqual({ diff: 0, action: 'none', amount: 0 });
    expect(reconcile(0, 0)).toEqual({ diff: 0, action: 'none', amount: 0 });
  });

  test('an empty card against a full account is an expense of the whole balance', () => {
    expect(reconcile(0, 312_500)).toEqual({ diff: -312_500, action: 'expense', amount: 312_500 });
  });

  test.each([
    [-1, 0],
    [0, -1],
    [1.5, 0],
    [0, 2.25],
    [Number.NaN, 0],
    [0, Number.POSITIVE_INFINITY],
    [Number.MAX_SAFE_INTEGER + 1, 0],
  ])('refuses a balance that is not a whole, non-negative amount (%p, %p)', (card, app) => {
    expect(() => reconcile(card, app)).toThrow(RangeError);
  });
});

describe('fingerprint', () => {
  const PAN = '6032984012347731';
  const SALT = '00ff00ff00ff00ff00ff00ff00ff00ff';

  test('the last 4 digits, whatever the spacing', () => {
    expect(last4Of(PAN)).toBe('7731');
    expect(last4Of('6032 9840 1234 7731')).toBe('7731');
  });

  test('is sha256 of the salt followed by the number, in hex', async () => {
    expect(await fingerprintOf(PAN, SALT, sha256Hex)).toBe(createHash('sha256').update(SALT + PAN).digest('hex'));
  });

  test('is stable for the same card and salt, and the same with or without spaces', async () => {
    expect(await fingerprintOf(PAN, SALT, sha256Hex)).toBe(await fingerprintOf('6032 9840 1234 7731', SALT, sha256Hex));
  });

  test('depends on the salt and on the number', async () => {
    const base = await fingerprintOf(PAN, SALT, sha256Hex);
    expect(await fingerprintOf(PAN, 'ff'.repeat(16), sha256Hex)).not.toBe(base);
    expect(await fingerprintOf('6032984012347732', SALT, sha256Hex)).not.toBe(base);
  });

  test('never contains the number', async () => {
    expect(await fingerprintOf(PAN, SALT, sha256Hex)).not.toContain(PAN);
  });

  test.each(['', '1234', 'abcdefgh12345678', '1'.repeat(20)])('something that is not a card number is refused (%p)', async bad => {
    expect(() => normalizePan(bad)).toThrow(RangeError);
    expect(() => last4Of(bad)).toThrow(RangeError);
    await expect(fingerprintOf(bad, SALT, sha256Hex)).rejects.toThrow(RangeError);
  });

  test('an empty salt is refused', async () => {
    await expect(fingerprintOf(PAN, '', sha256Hex)).rejects.toThrow(RangeError);
  });

  test('a salt is 16 bytes written as 32 hex characters', () => {
    expect(saltFromBytes(Uint8Array.from({ length: 16 }, (_, i) => i * 17))).toBe('00112233445566778899aabbccddeeff');
    expect(() => saltFromBytes(new Uint8Array(15))).toThrow(RangeError);
  });
});

describe('scan state', () => {
  const CARD: CardInfo = { issuer: 'mandiri', last4: '7731', fingerprint: 'fp', balance: 84_000, readAt: '2026-11-03T10:00:00+07:00', estimated: false };
  const run = (events: ScanEvent[], from: ScanState = initialScanState) => events.reduce(scanReducer, from);

  test('starts idle; start with NFC on waits for a card, start with NFC off says so', () => {
    expect(initialScanState).toEqual({ status: 'idle' });
    expect(run([{ type: 'start', nfcEnabled: true }])).toEqual({ status: 'waiting' });
    expect(run([{ type: 'start', nfcEnabled: false }])).toEqual({ status: 'nfcOff' });
  });

  test('waiting -> reading -> known, and unknown when the card is not linked yet', () => {
    const waiting = run([{ type: 'start', nfcEnabled: true }]);
    expect(run([{ type: 'tag' }], waiting)).toEqual({ status: 'reading' });
    expect(run([{ type: 'tag' }, { type: 'read', card: CARD, known: true }], waiting)).toEqual({ status: 'known', card: CARD });
    expect(run([{ type: 'tag' }, { type: 'read', card: CARD, known: false }], waiting)).toEqual({ status: 'unknown', card: CARD });
  });

  test('a card nobody can read is unsupported, and a card pulled away is lost', () => {
    const waiting = run([{ type: 'start', nfcEnabled: true }]);
    expect(run([{ type: 'tag' }, { type: 'unsupported' }], waiting)).toEqual({ status: 'unsupported' });
    expect(run([{ type: 'tag' }, { type: 'lost' }], waiting)).toEqual({ status: 'lost' });
  });

  test('NFC switched off while waiting or reading stops the scan; switched on again it waits again', () => {
    const waiting = run([{ type: 'start', nfcEnabled: true }]);
    const reading = run([{ type: 'tag' }], waiting);
    expect(run([{ type: 'nfcChanged', enabled: false }], waiting)).toEqual({ status: 'nfcOff' });
    expect(run([{ type: 'nfcChanged', enabled: false }], reading)).toEqual({ status: 'nfcOff' });
    expect(run([{ type: 'nfcChanged', enabled: false }, { type: 'nfcChanged', enabled: true }], waiting)).toEqual({ status: 'waiting' });
  });

  test('NFC changing does not disturb a finished result', () => {
    const known = run([{ type: 'start', nfcEnabled: true }, { type: 'tag' }, { type: 'read', card: CARD, known: true }]);
    expect(run([{ type: 'nfcChanged', enabled: false }], known)).toEqual(known);
    expect(run([{ type: 'nfcChanged', enabled: true }], known)).toEqual(known);
  });

  test('retry from any end state waits again (or says NFC is off); cancel always goes idle', () => {
    const lost = run([{ type: 'start', nfcEnabled: true }, { type: 'tag' }, { type: 'lost' }]);
    expect(run([{ type: 'retry', nfcEnabled: true }], lost)).toEqual({ status: 'waiting' });
    expect(run([{ type: 'retry', nfcEnabled: false }], lost)).toEqual({ status: 'nfcOff' });
    for (const state of [lost, run([{ type: 'start', nfcEnabled: false }]), run([{ type: 'start', nfcEnabled: true }])]) {
      expect(run([{ type: 'cancel' }], state)).toEqual({ status: 'idle' });
    }
  });

  test('events that make no sense in a state leave it alone', () => {
    expect(run([{ type: 'tag' }])).toEqual({ status: 'idle' });
    expect(run([{ type: 'read', card: CARD, known: true }])).toEqual({ status: 'idle' });
    expect(run([{ type: 'lost' }])).toEqual({ status: 'idle' });
    const waiting = run([{ type: 'start', nfcEnabled: true }]);
    expect(run([{ type: 'read', card: CARD, known: true }], waiting)).toEqual({ status: 'waiting' });
    expect(run([{ type: 'start', nfcEnabled: true }], waiting)).toEqual({ status: 'waiting' });
  });
});

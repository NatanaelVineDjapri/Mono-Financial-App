// A card in the field, start to finish: which adapter reads it, what comes out, and what never does.
import { createHash } from 'crypto';

import { fingerprintOf } from '../../../domain/cards/fingerprint';
import { ADAPTERS, ALLOWED_AIDS } from '../adapters';
import { readCard } from '../readCard';
import { assertReadOnlyCommand } from '../transceive';
import { BRIZZI_PAN, brizziCard, brizziRecord, FLAZZ_PAN, flazzCard, MANDIRI_PAN, mandiriCard, scriptedCard, TAPCASH_PAN, tapcashCard } from './fixtures';
import { hexToBytes } from '../hex';

const sha256Hex = async (text: string) => createHash('sha256').update(text).digest('hex');
const SALT = '00ff00ff00ff00ff00ff00ff00ff00ff';
const NOW = '2026-11-03T10:00:00+07:00';
const deps = { salt: SALT, sha256Hex, now: () => NOW };

describe('a card that is read', () => {
  test.each([
    ['mandiri', mandiriCard(), MANDIRI_PAN, 84_000, false],
    ['flazz', flazzCard(), FLAZZ_PAN, 124_500, false],
    ['tapcash', tapcashCard(), TAPCASH_PAN, 50_000, false],
    ['brizzi', brizziCard(), BRIZZI_PAN, 31_250, false],
    ['brizzi (estimated)', brizziCard({ '906c000001': '9d00', '90bb000007': brizziRecord('150126', '103000', '127a0000') + '9100' }), BRIZZI_PAN, 31_250, true],
  ])('%s', async (name, card, pan, balance, estimated) => {
    const outcome = await readCard(card, deps);
    expect(outcome.kind).toBe('ok');
    if (outcome.kind !== 'ok') return;
    expect(outcome.card).toEqual({
      issuer: name.split(' ')[0],
      last4: pan.slice(-4),
      fingerprint: await fingerprintOf(pan, SALT, sha256Hex),
      balance,
      readAt: NOW,
      estimated,
    });
  });

  test('the card number is nowhere in what comes out', async () => {
    for (const [card, pan] of [[mandiriCard(), MANDIRI_PAN], [flazzCard(), FLAZZ_PAN], [tapcashCard(), TAPCASH_PAN], [brizziCard(), BRIZZI_PAN]] as const) {
      const outcome = await readCard(card, deps);
      const dump = JSON.stringify(outcome);
      expect(dump).not.toContain(pan);
      expect(dump).not.toContain(pan.slice(0, 12)); // nor its first digits
    }
  });

  test('the same card read twice gives the same fingerprint; another salt gives another one', async () => {
    const a = await readCard(mandiriCard(), deps);
    const b = await readCard(mandiriCard(), deps);
    const c = await readCard(mandiriCard(), { ...deps, salt: 'ff'.repeat(16) });
    expect(a.kind === 'ok' && b.kind === 'ok' && c.kind === 'ok').toBe(true);
    if (a.kind === 'ok' && b.kind === 'ok' && c.kind === 'ok') {
      expect(a.card.fingerprint).toBe(b.card.fingerprint);
      expect(a.card.fingerprint).not.toBe(c.card.fingerprint);
    }
  });

  test('every command that was sent to the card is a read, and none selected anything but an e-money application', async () => {
    for (const card of [mandiriCard(), flazzCard(), tapcashCard(), brizziCard()]) {
      await readCard(card, deps);
      for (const hex of card.sent) expect(() => assertReadOnlyCommand(hexToBytes(hex), ALLOWED_AIDS)).not.toThrow();
    }
  });
});

describe('a card that is not one of those', () => {
  test('a debit or credit card (it answers nothing the e-money applications ask) is "unsupported", and nothing of EMV was sent', async () => {
    const bankCard = scriptedCard({});
    expect(await readCard(bankCard, deps)).toEqual({ kind: 'unsupported' });
    // What was sent: only the selects of the e-money applications, and the DESFire select. No PPSE, no GPO, no record read.
    for (const hex of bankCard.sent) {
      expect(hex).not.toContain('325041592e5359532e44444630'); // 2PAY.SYS.DDF01 / 1PAY.SYS.DDF01
      expect(hex.startsWith('80a8')).toBe(false); // GET PROCESSING OPTIONS
      expect(hex.startsWith('00b2')).toBe(false); // READ RECORD
      expect(hex.startsWith('00a40400') ? ALLOWED_AIDS.some(aid => hex.includes(aid.map(b => b.toString(16).padStart(2, '0')).join(''))) : true).toBe(true);
    }
  });

  test('every adapter was tried, in order', async () => {
    const card = scriptedCard({});
    await readCard(card, deps);
    expect(card.sent[0]).toBe('00a4040008000000000000000100'); // mandiri first
    expect(card.sent.some(h => h.startsWith('00a404000ba0000000180f'))).toBe(true); // flazz
    expect(card.sent.some(h => h.startsWith('00a40400061122334455'))).toBe(true); // tapcash
    expect(card.sent.some(h => h.startsWith('905a000003'))).toBe(true); // brizzi
  });

  test('a card number that does not look like a number is not a card', async () => {
    // The mandiri card whose number answer has a prefix that is not 6032, so no adapter takes it.
    expect(await readCard(mandiriCard('20480100', '4111111111111111' + '00'.repeat(55) + '9000'), deps)).toEqual({ kind: 'unsupported' });
  });
});

describe('a card that goes away', () => {
  test.each([1, 2, 3])('the radio fails at command %i: "lost"', async n => {
    const card = scriptedCard({ '00a40400080000000000000001': '9000', '00b300003f': MANDIRI_PAN + '9000', '00b500000a': '204801000000000000009000' }, { throwAt: n });
    expect(await readCard(card, deps)).toEqual({ kind: 'lost' });
  });

  test('a failure that is not the radio ends that adapter, and the next one gets its turn', async () => {
    const throwing = { ...ADAPTERS[0], probe: async () => { throw new Error('parser bug'); } };
    const outcome = await readCard(flazzCard(), deps, [throwing, ...ADAPTERS.slice(1)]);
    expect(outcome.kind).toBe('ok');
  });

  test('an adapter that tries a forbidden command is a bug and is not hidden', async () => {
    const bad = { ...ADAPTERS[0], probe: async (io: Parameters<(typeof ADAPTERS)[0]['probe']>[0]) => { await io.send(hexToBytes('00d6000004aabbccdd')); return null; } };
    await expect(readCard(scriptedCard({}), deps, [bad])).rejects.toThrow(/forbidden card command/);
  });
});

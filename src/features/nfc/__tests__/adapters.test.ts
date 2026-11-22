// What each adapter makes of a card's answers: normal, zero, the biggest, cut short, a bad status word, the byte order,
// and answers that are garbage. A parser never throws.
import { balanceFromRecords, brizziAdapter, parseBrizziPan, parseBrizziValue } from '../adapters/brizzi';
import { flazzAdapter, parseFlazzBalance, parseFlazzPan } from '../adapters/flazz';
import { MAX_CARD_BALANCE } from '../adapters/common';
import { mandiriAdapter, parseMandiriBalance, parseMandiriPan } from '../adapters/mandiri';
import { parseTapcashAnswer, tapcashAdapter } from '../adapters/tapcash';
import { hexToBytes } from '../hex';
import { createSafeIo } from '../transceive';
import { ADAPTERS, ALLOWED_AIDS } from '../adapters';
import { BRIZZI_PAN, brizziCard, brizziRecord, FLAZZ_PAN, flazzCard, MANDIRI_PAN, mandiriCard, scriptedCard, TAPCASH_PAN, tapcashCard } from './fixtures';

const bytes = hexToBytes;

describe('mandiri', () => {
  test('the number is found in BCD or in ASCII by its prefix, wherever it sits', () => {
    expect(parseMandiriPan(bytes('6032984012347731' + '00'.repeat(55)))).toBe(MANDIRI_PAN);
    expect(parseMandiriPan(bytes('0000' + '6032984012347731' + '00'.repeat(20)))).toBe(MANDIRI_PAN);
    expect(parseMandiriPan(Array.from(`ab${MANDIRI_PAN}cd`, c => c.charCodeAt(0)))).toBe(MANDIRI_PAN);
  });

  test('a number with another prefix is not a mandiri card', () => {
    expect(parseMandiriPan(bytes('6013012345678901' + '00'.repeat(20)))).toBeNull();
    expect(parseMandiriPan(bytes('ffff'.repeat(30)))).toBeNull();
    expect(parseMandiriPan([])).toBeNull();
  });

  test('the balance is 4 bytes little-endian: normal, zero, the byte order, cut short, too big', () => {
    expect(parseMandiriBalance(bytes('20480100'))).toBe(84_000);
    expect(parseMandiriBalance(bytes('00000000'))).toBe(0);
    expect(parseMandiriBalance(bytes('01020000'))).toBe(0x0201); // little-endian, not 0x01020000
    expect(parseMandiriBalance(bytes('0f420f00'))).toBe(999_951);
    expect(parseMandiriBalance(bytes('204801'))).toBeNull(); // cut short
    expect(parseMandiriBalance(bytes('ffffffff'))).toBeNull(); // 4,294,967,295 is not a balance
    expect(parseMandiriBalance(bytes('ffe0f505'))).toBe(MAX_CARD_BALANCE); // 99,999,999 is the largest accepted
    expect(parseMandiriBalance(bytes('00e1f505'))).toBeNull(); // 100,000,000 is not a balance
  });

  test('the whole read: a card, its number and its balance', async () => {
    const card = mandiriCard();
    const read = await mandiriAdapter.probe(createSafeIo(card, ALLOWED_AIDS));
    expect(read).toEqual({ issuer: 'mandiri', pan: MANDIRI_PAN, balance: 84_000 });
    expect(card.sent).toEqual(['00a4040008000000000000000100', '00b300003f', '00b500000a']);
  });

  test('a card that has only the second application name', async () => {
    const card = scriptedCard({
      '00a4040008a000000018300001': '9000',
      '00b300003f': MANDIRI_PAN + '9000',
      '00b500000a': '2048010000000000000' + '0' + '9000',
    });
    expect(await mandiriAdapter.probe(createSafeIo(card, ALLOWED_AIDS))).toMatchObject({ issuer: 'mandiri', balance: 84_000 });
  });

  test('a status word that is not 9000 means this is not the card', async () => {
    const wrongNumber = mandiriCard('20480100', '6700');
    expect(await mandiriAdapter.probe(createSafeIo(wrongNumber, ALLOWED_AIDS))).toBeNull();
    const nothing = scriptedCard({});
    expect(await mandiriAdapter.probe(createSafeIo(nothing, ALLOWED_AIDS))).toBeNull();
  });

  test('a number that cannot be found means this is not the card', async () => {
    const card = mandiriCard('20480100', '00'.repeat(63) + '9000');
    expect(await mandiriAdapter.probe(createSafeIo(card, ALLOWED_AIDS))).toBeNull();
  });
});

describe('flazz generation 2', () => {
  test('the number is the first 16 characters of track 2, in ASCII, with padding around it', () => {
    const track = Array.from(`${FLAZZ_PAN}=2912101123456789`, c => c.charCodeAt(0));
    expect(parseFlazzPan([0x00, ...track, 0x00, 0x00])).toBe(FLAZZ_PAN);
    expect(parseFlazzPan(Array.from('6019000011112222=1', c => c.charCodeAt(0)))).toBe('6019000011112222');
    expect(parseFlazzPan(Array.from('4111111111111111=1', c => c.charCodeAt(0)))).toBeNull(); // not a flazz prefix
    expect(parseFlazzPan([])).toBeNull();
  });

  test('the balance is 3 bytes big-endian, after a status byte when the answer has 4 bytes', () => {
    expect(parseFlazzBalance(bytes('0001e654'))).toBe(0x01e654);
    expect(parseFlazzBalance(bytes('0000c350'))).toBe(50_000);
    expect(parseFlazzBalance(bytes('00000000'))).toBe(0);
    expect(parseFlazzBalance(bytes('00 98 96 7f'))).toBe(0x98967f); // 9,999,999
    expect(parseFlazzBalance(bytes('0001e654').slice(1))).toBe(0x01e654); // the 3 bytes alone
    expect(parseFlazzBalance(bytes('0501e654'))).toBeNull(); // a status byte that is not 00
    expect(parseFlazzBalance(bytes('01e6'))).toBeNull(); // cut short
    expect(parseFlazzBalance(bytes('0001e65400'))).toBeNull(); // longer than described
  });

  test('big-endian, not little-endian', () => {
    expect(parseFlazzBalance(bytes('00 00 01 00'))).toBe(256);
  });

  test('the whole read', async () => {
    const card = flazzCard();
    expect(await flazzAdapter.probe(createSafeIo(card, ALLOWED_AIDS))).toEqual({ issuer: 'flazz', pan: FLAZZ_PAN, balance: 124_500 });
    expect(card.sent).toEqual(['00a404000ba0000000180f000001800100', '00b081008e', '805c000204']);
  });

  test('a generation 1 card does not have the application, so it is not read', async () => {
    const gen1 = scriptedCard({ '00a4040009a000000003869807 01': '9000' });
    expect(await flazzAdapter.probe(createSafeIo(gen1, ALLOWED_AIDS))).toBeNull();
  });

  test('if the number read is refused, the file is selected once and the read tried again', async () => {
    let reads = 0;
    const card = scriptedCard({ '00a404000ba0000000180f0000018001': '9000', '00a40100020200': '9000', '805c000204': '0001e6549000' });
    const original = card.transceive;
    card.transceive = async apdu => {
      if (apdu[1] === 0xb0) {
        reads++;
        if (reads === 1) return [0x69, 0x85];
        return Array.from(`${FLAZZ_PAN}=1`, c => c.charCodeAt(0)).concat([0x90, 0x00]);
      }
      return original(apdu);
    };
    expect(await flazzAdapter.probe(createSafeIo(card, ALLOWED_AIDS))).toMatchObject({ pan: FLAZZ_PAN, balance: 124_500 });
    expect(reads).toBe(2);
  });

  test('a bad status word on the balance means it is not read', async () => {
    const card = scriptedCard({ '00a404000ba0000000180f0000018001': '9000', '00b081008e': Buffer.from(`${FLAZZ_PAN}=1`).toString('hex') + '9000', '805c000204': '6985' });
    expect(await flazzAdapter.probe(createSafeIo(card, ALLOWED_AIDS))).toBeNull();
  });
});

describe('tapcash', () => {
  test('the balance is after a status byte, 3 bytes big-endian; the number is 8 bytes of BCD at bytes 8 to 15', () => {
    expect(parseTapcashAnswer(bytes(`0000c350${'00'.repeat(4)}${TAPCASH_PAN}`))).toEqual({ balance: 50_000, pan: TAPCASH_PAN });
    expect(parseTapcashAnswer(bytes(`00000000${'00'.repeat(4)}${TAPCASH_PAN}`))).toEqual({ balance: 0, pan: TAPCASH_PAN });
    expect(parseTapcashAnswer(bytes(`0000c350${'00'.repeat(4)}${TAPCASH_PAN}ffff`))?.balance).toBe(50_000);
  });

  test('an answer too short to hold the number, a bad status byte, or a number that is not digits is not read', () => {
    expect(parseTapcashAnswer(bytes('0000c350'))).toBeNull(); // the example of the notes: 4 bytes, no number
    expect(parseTapcashAnswer(bytes(`0100c350${'00'.repeat(4)}${TAPCASH_PAN}`))).toBeNull();
    expect(parseTapcashAnswer(bytes(`0000c350${'00'.repeat(4)}ab${TAPCASH_PAN.slice(2)}`))).toBeNull();
    expect(parseTapcashAnswer(bytes(`0000c350${'00'.repeat(4)}${'00'.repeat(8)}`))).toBeNull(); // all zeros
    expect(parseTapcashAnswer([])).toBeNull();
  });

  test('the whole read, and a card whose answer is the short one is reported as not read', async () => {
    expect(await tapcashAdapter.probe(createSafeIo(tapcashCard(), ALLOWED_AIDS))).toEqual({ issuer: 'tapcash', pan: TAPCASH_PAN, balance: 50_000 });
    expect(await tapcashAdapter.probe(createSafeIo(tapcashCard('0000c350'), ALLOWED_AIDS))).toBeNull();
  });
});

describe('brizzi', () => {
  test('the number is BCD at bytes 3 to 10, and must start with a brizzi prefix', () => {
    expect(parseBrizziPan(bytes(`000000${BRIZZI_PAN}${'00'.repeat(12)}`))).toBe(BRIZZI_PAN);
    expect(parseBrizziPan(bytes(`000000${'4111111111111111'}${'00'.repeat(12)}`))).toBeNull();
    expect(parseBrizziPan(bytes('0000'))).toBeNull();
  });

  test('Get Value is 4 bytes little-endian: normal, zero, byte order, cut short', () => {
    expect(parseBrizziValue(bytes('127a0000'))).toBe(31_250);
    expect(parseBrizziValue(bytes('00000000'))).toBe(0);
    expect(parseBrizziValue(bytes('00010000'))).toBe(256); // little-endian
    expect(parseBrizziValue(bytes('127a'))).toBeNull();
  });

  test('without Get Value the balance is the one left after the newest record, whatever order they come in', () => {
    const older = brizziRecord('010126', '091500', 'a0860100'); // 100,000
    const newer = brizziRecord('150126', '103000', '127a0000'); // 31,250
    expect(balanceFromRecords(bytes(older + newer))).toBe(31_250);
    expect(balanceFromRecords(bytes(newer + older))).toBe(31_250);
    expect(balanceFromRecords(bytes(brizziRecord('311225', '235959', 'a0860100') + brizziRecord('010126', '000000', '127a0000')))).toBe(31_250); // across a year
    expect(balanceFromRecords([])).toBeNull();
    expect(balanceFromRecords(bytes('00'.repeat(32)))).toBe(null); // a record of zeros has no date
    expect(balanceFromRecords(bytes(newer).slice(0, 20))).toBeNull(); // cut short
  });

  test('the whole read with Get Value', async () => {
    const card = brizziCard();
    expect(await brizziAdapter.probe(createSafeIo(card, ALLOWED_AIDS))).toEqual({ issuer: 'brizzi', pan: BRIZZI_PAN, balance: 31_250 });
  });

  test('when Get Value is refused, the balance is an estimate from the records, over more than one frame', async () => {
    const newer = brizziRecord('150126', '103000', '127a0000');
    const older = brizziRecord('010126', '091500', 'a0860100');
    const card = brizziCard({ '906c000001': '9d00', '90bb000007': older + '91af', '90af000000': newer + '9100' });
    expect(await brizziAdapter.probe(createSafeIo(card, ALLOWED_AIDS))).toEqual({ issuer: 'brizzi', pan: BRIZZI_PAN, balance: 31_250, estimated: true });
  });

  test('a card without usable records and without Get Value is not read', async () => {
    const card = brizziCard({ '906c000001': '9d00', '90bb000007': '9100' });
    expect(await brizziAdapter.probe(createSafeIo(card, ALLOWED_AIDS))).toBeNull();
  });

  test('a card without the application is not a brizzi', async () => {
    expect(await brizziAdapter.probe(createSafeIo(scriptedCard({}), ALLOWED_AIDS))).toBeNull();
  });
});

describe('no parser throws, whatever it is given', () => {
  // A fixed pseudo-random sequence, so a failure can be reproduced.
  let seed = 12345;
  const next = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff);
  const garbage = Array.from({ length: 300 }, () => Array.from({ length: next() % 80 }, () => next() % 256));

  test.each([
    ['parseMandiriPan', parseMandiriPan],
    ['parseMandiriBalance', parseMandiriBalance],
    ['parseFlazzPan', parseFlazzPan],
    ['parseFlazzBalance', parseFlazzBalance],
    ['parseTapcashAnswer', parseTapcashAnswer],
    ['parseBrizziPan', parseBrizziPan],
    ['parseBrizziValue', parseBrizziValue],
    ['balanceFromRecords', balanceFromRecords],
  ] as const)('%s', (_name, parse) => {
    for (const data of garbage) expect(() => (parse as (d: number[]) => unknown)(data)).not.toThrow();
  });

  test('and a balance, when there is one, is a whole non-negative number', () => {
    for (const data of garbage) {
      for (const balance of [parseMandiriBalance(data), parseFlazzBalance(data), parseBrizziValue(data), balanceFromRecords(data)]) {
        if (balance !== null) {
          expect(Number.isSafeInteger(balance)).toBe(true);
          expect(balance).toBeGreaterThanOrEqual(0);
          expect(balance).toBeLessThanOrEqual(MAX_CARD_BALANCE);
        }
      }
    }
  });
});

test('every adapter says which issuer it reads, and they are tried in this order', () => {
  expect(ADAPTERS.map(a => a.issuer)).toEqual(['mandiri', 'flazz', 'tapcash', 'brizzi']);
});

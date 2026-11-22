// The only way a command reaches a card is createSafeIo, and it lets read commands through and nothing else.
import { ADAPTERS, ALLOWED_AIDS } from '../adapters';
import { bytesToHex, hexToBytes } from '../hex';
import { assertReadOnlyCommand, CardLostError, createSafeIo, ForbiddenCommandError, isReadOnlyHeader } from '../transceive';
import { scriptedCard } from './fixtures';

const io = (answer = '9000') => {
  const card = scriptedCard({ '': answer });
  return { card, safe: createSafeIo(card, ALLOWED_AIDS) };
};

describe('commands that read are sent', () => {
  test.each([
    ['SELECT of a mandiri application', '00a4040008' + '0000000000000001' + '00'],
    ['SELECT of a flazz application', '00a404000b' + 'a0000000180f0000018001' + '00'],
    ['SELECT of a file by id', '00a4010002' + '0200' + '00'],
    ['READ BINARY', '00b081008e'],
    ['READ RECORD', '00b2010400'],
    ['mandiri read card number', '00b300003f'],
    ['mandiri read balance', '00b500000a'],
    ['flazz read balance', '805c000204'],
    ['tapcash read balance', '9032030000'],
    ['DESFire select application', '905a00000301000000'],
    ['DESFire read data', '90bd00000700000000170000' + '00'],
    ['DESFire read records', '90bb00000701000000000000' + '00'],
    ['DESFire get value', '90 6c 00 00 01 00 00'],
    ['DESFire next frame', '90af000000'],
  ])('%s', async (_name, hex) => {
    const { card, safe } = io();
    await safe.send(hexToBytes(hex));
    expect(card.sent).toHaveLength(1);
  });
});

describe('everything else is refused before anything is sent', () => {
  test.each([
    ['UPDATE BINARY', '00d6000004aabbccdd'],
    ['UPDATE RECORD', '00dc010c04aabbccdd'],
    ['ERASE BINARY', '000e000000'],
    ['CREATE FILE', '00e0000006aabbccddeeff'],
    ['DELETE FILE', '00e4000002aabb'],
    ['PUT DATA', '00da016204aabbccdd'],
    ['VERIFY (a PIN)', '0020008008aabbccddeeff0011'],
    ['EXTERNAL AUTHENTICATE', '0082000008aabbccddeeff0011'],
    ['INTERNAL AUTHENTICATE', '0088000008aabbccddeeff0011'],
    ['EMV GET PROCESSING OPTIONS', '80a8000002830000'],
    ['EMV GENERATE AC', '80ae80000aaabbccddeeff00112233'],
    ['an unknown flazz command (80 32)', '8032000304' + '00000000'],
    ['an unknown tapcash command (90 32 with another P1)', '9032010001010000'],
    ['DESFire write data', '903d00000700000000100000' + '00'],
    ['DESFire write record', '90db00000700000000100000' + '00'],
    ['DESFire credit', '900c00000500000000aa00'],
    ['DESFire debit', '90dc00000500000000aa00'],
    ['DESFire limited credit', '90cb00000500000000aa00'],
    ['DESFire clear records', '90eb000001' + '00' + '00'],
    ['DESFire format card', '90fc000000'],
    ['DESFire delete application', '90da000003010000' + '00'],
    ['DESFire create application', '90ca00000501000000' + '0f00'],
    ['DESFire change key', '90c4000011' + '00'.repeat(17) + '00'],
    ['a mandiri read with other parameters', '00b3010000'],
  ])('%s', async (_name, hex) => {
    const { card, safe } = io();
    await expect(safe.send(hexToBytes(hex))).rejects.toBeInstanceOf(ForbiddenCommandError);
    expect(card.sent).toEqual([]);
  });

  test('a SELECT of a payment application or of the directory of a bank card (EMV)', async () => {
    const { card, safe } = io();
    const ppse = '00a404000e' + '325041592e5359532e4444463031' + '00'; // 2PAY.SYS.DDF01
    const visa = '00a4040007' + 'a0000000031010' + '00';
    const mastercard = '00a4040007' + 'a0000000041010' + '00';
    const gpn = '00a4040007' + 'a0000006021010' + '00';
    for (const hex of [ppse, visa, mastercard, gpn]) await expect(safe.send(hexToBytes(hex))).rejects.toBeInstanceOf(ForbiddenCommandError);
    expect(card.sent).toEqual([]);
  });

  test('a SELECT by name without a name, or of a file with a long id', async () => {
    const { safe } = io();
    await expect(safe.send(hexToBytes('00a4040000'))).rejects.toBeInstanceOf(ForbiddenCommandError);
    await expect(safe.send(hexToBytes('00a40400' + '09' + '0000000000000001'))).rejects.toBeInstanceOf(ForbiddenCommandError); // says 9 bytes, has 8
    await expect(safe.send(hexToBytes('00a401000402000000'))).rejects.toBeInstanceOf(ForbiddenCommandError);
  });

  test('a command that is not a well-formed byte array', () => {
    for (const bad of [[], [0, 1, 2], [0x00, 0xb0, 0x00, 0x00, 256], [0x00, 0xb0, 0x00, 0x00, -1], [0x00, 0xb0, 0x00, 0x00, 1.5], new Array(300).fill(0)]) {
      expect(() => assertReadOnlyCommand(bad, ALLOWED_AIDS)).toThrow(ForbiddenCommandError);
    }
  });

  test('the message of a refusal names the header only, never the data', () => {
    try {
      assertReadOnlyCommand(hexToBytes('00d6000004aabbccdd'), ALLOWED_AIDS);
    } catch (error) {
      expect((error as Error).message).toContain('00d60000');
      expect((error as Error).message).not.toContain('aabbccdd');
    }
  });
});

describe('the list of what may be selected', () => {
  test('is exactly what the adapters declare', () => {
    expect(ALLOWED_AIDS).toEqual(ADAPTERS.flatMap(a => a.aids));
  });

  test('contains no payment application of a card network (EMV) and nothing of a bank card', () => {
    // Registered application provider prefixes of Visa, Mastercard and Maestro, American Express, UnionPay, JCB,
    // Discover, and Indonesia's GPN.
    const PAYMENT_RIDS = ['a000000003', 'a000000004', 'a000000025', 'a000000333', 'a000000065', 'a000000152', 'a000000602', 'a000000677'];
    for (const aid of ALLOWED_AIDS) {
      const hex = bytesToHex(aid);
      expect(PAYMENT_RIDS.some(rid => hex.startsWith(rid))).toBe(false);
      expect(hex).not.toContain('325041592e5359532e44444630'); // PPSE / PSE
    }
  });
});

describe('the radio link', () => {
  test('a transceive that fails is a lost card, with nothing of the original message', async () => {
    const safe = createSafeIo({ transceive: async () => { throw new Error('Transceive failed for 00b300003f'); } }, ALLOWED_AIDS);
    await expect(safe.send(hexToBytes('00b300003f'))).rejects.toBeInstanceOf(CardLostError);
    await expect(safe.send(hexToBytes('00b300003f'))).rejects.toThrow(/^card lost$/);
  });

  test('an answer shorter than a status word is a lost card', async () => {
    const safe = createSafeIo({ transceive: async () => [0x90] }, ALLOWED_AIDS);
    await expect(safe.send(hexToBytes('00b300003f'))).rejects.toBeInstanceOf(CardLostError);
  });

  test('the answer is split into data and the status word', async () => {
    const safe = createSafeIo({ transceive: async () => [1, 2, 3, 0x90, 0x00] }, ALLOWED_AIDS);
    expect(await safe.send(hexToBytes('00b300003f'))).toEqual({ data: [1, 2, 3], sw: 0x9000 });
  });
});

test('the header table', () => {
  expect(isReadOnlyHeader(0x00, 0xb3, 0x00, 0x00)).toBe(true);
  expect(isReadOnlyHeader(0x00, 0xd6, 0x00, 0x00)).toBe(false);
  expect(isReadOnlyHeader(0x90, 0x6c, 0x00, 0x00)).toBe(true);
  expect(isReadOnlyHeader(0x90, 0x0c, 0x00, 0x00)).toBe(false);
});

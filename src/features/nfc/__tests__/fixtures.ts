// Made-up card conversations, built from the written descriptions of each protocol (see the adapters). They are NOT
// recordings of real cards: every number below is invented. A scripted card answers a command whose bytes start with a
// known prefix (the longest match wins), and anything else the way a card answers a command it does not have (6A82).
import { bytesToHex, hexToBytes } from '../hex';
import type { Transport } from '../transceive';

export interface Scripted extends Transport {
  sent: string[]; // every command that was sent, as hex, in order
}

export function scriptedCard(script: Record<string, string>, options: { throwAt?: number } = {}): Scripted {
  const sent: string[] = [];
  const keys = Object.keys(script).sort((a, b) => b.length - a.length);
  return {
    sent,
    async transceive(apdu) {
      const hex = bytesToHex(apdu);
      sent.push(hex);
      if (options.throwAt !== undefined && sent.length === options.throwAt) throw new Error('Tag was lost.');
      const key = keys.find(k => hex.startsWith(k.toLowerCase()));
      return hexToBytes(key ? script[key] : '6a82');
    },
  };
}

const pad = (hex: string, bytes: number) => hex.padEnd(bytes * 2, '0');
const asciiHex = (text: string) => Array.from(text, c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');

// ---- Mandiri e-money: invented number 6032 9840 1234 7731; the balance is 4 bytes little-endian
export const MANDIRI_PAN = '6032984012347731';
export const mandiriCard = (balanceLeHex = '20480100' /* 0x00014820 = Rp84.000 */, panAnswer = pad(MANDIRI_PAN, 63) + '9000') =>
  scriptedCard({
    '00a40400080000000000000001': '9000',
    '00b300003f': panAnswer,
    '00b500000a': pad(balanceLeHex, 10) + '9000',
  });

// ---- Flazz generation 2: invented number 6013 0123 4567 8901; track 2 in ASCII, the balance 3 bytes big-endian
export const FLAZZ_PAN = '6013012345678901';
export const flazzCard = (balanceAnswerHex = '0001e654' /* status 00, then 0x01E654 = Rp124.500 */) =>
  scriptedCard({
    '00a404000ba0000000180f0000018001': '9000',
    '00b081008e': pad(asciiHex(`${FLAZZ_PAN}=29121011234`), 142) + '9000',
    '805c000204': balanceAnswerHex + '9000',
  });

// ---- TapCash: invented number 7546 0100 0000 2233; the answer is long enough to hold it at bytes 8 to 15
export const TAPCASH_PAN = '7546010000002233';
export const tapcashCard = (answerHex = `0000c350${'00'.repeat(4)}${TAPCASH_PAN}` /* status 00, 0x00C350 = Rp50.000 */) =>
  scriptedCard({
    '00a4040006112233445566': '9000',
    '9032030000': answerHex + '9000',
  });

// ---- Brizzi (DESFire): invented number 6013 5555 0000 1234 at bytes 3 to 10 of the file; Get Value is 4 bytes little-endian
export const BRIZZI_PAN = '6013555500001234';
const brizziPanFile = pad(`000000${BRIZZI_PAN}`, 23);
// One 32-byte transaction record: date ddMMyy and time HHmmss as BCD, the amount left as 4 bytes little-endian at 26..29.
export const brizziRecord = (ddmmyy: string, hhmmss: string, leftLeHex: string) => pad(`${'00'.repeat(16)}${ddmmyy}${hhmmss}eb102700${leftLeHex}`, 32);
export const brizziCard = (extra: Record<string, string> = { '906c000001': '127a0000' + '9100' /* 0x7A12 = Rp31.250 */ }) =>
  scriptedCard({
    '905a000003010000': '9100',
    '90bd000007': brizziPanFile + '9100',
    ...extra,
  });

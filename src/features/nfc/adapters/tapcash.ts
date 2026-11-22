// BNI TapCash. Status: experimental, and the least certain of the adapters.
//
// Protocol notes this was written from (facts only, no code was copied): the dwierwink/scannertest notes
// (ALGORITMA_OFFLINE_NFC.md and its command table, no licence stated; the same facts are not confirmed by a second,
// independent source) and the machfudn/tapMoney README (GPL-3.0), which only says the card is ISO-DEP.
//   - SELECT of the application 11 22 33 44 55 66, or A0 00 42 4E 49 10 00 01 (ASCII "BNI" inside it). The other
//     names those notes list are NOT used: one of them begins A0 00 00 00 03, the prefix of a Visa payment application,
//     and a payment application is never selected (transceive.ts would refuse it anyway).
//   - Balance: 90 32 03 00 00. The answer is a status byte 00, then the amount in 3 bytes big-endian (their example:
//     00 00 C3 50 = Rp50.000).
//   - Card number: the notes place it at bytes 8 to 15 of that same answer, as 8 bytes of BCD (16 digits), but their own
//     example answer is only 4 bytes long. So the number is taken from bytes 8 to 15 when the answer is long enough and
//     decodes as 16 decimal digits; otherwise the card cannot be identified and is reported as not supported, instead
//     of guessing.
import { bcdDigits, uint24BE } from '../hex';
import { plausibleBalance, selectAid, type CardAdapter, type CardRead } from './common';
import { SW_OK } from '../transceive';

export const TAPCASH_AIDS: readonly (readonly number[])[] = [
  [0x11, 0x22, 0x33, 0x44, 0x55, 0x66],
  [0xa0, 0x00, 0x42, 0x4e, 0x49, 0x10, 0x00, 0x01],
];

const READ_BALANCE = [0x90, 0x32, 0x03, 0x00, 0x00];

export interface TapcashAnswer {
  balance: number;
  pan: string;
}

export function parseTapcashAnswer(data: readonly number[]): TapcashAnswer | null {
  if (data.length < 16 || data[0] !== 0x00) return null;
  const balance = plausibleBalance(uint24BE(data, 1));
  const pan = bcdDigits(data.slice(8, 16));
  if (balance === null || pan === null || /^0+$/.test(pan)) return null;
  return { balance, pan };
}

export const tapcashAdapter: CardAdapter = {
  issuer: 'tapcash',
  aids: TAPCASH_AIDS,
  async probe(io): Promise<CardRead | null> {
    let selected = false;
    for (const aid of TAPCASH_AIDS) {
      if (await selectAid(io, aid)) {
        selected = true;
        break;
      }
    }
    if (!selected) return null;

    const response = await io.send(READ_BALANCE);
    if (response.sw !== SW_OK) return null;
    const answer = parseTapcashAnswer(response.data);
    if (!answer) return null;
    return { issuer: 'tapcash', pan: answer.pan, balance: answer.balance };
  },
};

// BCA Flazz, second generation. Status: experimental.
//
// Flazz generation 1 keeps its balance encrypted and needs the bank's secure module (SAM) to read it, so it is NOT
// supported: such a card answers neither command below and the scan ends as "unsupported".
//
// Protocol notes this was written from (facts only, no code was copied):
//   - SELECT of the application A0 00 00 00 18 0F 00 00 01 80 01 (11 bytes), as written in the dwierwink/scannertest notes
//     (ALGORITMA_OFFLINE_NFC.md, no licence stated).
//   - Balance: 80 5C 00 02 04, a 3-byte big-endian amount (tapMoney README, GPL-3.0). The notes of scannertest show the
//     same shape for a sibling command: one status byte 00, then the 3 amount bytes. A 4-byte answer is read that way,
//     a 3-byte answer as the amount alone; anything else is not understood.
//   - Card number: READ BINARY 00 B0 81 00 8E returns track 2 data in ASCII; the first 16 characters are the number
//     (prefix 6013 or 6019). If the read is refused, the file 0200 is selected (00 A4 01 00 02 02 00) and it is tried once more.
import { uint24BE } from '../hex';
import { plausibleBalance, selectAid, type CardAdapter, type CardRead } from './common';
import { SW_OK } from '../transceive';

export const FLAZZ_AIDS: readonly (readonly number[])[] = [[0xa0, 0x00, 0x00, 0x00, 0x18, 0x0f, 0x00, 0x00, 0x01, 0x80, 0x01]];

const READ_BALANCE = [0x80, 0x5c, 0x00, 0x02, 0x04];
const READ_TRACK2 = [0x00, 0xb0, 0x81, 0x00, 0x8e];
const SELECT_FILE_0200 = [0x00, 0xa4, 0x01, 0x00, 0x02, 0x02, 0x00];

export function parseFlazzPan(data: readonly number[]): string | null {
  // Printable characters as they are, anything else (padding, length bytes) as a space.
  const ascii = String.fromCharCode(...data.map(b => (b >= 0x20 && b < 0x7f ? b : 0x20)));
  const match = /60(?:13|19)\d{12}/.exec(ascii);
  return match ? match[0] : null;
}

export function parseFlazzBalance(data: readonly number[]): number | null {
  if (data.length === 4) return data[0] === 0x00 ? plausibleBalance(uint24BE(data, 1)) : null;
  if (data.length === 3) return plausibleBalance(uint24BE(data, 0));
  return null;
}

export const flazzAdapter: CardAdapter = {
  issuer: 'flazz',
  aids: FLAZZ_AIDS,
  async probe(io): Promise<CardRead | null> {
    for (const aid of FLAZZ_AIDS) if (!(await selectAid(io, aid))) return null;

    let track = await io.send(READ_TRACK2);
    if (track.sw !== SW_OK) {
      const selected = await io.send(SELECT_FILE_0200);
      if (selected.sw !== SW_OK) return null;
      track = await io.send(READ_TRACK2);
    }
    if (track.sw !== SW_OK) return null;
    const pan = parseFlazzPan(track.data);
    if (!pan) return null;

    const balanceResponse = await io.send(READ_BALANCE);
    if (balanceResponse.sw !== SW_OK) return null;
    const balance = parseFlazzBalance(balanceResponse.data);
    if (balance === null) return null;

    return { issuer: 'flazz', pan, balance };
  },
};

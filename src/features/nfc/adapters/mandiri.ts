// Bank Mandiri "e-money". Status: stable (the one reading the owner asked for first); like every adapter here it has been
// built from public protocol notes and fixtures made from them, and still has to be tried with a physical card.
//
// Protocol notes this was written from (facts only, no code was copied from any of them):
//   - SELECT of the application by its 8-byte name 00 00 00 00 00 00 00 01 (the note of the machfudn/tapMoney project,
//     GPL-3.0, README; and the second name A0 00 00 00 18 30 00 01 that dwierwink/scannertest and muhakmal/osp-kue-reader,
//     Apache-2.0, list for the same card). The first is tried first.
//   - READ 00 B3 00 00 3F gives the card number (prefix 6032); READ 00 B5 00 00 0A gives the balance, its first 4 bytes
//     little-endian (tapMoney README). A second note reads the balance from record 1 of SFI 4 as big-endian (00 B2 01 04
//     00, bytes 12 to 15); the two notes disagree, so only the first is used here.
//   - The notes do not say where in the 63 bytes of 00 B3 the number sits, so the number is looked for by its prefix:
//     16 digits as 8 bytes of BCD, or as 16 ASCII digits, starting with 6032.
import { uint32LE } from '../hex';
import { findPan, plausibleBalance, selectAid, type CardAdapter, type CardRead } from './common';
import { SW_OK } from '../transceive';

export const MANDIRI_AIDS: readonly (readonly number[])[] = [
  [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01],
  [0xa0, 0x00, 0x00, 0x00, 0x18, 0x30, 0x00, 0x01],
];

const READ_PAN = [0x00, 0xb3, 0x00, 0x00, 0x3f];
const READ_BALANCE = [0x00, 0xb5, 0x00, 0x00, 0x0a];

export function parseMandiriPan(data: readonly number[]): string | null {
  return findPan(data, ['6032']);
}

export function parseMandiriBalance(data: readonly number[]): number | null {
  return plausibleBalance(uint32LE(data, 0));
}

export const mandiriAdapter: CardAdapter = {
  issuer: 'mandiri',
  aids: MANDIRI_AIDS,
  async probe(io): Promise<CardRead | null> {
    let selected = false;
    for (const aid of MANDIRI_AIDS) {
      if (await selectAid(io, aid)) {
        selected = true;
        break;
      }
    }
    if (!selected) return null;

    const panResponse = await io.send(READ_PAN);
    if (panResponse.sw !== SW_OK) return null;
    const pan = parseMandiriPan(panResponse.data);
    if (!pan) return null;

    const balanceResponse = await io.send(READ_BALANCE);
    if (balanceResponse.sw !== SW_OK) return null;
    const balance = parseMandiriBalance(balanceResponse.data);
    if (balance === null) return null;

    return { issuer: 'mandiri', pan, balance };
  },
};

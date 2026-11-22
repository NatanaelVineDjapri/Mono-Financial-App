// BRI Brizzi, a MIFARE DESFire card read with DESFire's own commands (class 0x90). Status: experimental.
//
// Protocol notes this was written from (facts only, no code was copied): the machfudn/tapMoney README (GPL-3.0) and the
// dwierwink/scannertest notes (no licence stated).
//   - Select the application with 90 5A 00 00 03 <id: 01 00 00 or 16 00 00> 00; success is status 91 00.
//   - Card number: 90 BD 00 00 07 00 00 00 00 17 00 00 00 (read file 0, 23 bytes). The 16 digits are BCD at bytes 3 to
//     10 of the answer (hex characters 6 to 22), and must start with one of the Brizzi prefixes 5221, 6013 or 5379.
//   - Balance: DESFire Get Value, 90 6C 00 00 01 00 00; the answer is 4 bytes little-endian, then 91 00.
//   - When Get Value is refused (a protected value file), the balance is taken from the most recent transaction record
//     (90 BB 00 00 07 01 00 00 00 00 00 00 00, then 90 AF 00 00 00 while the status is 91 AF): records of 32 bytes, the
//     date as BCD ddMMyy at bytes 16 to 18, the time as BCD HHmmss at 19 to 21, the amount left on the card as 4 bytes
//     little-endian at bytes 26 to 29. The records are not assumed to come in any order: the newest by date and time is
//     used. A balance found this way is marked as an estimate.
import { bcdDigits, uint32LE } from '../hex';
import { plausibleBalance, type CardAdapter, type CardRead } from './common';
import type { CardIo } from '../transceive';
import { SW_DESFIRE_MORE, SW_DESFIRE_OK } from '../transceive';

const APP_IDS: readonly (readonly number[])[] = [
  [0x01, 0x00, 0x00],
  [0x16, 0x00, 0x00],
];
const READ_PAN = [0x90, 0xbd, 0x00, 0x00, 0x07, 0x00, 0x00, 0x00, 0x00, 0x17, 0x00, 0x00, 0x00];
const GET_VALUE = [0x90, 0x6c, 0x00, 0x00, 0x01, 0x00, 0x00];
const READ_RECORDS = [0x90, 0xbb, 0x00, 0x00, 0x07, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
const NEXT_FRAME = [0x90, 0xaf, 0x00, 0x00, 0x00];

const BRIZZI_PREFIXES = ['5221', '6013', '5379'];
const RECORD_BYTES = 32;
const MAX_FRAMES = 24;

export function parseBrizziPan(data: readonly number[]): string | null {
  const digits = bcdDigits(data.slice(3, 11));
  return digits && digits.length === 16 && BRIZZI_PREFIXES.some(p => digits.startsWith(p)) ? digits : null;
}

export function parseBrizziValue(data: readonly number[]): number | null {
  return plausibleBalance(uint32LE(data, 0));
}

// ddMMyy and HHmmss that can be a real moment (an empty record is all zeros).
function isRealDateTime(date: string, time: string): boolean {
  const [dd, mm, hh, mi, ss] = [date.slice(0, 2), date.slice(2, 4), time.slice(0, 2), time.slice(2, 4), time.slice(4, 6)].map(Number);
  return dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && hh <= 23 && mi <= 59 && ss <= 59;
}

// The balance left on the card after the newest of the transaction records, or null.
export function balanceFromRecords(data: readonly number[]): number | null {
  let newest: { key: number; balance: number } | null = null;
  for (let offset = 0; offset + RECORD_BYTES <= data.length; offset += RECORD_BYTES) {
    const record = data.slice(offset, offset + RECORD_BYTES);
    const date = bcdDigits(record.slice(16, 19)); // ddMMyy
    const time = bcdDigits(record.slice(19, 22)); // HHmmss
    const balance = plausibleBalance(uint32LE(record, 26));
    if (!date || !time || balance === null || !isRealDateTime(date, time)) continue;
    const key = Number(`${date.slice(4, 6)}${date.slice(2, 4)}${date.slice(0, 2)}${time}`); // yyMMddHHmmss
    if (newest === null || key > newest.key) newest = { key, balance };
  }
  return newest ? newest.balance : null;
}

async function readAllRecords(io: CardIo): Promise<number[] | null> {
  let response = await io.send(READ_RECORDS);
  const data: number[] = [];
  for (let frame = 0; frame < MAX_FRAMES; frame++) {
    if (response.sw !== SW_DESFIRE_OK && response.sw !== SW_DESFIRE_MORE) return null;
    data.push(...response.data);
    if (response.sw === SW_DESFIRE_OK) return data;
    response = await io.send(NEXT_FRAME);
  }
  return null;
}

export const brizziAdapter: CardAdapter = {
  issuer: 'brizzi',
  aids: [], // native commands, no application is selected by name
  async probe(io): Promise<CardRead | null> {
    let selected = false;
    for (const id of APP_IDS) {
      const { sw } = await io.send([0x90, 0x5a, 0x00, 0x00, 0x03, ...id, 0x00]);
      if (sw === SW_DESFIRE_OK) {
        selected = true;
        break;
      }
    }
    if (!selected) return null;

    const panResponse = await io.send(READ_PAN);
    if (panResponse.sw !== SW_DESFIRE_OK) return null;
    const pan = parseBrizziPan(panResponse.data);
    if (!pan) return null;

    const value = await io.send(GET_VALUE);
    if (value.sw === SW_DESFIRE_OK) {
      const balance = parseBrizziValue(value.data);
      if (balance !== null) return { issuer: 'brizzi', pan, balance };
    }

    const records = await readAllRecords(io);
    const estimate = records ? balanceFromRecords(records) : null;
    return estimate === null ? null : { issuer: 'brizzi', pan, balance: estimate, estimated: true };
  },
};

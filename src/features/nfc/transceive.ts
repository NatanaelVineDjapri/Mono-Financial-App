// The ONE way a command reaches a card. Everything an adapter sends goes through a CardIo made here, and a CardIo
// refuses (before anything is sent) every command that is not a READ:
//
//   - The command header (class, instruction, P1, P2) must be on the allow list below. The list is a table of exact
//     headers, not just instruction bytes, so an instruction that reads in one family of cards and writes in another is
//     never let through by accident. Nothing that writes, credits, debits, formats or deletes is on it.
//   - A SELECT by name may only select an application an adapter declared (the e-money applications of this feature).
//     So no EMV payment application, and not the directory of a debit or credit card (PPSE), can be selected; MONO
//     never sends EMV commands and never reads a bank card's number.
//   - The command must be a well-formed byte array.
//
// A failure of the radio link (the card was pulled away, the transceive failed) becomes CardLostError, with nothing of
// the original message: it can mention what was sent.
export class ForbiddenCommandError extends Error {
  constructor(reason: string) {
    super(`forbidden card command: ${reason}`);
    this.name = 'ForbiddenCommandError';
  }
}

export class CardLostError extends Error {
  constructor() {
    super('card lost');
    this.name = 'CardLostError';
  }
}

export interface Transport {
  // The bytes sent to the card, and the bytes it answered with, status word (SW1 SW2) last.
  transceive(apdu: number[]): Promise<number[]>;
}

export interface CardResponse {
  data: number[];
  sw: number; // SW1 * 256 + SW2
}

export interface CardIo {
  send(apdu: readonly number[]): Promise<CardResponse>;
}

export const SW_OK = 0x9000;
export const SW_DESFIRE_OK = 0x9100;
export const SW_DESFIRE_MORE = 0x91af;

interface HeaderRule {
  cla: number;
  ins: number;
  p1?: number; // omitted: any
  p2?: number;
  what: string;
}

// Read-only commands only. "Proprietary read" means the e-money issuers' own balance or card-number read, as described
// in the public protocol notes quoted in each adapter.
const READ_COMMANDS: readonly HeaderRule[] = [
  { cla: 0x00, ins: 0xa4, what: 'SELECT (an application by name, or a file)' },
  { cla: 0x00, ins: 0xb0, what: 'READ BINARY' },
  { cla: 0x00, ins: 0xb2, what: 'READ RECORD' },
  { cla: 0x00, ins: 0xca, what: 'GET DATA' },
  { cla: 0x00, ins: 0xb3, p1: 0x00, p2: 0x00, what: 'mandiri e-money: read card number (proprietary read)' },
  { cla: 0x00, ins: 0xb5, p1: 0x00, p2: 0x00, what: 'mandiri e-money: read balance (proprietary read)' },
  { cla: 0x80, ins: 0x5c, p1: 0x00, p2: 0x02, what: 'flazz: read balance (proprietary read)' },
  { cla: 0x90, ins: 0x32, p1: 0x03, p2: 0x00, what: 'tapcash: read balance (proprietary read)' },
  // DESFire native commands (wrapped in ISO 7816 with class 0x90), the reading ones only.
  { cla: 0x90, ins: 0x5a, p1: 0x00, p2: 0x00, what: 'DESFire: select application' },
  { cla: 0x90, ins: 0xbd, p1: 0x00, p2: 0x00, what: 'DESFire: read data' },
  { cla: 0x90, ins: 0xbb, p1: 0x00, p2: 0x00, what: 'DESFire: read records' },
  { cla: 0x90, ins: 0x6c, p1: 0x00, p2: 0x00, what: 'DESFire: get value' },
  { cla: 0x90, ins: 0xaf, p1: 0x00, p2: 0x00, what: 'DESFire: next frame of a read' },
];

export function isReadOnlyHeader(cla: number, ins: number, p1: number, p2: number): boolean {
  return READ_COMMANDS.some(r => r.cla === cla && r.ins === ins && (r.p1 === undefined || r.p1 === p1) && (r.p2 === undefined || r.p2 === p2));
}

function hex(bytes: readonly number[]): string {
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Checks a command. Throws ForbiddenCommandError, and never includes the command bytes in the message beyond the header.
export function assertReadOnlyCommand(apdu: readonly number[], allowedAids: readonly (readonly number[])[]): void {
  if (!Array.isArray(apdu) || apdu.length < 4 || apdu.length > 261 || !apdu.every(b => Number.isInteger(b) && b >= 0 && b <= 255)) {
    throw new ForbiddenCommandError('malformed command');
  }
  const [cla, ins, p1, p2] = apdu;
  if (!isReadOnlyHeader(cla, ins, p1, p2)) throw new ForbiddenCommandError(`header ${hex([cla, ins, p1, p2])} is not a read command`);

  // SELECT by name (P1 = 04): only an application an adapter declared.
  if (cla === 0x00 && ins === 0xa4 && p1 === 0x04) {
    const lc = apdu[4];
    const data = apdu.slice(5, 5 + lc);
    if (lc === undefined || lc === 0 || data.length !== lc) throw new ForbiddenCommandError('SELECT by name without a name');
    const known = allowedAids.some(aid => aid.length === data.length && aid.every((b, i) => b === data[i]));
    if (!known) throw new ForbiddenCommandError('SELECT of an application that is not an e-money application of this feature');
  }
  // SELECT of a file or a path (P1 = 00, 01, 02, 08, 09): only a file id of two bytes.
  if (cla === 0x00 && ins === 0xa4 && p1 !== 0x04) {
    if (apdu[4] !== 2) throw new ForbiddenCommandError('SELECT of a file needs a two-byte file id');
  }
}

export function createSafeIo(transport: Transport, allowedAids: readonly (readonly number[])[]): CardIo {
  return {
    async send(apdu) {
      assertReadOnlyCommand(apdu, allowedAids);
      let raw: number[];
      try {
        raw = await transport.transceive([...apdu]);
      } catch {
        throw new CardLostError();
      }
      if (!Array.isArray(raw) || raw.length < 2) throw new CardLostError();
      const sw = raw[raw.length - 2] * 256 + raw[raw.length - 1];
      return { data: raw.slice(0, -2), sw };
    },
  };
}

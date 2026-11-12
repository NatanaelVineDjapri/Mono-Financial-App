// One scan, from a picture to a result the review can show: read the text on the device, parse it,
// and say whether it is usable. The result is only ever a draft: nothing here writes a transaction.
//
// The picture: when the scan works it stays (a cached copy) so the review can show it as a
// thumbnail, and the caller hands it to the store, which deletes it when the review ends. When the
// scan does not work the picture is deleted here at once.
import { discardCachedImage } from './cache';
import { readReceiptLines } from './ocr';
import { isReadable, parseReceipt, type ParsedReceipt } from './parse';

export type ScanOutcome = { ok: true; parsed: ParsedReceipt; imageUri: string; lines: string[] } | { ok: false; reason: 'unreadable' | 'foreign' };

function fail(uri: string, reason: 'unreadable' | 'foreign'): ScanOutcome {
  discardCachedImage(uri);
  return { ok: false, reason };
}

export async function scanImage(uri: string, today: string): Promise<ScanOutcome> {
  let lines: string[];
  try {
    lines = await readReceiptLines(uri);
  } catch (error) {
    // The person sees "belum terbaca" either way; a developer needs to know it was the recognizer
    // itself (for example the native module is not in this build) and not the picture.
    if (__DEV__) console.warn('[receipt] text recognition failed:', error);
    return fail(uri, 'unreadable');
  }
  const parsed = parseReceipt(lines, today);
  if (parsed.foreignCurrency) return fail(uri, 'foreign');
  if (!isReadable(parsed)) {
    // Development builds only: how much text came out, to tell "nothing recognized" from "no total found".
    if (__DEV__) console.warn(`[receipt] ${lines.length} line(s) recognized, no total found:`, lines.slice(0, 40));
    return fail(uri, 'unreadable');
  }
  return { ok: true, parsed, imageUri: uri, lines };
}

// The one scan waiting to be reviewed, in memory only: never in the database, never on disk. It
// holds the parsed fields (shop, date, total candidates), the path of the cached picture for the
// review's thumbnail and the recognized lines, kept only so "Rapikan dengan AI" can send them if the
// person agrees (every time). The lines are never persisted and go with the draft. Clearing it (leaving the review, saving, starting a new
// scan) deletes that picture. Nothing here is a transaction: a scan is always a draft until the
// person taps Simpan.
import { create } from 'zustand';

import { discardCachedImage } from './cache';
import type { ParsedReceipt } from './parse';

interface ReceiptState {
  result: ParsedReceipt | null;
  imageUri: string | null;
  lines: string[];
  setResult: (result: ParsedReceipt, imageUri?: string | null, lines?: string[]) => void;
  clear: () => void;
}

export const useReceiptStore = create<ReceiptState>((set, get) => ({
  result: null,
  imageUri: null,
  lines: [],
  setResult: (result, imageUri = null, lines = []) => {
    const previous = get().imageUri;
    if (previous && previous !== imageUri) discardCachedImage(previous);
    set({ result, imageUri, lines });
  },
  clear: () => {
    const { imageUri } = get();
    if (imageUri) discardCachedImage(imageUri);
    set({ result: null, imageUri: null, lines: [] });
  },
}));

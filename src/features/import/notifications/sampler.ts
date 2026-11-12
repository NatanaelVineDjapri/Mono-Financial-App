// The sample recorder (docs/IMPORT_PLAN.md): __DEV__ ONLY. Shows the raw text of notifications from
// the apps that are switched on, so a real sample can be copied out and pasted into a chat to build
// a parser from real text instead of an invented format.
//
// The text lives in memory only (a small list in a store). It is never written to the database or
// to disk, only apps on the allowlist are shown (the native filter, then this file's own check), and
// in a production build nothing here does anything: `startSampler` returns at once.
import { create } from 'zustand';

import { acceptNotification } from './allowlist';
import { addNotificationListener, type RawNotification } from './native';

export const MAX_SAMPLES = 50;

export interface Sample extends RawNotification {
  id: number;
}

interface SamplerState {
  samples: Sample[];
  add: (event: RawNotification) => void;
  clear: () => void;
}

let nextId = 1;

export const useSamplerStore = create<SamplerState>(set => ({
  samples: [],
  add: event =>
    set(state => ({
      samples: [{ ...event, id: nextId++ }, ...state.samples].slice(0, MAX_SAMPLES),
    })),
  clear: () => set({ samples: [] }),
}));

// One sample as the text to copy: package, time, title and text, one per line.
export function sampleToText(sample: RawNotification): string {
  const time = new Date(sample.postedAt).toISOString();
  return [`package: ${sample.package}`, `waktu: ${time}`, `judul: ${sample.title ?? ''}`, `teks: ${sample.text ?? ''}`, ...(sample.bigText && sample.bigText !== sample.text ? [`teks panjang: ${sample.bigText}`] : [])].join('\n');
}

// Start listening. `allowed` is read on every event (the person may switch apps on and off while
// the screen is open). Returns a function that stops it.
export function startSampler(allowed: () => ReadonlySet<string>): () => void {
  if (!__DEV__) return () => undefined;
  const subscription = addNotificationListener(event => {
    if (acceptNotification(event, allowed())) useSamplerStore.getState().add(event);
  });
  return () => subscription?.remove();
}

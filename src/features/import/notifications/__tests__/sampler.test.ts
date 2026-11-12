// The dev sample recorder: in memory only, only allowed apps, nothing in a production build.
import * as native from '../native';
import { MAX_SAMPLES, sampleToText, startSampler, useSamplerStore } from '../sampler';
import type { RawNotification } from '../native';

jest.mock('../native', () => ({ addNotificationListener: jest.fn() }));

const addListener = native.addNotificationListener as jest.Mock;
const note = (pkg: string, over: Partial<RawNotification> = {}): RawNotification => ({ package: pkg, title: 'Transfer masuk', text: 'Rp 50.000 dari Budi', bigText: null, postedAt: 1_700_000_000_000, ...over });

let emit: (event: RawNotification) => void = () => undefined;
const remove = jest.fn();

beforeEach(() => {
  useSamplerStore.getState().clear();
  remove.mockReset();
  addListener.mockClear();
  addListener.mockImplementation((listener: (e: RawNotification) => void) => {
    emit = listener;
    return { remove };
  });
});

describe('startSampler', () => {
  test('an allowed app is recorded in memory, newest first', () => {
    const stop = startSampler(() => new Set(['com.bca.mobile']));
    emit(note('com.bca.mobile', { text: 'pertama' }));
    emit(note('com.bca.mobile', { text: 'kedua' }));
    expect(useSamplerStore.getState().samples.map(s => s.text)).toEqual(['kedua', 'pertama']);
    stop();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  test('an app that is not allowed is never recorded, even if something upstream let it through', () => {
    startSampler(() => new Set(['com.bca.mobile']));
    emit(note('com.whatsapp', { title: 'Budi', text: 'sudah kutransfer Rp 50.000' }));
    expect(useSamplerStore.getState().samples).toEqual([]);
  });

  test('the allowlist is read again on every event', () => {
    const allowed = new Set<string>();
    startSampler(() => allowed);
    emit(note('com.gojek.gopay'));
    allowed.add('com.gojek.gopay');
    emit(note('com.gojek.gopay'));
    expect(useSamplerStore.getState().samples).toHaveLength(1);
  });

  test('only the newest MAX_SAMPLES are kept', () => {
    startSampler(() => new Set(['com.bca.mobile']));
    for (let i = 0; i < MAX_SAMPLES + 10; i++) emit(note('com.bca.mobile', { text: `n${i}` }));
    const samples = useSamplerStore.getState().samples;
    expect(samples).toHaveLength(MAX_SAMPLES);
    expect(samples[0].text).toBe(`n${MAX_SAMPLES + 9}`);
  });

  test('in a production build it does nothing at all: it does not even subscribe', () => {
    const dev = (globalThis as { __DEV__?: boolean }).__DEV__;
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    try {
      const stop = startSampler(() => new Set(['com.bca.mobile']));
      expect(addListener).not.toHaveBeenCalled();
      expect(stop()).toBeUndefined();
    } finally {
      (globalThis as { __DEV__?: boolean }).__DEV__ = dev;
    }
  });

  test('the store is memory only: clearing it empties it', () => {
    startSampler(() => new Set(['com.bca.mobile']));
    emit(note('com.bca.mobile'));
    useSamplerStore.getState().clear();
    expect(useSamplerStore.getState().samples).toEqual([]);
  });
});

describe('sampleToText', () => {
  test('package, time, title and text, one per line', () => {
    expect(sampleToText(note('com.bca.mobile'))).toBe('package: com.bca.mobile\nwaktu: 2023-11-14T22:13:20.000Z\njudul: Transfer masuk\nteks: Rp 50.000 dari Budi');
  });

  test('a long text is added only when it differs from the text', () => {
    expect(sampleToText(note('a', { bigText: 'Rp 50.000 dari Budi' }))).not.toMatch(/teks panjang/);
    expect(sampleToText(note('a', { bigText: 'Rp 50.000 dari Budi untuk makan' }))).toMatch(/teks panjang: Rp 50\.000 dari Budi untuk makan/);
  });

  test('missing fields are empty, not "null"', () => {
    expect(sampleToText(note('a', { title: null, text: null }))).toMatch(/judul: \nteks: $/);
  });
});

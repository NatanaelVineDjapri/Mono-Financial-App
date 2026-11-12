// cache.ts and the store's hold on the picture: only a cached copy is ever deleted (never the
// person's own photo in the gallery), and clearing the draft deletes the picture.
import { File } from 'expo-file-system';

import { discardCachedImage } from '../cache';
import { useReceiptStore } from '../store';

jest.mock('expo-file-system', () => {
  const files = new Map<string, { exists: boolean }>();
  class MockFile {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
      if (!files.has(uri)) files.set(uri, { exists: true });
    }
    get exists() {
      return files.get(this.uri)!.exists;
    }
    delete() {
      files.get(this.uri)!.exists = false;
    }
  }
  return { File: MockFile, Paths: { cache: { uri: 'file:///data/user/0/app/cache/' } }, __files: files };
});

const files = (jest.requireMock('expo-file-system') as { __files: Map<string, { exists: boolean }> }).__files;
const CACHED = 'file:///data/user/0/app/cache/Camera/receipt.jpg';
const OTHER = 'file:///data/user/0/app/cache/ImagePicker/other.jpg';
const GALLERY = 'file:///storage/emulated/0/DCIM/Camera/IMG_0001.jpg';
const PARSED = { merchant: 'Toko', date: '2026-10-28', dateFromReceipt: true, totals: [{ amount: 48000, score: 100 }], foreignCurrency: false };

beforeEach(() => {
  files.clear();
  useReceiptStore.setState({ result: null, imageUri: null });
});

describe('discardCachedImage', () => {
  test('a cached picture is deleted', () => {
    expect(discardCachedImage(CACHED)).toBe(true);
    expect(new File(CACHED).exists).toBe(false);
  });

  test('a file outside the cache folder is never touched', () => {
    expect(discardCachedImage(GALLERY)).toBe(false);
    expect(files.get(GALLERY)).toBeUndefined();
  });

  test('a cache-lookalike path is not the cache', () => {
    expect(discardCachedImage('file:///data/user/0/app/cache-other/x.jpg')).toBe(false);
  });
});

describe('the store and the picture', () => {
  test('the picture lives while the draft does, and clearing the draft deletes it', () => {
    useReceiptStore.getState().setResult(PARSED, CACHED);
    expect(new File(CACHED).exists).toBe(true);
    useReceiptStore.getState().clear();
    expect(new File(CACHED).exists).toBe(false);
    expect(useReceiptStore.getState()).toMatchObject({ result: null, imageUri: null });
  });

  test('a new scan deletes the picture of the one before', () => {
    useReceiptStore.getState().setResult(PARSED, CACHED);
    useReceiptStore.getState().setResult(PARSED, OTHER);
    expect(new File(CACHED).exists).toBe(false);
    expect(new File(OTHER).exists).toBe(true);
  });

  test('a picture picked from the gallery is cleared without touching the original', () => {
    useReceiptStore.getState().setResult(PARSED, GALLERY);
    useReceiptStore.getState().clear();
    expect(files.get(GALLERY)).toBeUndefined();
  });
});

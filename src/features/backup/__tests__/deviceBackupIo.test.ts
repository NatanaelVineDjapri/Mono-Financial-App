// The real-device side of "Buat cadangan", with expo-file-system and expo-sharing mocked: old backup
// files are cleared out of the cache (and nothing else), the new one is written, and the share sheet
// is only opened when sharing is possible.
import * as Sharing from 'expo-sharing';

import { deviceBackupIo } from '../deviceBackupIo';

const mockFiles = new Map<string, { content: string | null; deleted: boolean }>();

jest.mock('expo-file-system', () => {
  class MockFile {
    name: string;
    uri: string;
    constructor(dir: { uri: string }, name?: string) {
      // new File(Paths.cache, name) or a listed entry (dir only)
      this.name = name ?? (dir as unknown as { name: string }).name;
      this.uri = name ? `${dir.uri}${name}` : (dir as unknown as { uri: string }).uri;
      if (name && !mockFiles.has(this.uri)) mockFiles.set(this.uri, { content: null, deleted: false });
    }
    get exists() {
      const f = mockFiles.get(this.uri);
      return !!f && !f.deleted && f.content !== null;
    }
    get size() {
      return mockFiles.get(this.uri)?.content?.length ?? null;
    }
    create() {
      mockFiles.set(this.uri, { content: '', deleted: false });
    }
    async write(content: string) {
      mockFiles.set(this.uri, { content, deleted: false });
    }
    delete() {
      const f = mockFiles.get(this.uri);
      if (f) f.deleted = true;
    }
  }
  const listed = (name: string) => {
    const f = Object.create(MockFile.prototype) as InstanceType<typeof MockFile>;
    f.name = name;
    f.uri = `file:///cache/${name}`;
    mockFiles.set(f.uri, { content: 'old', deleted: false });
    return f;
  };
  return {
    File: MockFile,
    Paths: { cache: { uri: 'file:///cache/', list: () => [listed('mono-backup-2026-10-01.json'), listed('mono-backup-2026-10-20.json'), listed('receipt.jpg'), listed('mono-backup-notes.txt')] } },
  };
});
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));

const isAvailable = Sharing.isAvailableAsync as jest.Mock;
const shareAsync = Sharing.shareAsync as jest.Mock;

beforeEach(() => {
  mockFiles.clear();
  isAvailable.mockReset().mockResolvedValue(true);
  shareAsync.mockReset().mockResolvedValue(undefined);
});

describe('deviceBackupIo.write', () => {
  test('writes the file in the cache and says where and how big', async () => {
    const result = await deviceBackupIo.write('mono-backup-2026-10-28.json', '{"a":1}');
    expect(result).toEqual({ uri: 'file:///cache/mono-backup-2026-10-28.json', sizeBytes: 7 });
    expect(mockFiles.get('file:///cache/mono-backup-2026-10-28.json')?.content).toBe('{"a":1}');
  });

  test('earlier backup files are cleared out of the cache first, and nothing else is touched', async () => {
    await deviceBackupIo.write('mono-backup-2026-10-28.json', '{}');
    expect(mockFiles.get('file:///cache/mono-backup-2026-10-01.json')?.deleted).toBe(true);
    expect(mockFiles.get('file:///cache/mono-backup-2026-10-20.json')?.deleted).toBe(true);
    expect(mockFiles.get('file:///cache/receipt.jpg')?.deleted).toBe(false);
    expect(mockFiles.get('file:///cache/mono-backup-notes.txt')?.deleted).toBe(false);
  });

  test('the same day twice replaces the file instead of failing', async () => {
    await deviceBackupIo.write('mono-backup-2026-10-28.json', 'first');
    const second = await deviceBackupIo.write('mono-backup-2026-10-28.json', 'second!');
    expect(second.sizeBytes).toBe(7);
    expect(mockFiles.get('file:///cache/mono-backup-2026-10-28.json')?.content).toBe('second!');
  });
});

describe('deviceBackupIo.share', () => {
  test('opens the share sheet for a JSON file', async () => {
    await deviceBackupIo.share('file:///cache/mono-backup-2026-10-28.json');
    expect(shareAsync).toHaveBeenCalledWith('file:///cache/mono-backup-2026-10-28.json', { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Simpan cadangan MONO' });
  });

  test('when sharing is not possible it throws, and no sheet is opened', async () => {
    isAvailable.mockResolvedValue(false);
    await expect(deviceBackupIo.share('file:///cache/x.json')).rejects.toThrow('sharing_unavailable');
    expect(shareAsync).not.toHaveBeenCalled();
  });
});

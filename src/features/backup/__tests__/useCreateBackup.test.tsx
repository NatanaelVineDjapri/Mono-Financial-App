// The hook behind every "Buat cadangan" button: one run at a time, a snackbar for the result, and
// the screens that show the backup status refreshed.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useToastStore } from '@/components/toast-store';

import { createBackup } from '../createBackup';
import { useCreateBackup } from '../useCreateBackup';

jest.mock('@/data/db/DbProvider', () => ({ useDb: () => ({ fake: 'db' }) }));
jest.mock('@/core/sha256', () => ({ sha256Hex: jest.fn(async () => 'hash') }));
jest.mock('../deviceBackupIo', () => ({ deviceBackupIo: { write: jest.fn(), share: jest.fn() } }));
jest.mock('../createBackup', () => ({ createBackup: jest.fn() }));

const mockCreate = createBackup as jest.MockedFunction<typeof createBackup>;

function setup() {
  const client = new QueryClient();
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { wrapper, invalidate };
}

beforeEach(() => {
  jest.clearAllMocks();
  useToastStore.setState({ visible: false, message: '' });
});

describe('useCreateBackup', () => {
  test('a good backup: the snackbar "Cadangan tersimpan." and everything that reads the log is refreshed', async () => {
    mockCreate.mockResolvedValue({ ok: true, fileName: 'mono-backup-2026-10-28.json', sizeBytes: 10, txCount: 2, createdAt: '2026-10-28T12:41:09+07:00' });
    const { wrapper, invalidate } = setup();
    const { result } = await renderHook(() => useCreateBackup(), { wrapper });

    let ok = false;
    await act(async () => {
      ok = await result.current.create();
    });
    expect(ok).toBe(true);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(useToastStore.getState()).toMatchObject({ visible: true, message: 'Cadangan tersimpan.' });
    expect(invalidate).toHaveBeenCalled();
  });

  test('a failed backup: a plain sentence, nothing refreshed, and the button is usable again', async () => {
    mockCreate.mockResolvedValue({ ok: false, reason: 'failed' });
    const { wrapper, invalidate } = setup();
    const { result } = await renderHook(() => useCreateBackup(), { wrapper });

    let ok = true;
    await act(async () => {
      ok = await result.current.create();
    });
    expect(ok).toBe(false);
    expect(useToastStore.getState().message).toBe('Cadangan gagal dibuat. Tidak ada yang berubah.');
    expect(invalidate).not.toHaveBeenCalled();
    expect(result.current.busy).toBe(false);
  });

  test('a second tap while one backup is running does nothing', async () => {
    let finish: (v: Awaited<ReturnType<typeof createBackup>>) => void = () => undefined;
    mockCreate.mockReturnValue(new Promise(resolve => (finish = resolve)));
    const { wrapper } = setup();
    const { result } = await renderHook(() => useCreateBackup(), { wrapper });

    let first: Promise<boolean> = Promise.resolve(false);
    await act(async () => {
      first = result.current.create();
    });
    expect(result.current.busy).toBe(true);
    let second = true;
    await act(async () => {
      second = await result.current.create();
    });
    expect(second).toBe(false);
    expect(mockCreate).toHaveBeenCalledTimes(1);

    await act(async () => {
      finish({ ok: true, fileName: 'x.json', sizeBytes: 1, txCount: 0, createdAt: '2026-10-28T12:41:09+07:00' });
      await first;
    });
    expect(result.current.busy).toBe(false);
  });
});

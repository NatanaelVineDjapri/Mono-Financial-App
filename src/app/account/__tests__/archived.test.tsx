// The archived accounts screen over a real database: what it shows, restore, and delete with a move.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { openMigratedTestDb } from '@/data/db/openTestDb';
import type { Db } from '@/data/db/types';
import { archiveAccount, createAccount } from '@/domain/accounts';

import ArchivedAccountsScreen from '../archived';

let mockDb: Db;
jest.mock('@/data/db/DbProvider', () => ({ useDb: () => mockDb }));
const mockBack = jest.fn();
jest.mock('expo-router', () => ({ ...jest.requireActual('expo-router'), useRouter: () => ({ back: mockBack, push: jest.fn() }) }));

const METRICS = { insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 390, height: 844 } };
const NOW = '2026-10-28T10:00:00.000Z';

test('delete asks where the records go, says what happens, and moves them', async () => {
  mockDb = await openMigratedTestDb();
  const old = await createAccount(mockDb, { name: 'Lama', type: 'bank', openingBalance: 500000, openingDate: '2026-10-01' }, NOW);
  const keep = await createAccount(mockDb, { name: 'Baru', type: 'bank', openingBalance: 100000, openingDate: '2026-10-01' }, NOW);
  await mockDb.runAsync(
    "insert into transactions (kind, account_id, category_id, amount, amount_idr, occurred_on, created_at, updated_at) values ('expense', $a, (select id from categories where kind = 'expense' limit 1), 1000, 1000, '2026-10-02', $now, $now)",
    { $a: old, $now: NOW },
  );
  await archiveAccount(mockDb, old);

  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const view = await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <QueryClientProvider client={client}>
        <ArchivedAccountsScreen />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
  await waitFor(() => expect(view.getByText('Lama')).toBeTruthy());
  expect(view.getByText('Rp499.000')).toBeTruthy();

  await fireEvent.press(view.getByTestId(`archived-account-delete-${old}`));
  await waitFor(() => expect(view.getByTestId(`removal-to-${keep}`)).toBeTruthy());
  await fireEvent.press(view.getByTestId(`removal-to-${keep}`));
  expect(view.getByText('Catatannya (1) dan saldonya pindah ke Baru, jadi kekayaan bersih tidak berubah. Tidak bisa dibatalkan.')).toBeTruthy();
  await act(async () => {
    await fireEvent.press(view.getByText('Hapus'));
  });

  await waitFor(async () => expect(await mockDb.getAllAsync('select id, opening_balance from accounts')).toEqual([{ id: keep, opening_balance: 600000 }]));
});

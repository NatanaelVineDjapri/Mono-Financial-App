// __DEV__-only: loads tools/november_transactions.sql into the database.
// Tambahan transaksi November 2026 untuk melengkapi sample data.
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';

import type { Db } from '@/data/db/types';

async function loadNovemberSql(): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require, not a dynamic module load
  const asset = Asset.fromModule(require('../../tools/november_transactions.sql'));
  await asset.downloadAsync();
  if (!asset.localUri) {
    throw new Error('november_transactions.sql asset has no localUri after downloadAsync().');
  }
  return new File(asset.localUri).text();
}

export async function loadNovemberData(db: Db): Promise<void> {
  await db.execAsync(await loadNovemberSql());
}

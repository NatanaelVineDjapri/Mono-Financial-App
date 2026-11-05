// __DEV__-only: loads tools/sample_data.sql (CLAUDE.md "Sample data") into an
// already-schema'd, otherwise-empty database — the same bundled-asset pattern
// src/data/db/open.ts uses for the schema itself. Never shipped as real data.
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';

import type { Db } from '@/data/db/types';

async function loadSampleSql(): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require, not a dynamic module load
  const asset = Asset.fromModule(require('../../tools/sample_data.sql'));
  await asset.downloadAsync();
  if (!asset.localUri) {
    throw new Error('sample_data.sql asset has no localUri after downloadAsync().');
  }
  return new File(asset.localUri).text();
}

export async function loadSampleData(db: Db): Promise<void> {
  await db.execAsync(await loadSampleSql());
}

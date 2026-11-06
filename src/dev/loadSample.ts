// __DEV__-only: loads tools/sample_data.sql (CLAUDE.md "Sample data") into an
// already-schema'd, otherwise-empty database — the same bundled-asset pattern
// src/data/db/open.ts uses for the schema itself. Never shipped as real data.
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';

import { createValasAccount } from '@/domain/accounts';
import type { Db } from '@/data/db/types';
import { insertFxRate } from '@/data/repo/fx';

async function loadSampleSql(): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require, not a dynamic module load
  const asset = Asset.fromModule(require('../../tools/sample_data.sql'));
  await asset.downloadAsync();
  if (!asset.localUri) {
    throw new Error('sample_data.sql asset has no localUri after downloadAsync().');
  }
  return new File(asset.localUri).text();
}

// tools/sample_data.sql has no `icon` column values (CLAUDE.md: never ship the seed as
// real data, so it stays a minimal, icon-less fixture) — the Accounts tab's BankCard
// needs one to show a real brand card instead of the neutral fallback, so the dev-only
// loader sets it here by the sample's own fixed account names, never touching the .sql.
const SAMPLE_ACCOUNT_ICONS: Record<string, string> = {
  'BCA Tabungan': 'bca',
  'GoPay': 'gopay',
  'Jago Pocket': 'jago',
  'Cash wallet': 'cash',
};

// Exported (alongside addValasFixture below) so a Jest test can exercise the DB-only
// logic directly, the same way loadSample.test.ts already does for the raw .sql itself —
// loadSampleData()/loadSampleDataWithValas() can't run under Jest (expo-asset).
export async function setSampleAccountIcons(db: Db): Promise<void> {
  for (const [name, icon] of Object.entries(SAMPLE_ACCOUNT_ICONS)) {
    await db.runAsync('update accounts set icon = $icon where name = $name', { $icon: icon, $name: name });
  }
}

export async function loadSampleData(db: Db): Promise<void> {
  await db.execAsync(await loadSampleSql());
  await setSampleAccountIcons(db);
}

// CLAUDE.md's Valas sample (separate from the IDR sample above): US$250,00 and S$180,00
// at 28 Oct 2026 09:00's rates (US$1 = Rp16.250, S$1 = Rp12.500), so Valas ≈ Rp6.312.500
// and net worth with Valas ≈ Rp15.192.500. Only for the dev "+ Valas" button, so the
// Accounts tab's forex group and BankCard can be seen without a real Valas account.
const VALAS_FIXTURE_AT = '2026-10-28T09:00:00+07:00';

export async function addValasFixture(db: Db): Promise<void> {
  await createValasAccount(
    db,
    {
      name: 'Valas',
      openingDate: '2026-10-01',
      pockets: [
        { currency: 'USD', openingBalance: 25000 }, // US$250,00
        { currency: 'SGD', openingBalance: 18000 }, // S$180,00
      ],
    },
    VALAS_FIXTURE_AT,
  );
  await insertFxRate(db, 'USD', 162500000, VALAS_FIXTURE_AT, 'api');
  await insertFxRate(db, 'SGD', 125000000, VALAS_FIXTURE_AT, 'api');
}

export async function loadSampleDataWithValas(db: Db): Promise<void> {
  await loadSampleData(db);
  await addValasFixture(db);
}

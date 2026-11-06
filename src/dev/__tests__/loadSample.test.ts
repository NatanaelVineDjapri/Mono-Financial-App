// Proves the bundled tools/sample_data.sql itself (not the __DEV__-only asset-loading
// wrapper in ../loadSample.ts, which needs expo-asset/expo-file-system and so can't run
// under Jest — same reason src/data/db/open.ts's loadSchemaSql() isn't unit tested
// directly either) reproduces CLAUDE.md's reference net worth through the real schema.
import * as fs from 'fs';
import * as path from 'path';

import { openTestDb } from '../../data/db/openTestDb';
import { listAccountBalances, listAccountsForOverview } from '../../domain/balances';
import { getNetWorth } from '../../domain/net-worth';
import { addValasFixture, setSampleAccountIcons } from '../loadSample';

const SAMPLE_SQL = fs.readFileSync(path.join(__dirname, '../../../tools/sample_data.sql'), 'utf8');

describe('tools/sample_data.sql', () => {
  test('produces a net worth of Rp8.880.000', async () => {
    const db = openTestDb();
    await db.execAsync(SAMPLE_SQL);

    const netWorth = await getNetWorth(db);

    expect(netWorth).toEqual({ netWorth: 8880000, incomplete: false });
  });
});

describe('setSampleAccountIcons', () => {
  test('sets each sample account to its real bank icon slug, by name, without touching the numbers', async () => {
    const db = openTestDb();
    await db.execAsync(SAMPLE_SQL);

    await setSampleAccountIcons(db);

    const accounts = await listAccountsForOverview(db);
    const icons = Object.fromEntries(accounts.map(a => [a.name, a.icon]));
    expect(icons).toEqual({
      'BCA Tabungan': 'bca',
      'Cash wallet': 'cash',
      GoPay: 'gopay',
      'Jago Pocket': 'jago',
    });
    expect(await getNetWorth(db)).toEqual({ netWorth: 8880000, incomplete: false });
  });
});

describe('addValasFixture', () => {
  test('adds a Valas account worth ≈ Rp6.312.500, net worth with Valas ≈ Rp15.192.500', async () => {
    const db = openTestDb();
    await db.execAsync(SAMPLE_SQL);

    await addValasFixture(db);

    const netWorth = await getNetWorth(db);
    expect(netWorth).toEqual({ netWorth: 8880000 + 6312500, incomplete: false });

    const accounts = await listAccountBalances(db);
    const valas = accounts.find(a => a.name === 'Valas');
    expect(valas).toMatchObject({ type: 'forex', balance: 6312500 });
  });
});

// Proves the bundled tools/sample_data.sql itself (not the __DEV__-only asset-loading
// wrapper in ../loadSample.ts, which needs expo-asset/expo-file-system and so can't run
// under Jest — same reason src/data/db/open.ts's loadSchemaSql() isn't unit tested
// directly either) reproduces CLAUDE.md's reference net worth through the real schema.
import * as fs from 'fs';
import * as path from 'path';

import { openTestDb } from '../../data/db/openTestDb';
import { getNetWorth } from '../../domain/net-worth';

const SAMPLE_SQL = fs.readFileSync(path.join(__dirname, '../../../tools/sample_data.sql'), 'utf8');

describe('tools/sample_data.sql', () => {
  test('produces a net worth of Rp8.880.000', async () => {
    const db = openTestDb();
    await db.execAsync(SAMPLE_SQL);

    const netWorth = await getNetWorth(db);

    expect(netWorth).toEqual({ netWorth: 8880000, incomplete: false });
  });
});

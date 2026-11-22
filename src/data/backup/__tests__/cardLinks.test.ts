// A paired e-money card (card_links) and the salt that makes its fingerprint (settings.nfc_salt) travel with a backup,
// so a restored phone still recognises its cards; a file from before the table existed still restores.
import { createHash } from 'crypto';

import { createAccount } from '../../../domain/accounts';
import { openMigratedTestDb } from '../../db/openTestDb';
import type { Db } from '../../db/types';
import { setSetting } from '../../repo/settings';
import { exportBackup } from '../export';
import type { BackupFile } from '../export';
import { restoreBackup } from '../restore';
import { validateBackup } from '../validate';

const NOW = '2026-11-03T10:00:00+07:00';
const sha256Hex = async (text: string) => createHash('sha256').update(text).digest('hex');

async function fixture(): Promise<{ db: Db; account: number }> {
  const db = await openMigratedTestDb();
  const account = await createAccount(db, { name: 'E-money Mandiri', type: 'ewallet', openingBalance: 84000, openingDate: '2026-01-01' }, NOW);
  await db.runAsync("insert into card_links (account_id, issuer, last4, fingerprint, linked_at) values (?, 'mandiri', '7731', 'abc123', ?)", [account, NOW]);
  await setSetting(db, 'nfc_salt', '00ff00ff00ff00ff00ff00ff00ff00ff');
  return { db, account };
}

// What an app of schema version 11 wrote: no card_links, and a checksum over the tables it knew.
async function asVersion11(file: BackupFile): Promise<string> {
  const { card_links: _links, ...data } = file.data;
  const { card_links: _count, ...counts } = file.counts;
  void _links;
  void _count;
  const ordered = Object.fromEntries(Object.entries(data));
  return JSON.stringify({ ...file, schema_version: 11, data, counts, checksum: `sha256:${await sha256Hex(JSON.stringify(ordered))}` });
}

describe('card_links in a backup', () => {
  test('the file holds the link rows, only issuer, last 4 digits and fingerprint, and the salt rides in settings', async () => {
    const { db } = await fixture();
    const file = await exportBackup(db, NOW, sha256Hex);
    expect(file.counts.card_links).toBe(1);
    expect(file.data.card_links).toEqual([expect.objectContaining({ issuer: 'mandiri', last4: '7731', fingerprint: 'abc123' })]);
    expect(Object.keys(file.data.card_links[0]).sort()).toEqual(['account_id', 'fingerprint', 'issuer', 'last4', 'linked_at']);
    expect((file.data.settings as { key: string; value: string }[]).find(s => s.key === 'nfc_salt')?.value).toBe('00ff00ff00ff00ff00ff00ff00ff00ff');
  });

  test('restoring onto another phone brings the link and the salt back, so the card is recognised again', async () => {
    const { db, account } = await fixture();
    const file = await exportBackup(db, NOW, sha256Hex);

    const target = await openMigratedTestDb();
    const result = await restoreBackup(target, JSON.stringify(file), NOW, sha256Hex);
    expect(result.ok).toBe(true);
    expect(await target.getFirstAsync('select * from card_links')).toEqual({ account_id: account, issuer: 'mandiri', last4: '7731', fingerprint: 'abc123', linked_at: NOW });
    expect(await target.getFirstAsync("select value from settings where key = 'nfc_salt'")).toEqual({ value: '00ff00ff00ff00ff00ff00ff00ff00ff' });
    expect(await target.getAllAsync('select * from v_integrity_issues')).toEqual([]);
  });

  test('a restore replaces the links that were there, even though the accounts under them go away', async () => {
    const { db } = await fixture();
    const file = await exportBackup(db, NOW, sha256Hex);

    const target = await fixture(); // has its own link to its own account, with the same ids and fingerprint
    await target.db.runAsync("update card_links set fingerprint = 'old', last4 = '0001'");
    const result = await restoreBackup(target.db, JSON.stringify(file), NOW, sha256Hex);
    expect(result.ok).toBe(true);
    expect(await target.db.getAllAsync('select fingerprint, last4 from card_links')).toEqual([{ fingerprint: 'abc123', last4: '7731' }]);
  });

  test('a backup without links empties the links of the phone it is restored on', async () => {
    const { db } = await fixture();
    const clean = await openMigratedTestDb();
    const file = await exportBackup(clean, NOW, sha256Hex);
    const result = await restoreBackup(db, JSON.stringify(file), NOW, sha256Hex);
    expect(result.ok).toBe(true);
    expect(await db.getAllAsync('select * from card_links')).toEqual([]);
  });

  test('a file from schema version 11 (no card_links at all) still validates and restores, with no links', async () => {
    const { db } = await fixture();
    const file = await exportBackup(db, NOW, sha256Hex);
    const old = await asVersion11(file);

    const validated = await validateBackup(old, sha256Hex);
    expect(validated.ok).toBe(true);

    const target = await fixture();
    const result = await restoreBackup(target.db, old, NOW, sha256Hex);
    expect(result.ok).toBe(true);
    expect(await target.db.getAllAsync('select * from card_links')).toEqual([]);
    expect(await target.db.getFirstAsync("select name from accounts where name = 'E-money Mandiri'")).toEqual({ name: 'E-money Mandiri' });
  });

  test('a link that points at an account the file does not have is refused before anything is touched', async () => {
    const { db } = await fixture();
    const file = await exportBackup(db, NOW, sha256Hex);
    const data = { ...file.data, card_links: [{ ...file.data.card_links[0], account_id: 999 }] };
    const ordered = Object.fromEntries(Object.keys(file.data).map(t => [t, (data as Record<string, unknown>)[t]]));
    const bad = { ...file, data, checksum: `sha256:${await sha256Hex(JSON.stringify(ordered))}` };
    expect(await validateBackup(JSON.stringify(bad), sha256Hex)).toEqual({ ok: false, reason: 'broken_reference', table: 'card_links' });
  });

  test('a count that does not match the links is refused', async () => {
    const { db } = await fixture();
    const file = await exportBackup(db, NOW, sha256Hex);
    const bad = { ...file, counts: { ...file.counts, card_links: 2 } };
    expect(await validateBackup(JSON.stringify(bad), sha256Hex)).toEqual({ ok: false, reason: 'count_mismatch', table: 'card_links' });
  });
});

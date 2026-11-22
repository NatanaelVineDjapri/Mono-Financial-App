// The pretend reader, for every scenario, against the real schema. It makes the same fingerprints and real accounts.
import { createHash } from 'crypto';

import { openMigratedTestDb } from '../../../data/db/openTestDb';
import { getAccountBalanceNow } from '../../../data/repo/cardLinks';
import { previewAdjustment } from '../../../domain/cards/adjustment';
import { ensureNfcSalt, findCardAccount } from '../../../domain/cards/links';
import { createMockReader, isMockActive, MOCK_SCENARIOS, useMockCardStore, type MockScenario } from '../mock/mockCardReader';

const sha256Hex = async (text: string) => createHash('sha256').update(text).digest('hex');
const NOW = '2026-11-03T10:00:00+07:00';

async function setup(scenario: MockScenario) {
  const db = await openMigratedTestDb();
  const getSalt = () => ensureNfcSalt(db, async () => new Uint8Array(16).fill(7));
  const reader = createMockReader({ db, getSalt, sha256Hex, now: () => NOW, getScenario: () => scenario, stepMs: 0 });
  return { db, reader };
}

const read = (reader: ReturnType<typeof createMockReader>) => reader.read(new AbortController().signal);

test('every scenario of the Dev tools list is handled', async () => {
  for (const { id } of MOCK_SCENARIOS) {
    const { reader } = await setup(id);
    await expect(read(reader)).resolves.toBeDefined();
  }
});

describe('a known card', () => {
  test.each([
    ['known_less', -16_000, 'expense'],
    ['known_more', 20_000, 'income'],
    ['known_same', 0, 'none'],
  ] as const)('%s: the card differs from MONO by %i, which is a(n) %s', async (scenario, delta, action) => {
    const { db, reader } = await setup(scenario);
    const result = await read(reader);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const link = await findCardAccount(db, result.card.fingerprint);
    expect(link).not.toBeNull(); // the card is recognised: it belongs to a real account
    const app = (await getAccountBalanceNow(db, link!.account_id))!;
    expect(result.card.balance).toBe(app + delta);
    expect(await previewAdjustment(db, link!.account_id, result.card.balance)).toMatchObject({ diff: delta, action });
  });

  test('scanning it a second time finds the same account, and makes no second one', async () => {
    const { db, reader } = await setup('known_less');
    await read(reader);
    await read(reader);
    expect((await db.getFirstAsync<{ n: number }>("select count(*) as n from accounts where type = 'ewallet'"))!.n).toBe(1);
  });
});

describe('a new card', () => {
  test('is read, belongs to no account, and leaves the database alone', async () => {
    const { db, reader } = await setup('new_mandiri');
    const result = await read(reader);
    expect(result).toMatchObject({ ok: true, card: { issuer: 'mandiri', last4: '1234', balance: 84_000, estimated: false } });
    if (!result.ok) return;
    expect(await findCardAccount(db, result.card.fingerprint)).toBeNull();
    expect((await db.getFirstAsync<{ n: number }>('select count(*) as n from accounts'))!.n).toBe(0);
  });

  test('a Flazz is an experimental issuer', async () => {
    const { reader } = await setup('flazz_experimental');
    expect(await read(reader)).toMatchObject({ ok: true, card: { issuer: 'flazz', last4: '5566' } });
  });
});

describe('the failures', () => {
  test.each([
    ['unsupported', 'unsupported'],
    ['lost', 'lost'],
    ['nfc_off', 'nfcOff'],
  ] as const)('%s', async (scenario, error) => {
    const { reader } = await setup(scenario);
    expect(await read(reader)).toEqual({ ok: false, error });
  });

  test('NFC off is also what isEnabled says', async () => {
    const { reader } = await setup('nfc_off');
    expect(await reader.isEnabled()).toBe(false);
    expect(await (await setup('known_less')).reader.isEnabled()).toBe(true);
  });

  test('leaving the screen stops it', async () => {
    const { reader } = await setup('known_less');
    const controller = new AbortController();
    controller.abort();
    expect(await reader.read(controller.signal)).toEqual({ ok: false, error: 'cancelled' });
  });

  test('the onTag hook is called once the card is found', async () => {
    const { reader } = await setup('known_less');
    const onTag = jest.fn();
    await reader.read(new AbortController().signal, { onTag });
    expect(onTag).toHaveBeenCalledTimes(1);
  });
});

test('the pretend reader is on only when the development switch says so', () => {
  expect(isMockActive()).toBe(false);
  useMockCardStore.getState().setEnabled(true);
  expect(isMockActive()).toBe(true);
  useMockCardStore.getState().setEnabled(false);
});

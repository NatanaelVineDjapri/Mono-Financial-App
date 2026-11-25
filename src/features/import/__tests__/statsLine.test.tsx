// The line under an app on the import settings screen: counts only, and nothing until a notification has been read.
import { statsLine } from '../ImportSettingsView';

const base = { read: 0, queued: 0, duplicate: 0, no_account: 0, empty: 0, security: 0, reminder: 0, no_amount: 0, no_money_word: 0, promo: 0 };

describe('statsLine', () => {
  test('says nothing until something has been read', () => {
    expect(statsLine(undefined)).toBe('');
    expect(statsLine(base)).toBe('');
  });

  test('reads, queued and what was dropped, by reason', () => {
    expect(statsLine({ ...base, read: 6, queued: 1, no_amount: 4, promo: 1 })).toBe('Dibaca 6 · masuk antrean 1 · dibuang: tanpa nominal Rp 4, promo 1');
  });

  test('nothing dropped: just the two counts', () => {
    expect(statsLine({ ...base, read: 2, queued: 2 })).toBe('Dibaca 2 · masuk antrean 2');
  });
});

// The JS-side allowlist (the second line of defence; the real one is native) and the cleaning of
// what the native listener reports as "seen apps".
import { acceptAll, acceptNotification, sanitizeSeenApps } from '../allowlist';
import type { RawNotification } from '../native';

const note = (pkg: string, over: Partial<RawNotification> = {}): RawNotification => ({ package: pkg, title: 'Transfer masuk', text: 'Rp 50.000 dari Budi', bigText: null, postedAt: 1_700_000_000_000, ...over });
const ALLOWED = new Set(['com.bca.mobile', 'com.gojek.gopay']);

describe('acceptNotification: only a package on the allowlist gets through', () => {
  test('an allowed package is accepted', () => {
    expect(acceptNotification(note('com.bca.mobile'), ALLOWED)).toBe(true);
  });

  test('a package that is not on the list is refused, whatever it says', () => {
    expect(acceptNotification(note('com.whatsapp', { title: 'Budi', text: 'Rp 50.000 sudah kutransfer' }), ALLOWED)).toBe(false);
    expect(acceptNotification(note('com.bca.mobile.fake'), ALLOWED)).toBe(false);
    expect(acceptNotification(note('COM.BCA.MOBILE'), ALLOWED)).toBe(false);
  });

  test('an empty allowlist refuses everything', () => {
    expect(acceptNotification(note('com.bca.mobile'), new Set())).toBe(false);
  });

  test('a malformed event is refused', () => {
    expect(acceptNotification(null, ALLOWED)).toBe(false);
    expect(acceptNotification(undefined, ALLOWED)).toBe(false);
    expect(acceptNotification({ package: '' }, new Set(['']))).toBe(false);
    expect(acceptNotification({ package: 42 as unknown as string }, ALLOWED)).toBe(false);
  });

  test('acceptAll keeps the allowed ones, in order, and drops the rest', () => {
    const events = [note('com.whatsapp'), note('com.gojek.gopay'), note('com.instagram.android'), note('com.bca.mobile')];
    expect(acceptAll(events, ALLOWED).map(e => e.package)).toEqual(['com.gojek.gopay', 'com.bca.mobile']);
  });
});

describe('sanitizeSeenApps: only a package, a name and a time', () => {
  test('a good entry passes through', () => {
    expect(sanitizeSeenApps([{ package: 'com.bca.mobile', appName: 'BCA mobile', lastSeenAt: 1_700_000_000_000 }])).toEqual([
      { package: 'com.bca.mobile', appName: 'BCA mobile', lastSeenAt: 1_700_000_000_000 },
    ]);
  });

  test('extra fields (a title, a text) are dropped, not carried on', () => {
    const [entry] = sanitizeSeenApps([{ package: 'com.x', appName: 'X', lastSeenAt: 5, title: 'Transfer masuk', text: 'Rp 50.000', bigText: 'secret' }]);
    expect(Object.keys(entry).sort()).toEqual(['appName', 'lastSeenAt', 'package']);
    expect(JSON.stringify(entry)).not.toMatch(/Transfer|50\.000|secret/);
  });

  test('a missing name falls back to the package; broken entries are skipped', () => {
    const out = sanitizeSeenApps([
      { package: 'com.a', lastSeenAt: 1 },
      { package: '  ', appName: 'x', lastSeenAt: 1 },
      { package: 'com.b', appName: 'B', lastSeenAt: 0 },
      { package: 'com.c', appName: 'C', lastSeenAt: Number.NaN },
      { appName: 'no package', lastSeenAt: 1 },
      null,
      'text',
      42,
    ]);
    expect(out).toEqual([{ package: 'com.a', appName: 'com.a', lastSeenAt: 1 }]);
  });
});

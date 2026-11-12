// Notification access: when it is a problem, which screen to show, and when the permission guide
// may appear (never once the permission is on).
import { importProblems, importSetupState, shouldShowPermissionGuide, type AccessSnapshot } from '../access';

const base: AccessSnapshot = { available: true, accessEnabled: true, connected: true, ignoringBattery: true, lastReadAt: null };
const snap = (over: Partial<AccessSnapshot>): AccessSnapshot => ({ ...base, ...over });

describe('the permission guide', () => {
  test('shown while access is off, never once it is on', () => {
    expect(shouldShowPermissionGuide(snap({ accessEnabled: false }))).toBe(true);
    expect(shouldShowPermissionGuide(snap({ accessEnabled: true }))).toBe(false);
  });
});

describe('which screen: Import-Setup or Import-Settings', () => {
  test('nothing set up yet: the setup screen', () => {
    expect(importSetupState(snap({ accessEnabled: false }), false)).toBe('setup');
  });

  test('access on, or an app already switched on: the settings screen', () => {
    expect(importSetupState(snap({ accessEnabled: true }), false)).toBe('settings');
    expect(importSetupState(snap({ accessEnabled: false }), true)).toBe('settings');
  });
});

describe('importProblems', () => {
  test('access off is a problem only once an app is switched on', () => {
    expect(importProblems(snap({ accessEnabled: false }), false)).toEqual([]);
    expect(importProblems(snap({ accessEnabled: false }), true)).toEqual([{ kind: 'access_off', level: 'bad' }]);
  });

  test('access on but the service not bound: it was stopped', () => {
    expect(importProblems(snap({ connected: false }), true)).toEqual([{ kind: 'service_stopped', level: 'bad' }]);
  });

  test('battery optimisation on is a note, not an error', () => {
    expect(importProblems(snap({ ignoringBattery: false }), true)).toEqual([{ kind: 'battery_saver', level: 'note' }]);
  });

  test('no problem when everything is fine', () => {
    expect(importProblems(base, true)).toEqual([]);
  });

  test('a build without the native module reports no problems (the screen says so on its own)', () => {
    expect(importProblems(snap({ available: false, accessEnabled: false }), true)).toEqual([]);
  });

  test('with access off the battery note is not added on top', () => {
    expect(importProblems(snap({ accessEnabled: false, ignoringBattery: false }), true)).toEqual([{ kind: 'access_off', level: 'bad' }]);
  });
});

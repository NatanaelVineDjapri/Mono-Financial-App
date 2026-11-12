import { FULL_SUPPORT, supportLevel } from '../registry';

describe('the parser registry', () => {
  test('no app is "Didukung penuh" until a parser exists for it, tested with real samples', () => {
    expect(Object.keys(FULL_SUPPORT)).toEqual([]);
  });

  test('every app is read by the general parser for now', () => {
    expect(supportLevel('com.bca.mobile')).toBe('generic');
    expect(supportLevel('com.gojek.gopay')).toBe('generic');
  });

  test('inherited object keys are not mistaken for packages', () => {
    expect(supportLevel('constructor')).toBe('generic');
    expect(supportLevel('toString')).toBe('generic');
  });
});

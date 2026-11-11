import { avatarInitial } from '../useDisplayName';

describe('avatarInitial', () => {
  test('the first letter of the name, upper case', () => {
    expect(avatarInitial('Nael')).toBe('N');
    expect(avatarInitial('  budi ')).toBe('B');
  });

  test('"M" when no name is set', () => {
    expect(avatarInitial('')).toBe('M');
    expect(avatarInitial('   ')).toBe('M');
  });
});

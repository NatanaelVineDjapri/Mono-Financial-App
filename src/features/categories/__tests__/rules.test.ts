import { CATEGORY_ICON_KEYS, CATEGORY_ICON_PATHS, DEFAULT_NEW_CATEGORY_ICON, resolveCategoryIcon } from '../icons';
import { CATEGORY_NAME_MAX, checkCanArchive, checkCategoryName, isKindLocked, type NameCandidate } from '../rules';

const EXISTING: NameCandidate[] = [
  { id: 1, name: 'Food & drink', kind: 'expense', archived: 0 },
  { id: 2, name: 'Coffee', kind: 'expense', archived: 1 },
  { id: 3, name: 'Salary', kind: 'income', archived: 0 },
];

describe('category name rules', () => {
  test('the name is trimmed', () => {
    expect(checkCategoryName('  Kopi  ', 'expense', EXISTING)).toEqual({ ok: true, name: 'Kopi' });
  });

  test('empty or blank is refused', () => {
    expect(checkCategoryName('', 'expense', EXISTING)).toEqual({ ok: false, error: { code: 'name_empty' } });
    expect(checkCategoryName('   ', 'expense', EXISTING)).toEqual({ ok: false, error: { code: 'name_empty' } });
  });

  test('1 to 40 characters: 40 passes, 41 is refused', () => {
    expect(checkCategoryName('a'.repeat(CATEGORY_NAME_MAX), 'expense', EXISTING).ok).toBe(true);
    expect(checkCategoryName('a'.repeat(CATEGORY_NAME_MAX + 1), 'expense', EXISTING)).toEqual({ ok: false, error: { code: 'name_too_long' } });
    // the length is counted after trimming
    expect(checkCategoryName(` ${'a'.repeat(CATEGORY_NAME_MAX)} `, 'expense', EXISTING).ok).toBe(true);
  });

  test('a clash with an active category is refused, ignoring case', () => {
    expect(checkCategoryName('FOOD & DRINK', 'expense', EXISTING)).toEqual({ ok: false, error: { code: 'name_taken', kind: 'expense' } });
    expect(checkCategoryName('salary', 'income', EXISTING)).toEqual({ ok: false, error: { code: 'name_taken', kind: 'income' } });
  });

  test('an archived category keeps its name taken, with its own reason', () => {
    expect(checkCategoryName('coffee', 'expense', EXISTING)).toEqual({ ok: false, error: { code: 'name_taken_archived', kind: 'expense' } });
  });

  test('the same name in the other kind is fine', () => {
    expect(checkCategoryName('Salary', 'expense', EXISTING)).toEqual({ ok: true, name: 'Salary' });
    expect(checkCategoryName('Coffee', 'income', EXISTING)).toEqual({ ok: true, name: 'Coffee' });
  });

  test('the category being edited never clashes with itself', () => {
    expect(checkCategoryName('food & drink', 'expense', EXISTING, 1)).toEqual({ ok: true, name: 'food & drink' });
    expect(checkCategoryName('Coffee', 'expense', EXISTING, 1)).toMatchObject({ ok: false });
  });
});

describe('archive and kind rules', () => {
  test('the last active category of a kind cannot be archived', () => {
    expect(checkCanArchive('expense', 1, null)).toEqual({ code: 'last_active', kind: 'expense' });
    expect(checkCanArchive('income', 1, null)).toEqual({ code: 'last_active', kind: 'income' });
    expect(checkCanArchive('expense', 2, null)).toBeNull();
  });

  test('a category an active fixed expense uses cannot be archived, and the reason names it', () => {
    expect(checkCanArchive('expense', 5, 'Gym membership')).toEqual({ code: 'used_by_recurring', recurringName: 'Gym membership' });
  });

  test('being the last wins over being used by a fixed expense', () => {
    expect(checkCanArchive('expense', 1, 'Gym membership')).toEqual({ code: 'last_active', kind: 'expense' });
  });

  test('the kind is locked as soon as a transaction, a budget or a fixed expense uses the category', () => {
    expect(isKindLocked({ transactionCount: 0, budgetCount: 0, recurringCount: 0 })).toBe(false);
    expect(isKindLocked({ transactionCount: 1, budgetCount: 0, recurringCount: 0 })).toBe(true);
    expect(isKindLocked({ transactionCount: 0, budgetCount: 1, recurringCount: 0 })).toBe(true);
    expect(isKindLocked({ transactionCount: 0, budgetCount: 0, recurringCount: 1 })).toBe(true);
  });
});

describe('icon registry', () => {
  test('there are twenty keys and each has a glyph', () => {
    expect(CATEGORY_ICON_KEYS).toHaveLength(20);
    for (const key of CATEGORY_ICON_KEYS) expect(CATEGORY_ICON_PATHS[key]).toMatch(/^M/);
  });

  test('a known key is kept; empty, null and unknown fall back to dot', () => {
    expect(resolveCategoryIcon('coffee')).toBe('coffee');
    expect(resolveCategoryIcon('')).toBe('dot');
    expect(resolveCategoryIcon(null)).toBe('dot');
    expect(resolveCategoryIcon(undefined)).toBe('dot');
    expect(resolveCategoryIcon('rocket')).toBe('dot');
  });

  test('a new category starts on the tag icon, which is in the registry', () => {
    expect(DEFAULT_NEW_CATEGORY_ICON).toBe('tag');
    expect(CATEGORY_ICON_KEYS).toContain(DEFAULT_NEW_CATEGORY_ICON);
  });
});

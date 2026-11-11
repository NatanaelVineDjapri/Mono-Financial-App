import { matchAccount, matchCategory, matchName, normalizeName } from '../match';
import { ACCOUNTS, CATEGORIES } from './fixtures';

describe('matchName', () => {
  test('exact, ignoring case and punctuation', () => {
    expect(matchAccount('BCA Tabungan', ACCOUNTS)).toMatchObject({ kind: 'exact', item: { id: 1 } });
    expect(matchAccount('  cash   wallet! ', ACCOUNTS)).toMatchObject({ kind: 'exact', item: { id: 2 } });
    expect(matchCategory('food & drink', 'expense', CATEGORIES)).toMatchObject({ kind: 'exact', item: { id: 10 } });
    expect(normalizeName('Food & drink')).toBe('food drink');
  });

  test('a unique alias or prefix', () => {
    expect(matchAccount('bca', ACCOUNTS)).toMatchObject({ kind: 'alias', item: { id: 1 } });
    expect(matchAccount('cash', ACCOUNTS)).toMatchObject({ kind: 'alias', item: { id: 2 } });
    expect(matchAccount('jago', ACCOUNTS)).toMatchObject({ kind: 'alias', item: { id: 4 } });
    expect(matchAccount('gopay', ACCOUNTS)).toMatchObject({ kind: 'exact', item: { id: 3 } });
  });

  test('a typo within two edits, for names of five letters or more', () => {
    expect(matchAccount('gopai', ACCOUNTS)).toMatchObject({ kind: 'fuzzy', item: { id: 3 } });
    expect(matchAccount('gopy', ACCOUNTS)).toMatchObject({ kind: 'none', item: null }); // too short to guess
    expect(matchAccount('tabungn', ACCOUNTS)).toMatchObject({ kind: 'fuzzy', item: { id: 1 } });
  });

  test('two candidates, or none, is never a guess', () => {
    const accounts = [...ACCOUNTS, { ...ACCOUNTS[0], id: 9, name: 'BCA Giro' }];
    expect(matchAccount('bca', accounts)).toEqual({ kind: 'ambiguous', item: null });
    expect(matchAccount('budi', ACCOUNTS)).toEqual({ kind: 'none', item: null });
    expect(matchAccount('c', ACCOUNTS)).toEqual({ kind: 'none', item: null }); // one letter picks nothing
    expect(matchAccount(null, ACCOUNTS)).toEqual({ kind: 'none', item: null });
    expect(matchAccount('', ACCOUNTS)).toEqual({ kind: 'none', item: null });
    expect(matchName('gopay', [{ name: 'GoPay' }, { name: 'GoPay' }])).toEqual({ kind: 'ambiguous', item: null });
  });

  test('an exact name wins over a longer name that starts with it', () => {
    const accounts = [{ ...ACCOUNTS[1], id: 5, name: 'Cash' }, ACCOUNTS[1]];
    expect(matchAccount('cash', accounts)).toMatchObject({ kind: 'exact', item: { id: 5 } });
  });

  test('a Valas account is never matched', () => {
    const accounts = [...ACCOUNTS, { ...ACCOUNTS[0], id: 7, name: 'Dompet Valas', type: 'forex' as const }];
    expect(matchAccount('dompet valas', accounts).item).toBeNull();
  });

  test('a category must be of the right kind; a transfer has none', () => {
    expect(matchCategory('Salary', 'expense', CATEGORIES)).toEqual({ kind: 'none', item: null });
    expect(matchCategory('Salary', 'income', CATEGORIES).item?.id).toBe(20);
    expect(matchCategory('Food & drink', 'income', CATEGORIES).item).toBeNull();
    expect(matchCategory('Food & drink', 'transfer', CATEGORIES).item).toBeNull();
    expect(matchCategory('Food & drink', null, CATEGORIES).item).toBeNull();
  });
});

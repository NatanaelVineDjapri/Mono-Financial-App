// The category suggestion: the person's own memory first, then keyword rules, otherwise nothing.
import { merchantKey, suggestCategory, type CategoryLite } from '../categorize';

const categories: CategoryLite[] = [
  { id: 1, name: 'Food & drink', kind: 'expense' },
  { id: 2, name: 'Transport', kind: 'expense' },
  { id: 3, name: 'Bills', kind: 'expense' },
  { id: 4, name: 'Shopping', kind: 'expense' },
  { id: 5, name: 'Salary', kind: 'income' },
  { id: 6, name: 'Other', kind: 'expense' },
];

const suggest = (merchant: string, kind: 'income' | 'expense' | null, remembered: number | null = null, list = categories) => suggestCategory({ merchant, kind, categories: list, remembered });

describe('merchantKey', () => {
  test('lower case, one space, no marks', () => {
    expect(merchantKey('  Kopi   Kenangan! ')).toBe('kopi kenangan');
    expect(merchantKey('Warung Bu Tini*')).toBe('warung bu tini');
  });
  test('nothing left gives an empty key', () => {
    expect(merchantKey('***')).toBe('');
  });
});

describe('suggestCategory', () => {
  test('a keyword in the merchant name', () => {
    expect(suggest('Kopi Kenangan', 'expense')).toBe(1);
    expect(suggest('Gojek', 'expense')).toBe(2);
    expect(suggest('PLN Token', 'expense')).toBe(3);
  });

  test('a keyword is a whole word, not a piece of another word', () => {
    expect(suggest('Tokoh Kita', 'expense')).toBeNull(); // "toko" is not "tokoh"
  });

  test('the memory wins over a keyword', () => {
    expect(suggest('Kopi Kenangan', 'expense', 4)).toBe(4);
  });

  test('a memory that is archived, gone or the other kind is ignored', () => {
    expect(suggest('Kopi Kenangan', 'expense', 99)).toBe(1);
    expect(suggest('Kopi Kenangan', 'expense', 5)).toBe(1);
    const archived = categories.map(c => (c.id === 4 ? { ...c, archived: 1 } : c));
    expect(suggest('Kopi Kenangan', 'expense', 4, archived)).toBe(1);
  });

  test('income uses the income rules only', () => {
    expect(suggest('Gaji Oktober', 'income')).toBe(5);
    expect(suggest('Kopi Kenangan', 'income')).toBeNull();
  });

  test('unknown merchant, empty merchant or unknown kind: empty, never a guess', () => {
    expect(suggest('Budi Santoso', 'expense')).toBeNull();
    expect(suggest('', 'expense')).toBeNull();
    expect(suggest('Kopi Kenangan', null)).toBeNull();
  });

  test('a renamed or archived starter category offers nothing', () => {
    expect(suggest('Kopi Kenangan', 'expense', null, categories.filter(c => c.id !== 1))).toBeNull();
    expect(suggest('Kopi Kenangan', 'expense', null, categories.map(c => (c.id === 1 ? { ...c, archived: true } : c)))).toBeNull();
  });
});

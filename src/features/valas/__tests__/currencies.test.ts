import { CURRENCY_NAMES_ID } from '../../../i18n/currencyNamesId';
import { money, toIdr } from '../../../core/money';
import { CURRENCY_NAMES_EN } from '../../../core/currencyList';
import { openMigratedTestDb } from '../../../data/db/openTestDb';
import { parseCurrencyText } from '../amountText';
import { MINOR_FACTORS, SUPPORTED_FOREX_CURRENCIES } from '../currencies';
import { validateValasForm, pocketsFromRows } from '../formValidate';

describe('the currency list', () => {
  test('every listed currency is in the  table with the same minor unit and name (fresh install, after the migration)', async () => {
    const db = await openMigratedTestDb();
    const rows = await db.getAllAsync<{ code: string; minor_factor: number; name: string }>("select code, minor_factor, name from currencies where code <> 'IDR'");
    expect(Object.fromEntries(rows.map(r => [r.code, r.minor_factor]))).toEqual(MINOR_FACTORS);
    expect(rows.map(r => r.code).sort()).toEqual([...SUPPORTED_FOREX_CURRENCIES].sort());
    // the twelve that were there since schema v1 keep the names they were seeded with
    expect(rows.find(r => r.code === 'GBP')?.name).toBe('Pound sterling');
  });

  test('about a hundred and fifty currencies, each with an English and an Indonesian name, no duplicates', () => {
    expect(SUPPORTED_FOREX_CURRENCIES.length).toBeGreaterThan(140);
    expect(new Set(SUPPORTED_FOREX_CURRENCIES).size).toBe(SUPPORTED_FOREX_CURRENCIES.length);
    for (const code of SUPPORTED_FOREX_CURRENCIES) {
      expect(code).toMatch(/^[A-Z]{3}$/);
      expect(CURRENCY_NAMES_EN[code]).toBeTruthy();
      expect(CURRENCY_NAMES_ID[code]).toBeTruthy();
    }
  });

  test('the twelve most used come first, and the ones that cannot be held are not listed', () => {
    expect(SUPPORTED_FOREX_CURRENCIES.slice(0, 12)).toEqual(['USD', 'SGD', 'EUR', 'MYR', 'AUD', 'GBP', 'JPY', 'CNY', 'HKD', 'KRW', 'THB', 'SAR']);
    for (const code of ['IDR', 'IRR', 'CLF', 'XDR', 'CNH', 'HRK', 'SLL', 'ZWL', 'FOK', 'GGP']) expect(SUPPORTED_FOREX_CURRENCIES).not.toContain(code);
  });

  test('minor units follow ISO 4217: yen, won and dong have none, the Gulf dinars have three', () => {
    expect(MINOR_FACTORS).toMatchObject({ USD: 100, JPY: 1, KRW: 1, VND: 1, KWD: 1000, BHD: 1000, OMR: 1000 });
  });

  test('a three-decimal currency is typed, valued and shown in whole thousandths', async () => {
    expect(parseCurrencyText('1,250', 1000)).toBe(1250);
    expect(parseCurrencyText('1.250,500', 1000)).toBe(1250500);
    expect(money(1250, 'KWD', 1000)).toBe('KWD 1,250');
    // KWD 1,000 at Rp58.687 per dinar
    expect(toIdr(1000, 586870000, 1000)).toBe(58687);
  });
});

describe('validateValasForm', () => {
  const ctx = { today: '2026-10-28', otherNames: ['BCA Tabungan'], minorFactors: MINOR_FACTORS, requirePockets: true };
  const ok = { name: 'Valas', rows: [{ currency: 'USD', text: '250,00' }], openingDate: '2026-10-01' };

  test('a good form has no errors', () => {
    expect(validateValasForm(ok, ctx)).toEqual([]);
  });
  test('name: empty, too long, taken ignoring case', () => {
    expect(validateValasForm({ ...ok, name: '  ' }, ctx)).toEqual([{ field: 'name', code: 'name_invalid' }]);
    expect(validateValasForm({ ...ok, name: 'x'.repeat(41) }, ctx)).toEqual([{ field: 'name', code: 'name_invalid' }]);
    expect(validateValasForm({ ...ok, name: 'bca tabungan' }, ctx)).toEqual([{ field: 'name', code: 'name_taken' }]);
  });
  test('create needs a currency; edit does not', () => {
    expect(validateValasForm({ ...ok, rows: [] }, ctx)).toEqual([{ field: 'rows', code: 'no_pockets' }]);
    expect(validateValasForm({ ...ok, rows: [] }, { ...ctx, requirePockets: false })).toEqual([]);
  });
  test('an opening balance that is not a number is marked on its row; empty means 0', () => {
    expect(validateValasForm({ ...ok, rows: [{ currency: 'USD', text: 'abc' }] }, ctx)).toEqual([{ field: 'row', currency: 'USD', code: 'amount_invalid' }]);
    expect(validateValasForm({ ...ok, rows: [{ currency: 'USD', text: '' }] }, ctx)).toEqual([]);
  });
  test('a date in the future is refused', () => {
    expect(validateValasForm({ ...ok, openingDate: '2026-10-29' }, ctx)).toEqual([{ field: 'openingDate', code: 'future_date' }]);
  });
  test('pocketsFromRows turns the text into minor units with the currency factor', () => {
    expect(
      pocketsFromRows(
        [
          { currency: 'USD', text: '250,00' },
          { currency: 'JPY', text: '15.000' },
          { currency: 'SGD', text: '' },
        ],
        MINOR_FACTORS,
      ),
    ).toEqual([
      { currency: 'USD', openingMinor: 25000 },
      { currency: 'JPY', openingMinor: 15000 },
      { currency: 'SGD', openingMinor: 0 },
    ]);
  });
});

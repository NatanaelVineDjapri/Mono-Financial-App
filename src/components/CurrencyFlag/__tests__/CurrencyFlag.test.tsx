import { render } from '@testing-library/react-native';

import { CURRENCY_LIST } from '@/core/currencyList';

import { CurrencyFlag } from '../CurrencyFlag';
import { CURRENCY_FLAGS } from '../currencyFlags';

// The disc is decoration: the row around it already announces the currency by name, so it is
// hidden from screen readers and these queries have to ask for hidden elements explicitly.
const HIDDEN = { includeHiddenElements: true } as const;

// The only currencies in CURRENCY_LIST that no country issues on its own. Keep this list and the
// comment at the top of currencyFlags.ts in step; the last test is what fails when a new
// currency is added without artwork.
const UNION_CURRENCIES = ['XAF', 'XCD', 'XCG', 'XOF', 'XPF'];

describe('CurrencyFlag', () => {
  test('draws the flag and no code for a currency that has one', async () => {
    const result = await render(<CurrencyFlag code="USD" />);
    expect(result.getByTestId('currency-flag-USD', HIDDEN)).toBeTruthy();
    expect(result.queryByText('USD', HIDDEN)).toBeNull();
  });

  test('falls back to the code when the currency has no flag of its own', async () => {
    const result = await render(<CurrencyFlag code="XAF" />);
    expect(result.getByText('XAF', HIDDEN)).toBeTruthy();
  });

  test('sizes the disc to the requested square', async () => {
    const result = await render(<CurrencyFlag code="EUR" size={24} />);
    expect(result.getByTestId('currency-flag-EUR', HIDDEN)).toHaveStyle({ width: 24, height: 24, borderRadius: 12 });
  });

  test('every currency is either flagged or a documented union currency', () => {
    const missing = CURRENCY_LIST.map(c => c.code)
      .filter(code => !CURRENCY_FLAGS[code])
      .sort();
    expect(missing).toEqual([...UNION_CURRENCIES].sort());
  });
});

import { act, fireEvent, render } from '@testing-library/react-native';

import { useHideAmounts } from '@/components/hide-amounts-store';

import { BankCard } from '../BankCard';
import { BANK_CARDS, NEUTRAL_CARDS } from '../bankCards';
import { CARD_ASSETS } from '../cardAssets';

function luminance(hex: string): number {
  const c = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(c.slice(i, i + 2), 16) / 255);
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(hexA: string, hexB: string): number {
  const a = luminance(hexA) + 0.05;
  const b = luminance(hexB) + 0.05;
  return a > b ? a / b : b / a;
}

function backgroundSource(card: Awaited<ReturnType<typeof render>>, testID: string) {
  return card.getByTestId(`${testID}-bg`).props.source;
}

describe('BankCard assets', () => {
  test('every BANK_CARDS and NEUTRAL_CARDS slug has a PNG in CARD_ASSETS', () => {
    for (const slug of Object.keys(BANK_CARDS)) {
      expect(CARD_ASSETS[slug]).toBeDefined();
    }
    for (const slug of Object.keys(NEUTRAL_CARDS)) {
      expect(CARD_ASSETS[slug]).toBeDefined();
    }
  });

  test.each(Object.entries({ ...BANK_CARDS, ...NEUTRAL_CARDS }))('%s: fg keeps >= 4.5:1 contrast against bg and bgEnd', (_slug, style) => {
    expect(contrast(style.fg, style.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(style.fg, style.bgEnd)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('BankCard', () => {
  afterEach(async () => await act(() => useHideAmounts.getState().setHidden(false)));

  test('is one accessible button with the full label', async () => {
    const result = await render(<BankCard name="BCA Tabungan" type="bank" icon="bca" balance={6842500} onPress={() => {}} />);
    const card = result.getByRole('button');
    expect(card.props.accessibilityLabel).toBe('BCA Tabungan, rekening bank, saldo Rp6.842.500');
  });

  test('calls onPress when tapped', async () => {
    const onPress = jest.fn();
    const result = await render(<BankCard name="BCA Tabungan" type="bank" icon="bca" balance={6842500} onPress={onPress} />);
    fireEvent.press(result.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('null icon falls back to a neutral card by account type', async () => {
    const cash = await render(<BankCard name="Cash wallet" type="cash" icon={null} balance={450000} onPress={() => {}} testID="card" />);
    expect(backgroundSource(cash, 'card')).toBe(CARD_ASSETS.cash);

    const valas = await render(<BankCard name="Valas" type="forex" icon={null} balance={6312500} onPress={() => {}} testID="card" />);
    expect(backgroundSource(valas, 'card')).toBe(CARD_ASSETS.valas);

    const bank = await render(<BankCard name="Some Bank" type="bank" icon={null} balance={100000} onPress={() => {}} testID="card" />);
    expect(backgroundSource(bank, 'card')).toBe(CARD_ASSETS.default);
  });

  test('unrecognised icon slug also falls back to a neutral card', async () => {
    const result = await render(<BankCard name="Mystery" type="ewallet" icon="totally-unknown-bank" balance={1000} onPress={() => {}} testID="card" />);
    expect(backgroundSource(result, 'card')).toBe(CARD_ASSETS.default);
  });

  test('stockbit renders the text wordmark, not a Logo', async () => {
    const result = await render(<BankCard name="Stockbit" type="ewallet" icon="stockbit" balance={1000000} onPress={() => {}} />);
    expect(result.getByText('stockbit')).toBeTruthy();
  });

  test('Valas with a currencyCount shows the "N MATA UANG" tag', async () => {
    const result = await render(<BankCard name="Valas" type="forex" icon={null} balance={6312500} currencyCount={2} onPress={() => {}} />);
    expect(result.getByText('2 MATA UANG')).toBeTruthy();
    expect(result.getByText('≈ ')).toBeTruthy();
  });

  test('a Valas subline renders when given', async () => {
    const result = await render(
      <BankCard name="Valas" type="forex" icon={null} balance={6312500} currencyCount={2} subline="US$250,00 · S$180,00" onPress={() => {}} />,
    );
    expect(result.getByText('US$250,00 · S$180,00')).toBeTruthy();
  });

  test('hidden mode: the accessibility label never leaks the number', async () => {
    await act(() => useHideAmounts.getState().setHidden(true));
    const result = await render(<BankCard name="BCA Tabungan" type="bank" icon="bca" balance={6842500} onPress={() => {}} />);
    const label = result.getByRole('button').props.accessibilityLabel;
    expect(label).not.toContain('6.842.500');
    expect(label).toBe('BCA Tabungan, rekening bank, saldo Rp••••••••');
  });

  test('carousel variant is 312x184; list variant is full width at 358:184', async () => {
    const carousel = await render(<BankCard name="BCA" type="bank" icon="bca" balance={1} onPress={() => {}} variant="carousel" testID="c" />);
    expect(carousel.getByTestId('c').props.style).toMatchObject({ width: 312, height: 184 });

    const list = await render(<BankCard name="BCA" type="bank" icon="bca" balance={1} onPress={() => {}} variant="list" testID="l" />);
    expect(list.getByTestId('l').props.style).toMatchObject({ width: '100%', aspectRatio: 358 / 184 });
  });
});

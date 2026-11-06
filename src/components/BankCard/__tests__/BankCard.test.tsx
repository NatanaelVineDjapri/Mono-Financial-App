import { act, fireEvent, render } from '@testing-library/react-native';

import { useHideAmounts } from '@/components/hide-amounts-store';

import { BankCard } from '../BankCard';
import { BANK_CARDS, NEUTRAL_CARDS } from '../bankCards';
import { CARD_ASSETS, SVG_BACKGROUNDS } from '../cardAssets';

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

// A slug's background is either a PNG (CARD_ASSETS, rendered via <Image>) or, for the
// rare slug with a broken PNG, a live SVG override (SVG_BACKGROUNDS, rendered via
// <SvgXml>) — see cardAssets.ts. Either way the element carries testID `${testID}-bg`.
function background(card: Awaited<ReturnType<typeof render>>, testID: string) {
  return card.getByTestId(`${testID}-bg`);
}

describe('BankCard assets', () => {
  test('every BANK_CARDS and NEUTRAL_CARDS slug has a working background, PNG or SVG', () => {
    for (const slug of [...Object.keys(BANK_CARDS), ...Object.keys(NEUTRAL_CARDS)]) {
      expect(CARD_ASSETS[slug] ?? SVG_BACKGROUNDS[slug]).toBeDefined();
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
    expect(background(cash, 'card').props.source).toBe(CARD_ASSETS.cash);

    // valas has no PNG (broken source asset, see cardAssets.ts) — it renders the SVG override.
    const valas = await render(<BankCard name="Valas" type="forex" icon={null} balance={6312500} onPress={() => {}} testID="card" />);
    expect(background(valas, 'card').props.xml).toBe(SVG_BACKGROUNDS.valas);

    const bank = await render(<BankCard name="Some Bank" type="bank" icon={null} balance={100000} onPress={() => {}} testID="card" />);
    expect(background(bank, 'card').props.source).toBe(CARD_ASSETS.default);
  });

  test('unrecognised icon slug also falls back to a neutral card', async () => {
    const result = await render(<BankCard name="Mystery" type="ewallet" icon="totally-unknown-bank" balance={1000} onPress={() => {}} testID="card" />);
    expect(background(result, 'card').props.source).toBe(CARD_ASSETS.default);
  });

  test('Valas background renders as a live SVG without throwing (nested <svg>, <use xlink:href>, <marker>)', async () => {
    const result = await render(<BankCard name="Valas" type="forex" icon={null} balance={6312500} onPress={() => {}} testID="card" />);
    expect(background(result, 'card')).toBeTruthy();
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

  // Regression: the background Image, positioned only via StyleSheet.absoluteFill's inset
  // edges (no explicit size), fell back to its PNG's own intrinsic 358x184 logical size
  // instead of stretching to this (aspectRatio-sized, not literally 358x184) container —
  // invisible in Jest's fixed-width render, only visible against a real device's actual
  // resolved width. Explicit width/height: '100%' alongside absoluteFill is the fix.
  test('the background fills its container: explicit 100%/100% size, not just absoluteFill', async () => {
    const result = await render(<BankCard name="BCA Tabungan" type="bank" icon="bca" balance={1} onPress={() => {}} testID="card" />);
    const flatStyle = Object.assign({}, ...[background(result, 'card').props.style].flat());
    expect(flatStyle.width).toBe('100%');
    expect(flatStyle.height).toBe('100%');
  });

  test('carousel variant is 312x184; list variant is full width at 358:184', async () => {
    const carousel = await render(<BankCard name="BCA" type="bank" icon="bca" balance={1} onPress={() => {}} variant="carousel" testID="c" />);
    expect(carousel.getByTestId('c').props.style).toMatchObject({ width: 312, height: 184 });

    const list = await render(<BankCard name="BCA" type="bank" icon="bca" balance={1} onPress={() => {}} variant="list" testID="l" />);
    expect(list.getByTestId('l').props.style).toMatchObject({ width: '100%', aspectRatio: 358 / 184 });
  });
});

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { PhysicalCard } from '../PhysicalCard';
import {
  PHYSICAL_CARD_THEMES,
  resolvePhysicalCardTheme,
} from '../cardThemes';

function luminance(hex: string): number {
  const c = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(hexA: string, hexB: string): number {
  const a = luminance(hexA) + 0.05;
  const b = luminance(hexB) + 0.05;
  return a > b ? a / b : b / a;
}

describe('PhysicalCard Theme System', () => {
  test('resolves Indonesian bank themes accurately', () => {
    expect(resolvePhysicalCardTheme('bca').name).toBe('BCA');
    expect(resolvePhysicalCardTheme('mandiri').name).toBe('Mandiri');
    expect(resolvePhysicalCardTheme('jago').name).toBe('Jago');
    expect(resolvePhysicalCardTheme('bni').name).toBe('BNI');
    expect(resolvePhysicalCardTheme('bri').name).toBe('BRI');
    expect(resolvePhysicalCardTheme('bsi').name).toBe('BSI');
    expect(resolvePhysicalCardTheme(null, 'cash').name).toBe('Cash');
    expect(resolvePhysicalCardTheme(null, 'forex').name).toBe('Valas');
  });

  test('Krom has its own purple card, with the bank name as the wordmark', async () => {
    const theme = resolvePhysicalCardTheme('krom', 'bank');
    expect(theme).toMatchObject({ name: 'Krom', cardTier: 'KROM DEBIT', bg: '#6C38D9', fg: '#FFFFFF' });
    const view = await render(<PhysicalCard name="Bank KROM" type="bank" icon="krom" balance={3756} />);
    expect(view.getAllByText('Krom').length).toBeGreaterThanOrEqual(1);
    expect(view.getByText('KROM DEBIT')).toBeTruthy();
  });

  test.each(Object.entries(PHYSICAL_CARD_THEMES))(
    '%s: keeps >= 4.5:1 contrast against bg and bgEnd',
    (_slug, theme) => {
      expect(contrast(theme.fg, theme.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(theme.fg, theme.bgEnd)).toBeGreaterThanOrEqual(4.5);
    }
  );
});

describe('PhysicalCard Component', () => {
  test('renders full realistic card with chip, holder, and tier', async () => {
    const onPress = jest.fn();
    const { getByTestId, queryByTestId, getByText } = await render(
      <PhysicalCard
        name="BCA Tahapan"
        type="savings"
        icon="bca"
        balance={15000000}
        cardholderName="NATHANIEL V"
        cardNumber="5210 1234 5678 9012"
        onPress={onPress}
        testID="card-bca"
      />
    );

    expect(getByTestId('card-bca')).toBeTruthy();
    expect(getByTestId('emv-chip')).toBeTruthy();
    expect(queryByTestId('card-bca-network')).toBeNull(); // no network badge on any card
    expect(getByText('5210 1234 5678 9012')).toBeTruthy();
    expect(getByText('NATHANIEL V')).toBeTruthy();
    expect(getByText('PASPOR BCA')).toBeTruthy();

    fireEvent.press(getByTestId('card-bca'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('renders strip variant correctly', async () => {
    const { getByTestId, getByText } = await render(
      <PhysicalCard
        name="Mandiri Utama"
        type="bank"
        icon="mandiri"
        balance={5000000}
        variant="strip"
        testID="card-mandiri-strip"
      />
    );

    expect(getByTestId('card-mandiri-strip')).toBeTruthy();
    expect(getByText('Mandiri Utama')).toBeTruthy();
  });

  test('a long account name gives way to the balance: the name can shrink, the amount never does', async () => {
    const { getByText } = await render(
      <PhysicalCard name="E-money Mandiri (mock)" type="ewallet" icon={null} balance={120000} variant="strip" testID="card-long-strip" />
    );
    const flat = (node: { props: { style?: unknown } }) => Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean));
    const name = getByText('E-money Mandiri (mock)');
    expect(name.props.numberOfLines).toBe(1);
    expect(flat(name).flexShrink).toBe(1);
    // the whole amount is there and is not cut to a number of lines
    expect(getByText('Rp120.000').props.numberOfLines).toBeUndefined();
  });
});

describe('PhysicalCard is decorative and cheap to redraw', () => {
  test('without a card number the card shows a plain mask, never digits made from the balance', async () => {
    const { getByText, queryByText } = await render(<PhysicalCard name="BCA" type="bank" icon="bca" balance={1234567} />);
    expect(getByText('•••• •••• •••• ••••')).toBeTruthy();
    expect(queryByText(/\d{4}$/)).toBeNull();
  });

  test('there is no VALID THRU line unless a real date is passed in', async () => {
    const view = await render(<PhysicalCard name="BCA" type="bank" icon="bca" balance={1} />);
    expect(view.queryByText('VALID THRU')).toBeNull();
  });

  test('a real expiry date is shown with its VALID THRU label', async () => {
    const view = await render(<PhysicalCard name="BCA" type="bank" icon="bca" balance={1} expiryDate="03/29" />);
    expect(view.getByText('VALID THRU')).toBeTruthy();
    expect(view.getByText('03/29')).toBeTruthy();
  });

  test('every theme has a stable memoized Background component', () => {
    for (const [slug, theme] of Object.entries(PHYSICAL_CARD_THEMES)) {
      expect(resolvePhysicalCardTheme(slug).Background).toBe(theme.Background);
      expect((theme.Background as unknown as { $$typeof: symbol }).$$typeof).toBe(Symbol.for('react.memo'));
    }
  });

  test('a new balance redraws the text, not the SVG artwork', async () => {
    const theme = PHYSICAL_CARD_THEMES.bca;
    const original = theme.Background;
    let drawn = 0;
    theme.Background = React.memo(function Counting() {
      drawn += 1;
      return null;
    });
    try {
      const view = await render(<PhysicalCard name="BCA" type="bank" icon="bca" balance={1000} />);
      expect(drawn).toBe(1);
      await view.rerender(<PhysicalCard name="BCA" type="bank" icon="bca" balance={2000} />);
      expect(drawn).toBe(1); // the artwork was not drawn again
    } finally {
      theme.Background = original;
    }
  });

  test('the same props do not even re-render the card', async () => {
    const theme = PHYSICAL_CARD_THEMES.mandiri;
    const original = theme.Background;
    let drawn = 0;
    theme.Background = React.memo(function Counting() {
      drawn += 1;
      return null;
    });
    try {
      const props = { name: 'Mandiri', type: 'bank' as const, icon: 'mandiri', balance: 5 };
      const view = await render(<PhysicalCard {...props} />);
      await view.rerender(<PhysicalCard {...props} />);
      expect(drawn).toBe(1);
    } finally {
      theme.Background = original;
    }
  });
});

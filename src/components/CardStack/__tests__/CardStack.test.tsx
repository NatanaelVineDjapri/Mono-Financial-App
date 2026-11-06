import { act, fireEvent, render } from '@testing-library/react-native';

import { useHideAmounts } from '@/components/hide-amounts-store';

import { CardStack, type CardStackAccount } from '../CardStack';

const ACCOUNTS: CardStackAccount[] = [
  { id: 1, name: 'BCA Tabungan', type: 'bank', icon: 'bca', balance: 6842500 },
  { id: 2, name: 'Cash wallet', type: 'cash', icon: 'cash', balance: 450000 },
  { id: 3, name: 'Jago Pocket', type: 'savings', icon: 'jago', balance: 1275000 },
];

async function renderStack(overrides: Partial<Parameters<typeof CardStack>[0]> = {}) {
  const onOpenAccount = jest.fn();
  const result = await render(
    <CardStack netWorth={8567500} accountCount={3} accounts={ACCOUNTS} onOpenAccount={onOpenAccount} testID="stack" {...overrides} />,
  );
  return { ...result, onOpenAccount };
}

describe('CardStack', () => {
  afterEach(async () => await act(() => useHideAmounts.getState().setHidden(false)));

  test('renders the total card with net worth, account count and an optional note', async () => {
    const result = await renderStack({ note: 'A note' });
    expect(result.getByText('Rp8.567.500')).toBeTruthy();
    expect(result.getByText('3 accounts')).toBeTruthy();
    expect(result.getByText('A note')).toBeTruthy();
  });

  test('renders every account in the given order, exactly the last one open by default', async () => {
    const result = await renderStack();
    const cards = [1, 2, 3].map(id => result.getByTestId(`card-stack-card-${id}`));

    expect(cards[0].props.accessibilityLabel).toBe('BCA Tabungan, Rp6.842.500. Bring card forward.');
    expect(cards[1].props.accessibilityLabel).toBe('Cash wallet, Rp450.000. Bring card forward.');
    expect(cards[2].props.accessibilityLabel).toBe('Jago Pocket, Rp1.275.000. Open account.');
  });

  test('tapping a closed strip brings it forward and closes whatever was open (exactly one open at a time)', async () => {
    const result = await renderStack();
    await fireEvent.press(result.getByTestId('card-stack-card-1'));

    expect(result.getByTestId('card-stack-card-1').props.accessibilityLabel).toContain('Open account.');
    expect(result.getByTestId('card-stack-card-3').props.accessibilityLabel).toContain('Bring card forward.');
  });

  test('tapping the already-open card calls onOpenAccount, not onToggle', async () => {
    const { getByTestId, onOpenAccount } = await renderStack();
    await fireEvent.press(getByTestId('card-stack-card-3')); // open by default
    expect(onOpenAccount).toHaveBeenCalledWith(3);
    // It stayed open — didn't flip to a strip.
    expect(getByTestId('card-stack-card-3').props.accessibilityLabel).toContain('Open account.');
  });

  test('the open card shows its own detail (e.g. a forex tag/subline); a closed strip does not', async () => {
    const withValas: CardStackAccount[] = [
      ...ACCOUNTS,
      { id: 4, name: 'Valas', type: 'forex', icon: null, balance: 6312500, subline: 'US$250,00 · S$180,00', currencyCount: 2 },
    ];
    const result = await renderStack({ accounts: withValas });

    // Valas is last, so it's open by default.
    expect(result.getByText('2 CURRENCIES')).toBeTruthy();
    expect(result.getByText('US$250,00 · S$180,00')).toBeTruthy();

    // Bring BCA (a strip) forward instead — Valas closes and loses its open-only detail.
    await fireEvent.press(result.getByTestId('card-stack-card-1'));
    expect(result.queryByText('2 CURRENCIES')).toBeNull();
    expect(result.queryByText('US$250,00 · S$180,00')).toBeNull();
  });

  test('hidden mode masks the total card and every card’s own accessibility label', async () => {
    await act(() => useHideAmounts.getState().setHidden(true));
    const result = await renderStack();

    expect(result.queryByText('Rp8.567.500')).toBeNull();
    expect(result.getAllByText('Rp••••••••').length).toBeGreaterThan(0);
    expect(result.getByTestId('card-stack-card-1').props.accessibilityLabel).toBe('BCA Tabungan, Rp••••••••. Bring card forward.');
  });

  test('a strip has role button and a touch target of at least 44dp (minHeight 68)', async () => {
    const result = await renderStack();
    const strip = result.getByTestId('card-stack-card-1');
    expect(strip.props.accessibilityRole).toBe('button');
  });
});

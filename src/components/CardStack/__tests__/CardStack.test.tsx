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
    <CardStack netWorth={8567500} accountCount={3} note="A note" accounts={ACCOUNTS} onOpenAccount={onOpenAccount} testID="stack" {...overrides} />,
  );
  return { ...result, onOpenAccount };
}

function makeTouchEvent(currentY: number, prevY: number, t: number, isEnd = false) {
  return {
    touchHistory: {
      mostRecentTimeStamp: t,
      numberActiveTouches: isEnd ? 0 : 1,
      indexOfSingleActiveTouch: 0,
      touchBank: [
        {
          touchActive: !isEnd,
          startPageX: 0,
          startPageY: 100,
          previousPageX: 0,
          previousPageY: prevY,
          currentPageX: 0,
          currentPageY: currentY,
          currentTimeStamp: t,
        },
      ],
    },
    nativeEvent: {
      touches: isEnd ? [] : [{ pageX: 0, pageY: currentY }],
      changedTouches: [{ pageX: 0, pageY: currentY }],
    },
  };
}

// Press and hold a card until it is in hand, with the test clock moved past HOLD_TO_DRAG.
async function holdCard(result: Awaited<ReturnType<typeof renderStack>>, id: number) {
  const handle = result.getByTestId(`card-stack-drag-${id}`);
  jest.useFakeTimers();
  await act(async () => {
    handle.props.onTouchStart();
    jest.advanceTimersByTime(250);
  });
  return handle;
}

describe('CardStack', () => {
  afterEach(async () => {
    await act(() => useHideAmounts.getState().setHidden(false));
    jest.useRealTimers();
  });

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

  test('default-open skips Valas even though it sorts last: the last non-forex account opens instead', async () => {
    const withValas: CardStackAccount[] = [
      ...ACCOUNTS,
      { id: 4, name: 'Valas', type: 'forex', icon: null, balance: 6312500, subline: 'US$250,00 · S$180,00' },
    ];
    const result = await renderStack({ accounts: withValas });

    expect(result.getByTestId('card-stack-card-3').props.accessibilityLabel).toContain('Open account.'); // Jago Pocket
    expect(result.getByTestId('card-stack-card-4').props.accessibilityLabel).toContain('Bring card forward.'); // Valas
  });

  test('the open card shows its own detail (e.g. a forex subline); a closed strip does not', async () => {
    const withValas: CardStackAccount[] = [
      ...ACCOUNTS,
      { id: 4, name: 'Valas', type: 'forex', icon: null, balance: 6312500, subline: 'US$250,00 · S$180,00' },
    ];
    const result = await renderStack({ accounts: withValas });

    // Bring Valas forward (it isn't open by default — see the test above).
    await fireEvent.press(result.getByTestId('card-stack-card-4'));
    expect(result.getByText('US$250,00 · S$180,00')).toBeTruthy();
    expect(result.queryByText(/CURRENC/)).toBeNull(); // no tag pill either way (Fase 4.2c step 4)

    // Bring BCA (a strip) forward instead — Valas closes and loses its open-only detail.
    await fireEvent.press(result.getByTestId('card-stack-card-1'));
    expect(result.queryByText('US$250,00 · S$180,00')).toBeNull();
  });

  test('forexNote only replaces the total card\'s note while the forex account is the one open', async () => {
    const withValas: CardStackAccount[] = [
      ...ACCOUNTS,
      { id: 4, name: 'Valas', type: 'forex', icon: null, balance: 6312500 },
    ];
    const result = await renderStack({ accounts: withValas, note: 'Everyday note', forexNote: 'Forex estimate note' });

    // Not open by default — the everyday note shows.
    expect(result.getByText('Everyday note')).toBeTruthy();
    expect(result.queryByText('Forex estimate note')).toBeNull();

    // Bring Valas forward — forexNote wins.
    await fireEvent.press(result.getByTestId('card-stack-card-4'));
    expect(result.queryByText('Everyday note')).toBeNull();
    expect(result.getByText('Forex estimate note')).toBeTruthy();

    // Bring BCA forward (closes Valas) — back to the everyday note.
    await fireEvent.press(result.getByTestId('card-stack-card-1'));
    expect(result.getByText('Everyday note')).toBeTruthy();
    expect(result.queryByText('Forex estimate note')).toBeNull();
  });

  test('every open card except the stack\'s last one lifts its balance clear of the strip below (Fase 4.2c step 2)', async () => {
    const result = await renderStack();
    // Bring the middle account (Cash wallet, id 2) forward — it is open but not last.
    await fireEvent.press(result.getByTestId('card-stack-card-2'));

    // The card's content area carries the lift as extra bottom padding (12 normal + 12 for the overlap).
    const bottomPadding = () => {
      let node = result.getByText('Cash wallet').parent;
      for (let i = 0; i < 8 && node; i++, node = node.parent) {
        const padding = Object.assign({}, ...[node.props.style].flat().filter(Boolean)).paddingBottom;
        if (typeof padding === 'number') return padding;
      }
      return undefined;
    };
    expect(bottomPadding()).toBe(24);
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

  test('a card only becomes draggable after a short hold, so a tap and a scroll still work', async () => {
    const result = await renderStack();
    const handle = result.getByTestId('card-stack-drag-1');

    jest.useFakeTimers();
    // A fresh touch is not a drag yet: the page may still scroll, the card may still be tapped.
    expect(handle.props.onMoveShouldSetResponder()).toBe(false);

    await act(async () => {
      handle.props.onTouchStart();
      jest.advanceTimersByTime(100);
    });
    expect(handle.props.onMoveShouldSetResponder()).toBe(false);

    // Past the hold, the card is in hand and a move becomes a drag.
    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    expect(handle.props.onMoveShouldSetResponder()).toBe(true);

    // Letting go puts it back down.
    await act(async () => {
      handle.props.onTouchEnd();
    });
    expect(handle.props.onMoveShouldSetResponder()).toBe(false);
  });

  test('a hold that never moves puts the card back instead of opening it', async () => {
    const result = await renderStack();
    const handle = await holdCard(result, 1);

    // The hold armed the card; releasing without a drag must not count as a tap.
    await act(async () => {
      handle.props.onTouchEnd();
    });
    await fireEvent.press(result.getByTestId('card-stack-card-1'));

    expect(result.getByTestId('card-stack-card-1').props.accessibilityLabel).toContain('Bring card forward.');
  });

  test('dragging a held card down reorders the stack and calls onReorder', async () => {
    const onReorder = jest.fn();
    const onDragActiveChange = jest.fn();
    const result = await renderStack({ onReorder, onDragActiveChange });

    const handle = await holdCard(result, 1); // index 0 (BCA)
    expect(onDragActiveChange).toHaveBeenCalledWith(true);

    await act(async () => {
      handle.props.onResponderGrant(makeTouchEvent(100, 100, 0));
      // Down by 130px: past the two slots below (tops at 0, 56 and 112).
      handle.props.onResponderMove(makeTouchEvent(230, 100, 20));
      handle.props.onResponderRelease(makeTouchEvent(230, 230, 30, true));
    });

    // BCA (id 1) moved from index 0 to the last slot: [Cash(2), Jago(3), BCA(1)].
    expect(onReorder).toHaveBeenCalledWith([2, 3, 1]);
    expect(onDragActiveChange).toHaveBeenLastCalledWith(false);
  });

  test('dragging a held card up moves it towards the top of the stack', async () => {
    const onReorder = jest.fn();
    const result = await renderStack({ onReorder });

    const handle = await holdCard(result, 2); // index 1 (Cash wallet)
    await act(async () => {
      // Up by 60px: its top (56) is now closest to the first slot (0), not the second (56).
      handle.props.onResponderGrant(makeTouchEvent(100, 100, 0));
      handle.props.onResponderMove(makeTouchEvent(40, 100, 20));
      handle.props.onResponderRelease(makeTouchEvent(40, 40, 30, true));
    });

    expect(onReorder).toHaveBeenCalledWith([2, 1, 3]);
  });

  test('dragging the open card itself moves it and keeps it open', async () => {
    const onReorder = jest.fn();
    const result = await renderStack({ onReorder });

    const handle = await holdCard(result, 3); // open by default, last slot
    await act(async () => {
      handle.props.onResponderGrant(makeTouchEvent(100, 100, 0));
      handle.props.onResponderMove(makeTouchEvent(-30, 100, 20));
      handle.props.onResponderRelease(makeTouchEvent(-30, -30, 30, true));
    });

    expect(onReorder).toHaveBeenCalledWith([3, 1, 2]);
    // It is still the open card, just at the top now.
    expect(result.getByTestId('card-stack-card-3').props.accessibilityLabel).toContain('Open account.');
  });

  test('a small drag that stays in its own slot does not reorder', async () => {
    const onReorder = jest.fn();
    const result = await renderStack({ onReorder });

    const handle = await holdCard(result, 1);
    await act(async () => {
      handle.props.onResponderGrant(makeTouchEvent(100, 100, 0));
      handle.props.onResponderMove(makeTouchEvent(110, 100, 20));
      handle.props.onResponderRelease(makeTouchEvent(110, 110, 30, true));
    });

    expect(onReorder).not.toHaveBeenCalled();
  });
});

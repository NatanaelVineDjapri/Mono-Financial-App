import { act, fireEvent, render } from '@testing-library/react-native';
import { useWindowDimensions } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { TabBar, SLIDE_LEAD_MS, fabSlotWidth, labelsFit, slotWidths, type TabBarItem } from '../TabBar';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions');
const mockUseWindowDimensions = useWindowDimensions as jest.MockedFunction<typeof useWindowDimensions>;

function setDimensions(overrides: Partial<ReturnType<typeof useWindowDimensions>> = {}) {
  mockUseWindowDimensions.mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1, ...overrides });
}

const ITEMS: TabBarItem[] = [
  { key: 'index', label: 'Overview', icon: 'overview' },
  { key: 'transactions', label: 'Transactions', icon: 'flow' },
  { key: 'accounts', label: 'Accounts', icon: 'bank' },
  { key: 'budgets', label: 'Budgets', icon: 'pie' },
];

function metrics(bottom: number) {
  return { insets: { top: 0, left: 0, right: 0, bottom }, frame: { x: 0, y: 0, width: 390, height: 844 } };
}

function renderBar(props: Partial<React.ComponentProps<typeof TabBar>> = {}, bottomInset = 0) {
  return render(
    <SafeAreaProvider initialMetrics={metrics(bottomInset)}>
      <TabBar
        items={ITEMS}
        activeKey="index"
        onPress={() => {}}
        fabLabel="Add transaction by chat"
        onFabPress={() => {}}
        testID="tab-bar"
        {...props}
      />
    </SafeAreaProvider>,
  );
}

function flat(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
}

describe('TabBar', () => {
  beforeEach(() => setDimensions());

  test('four tabs, each role tab with its label and the right selected state', async () => {
    const result = await renderBar({ activeKey: 'accounts' });
    expect(result.getAllByRole('tab')).toHaveLength(4);
    expect(result.getByRole('tab', { name: 'Overview' }).props.accessibilityState).toMatchObject({ selected: false });
    expect(result.getByRole('tab', { name: 'Accounts' }).props.accessibilityState).toMatchObject({ selected: true });
    expect(result.queryByRole('tab', { name: 'More' })).toBeNull();
  });

  test('exactly one tab is selected at a time', async () => {
    const result = await renderBar({ activeKey: 'budgets' });
    const selected = ITEMS.filter(i => result.getByRole('tab', { name: i.label }).props.accessibilityState.selected);
    expect(selected).toHaveLength(1);
  });

  test('the bar is a tablist and the centre + is a labelled button', async () => {
    const result = await renderBar();
    const bar = result.getByTestId('tab-bar-bar');
    expect(bar.props.accessibilityRole).toBe('tablist');
    expect(result.getByRole('button', { name: 'Add transaction by chat' })).toBeTruthy();
  });

  test('tapping the + calls onFabPress; tapping a tab calls onPress with its key, a beat after the pill starts to slide', async () => {
    jest.useFakeTimers();
    try {
      const onPress = jest.fn();
      const onFabPress = jest.fn();
      const result = await renderBar({ onPress, onFabPress });
      await fireEvent.press(result.getByRole('button', { name: 'Add transaction by chat' }));
      expect(onFabPress).toHaveBeenCalledTimes(1);

      await fireEvent.press(result.getByRole('tab', { name: 'Budgets' }));
      // The pill moves at once...
      expect(result.getByRole('tab', { name: 'Budgets' }).props.accessibilityState).toMatchObject({ selected: true });
      expect(result.getByRole('tab', { name: 'Overview' }).props.accessibilityState).toMatchObject({ selected: false });
      // ...the navigation follows after SLIDE_LEAD_MS.
      expect(onPress).not.toHaveBeenCalled();
      await act(async () => {
        jest.advanceTimersByTime(SLIDE_LEAD_MS);
      });
      expect(onPress).toHaveBeenCalledWith('budgets');
      expect(onPress).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  test('tabs pressed in quick succession: only the last one navigates', async () => {
    jest.useFakeTimers();
    try {
      const onPress = jest.fn();
      const result = await renderBar({ onPress });
      await fireEvent.press(result.getByRole('tab', { name: 'Accounts' }));
      await fireEvent.press(result.getByRole('tab', { name: 'Budgets' }));
      await act(async () => {
        jest.advanceTimersByTime(SLIDE_LEAD_MS * 3);
      });
      expect(onPress.mock.calls).toEqual([['budgets']]);
    } finally {
      jest.useRealTimers();
    }
  });

  test('when the real active tab changes some other way (a link), the pill follows it', async () => {
    const view = await renderBar({ activeKey: 'index' });
    expect(view.getByRole('tab', { name: 'Overview' }).props.accessibilityState).toMatchObject({ selected: true });
    await view.rerender(
      <SafeAreaProvider initialMetrics={metrics(0)}>
        <TabBar items={ITEMS} activeKey="accounts" onPress={() => {}} fabLabel="Add transaction by chat" onFabPress={() => {}} testID="tab-bar" />
      </SafeAreaProvider>,
    );
    expect(view.getByRole('tab', { name: 'Accounts' }).props.accessibilityState).toMatchObject({ selected: true });
    expect(view.getByRole('tab', { name: 'Overview' }).props.accessibilityState).toMatchObject({ selected: false });
  });

  test('zone is 112 high plus the safe-area inset, with 14 beneath the bar plus the inset', async () => {
    const result = await renderBar({}, 20);
    const zone = flat(result.getByTestId('tab-bar').props.style);
    expect(zone.height).toBe(132);
    expect(zone.paddingBottom).toBe(34);
    expect(zone.backgroundColor).toBe('transparent');
  });

  test('bar: 64 high, radius 30, charcoal fill, 1px border, 12 horizontal padding (the outer tabs sit inside the curve)', async () => {
    const result = await renderBar();
    expect(flat(result.getByTestId('tab-bar-bar').props.style)).toMatchObject({
      height: 64,
      borderRadius: 30,
      backgroundColor: '#131314',
      borderWidth: 1,
      borderColor: '#262627',
      paddingHorizontal: 12,
    });
  });

  test('active slot: the light pill, 48 high; inactive slots are clear. Each is at least 44 wide', async () => {
    const result = await renderBar({ activeKey: 'budgets' });
    const active = flat(result.getByRole('tab', { name: 'Budgets' }).parent?.props.style);
    expect(active).toMatchObject({ backgroundColor: 'rgba(245, 245, 245, 1)', height: 48 }); // #F5F5F5, as interpolateColor writes it
    for (const name of ['Overview', 'Transactions', 'Accounts']) {
      const slot = flat(result.getByRole('tab', { name }).parent?.props.style);
      expect(slot.backgroundColor).toBe('rgba(245, 245, 245, 0)');
      expect(slot.height).toBe(48);
      expect(slot.width as number).toBeGreaterThanOrEqual(44);
    }
    expect(active.width as number).toBeGreaterThanOrEqual(44);
  });

  describe('slotWidths (what the slots slide between)', () => {
    // 390 wide: inner = 390 - 20 (zone) - 24 (padding) - 2 (border) - the gap for the + (83) = 261; each half is 130.5.
    const HALF = (390 - 46 - fabSlotWidth(390)) / 2;
    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

    test.each([['index'], ['transactions'], ['accounts'], ['budgets']])('with %s active, the left two and the right two take exactly the same width, so the + stays centred', key => {
      const widths = slotWidths(ITEMS, key, 390, 1, true);
      expect(sum(widths.slice(0, 2))).toBeCloseTo(HALF, 5);
      expect(sum(widths.slice(2))).toBeCloseTo(HALF, 5);
      expect(Math.min(...widths)).toBeGreaterThanOrEqual(44);
    });

    test.each([320, 340, 360, 390, 411, 600])('the halves are equal at %idp for every active tab, with and without labels', width => {
      // Labels only ever show when they fit (labelsFit); otherwise the bar is icon-only.
      for (const showLabel of labelsFit(ITEMS, width, 1) ? [true, false] : [false]) {
        for (const item of ITEMS) {
          const widths = slotWidths(ITEMS, item.key, width, 1, showLabel);
          expect(sum(widths.slice(0, 2))).toBeCloseTo(sum(widths.slice(2)), 5);
        }
      }
    });

    test('the active pill GROWS: it takes the room its neighbour does not need, and the neighbour shrinks to its label', () => {
      const widths = slotWidths(ITEMS, 'transactions', 390, 1, true);
      const overviewNeed = 'Overview'.length * 5.3 + 6;
      expect(widths[0]).toBeCloseTo(overviewNeed, 5); // pushed aside, as small as its label allows
      expect(widths[1]).toBeCloseTo(HALF - overviewNeed, 5);
      expect(widths[1]).toBeGreaterThan('Transactions'.length * 5.3 + 10); // roomier than label + padding
    });

    test('the last tab: Budgets takes the room, Accounts is pushed toward the +', () => {
      const budgets = slotWidths(ITEMS, 'budgets', 390, 1, true);
      const accountsNeed = 'Accounts'.length * 5.3 + 6;
      expect(budgets[2]).toBeCloseTo(accountsNeed, 5);
      expect(budgets[3]).toBeCloseTo(HALF - accountsNeed, 5);
      // A pill never gets narrower than its own label and padding, on any tab.
      for (const item of ITEMS) {
        const widths = slotWidths(ITEMS, item.key, 390, 1, true);
        expect(widths[ITEMS.indexOf(item)]).toBeGreaterThanOrEqual(item.label.length * 5.3 + 10);
      }
    });

    test('with the labels hidden: an icon-only pill grows to 56 at most; its neighbour keeps the rest', () => {
      const widths = slotWidths(ITEMS, 'index', 320, 1, false);
      expect(widths[0]).toBe(56);
      expect(widths[1]).toBeCloseTo((320 - 46 - fabSlotWidth(320)) / 2 - 56, 5);
    });

    test('moving the pill moves the widths: the one that was clicked grows, the old one gives the room back', () => {
      const before = slotWidths(ITEMS, 'index', 390, 1, true);
      const after = slotWidths(ITEMS, 'accounts', 390, 1, true);
      expect(after[2]).toBeGreaterThan(before[2]);
      expect(after[0]).toBeLessThan(before[0]);
    });
  });

  describe('real label widths (measured), not guesses', () => {
    test('slotWidths uses a measured width: the neighbour gets its measured label plus air, never a guess', () => {
      const metrics = { index: { medium: 50, semi: 53 }, transactions: { medium: 66, semi: 68 } };
      const widths = slotWidths(ITEMS, 'transactions', 411, 1, true, metrics);
      expect(widths[0]).toBeCloseTo(50 + 6, 5); // Overview's measured medium width + 3 each side
      const half = (411 - 46 - fabSlotWidth(411)) / 2;
      expect(widths[1]).toBeCloseTo(half - 56, 5);
    });

    test('a measured label that is wider than the estimate can take the labels away rather than be cut off', () => {
      const wide = Object.fromEntries(ITEMS.map(i => [i.key, { medium: 90, semi: 95 }]));
      expect(labelsFit(ITEMS, 411, 1, wide)).toBe(false);
      expect(labelsFit(ITEMS, 411, 1)).toBe(true);
    });

    test('the bar measures every label in both weights, invisibly, and slots use what it reads', async () => {
      const result = await renderBar({ activeKey: 'transactions' });
      const keys = ITEMS.map(i => i.key);
      for (const key of keys) {
        for (const weight of ['medium', 'semi']) {
          expect(result.getByTestId(`tab-bar-measure-${key}-${weight}`, { includeHiddenElements: true })).toBeTruthy();
        }
      }
      // Tell the bar that "Overview" really is 58 wide: the bar re-renders with it measured (the
      // slot's own width then glides there, which the slotWidths tests above cover).
      await fireEvent(result.getByTestId('tab-bar-measure-index-medium', { includeHiddenElements: true }), 'layout', { nativeEvent: { layout: { width: 58, height: 12, x: 0, y: 0 } } });
      expect(result.getByRole('tab', { name: 'Overview' })).toBeTruthy();
    });
  });

  describe('the gap around the +', () => {
    test('grows with the screen: a hair at 360dp, clear air at 411dp, never more than 90', () => {
      expect(fabSlotWidth(320)).toBe(74);
      expect(fabSlotWidth(360)).toBe(74);
      expect(fabSlotWidth(390)).toBe(83);
      expect(fabSlotWidth(411)).toBe(89);
      expect(fabSlotWidth(900)).toBe(90);
    });

    test('at 411dp a neighbouring pill clears the 7dp ring of the + by at least 5dp', () => {
      expect(fabSlotWidth(411) / 2 - (32 + 7)).toBeGreaterThanOrEqual(5);
    });

    test('the labels fit at 390 and 411, whichever tab is active (a narrower bar shows icons only)', () => {
      for (const width of [390, 411]) expect(labelsFit(ITEMS, width, 1)).toBe(true);
      expect(labelsFit(ITEMS, 340, 1)).toBe(false);
    });
  });

  test('never uses the amber accent for a tab (gold is the + only)', async () => {
    const result = await renderBar();
    const active = flat(result.getByRole('tab', { name: 'Overview' }).parent?.props.style);
    expect(active.backgroundColor).not.toBe('#E3C27A');
  });

  describe('label visibility', () => {
    test('shown at a normal width and font scale, active label semibold, inactive medium grey', async () => {
      const result = await renderBar();
      expect(flat(result.getByText('Overview').props.style)).toMatchObject({ fontFamily: 'IBMPlexSans_600SemiBold', color: '#0A0A0A', fontSize: 10.5, lineHeight: 12 });
      expect(flat(result.getByText('Budgets').props.style)).toMatchObject({ fontFamily: 'IBMPlexSans_500Medium', color: '#9A9A9A' });
    });

    test.each([
      [320, 1, false],
      [339, 1, false],
      [360, 1, false],
      [390, 1, true],
      [390, 1.3, false],
      [390, 2, false],
    ])('width %i, fontScale %f → labels shown: %s', async (width, fontScale, expectShown) => {
      setDimensions({ width, fontScale });
      const result = await renderBar();
      if (expectShown) expect(result.getByText('Overview')).toBeTruthy();
      else expect(result.queryByText('Overview')).toBeNull();
      // Whether or not the labels show, every tab is still there and still labelled.
      for (const item of ITEMS) expect(result.getByRole('tab', { name: item.label })).toBeTruthy();
    });

    test('390dp fits every label, whichever tab is active (so labels never come and go as the pill moves)', () => {
      expect(labelsFit(ITEMS, 390, 1)).toBe(true);
    });
  });
});

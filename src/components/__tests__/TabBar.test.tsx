import { fireEvent, render } from '@testing-library/react-native';
import { useWindowDimensions } from 'react-native';

import { TabBar, type TabBarItem } from '../TabBar';
import { MonoColors } from '@/theme/tokens';

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
  { key: 'more', label: 'More', icon: 'dots' },
];

// The zone's own horizontal padding (10dp each side) is outside the bar, so "screen
// width" in the bug report and the bar's own measured width (what onLayout reports)
// differ by 20 — every test below that takes a screen width subtracts it before firing
// the layout event.

describe('TabBar', () => {
  beforeEach(() => setDimensions());

  test('role tab on every item, with the correct selected state', async () => {
    const result = await render(<TabBar items={ITEMS} activeKey="accounts" onPress={() => {}} />);
    expect(result.getByRole('tab', { name: 'Overview' }).props.accessibilityState).toMatchObject({ selected: false });
    expect(result.getByRole('tab', { name: 'Accounts' }).props.accessibilityState).toMatchObject({ selected: true });
    expect(result.getByRole('tab', { name: 'More' }).props.accessibilityState).toMatchObject({ selected: false });
  });

  test('exactly one item is selected at a time', async () => {
    const result = await render(<TabBar items={ITEMS} activeKey="more" onPress={() => {}} />);
    const selectedCount = ITEMS.filter(i => result.getByRole('tab', { name: i.label }).props.accessibilityState.selected).length;
    expect(selectedCount).toBe(1);
  });

  test('the bar is a tablist, clips overflow, and the active tab reaches the minimum touch target (44dp)', async () => {
    const result = await render(<TabBar items={ITEMS} activeKey="index" onPress={() => {}} testID="tab-bar" />);
    const bar = result.getByTestId('tab-bar-bar');
    expect(bar.props.accessibilityRole).toBe('tablist');
    const barStyle = Object.assign({}, ...[bar.props.style].flat());
    expect(barStyle.overflow).toBe('hidden');

    const activePill = result.getByRole('tab', { name: 'Overview' }).parent;
    const flatStyle = Object.assign({}, ...[activePill?.props.style].flat());
    expect(flatStyle.height).toBeGreaterThanOrEqual(44);
  });

  // Regression (TabBar bug report): `flex: 0` on the active pill also zeroes its
  // flexBasis in RN/Yoga (unlike web CSS, where flex:0 keeps basis auto), so the pill's
  // real content width lost the fight against the inactive cells' flexGrow:1 and
  // overflowed the bar, pushing the last tab out past its right edge. flexBasis:'auto'
  // on the pill, plus an explicit flexBasis:0 on the inactive cells, is the actual fix —
  // assert the exact flex triplet on both so `flex: 0`/`flex: 1` shorthands don't creep
  // back in.
  test('active pill sizes from its own content (flexBasis auto); inactive cells share the rest equally (flexBasis 0)', async () => {
    const result = await render(<TabBar items={ITEMS} activeKey="budgets" onPress={() => {}} />);

    const activePill = result.getByRole('tab', { name: 'Budgets' }).parent;
    const activeStyle = Object.assign({}, ...[activePill?.props.style].flat());
    expect(activeStyle).toMatchObject({ flexGrow: 0, flexShrink: 0, flexBasis: 'auto' });

    const inactiveCell = result.getByRole('tab', { name: 'More' }).parent;
    const inactiveStyle = Object.assign({}, ...[inactiveCell?.props.style].flat());
    expect(inactiveStyle).toMatchObject({ flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 44 });
  });

  test('bottomInset grows the zone and stacks beneath its own bottom padding', async () => {
    const result = await render(<TabBar items={ITEMS} activeKey="index" onPress={() => {}} bottomInset={20} testID="tab-bar" />);
    const zone = result.getByTestId('tab-bar');
    const flatStyle = Object.assign({}, ...[zone.props.style].flat());
    expect(flatStyle.height).toBe(92); // 72 + 20
    expect(flatStyle.paddingBottom).toBe(28); // 8 (own) + 20 (safe area)
  });

  test('no top border and no 28x2 indicator (replaced by the pill itself)', async () => {
    const result = await render(<TabBar items={ITEMS} activeKey="index" onPress={() => {}} testID="tab-bar" />);
    const zone = result.getByTestId('tab-bar');
    const flatStyle = Object.assign({}, ...[zone.props.style].flat());
    expect(flatStyle.borderTopWidth).toBeUndefined();
    expect(result.queryByTestId('tab-bar-indicator')).toBeNull();
  });

  test('colour comes only from tokens: the active pill fill is `text`, never `accent`', async () => {
    const result = await render(<TabBar items={ITEMS} activeKey="index" onPress={() => {}} />);
    const activePill = result.getByRole('tab', { name: 'Overview' }).parent;
    const flatStyle = Object.assign({}, ...[activePill?.props.style].flat());
    expect(flatStyle.backgroundColor).toBe(MonoColors.text);
    expect(flatStyle.backgroundColor).not.toBe(MonoColors.accent);
  });

  test('onPress is called with the tapped item\'s key', async () => {
    const onPress = jest.fn();
    const result = await render(<TabBar items={ITEMS} activeKey="index" onPress={onPress} />);
    fireEvent.press(result.getByRole('tab', { name: 'Budgets' }));
    expect(onPress).toHaveBeenCalledWith('budgets');
  });

  describe('active label visibility: fits the pill\'s own estimated width against the 4 other tabs\' 44dp floor', () => {
    test('shows the label with room to spare (normal scale, full width)', async () => {
      const result = await render(<TabBar items={ITEMS} activeKey="index" onPress={() => {}} testID="tab-bar" />);
      expect(result.getByText('Overview')).toBeTruthy();
    });

    // Screen widths 320/360/390 (bar width = screen - 20), fontScale 1 and 2, active
    // tab "Overview" (8 chars) — per the brief's own test matrix.
    test.each([
      [320, 1, false],
      [320, 2, false],
      [360, 1, true],
      [360, 2, false],
      [390, 1, true],
      [390, 2, false],
    ])('screen %ipx, fontScale %f → label shown: %s', async (screenWidth, fontScale, expectShown) => {
      setDimensions({ fontScale });
      const result = await render(<TabBar items={ITEMS} activeKey="index" onPress={() => {}} testID="tab-bar" />);
      const bar = result.getByTestId('tab-bar-bar');
      await fireEvent(bar, 'layout', { nativeEvent: { layout: { width: screenWidth - 20, height: 56, x: 0, y: 0 } } });
      if (expectShown) {
        expect(result.getByText('Overview')).toBeTruthy();
      } else {
        expect(result.queryByText('Overview')).toBeNull();
      }
      // Whichever way the label falls, every tab is still present and still role="tab" —
      // the fix's actual point: nothing gets squeezed out of existence.
      for (const item of ITEMS) {
        expect(result.getByRole('tab', { name: item.label })).toBeTruthy();
      }
    });

    test('hides the active tab\'s label when even the full-width bar can\'t fit a long name at a large font scale', async () => {
      setDimensions({ fontScale: 2 });
      const result = await render(<TabBar items={ITEMS} activeKey="transactions" onPress={() => {}} testID="tab-bar" />);
      const bar = result.getByTestId('tab-bar-bar');
      await fireEvent(bar, 'layout', { nativeEvent: { layout: { width: 370, height: 56, x: 0, y: 0 } } });
      expect(result.queryByText('Transactions')).toBeNull();
      expect(result.getByRole('tab', { name: 'Transactions' }).props.accessibilityState).toMatchObject({ selected: true });
    });
  });
});

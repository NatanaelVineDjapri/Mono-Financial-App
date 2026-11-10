import { fireEvent, render } from '@testing-library/react-native';
import { useWindowDimensions } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { TabBar, labelsFit, type TabBarItem } from '../TabBar';

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

  test('tapping the + calls onFabPress; tapping a tab calls onPress with its key', async () => {
    const onPress = jest.fn();
    const onFabPress = jest.fn();
    const result = await renderBar({ onPress, onFabPress });
    await fireEvent.press(result.getByRole('button', { name: 'Add transaction by chat' }));
    expect(onFabPress).toHaveBeenCalledTimes(1);
    await fireEvent.press(result.getByRole('tab', { name: 'Budgets' }));
    expect(onPress).toHaveBeenCalledWith('budgets');
  });

  test('zone is 112 high plus the safe-area inset, with 14 beneath the bar plus the inset', async () => {
    const result = await renderBar({}, 20);
    const zone = flat(result.getByTestId('tab-bar').props.style);
    expect(zone.height).toBe(132);
    expect(zone.paddingBottom).toBe(34);
    expect(zone.backgroundColor).toBe('transparent');
  });

  test('bar: 64 high, radius 30, charcoal fill, 1px border, 6 horizontal padding', async () => {
    const result = await renderBar();
    expect(flat(result.getByTestId('tab-bar-bar').props.style)).toMatchObject({
      height: 64,
      borderRadius: 30,
      backgroundColor: '#131314',
      borderWidth: 1,
      borderColor: '#262627',
      paddingHorizontal: 6,
    });
  });

  test('active slot: light pill, sizes from its content; inactive slots share the rest, min 44, 48 high', async () => {
    const result = await renderBar({ activeKey: 'budgets' });
    const active = flat(result.getByRole('tab', { name: 'Budgets' }).parent?.props.style);
    expect(active).toMatchObject({ backgroundColor: '#F5F5F5', flexGrow: 0, flexShrink: 0, flexBasis: 'auto', height: 48, paddingHorizontal: 13 });
    const inactive = flat(result.getByRole('tab', { name: 'Overview' }).parent?.props.style);
    expect(inactive).toMatchObject({ flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 44, height: 48 });
    expect(inactive.backgroundColor).toBeUndefined();
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
      [360, 1, true],
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

    test('360dp fits the longest label ("Transactions") active, alongside the other three', () => {
      expect(labelsFit(ITEMS, 'transactions', 360, 1)).toBe(true);
    });
  });
});

import { fireEvent, render } from '@testing-library/react-native';

import { TabBar, type TabBarItem } from '../TabBar';

const ITEMS: TabBarItem[] = [
  { key: 'index', label: 'Ringkasan', icon: 'overview' },
  { key: 'transactions', label: 'Transaksi', icon: 'flow' },
  { key: 'accounts', label: 'Akun', icon: 'bank' },
  { key: 'budgets', label: 'Anggaran', icon: 'pie' },
  { key: 'more', label: 'Lainnya', icon: 'dots' },
];

describe('TabBar', () => {
  test('role tab on every item, with the correct selected state', async () => {
    const result = await render(<TabBar items={ITEMS} activeKey="accounts" onPress={() => {}} />);
    expect(result.getByRole('tab', { name: 'Ringkasan' }).props.accessibilityState).toMatchObject({ selected: false });
    expect(result.getByRole('tab', { name: 'Akun' }).props.accessibilityState).toMatchObject({ selected: true });
    expect(result.getByRole('tab', { name: 'Lainnya' }).props.accessibilityState).toMatchObject({ selected: false });
  });

  test('exactly one item is selected at a time', async () => {
    const result = await render(<TabBar items={ITEMS} activeKey="more" onPress={() => {}} />);
    const selectedCount = ITEMS.filter(i => result.getByRole('tab', { name: i.label }).props.accessibilityState.selected).length;
    expect(selectedCount).toBe(1);
  });

  test('container is a tablist and reaches the minimum touch target', async () => {
    const result = await render(<TabBar items={ITEMS} activeKey="index" onPress={() => {}} testID="tab-bar" />);
    const bar = result.getByTestId('tab-bar');
    expect(bar.props.accessibilityRole).toBe('tablist');
    const row = result.getByRole('tab', { name: 'Ringkasan' });
    const flatStyle = Object.assign({}, ...[row.props.style].flat());
    expect(flatStyle.minHeight).toBeGreaterThanOrEqual(44);
  });

  test('bottomInset grows the bar height and becomes its bottom padding', async () => {
    const result = await render(<TabBar items={ITEMS} activeKey="index" onPress={() => {}} bottomInset={20} testID="tab-bar" />);
    const bar = result.getByTestId('tab-bar');
    const flatStyle = Object.assign({}, ...[bar.props.style].flat());
    expect(flatStyle.height).toBe(92);
    expect(flatStyle.paddingBottom).toBe(20);
  });

  test('onPress is called with the tapped item\'s key', async () => {
    const onPress = jest.fn();
    const result = await render(<TabBar items={ITEMS} activeKey="index" onPress={onPress} />);
    fireEvent.press(result.getByRole('tab', { name: 'Anggaran' }));
    expect(onPress).toHaveBeenCalledWith('budgets');
  });
});

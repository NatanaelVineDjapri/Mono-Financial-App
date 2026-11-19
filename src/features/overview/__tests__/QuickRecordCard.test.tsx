import { fireEvent, render } from '@testing-library/react-native';

import type { QuickRecord } from '@/domain/quickRecords';

import { QuickRecordCard } from '../QuickRecordCard';

const ITEMS: QuickRecord[] = [
  {
    source: 'category',
    label: 'Food & drink',
    placeName: null,
    kind: 'expense',
    accountId: 1,
    accountName: 'BCA Tabungan',
    categoryId: 2,
    categoryName: 'Food & drink',
    amount: 18_000,
    count: 4,
    lastOn: '2026-10-20',
  },
  {
    source: 'place',
    label: 'Kantor',
    placeName: 'Kantor',
    kind: 'expense',
    accountId: 1,
    accountName: 'BCA Tabungan',
    categoryId: 3,
    categoryName: 'Transport',
    amount: 5_000,
    count: 2,
    lastOn: '2026-10-18',
  },
];

describe('QuickRecordCard', () => {
  test('shows the note and its initial, without a count', async () => {
    const result = await render(<QuickRecordCard items={ITEMS} onOpenRecord={jest.fn()} />);
    expect(result.getByText('Catat cepat')).toBeTruthy();
    expect(result.getByText('Food & drink')).toBeTruthy();
    expect(result.getByText('F')).toBeTruthy();
    expect(result.getByText('Kantor')).toBeTruthy();
    expect(result.queryByText('4×')).toBeNull();
  });

  test('tapping a shortcut hands the whole record to the caller', async () => {
    const onOpenRecord = jest.fn();
    const result = await render(<QuickRecordCard items={ITEMS} onOpenRecord={onOpenRecord} />);
    await fireEvent.press(result.getByTestId('quick-record-category-Food & drink'));
    expect(onOpenRecord).toHaveBeenCalledWith(ITEMS[0]);
  });

  test('the accessibility label names the note and the amount it will fill in', async () => {
    const result = await render(<QuickRecordCard items={ITEMS} onOpenRecord={jest.fn()} />);
    expect(result.getByTestId('quick-record-category-Food & drink').props.accessibilityLabel).toBe('Catat Food & drink, Rp18.000.');
  });

  test('renders nothing when there is no shortcut to offer', async () => {
    const result = await render(<QuickRecordCard items={[]} onOpenRecord={jest.fn()} />);
    expect(result.queryByTestId('overview-quick-record')).toBeNull();
  });
});

import { act, fireEvent, render } from '@testing-library/react-native';

import { ChartTable } from '../ChartTable';
import { useHideAmounts } from '../hide-amounts-store';

describe('ChartTable', () => {
  afterEach(async () => await act(() => useHideAmounts.getState().setHidden(false)));

  test('renders a label and amount per row', async () => {
    const result = await render(<ChartTable rows={[{ label: 'Mei', values: [6800000] }]} />);
    expect(result.getByText('Mei')).toBeTruthy();
    expect(result.getByText('Rp6.800.000')).toBeTruthy();
  });

  test('hidden mode hides the nominal, not the row label', async () => {
    await act(() => useHideAmounts.getState().setHidden(true));
    const result = await render(<ChartTable rows={[{ label: 'Mei', values: [6800000] }]} />);
    expect(result.getByText('Mei')).toBeTruthy();
    expect(result.queryByText('Rp6.800.000')).toBeNull();
    expect(result.getByText('Rp••••••••')).toBeTruthy();
  });

  test('starts expanded by default; the toggle collapses and expands it', async () => {
    const result = await render(<ChartTable rows={[{ label: 'Mei', values: [6800000] }]} testID="table" />);
    expect(result.getByText('Mei')).toBeTruthy();
    const toggle = result.getByRole('button');
    expect(toggle.props.accessibilityState).toMatchObject({ expanded: true });
    expect(result.getByText('Sembunyikan tabel')).toBeTruthy();

    await fireEvent.press(toggle);
    expect(result.queryByText('Mei')).toBeNull();
    expect(result.getByText('Lihat tabel nilai')).toBeTruthy();
    expect(result.getByRole('button').props.accessibilityState).toMatchObject({ expanded: false });

    await fireEvent.press(result.getByRole('button'));
    expect(result.getByText('Mei')).toBeTruthy();
  });

  test('collapsedByDefault: starts collapsed', async () => {
    const result = await render(<ChartTable rows={[{ label: 'Mei', values: [6800000] }]} collapsedByDefault />);
    expect(result.queryByText('Mei')).toBeNull();
    expect(result.getByRole('button').props.accessibilityState).toMatchObject({ expanded: false });
  });

  test('double columns: each row shows both values, in column order', async () => {
    const columns = [{ label: 'Pemasukan', kind: 'income' as const }, { label: 'Pengeluaran', kind: 'expense' as const }];
    const result = await render(
      <ChartTable
        columns={columns}
        rows={[
          { label: 'Mei', values: [6800000, 6800000] },
          { label: 'Jun', values: [7000000, 6600000] },
        ]}
      />,
    );
    expect(result.getByText('Pemasukan')).toBeTruthy();
    expect(result.getByText('Pengeluaran')).toBeTruthy();
    expect(result.getAllByText('Rp6.800.000')).toHaveLength(2);
    expect(result.getByText('Rp7.000.000')).toBeTruthy();
    expect(result.getByText('Rp6.600.000')).toBeTruthy();
  });

  test('negative values keep the true minus sign (U+2212), for amount and percent columns alike', async () => {
    const columns = [{ format: 'amount' as const }, { format: 'percent' as const }];
    const result = await render(<ChartTable columns={columns} rows={[{ label: 'Over', values: [-38500, -500] }]} />);
    expect(result.getByText('−5,00%')).toBeTruthy();
    expect(result.getByText(/^−Rp38\.500$/)).toBeTruthy();
  });

  test('an optional total row renders with emphasis', async () => {
    const result = await render(
      <ChartTable
        rows={[{ label: 'Mei', values: [6800000] }]}
        totalRow={{ label: 'Total', values: [6800000] }}
      />,
    );
    expect(result.getByText('Total')).toBeTruthy();
    expect(result.getAllByText('Rp6.800.000')).toHaveLength(2);
  });
});

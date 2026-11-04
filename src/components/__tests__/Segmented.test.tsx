import { fireEvent, render } from '@testing-library/react-native';

import { Segmented } from '../Segmented';

const OPTIONS = [
  { value: 'expense', label: 'Pengeluaran' },
  { value: 'income', label: 'Pemasukan' },
  { value: 'transfer', label: 'Transfer' },
];

describe('Segmented', () => {
  test('role radio on every option, with the correct selected state', async () => {
    const result = await render(<Segmented options={OPTIONS} value="income" onChange={() => {}} />);
    expect(result.getByRole('radio', { name: 'Pengeluaran' }).props.accessibilityState).toMatchObject({ selected: false });
    expect(result.getByRole('radio', { name: 'Pemasukan' }).props.accessibilityState).toMatchObject({ selected: true });
    expect(result.getByRole('radio', { name: 'Transfer' }).props.accessibilityState).toMatchObject({ selected: false });
  });

  test('exactly one option is selected at a time', async () => {
    const result = await render(<Segmented options={OPTIONS} value="transfer" onChange={() => {}} />);
    const selectedCount = OPTIONS.filter(o => result.getByRole('radio', { name: o.label }).props.accessibilityState.selected).length;
    expect(selectedCount).toBe(1);
  });

  test('is 48dp tall', async () => {
    const result = await render(<Segmented options={OPTIONS} value="income" onChange={() => {}} testID="segmented" />);
    const row = result.getByTestId('segmented');
    expect(row.props.accessibilityRole).toBe('radiogroup');
    const flatStyle = Object.assign({}, ...[row.props.style].flat());
    expect(flatStyle.height).toBe(48);
  });

  test('onChange is called with the tapped option\'s value', async () => {
    const onChange = jest.fn();
    const result = await render(<Segmented options={OPTIONS} value="income" onChange={onChange} />);
    fireEvent.press(result.getByRole('radio', { name: 'Transfer' }));
    expect(onChange).toHaveBeenCalledWith('transfer');
  });

  test('disabled: onChange is never called', async () => {
    const onChange = jest.fn();
    const result = await render(<Segmented options={OPTIONS} value="income" onChange={onChange} disabled />);
    const radio = result.getByRole('radio', { name: 'Transfer' });
    expect(radio.props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(radio);
    expect(onChange).not.toHaveBeenCalled();
  });
});

import { fireEvent, render } from '@testing-library/react-native';

import { AmountField } from '../AmountField';

describe('AmountField', () => {
  test('shows the digits with thousands separators, the Rp sits in its own prefix', async () => {
    const result = await render(<AmountField value={1500000} onChangeValue={() => {}} testID="amount" />);
    expect(result.getByTestId('amount-input').props.value).toBe('1.500.000');
    expect(result.getByText('Rp')).toBeTruthy();
  });

  test('zero leaves the field empty so the 0 placeholder shows', async () => {
    const result = await render(<AmountField value={0} onChangeValue={() => {}} testID="amount" />);
    expect(result.getByTestId('amount-input').props.value).toBe('');
    expect(result.getByTestId('amount-input').props.placeholder).toBe('0');
  });

  test('typed text is stripped to digits and parsed as an int', async () => {
    const onChangeValue = jest.fn();
    const result = await render(<AmountField value={0} onChangeValue={onChangeValue} testID="amount" />);
    await fireEvent.changeText(result.getByTestId('amount-input'), 'Rp1.250.000');
    expect(onChangeValue).toHaveBeenCalledWith(1250000);
  });

  test('clearing the digits reports 0', async () => {
    const onChangeValue = jest.fn();
    const result = await render(<AmountField value={500000} onChangeValue={onChangeValue} testID="amount" />);
    await fireEvent.changeText(result.getByTestId('amount-input'), 'Rp');
    expect(onChangeValue).toHaveBeenCalledWith(0);
  });

  test('uses the number-pad keyboard', async () => {
    const result = await render(<AmountField value={0} onChangeValue={() => {}} testID="amount" />);
    expect(result.getByTestId('amount-input').props.keyboardType).toBe('number-pad');
  });

  test('error shows the message and emphasised border, same as Field', async () => {
    const result = await render(<AmountField value={0} onChangeValue={() => {}} testID="amount" error="Enter an amount above Rp0." />);
    expect(result.getByText('Enter an amount above Rp0.')).toBeTruthy();
  });

  test('disabled: not editable', async () => {
    const result = await render(<AmountField value={0} onChangeValue={() => {}} testID="amount" disabled />);
    expect(result.getByTestId('amount-input').props.editable).toBe(false);
  });
});

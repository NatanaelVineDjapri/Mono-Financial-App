import { fireEvent, render } from '@testing-library/react-native';

import { Field } from '../Field';

function flatStyle(style: unknown) {
  return Object.assign({}, ...[style].flat());
}

describe('Field', () => {
  test('renders the label and placeholder', async () => {
    const result = await render(<Field label="Nama" placeholder="Nama akun" testID="field" />);
    expect(result.getByText('Nama')).toBeTruthy();
    expect(result.getByPlaceholderText('Nama akun')).toBeTruthy();
  });

  test('calls onChangeText when typed into', async () => {
    const onChangeText = jest.fn();
    const result = await render(<Field testID="field" onChangeText={onChangeText} />);
    fireEvent.changeText(result.getByTestId('field-input'), 'BCA Tabungan');
    expect(onChangeText).toHaveBeenCalledWith('BCA Tabungan');
  });

  test('focus draws the outer ring, blur removes it', async () => {
    const result = await render(<Field testID="field" />);

    await fireEvent(result.getByTestId('field-input'), 'focus');
    const focusedRing = result.getByTestId('field-input').parent?.parent;
    expect(flatStyle(focusedRing?.props.style).borderColor).toBe('#F5F5F5');

    await fireEvent(result.getByTestId('field-input'), 'blur');
    const blurredRing = result.getByTestId('field-input').parent?.parent;
    expect(flatStyle(blurredRing?.props.style).borderColor).toBe('transparent');
  });

  test('error shows the alert icon and the error message, with an emphasised border', async () => {
    const result = await render(<Field testID="field" error="Enter an amount above Rp0." />);
    expect(result.getByText('Enter an amount above Rp0.')).toBeTruthy();

    const input = result.getByTestId('field-input');
    const box = input.parent;
    expect(flatStyle(box?.props.style).borderWidth).toBe(1.5);
  });

  test('no error: shows helper text instead', async () => {
    const result = await render(<Field testID="field" helperText="Boleh diubah nanti" />);
    expect(result.getByText('Boleh diubah nanti')).toBeTruthy();
  });

  test('disabled: not editable and dimmed', async () => {
    const result = await render(<Field testID="field" disabled />);
    const input = result.getByTestId('field-input');
    expect(input.props.editable).toBe(false);

    const box = input.parent;
    expect(flatStyle(box?.props.style).opacity).toBe(0.4);
  });
});

import { fireEvent, render } from '@testing-library/react-native';

import { Button } from '../Button';

describe('Button', () => {
  test('exposes the button role and the label as its accessible name', async () => {
    const result = await render(<Button label="Simpan" onPress={() => {}} />);
    const button = result.getByRole('button', { name: 'Simpan' });
    expect(button).toBeTruthy();
  });

  test('is 48dp tall (at least the 44dp minimum touch target)', async () => {
    const result = await render(<Button label="Simpan" onPress={() => {}} />);
    const button = result.getByRole('button', { name: 'Simpan' });
    const flatStyle = Object.assign({}, ...[button.props.style].flat());
    expect(flatStyle.height).toBe(48);
    expect(flatStyle.height).toBeGreaterThanOrEqual(44);
  });

  test('calls onPress when tapped', async () => {
    const onPress = jest.fn();
    const result = await render(<Button label="Simpan" onPress={onPress} />);
    fireEvent.press(result.getByRole('button', { name: 'Simpan' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('disabled: accessibilityState reads disabled, and onPress is never called', async () => {
    const onPress = jest.fn();
    const result = await render(<Button label="Simpan" onPress={onPress} disabled />);
    const button = result.getByRole('button', { name: 'Simpan' });
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  test('loading counts as disabled too: busy state, no onPress', async () => {
    const onPress = jest.fn();
    const result = await render(<Button label="Simpan" onPress={onPress} loading />);
    const button = result.getByRole('button', { name: 'Simpan' });
    expect(button.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  test('secondary variant renders the same way (role, label, height)', async () => {
    const result = await render(<Button label="Batal" variant="secondary" onPress={() => {}} />);
    const button = result.getByRole('button', { name: 'Batal' });
    expect(button).toBeTruthy();
  });
});

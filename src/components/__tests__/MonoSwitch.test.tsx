import { fireEvent, render } from '@testing-library/react-native';

import { MonoSwitch } from '../MonoSwitch';

describe('MonoSwitch', () => {
  test('role switch, with the correct checked state and label', async () => {
    const off = await render(<MonoSwitch value={false} onValueChange={() => {}} label="Kunci aplikasi" />);
    expect(off.getByRole('switch', { name: 'Kunci aplikasi' }).props.accessibilityState).toMatchObject({ checked: false });

    const on = await render(<MonoSwitch value onValueChange={() => {}} label="Kunci aplikasi" />);
    expect(on.getByRole('switch', { name: 'Kunci aplikasi' }).props.accessibilityState).toMatchObject({ checked: true });
  });

  test('calls onValueChange with the flipped value when tapped', async () => {
    const onValueChange = jest.fn();
    const result = await render(<MonoSwitch value={false} onValueChange={onValueChange} label="Kunci aplikasi" />);
    fireEvent.press(result.getByRole('switch', { name: 'Kunci aplikasi' }));
    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  test('disabled: onValueChange is never called', async () => {
    const onValueChange = jest.fn();
    const result = await render(<MonoSwitch value={false} onValueChange={onValueChange} label="Kunci aplikasi" disabled />);
    const switchEl = result.getByRole('switch', { name: 'Kunci aplikasi' });
    expect(switchEl.props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(switchEl);
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

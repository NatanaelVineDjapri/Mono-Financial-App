import { fireEvent, render } from '@testing-library/react-native';

import { Chip } from '../Chip';

describe('Chip', () => {
  test('selected shows the check icon, not just a colour change', async () => {
    const result = await render(<Chip label="Makanan" selected onPress={() => {}} />);
    expect(result.getByTestId('chip-check', { includeHiddenElements: true })).toBeTruthy();
  });

  test('unselected shows no check icon', async () => {
    const result = await render(<Chip label="Makanan" selected={false} onPress={() => {}} />);
    expect(result.queryByTestId('chip-check', { includeHiddenElements: true })).toBeNull();
  });

  test('role and accessibilityState.selected are correct both ways', async () => {
    const selected = await render(<Chip label="Makanan" selected onPress={() => {}} />);
    expect(selected.getByRole('button', { name: 'Makanan' }).props.accessibilityState).toMatchObject({ selected: true });

    const unselected = await render(<Chip label="Makanan" selected={false} onPress={() => {}} />);
    expect(unselected.getByRole('button', { name: 'Makanan' }).props.accessibilityState).toMatchObject({ selected: false });
  });

  test('is 40dp tall, radius 10', async () => {
    const result = await render(<Chip label="Makanan" selected={false} onPress={() => {}} />);
    const flatStyle = Object.assign({}, ...[result.getByRole('button', { name: 'Makanan' }).props.style].flat());
    expect(flatStyle.height).toBe(40);
    expect(flatStyle.borderRadius).toBe(10);
  });

  test('calls onPress when tapped', async () => {
    const onPress = jest.fn();
    const result = await render(<Chip label="Makanan" selected={false} onPress={onPress} />);
    fireEvent.press(result.getByRole('button', { name: 'Makanan' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('disabled: onPress is never called', async () => {
    const onPress = jest.fn();
    const result = await render(<Chip label="Makanan" selected={false} onPress={onPress} disabled />);
    const chip = result.getByRole('button', { name: 'Makanan' });
    expect(chip.props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(chip);
    expect(onPress).not.toHaveBeenCalled();
  });
});

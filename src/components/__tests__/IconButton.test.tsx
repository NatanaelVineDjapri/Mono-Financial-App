import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { IconButton } from '../IconButton';

describe('IconButton', () => {
  test('exposes the button role and the required label', async () => {
    const result = await render(
      <IconButton label="Tutup" onPress={() => {}}>
        <Text>x</Text>
      </IconButton>,
    );
    expect(result.getByRole('button', { name: 'Tutup' })).toBeTruthy();
  });

  test('is 44x44 (the minimum touch target)', async () => {
    const result = await render(
      <IconButton label="Tutup" onPress={() => {}}>
        <Text>x</Text>
      </IconButton>,
    );
    const button = result.getByRole('button', { name: 'Tutup' });
    const flatStyle = Object.assign({}, ...[button.props.style].flat());
    expect(flatStyle.width).toBe(44);
    expect(flatStyle.height).toBe(44);
    expect(flatStyle.height).toBeGreaterThanOrEqual(44);
  });

  test('has a hitSlop beyond its own box', async () => {
    const result = await render(
      <IconButton label="Tutup" onPress={() => {}}>
        <Text>x</Text>
      </IconButton>,
    );
    expect(result.getByRole('button', { name: 'Tutup' }).props.hitSlop).toBeTruthy();
  });

  test('calls onPress when tapped', async () => {
    const onPress = jest.fn();
    const result = await render(
      <IconButton label="Tutup" onPress={onPress}>
        <Text>x</Text>
      </IconButton>,
    );
    fireEvent.press(result.getByRole('button', { name: 'Tutup' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('disabled: accessibilityState reads disabled, and onPress is never called', async () => {
    const onPress = jest.fn();
    const result = await render(
      <IconButton label="Tutup" onPress={onPress} disabled>
        <Text>x</Text>
      </IconButton>,
    );
    const button = result.getByRole('button', { name: 'Tutup' });
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});

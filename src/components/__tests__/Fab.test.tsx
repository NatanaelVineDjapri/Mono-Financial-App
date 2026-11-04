import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Fab } from '../Fab';

describe('Fab', () => {
  test('exposes the button role and the required label', async () => {
    const result = await render(
      <Fab label="Catat lewat chat" onPress={() => {}}>
        <Text>+</Text>
      </Fab>,
    );
    expect(result.getByRole('button', { name: 'Catat lewat chat' })).toBeTruthy();
  });

  test('is 56x56, radius 16', async () => {
    const result = await render(
      <Fab label="Catat lewat chat" onPress={() => {}}>
        <Text>+</Text>
      </Fab>,
    );
    const button = result.getByRole('button', { name: 'Catat lewat chat' });
    const flatStyle = Object.assign({}, ...[button.props.style].flat());
    expect(flatStyle.width).toBe(56);
    expect(flatStyle.height).toBe(56);
    expect(flatStyle.borderRadius).toBe(16);
    expect(flatStyle.height).toBeGreaterThanOrEqual(44);
  });

  test('calls onPress when tapped', async () => {
    const onPress = jest.fn();
    const result = await render(
      <Fab label="Catat lewat chat" onPress={onPress}>
        <Text>+</Text>
      </Fab>,
    );
    fireEvent.press(result.getByRole('button', { name: 'Catat lewat chat' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('disabled: accessibilityState reads disabled, and onPress is never called', async () => {
    const onPress = jest.fn();
    const result = await render(
      <Fab label="Catat lewat chat" onPress={onPress} disabled>
        <Text>+</Text>
      </Fab>,
    );
    const button = result.getByRole('button', { name: 'Catat lewat chat' });
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});

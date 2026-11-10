import { fireEvent, render } from '@testing-library/react-native';

import { TabFab } from '../TabFab';

function flat(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
}

describe('TabFab', () => {
  test('is a labelled button that calls onPress', async () => {
    const onPress = jest.fn();
    const result = await render(<TabFab label="Add transaction by chat" onPress={onPress} testID="fab" />);
    await fireEvent.press(result.getByRole('button', { name: 'Add transaction by chat' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('64 gold circle with a flat fill (no gradient) and a 7 ring in the screen colour', async () => {
    const result = await render(<TabFab label="Add" onPress={() => {}} testID="fab" />);
    const circle = flat(result.getByTestId('fab').parent?.props.style);
    expect(circle).toMatchObject({ width: 64, height: 64, borderRadius: 32, backgroundColor: '#E3C27A' });
    const shadows = circle.boxShadow as { spreadDistance?: number; color: string }[];
    expect(shadows[0]).toMatchObject({ spreadDistance: 7, color: '#0A0A0A' });
    expect(shadows[1].color).toBe('rgba(227,194,122,0.28)');
  });
});

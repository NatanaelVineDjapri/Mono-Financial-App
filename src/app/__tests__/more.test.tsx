import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import MoreScreen from '../more';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  router: { push: jest.fn(), back: (...args: unknown[]) => mockBack(...args) },
}));

const METRICS = { insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 400, height: 800 } };

function renderMore() {
  return render(<SafeAreaProvider initialMetrics={METRICS}>{<MoreScreen />}</SafeAreaProvider>);
}

describe('MoreScreen', () => {
  beforeEach(() => mockBack.mockClear());

  test('has a title and a back arrow that goes back', async () => {
    const result = await renderMore();
    expect(result.getByRole('header', { name: 'More' })).toBeTruthy();
    await fireEvent.press(result.getByRole('button', { name: 'Back' }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  test('shows the Dev tools row in __DEV__', async () => {
    const result = await renderMore();
    expect(result.getByText('Dev tools')).toBeTruthy();
    expect(result.getByText('Sample data, reset database, adjust date.')).toBeTruthy();
  });
});

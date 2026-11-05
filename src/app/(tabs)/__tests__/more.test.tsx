import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import MoreScreen from '../more';

const METRICS = { insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 400, height: 800 } };

function renderMore() {
  return render(<SafeAreaProvider initialMetrics={METRICS}>{<MoreScreen />}</SafeAreaProvider>);
}

describe('MoreScreen', () => {
  test('shows the Dev tools row in __DEV__', async () => {
    const result = await renderMore();
    expect(result.getByText('Dev tools')).toBeTruthy();
    expect(result.getByText('Data contoh, reset database, atur ulang tanggal.')).toBeTruthy();
  });
});

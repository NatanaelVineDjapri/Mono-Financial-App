import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ScreenHeader } from '../ScreenHeader';

const METRICS = { insets: { top: 24, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 400, height: 800 } };

function renderHeader(props: Parameters<typeof ScreenHeader>[0]) {
  return render(<SafeAreaProvider initialMetrics={METRICS}>{<ScreenHeader {...props} />}</SafeAreaProvider>);
}

describe('ScreenHeader', () => {
  test('renders the title', async () => {
    const result = await renderHeader({ title: 'Akun' });
    expect(result.getByText('Akun')).toBeTruthy();
  });

  test('pads for the top safe-area inset', async () => {
    const result = await renderHeader({ title: 'Akun', testID: 'header' });
    const header = result.getByTestId('header');
    const flatStyle = Object.assign({}, ...[header.props.style].flat());
    expect(flatStyle.paddingTop).toBe(24 + 12);
  });

  test('renders an optional right-side slot', async () => {
    const result = await renderHeader({ title: 'Akun', right: <Text>Aksi</Text> });
    expect(result.getByText('Aksi')).toBeTruthy();
  });
});

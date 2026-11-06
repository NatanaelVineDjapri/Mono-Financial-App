import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ScreenHeader } from '../ScreenHeader';
import { MonoText } from '@/theme/typography';

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

  test('defaults to the serif titleL style', async () => {
    const result = await renderHeader({ title: 'Akun' });
    const flatStyle = Object.assign({}, ...[result.getByText('Akun').props.style].flat());
    expect(flatStyle.fontFamily).toBe(MonoText.titleL.fontFamily);
  });

  test('serif={false} uses the plain titleM style instead (CLAUDE.md rule 6: one serif moment per screen)', async () => {
    const result = await renderHeader({ title: 'Akun', serif: false });
    const flatStyle = Object.assign({}, ...[result.getByText('Akun').props.style].flat());
    expect(flatStyle.fontFamily).toBe(MonoText.titleM.fontFamily);
  });
});

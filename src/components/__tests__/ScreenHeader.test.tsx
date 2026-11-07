import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { MonoText } from '@/theme/typography';
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

  test('right-side actions sit in a row 8 apart and never shrink; the title is what wraps', async () => {
    const result = await renderHeader({ title: 'Budgets', right: <Text>Aksi</Text> });
    const row = result.getByText('Aksi').parent!;
    const rowStyle = Object.assign({}, ...[row.props.style].flat());
    expect(rowStyle).toMatchObject({ flexDirection: 'row', gap: 8, flexShrink: 0 });
    const titleStyle = Object.assign({}, ...[result.getByText('Budgets').props.style].flat());
    expect(titleStyle.flexShrink).toBe(1);
    expect(result.getByText('Budgets').props.numberOfLines).toBeUndefined();
  });

  test('a per-screen style overrides spacing but never the safe-area top padding', async () => {
    const result = await renderHeader({ title: 'Budgets', testID: 'header', style: { paddingRight: 16, paddingBottom: 12, paddingTop: 0 } });
    const flatStyle = Object.assign({}, ...[result.getByTestId('header').props.style].flat());
    expect(flatStyle).toMatchObject({ paddingRight: 16, paddingBottom: 12, paddingTop: 24 + 12 });
  });

  test('always uses the serif titleL style (CLAUDE.md rule 6: screen titles are serif)', async () => {
    const result = await renderHeader({ title: 'Akun' });
    const flatStyle = Object.assign({}, ...[result.getByText('Akun').props.style].flat());
    expect(flatStyle.fontFamily).toBe(MonoText.titleL.fontFamily);
    expect(flatStyle.fontSize).toBe(MonoText.titleL.fontSize);
    expect(flatStyle.lineHeight).toBe(MonoText.titleL.lineHeight);
  });
});

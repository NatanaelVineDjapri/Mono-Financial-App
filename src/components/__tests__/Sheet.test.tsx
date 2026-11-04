import { fireEvent, render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Sheet } from '../Sheet';

// Sheet reads safe-area insets; outside a real app tree these need a provider with
// fixed metrics so tests don't depend on async native measurement.
const METRICS = { insets: { top: 0, right: 0, bottom: 34, left: 0 }, frame: { x: 0, y: 0, width: 390, height: 844 } };
function renderSheet(children: ReactElement) {
  return render(<SafeAreaProvider initialMetrics={METRICS}>{children}</SafeAreaProvider>);
}

describe('Sheet', () => {
  test('not visible and never opened: renders nothing', async () => {
    const result = await renderSheet(
      <Sheet visible={false} onClose={() => {}} closeLabel="Tutup" testID="sheet">
        <Text>Isi sheet</Text>
      </Sheet>,
    );
    expect(result.queryByTestId('sheet')).toBeNull();
    expect(result.queryByText('Isi sheet')).toBeNull();
  });

  test('visible: renders the children and a dismiss target over the scrim', async () => {
    const result = await renderSheet(
      <Sheet visible onClose={() => {}} closeLabel="Tutup" testID="sheet">
        <Text>Isi sheet</Text>
      </Sheet>,
    );
    expect(result.getByTestId('sheet')).toBeTruthy();
    expect(result.getByText('Isi sheet')).toBeTruthy();
    // accessibilityViewIsModal on the panel correctly makes the scrim's own
    // accessibilityLabel unreachable to role queries (a modal shadows its siblings on
    // iOS) — so the touch target is confirmed by testID, and the label by its raw prop.
    expect(result.getByTestId('sheet-scrim', { includeHiddenElements: true }).props.accessibilityLabel).toBe('Tutup');
  });

  test('tapping the scrim calls onClose', async () => {
    const onClose = jest.fn();
    const result = await renderSheet(
      <Sheet visible onClose={onClose} closeLabel="Tutup" testID="sheet">
        <Text>Isi sheet</Text>
      </Sheet>,
    );
    await fireEvent.press(result.getByTestId('sheet-scrim', { includeHiddenElements: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('the panel is marked as a modal view for accessibility', async () => {
    const result = await renderSheet(
      <Sheet visible onClose={() => {}} closeLabel="Tutup" testID="sheet">
        <Text testID="content">Isi sheet</Text>
      </Sheet>,
    );
    const panel = result.getByTestId('content').parent;
    expect(panel?.props.accessibilityViewIsModal).toBe(true);
  });
});

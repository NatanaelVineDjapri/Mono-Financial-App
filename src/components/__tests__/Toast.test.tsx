import { fireEvent, render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Toast } from '../Toast';

const METRICS = { insets: { top: 0, right: 0, bottom: 34, left: 0 }, frame: { x: 0, y: 0, width: 390, height: 844 } };
function renderToast(children: ReactElement) {
  return render(<SafeAreaProvider initialMetrics={METRICS}>{children}</SafeAreaProvider>);
}

describe('Toast', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('not visible and never shown: renders nothing', async () => {
    const result = await renderToast(<Toast visible={false} message="Tersimpan." onDismiss={() => {}} testID="toast" />);
    expect(result.queryByText('Tersimpan.')).toBeNull();
  });

  test('visible: shows the message as a polite live region', async () => {
    const result = await renderToast(<Toast visible message="Tersimpan." onDismiss={() => {}} testID="toast" />);
    const text = result.getByText('Tersimpan.');
    expect(text.props.accessibilityLiveRegion).toBe('polite');
  });

  test('with an actionLabel: shows the action, without: no action is rendered', async () => {
    const withAction = await renderToast(<Toast visible message="Tersimpan." actionLabel="Urungkan" onDismiss={() => {}} testID="toast" />);
    expect(withAction.getByRole('button', { name: 'Urungkan' })).toBeTruthy();

    const withoutAction = await renderToast(<Toast visible message="Tersimpan." onDismiss={() => {}} testID="toast" />);
    expect(withoutAction.queryByRole('button')).toBeNull();
  });

  test('tapping the action calls onAction and dismisses', async () => {
    const onAction = jest.fn();
    const onDismiss = jest.fn();
    const result = await renderToast(
      <Toast visible message="Tersimpan." actionLabel="Urungkan" onAction={onAction} onDismiss={onDismiss} testID="toast" />,
    );
    await fireEvent.press(result.getByRole('button', { name: 'Urungkan' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  test('auto-dismisses after the duration', async () => {
    const onDismiss = jest.fn();
    await renderToast(<Toast visible message="Tersimpan." onDismiss={onDismiss} duration={4000} testID="toast" />);
    expect(onDismiss).not.toHaveBeenCalled();
    jest.advanceTimersByTime(4000);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  test('does not auto-dismiss before the duration elapses', async () => {
    const onDismiss = jest.fn();
    await renderToast(<Toast visible message="Tersimpan." onDismiss={onDismiss} duration={4000} testID="toast" />);
    jest.advanceTimersByTime(3999);
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

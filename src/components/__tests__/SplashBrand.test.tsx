// The brand splash stays up until the first screen has settled, releases the native splash as soon as it is drawn, and always goes
// by the hard timeout.
import { act, fireEvent, render } from '@testing-library/react-native';

import { APP_READY_TIMEOUT_MS, markAppReady, resetAppReady } from '@/core/appReady';

import { SplashBrand } from '../SplashBrand';

const mockHideAsync = jest.fn(() => Promise.resolve());
jest.mock('expo-splash-screen', () => ({ hideAsync: () => mockHideAsync() }));
jest.mock('expo-image', () => ({ Image: () => null }));

beforeEach(() => {
  jest.useFakeTimers();
  resetAppReady();
  mockHideAsync.mockClear();
});
afterEach(() => jest.useRealTimers());

describe('SplashBrand', () => {
  test('is drawn at the start and lets the native splash go once it has been laid out, once', async () => {
    const view = await render(<SplashBrand />);
    const overlay = view.getByTestId('splash-brand');
    await fireEvent(overlay, 'layout', { nativeEvent: { layout: { width: 400, height: 800 } } });
    await fireEvent(overlay, 'layout', { nativeEvent: { layout: { width: 400, height: 800 } } });
    expect(mockHideAsync).toHaveBeenCalledTimes(1);
    expect(view.queryByTestId('splash-brand')).toBeTruthy(); // the native one is gone, this one stays
  });

  test('stays while the first screen is still being read, and goes the moment it has settled', async () => {
    const view = await render(<SplashBrand />);
    await act(async () => jest.advanceTimersByTime(APP_READY_TIMEOUT_MS - 100));
    expect(view.queryByTestId('splash-brand')).toBeTruthy();
    await act(async () => markAppReady());
    expect(view.queryByTestId('splash-brand')).toBeNull();
  });

  test('goes by itself after the hard maximum when nothing marked the app ready', async () => {
    const view = await render(<SplashBrand />);
    await act(async () => jest.advanceTimersByTime(APP_READY_TIMEOUT_MS));
    expect(view.queryByTestId('splash-brand')).toBeNull();
  });

  test('a failing native hide does not matter', async () => {
    mockHideAsync.mockImplementationOnce(() => Promise.reject(new Error('already hidden')));
    const view = await render(<SplashBrand />);
    await expect(
      fireEvent(view.getByTestId('splash-brand'), 'layout', { nativeEvent: { layout: { width: 1, height: 1 } } }),
    ).resolves.not.toThrow();
  });
});

// A first screen that is not the Overview (a deep link, a tapped notification) lifts the splash once it is on screen; the Overview
// itself does not (it marks the app ready when its own data is in).
import { act, render } from '@testing-library/react-native';

import { resetAppReady, useAppReady } from '@/core/appReady';

import { ReadyOnOtherRoute } from '../ReadyOnOtherRoute';

let mockPathname = '/';
jest.mock('expo-router', () => ({ usePathname: () => mockPathname }));

beforeEach(() => {
  jest.useFakeTimers();
  resetAppReady();
  mockPathname = '/';
});
afterEach(() => jest.useRealTimers());

describe('ReadyOnOtherRoute', () => {
  test('on the Overview ("/") it leaves the splash to the Overview', async () => {
    await render(<ReadyOnOtherRoute />);
    await act(async () => jest.advanceTimersByTime(1000));
    expect(useAppReady.getState().ready).toBe(false);
  });

  test('on any other route it lifts the splash after a frame', async () => {
    mockPathname = '/nfc/scan';
    await render(<ReadyOnOtherRoute />);
    await act(async () => jest.advanceTimersByTime(100));
    expect(useAppReady.getState().ready).toBe(true);
  });

  test('moving from the Overview to another route lifts it then', async () => {
    const view = await render(<ReadyOnOtherRoute />);
    expect(useAppReady.getState().ready).toBe(false);
    mockPathname = '/recurring';
    await view.rerender(<ReadyOnOtherRoute />);
    await act(async () => jest.advanceTimersByTime(100));
    expect(useAppReady.getState().ready).toBe(true);
  });
});

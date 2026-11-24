// A tap on a reminder that opened the app (it was closed) is acted on only once the first screen has settled: a push made while
// the first screen was still being built left a white screen that never went away (release build, tapping a reminder with the
// app closed). A tap while the app is running is acted on at once.
import { act, render } from '@testing-library/react-native';

import { markAppReady, resetAppReady } from '@/core/appReady';

import { COLD_START_TAP_DELAY_MS, NotificationsInit } from '../NotificationsInit';

const mockPush = jest.fn();
let mockNavigationKey: string | undefined = 'root';
let mockLastResponse: unknown = null;
let mockLiveListener: ((response: unknown) => void) | null = null;

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useRootNavigationState: () => (mockNavigationKey ? { key: mockNavigationKey } : undefined),
}));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getLastNotificationResponseAsync: jest.fn(async () => mockLastResponse),
  addNotificationResponseReceivedListener: jest.fn((listener: (response: unknown) => void) => {
    mockLiveListener = listener;
    return { remove: jest.fn() };
  }),
}));
jest.mock('@/data/db/DbProvider', () => ({ useDb: () => ({}) }));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: jest.fn() }) }));
jest.mock('@/data/repo/notifications', () => ({ markRead: jest.fn(), pruneNotifications: jest.fn(async () => undefined) }));
jest.mock('../scheduler', () => ({
  scheduleSync: jest.fn(),
  setupNotificationChannels: jest.fn(async () => undefined),
  syncNotifications: jest.fn(async () => undefined),
}));

const response = (kind: string) => ({ notification: { request: { content: { data: { kind, key: 'k' } } } } });

beforeEach(() => {
  jest.useFakeTimers();
  mockPush.mockClear();
  mockNavigationKey = 'root';
  mockLastResponse = null;
  mockLiveListener = null;
  resetAppReady();
});
afterEach(() => jest.useRealTimers());

describe('NotificationsInit: the tap that opened the app', () => {
  test('nothing is pushed while the first screen is still being built', async () => {
    mockLastResponse = response('daily');
    await render(<NotificationsInit />);
    await act(async () => jest.advanceTimersByTime(5000));
    expect(mockPush).not.toHaveBeenCalled();
  });

  test('once the first screen has settled, the reminder opens its screen', async () => {
    mockLastResponse = response('daily');
    await render(<NotificationsInit />);
    await act(async () => markAppReady());
    await act(async () => jest.advanceTimersByTime(COLD_START_TAP_DELAY_MS + 50));
    expect(mockPush).toHaveBeenCalledWith('/tx/add');
  });

  test('each kind goes where it should', async () => {
    mockLastResponse = response('bill_due');
    await render(<NotificationsInit />);
    await act(async () => markAppReady());
    await act(async () => jest.advanceTimersByTime(COLD_START_TAP_DELAY_MS + 50));
    expect(mockPush).toHaveBeenCalledWith('/recurring');
  });

  test('without a tap that opened the app, nothing is pushed', async () => {
    await render(<NotificationsInit />);
    await act(async () => markAppReady());
    await act(async () => jest.advanceTimersByTime(COLD_START_TAP_DELAY_MS + 50));
    expect(mockPush).not.toHaveBeenCalled();
  });

  test('before the navigator exists nothing is asked at all', async () => {
    mockNavigationKey = undefined;
    mockLastResponse = response('daily');
    await render(<NotificationsInit />);
    await act(async () => markAppReady());
    await act(async () => jest.advanceTimersByTime(COLD_START_TAP_DELAY_MS + 50));
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe('NotificationsInit: a tap while the app is running', () => {
  test('goes at once, without waiting', async () => {
    await render(<NotificationsInit />);
    await act(async () => mockLiveListener?.(response('backup')));
    expect(mockPush).toHaveBeenCalledWith('/backup');
  });
});

// When the app opens: first what the service kept, then what is still in the notification shade; an unbound service is
// asked back before the shade is read.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react-native';

import { ImportSync } from '../ImportSync';

const mockPush = jest.fn();
const mockNative = {
  drainQueue: jest.fn(() => [{ package: 'kept' }]),
  getActiveAllowed: jest.fn(() => [{ package: 'shade' }]),
  isAccessEnabled: jest.fn(() => true),
  isConnected: jest.fn(() => true),
  requestRebind: jest.fn(),
  restartService: jest.fn(),
  addNotificationListener: jest.fn(() => ({ remove: jest.fn() })),
};
jest.mock('../notifications/native', () => ({
  drainQueue: () => mockNative.drainQueue(),
  getActiveAllowed: () => mockNative.getActiveAllowed(),
  isAccessEnabled: () => mockNative.isAccessEnabled(),
  isConnected: () => mockNative.isConnected(),
  requestRebind: () => mockNative.requestRebind(),
  restartService: () => mockNative.restartService(),
  addNotificationListener: () => mockNative.addNotificationListener(),
}));
jest.mock('../notifications/sync', () => ({ syncImportApps: async () => ({ recorded: 0, allowed: [] }) }));
jest.mock('../ingest', () => ({ createIngestor: () => ({ push: mockPush }), prune: async () => undefined }));
jest.mock('@/data/db/DbProvider', () => ({ useDb: () => ({}) }));
jest.mock('@/core/appReady', () => ({ runAfterReady: (work: () => void) => (work(), () => undefined) }));

const open = async () => {
  await render(
    <QueryClientProvider client={new QueryClient()}>
      <ImportSync />
    </QueryClientProvider>,
  );
  await act(async () => undefined);
};

beforeEach(() => {
  jest.clearAllMocks();
  mockNative.isConnected.mockReturnValue(true);
});

test('the kept notifications go first, then the ones still showing, marked as possibly seen before', async () => {
  await open();
  expect(mockPush.mock.calls).toEqual([[{ package: 'kept' }, { seenAgain: false }], [{ package: 'shade' }, { seenAgain: true }]]);
  expect(mockNative.requestRebind).not.toHaveBeenCalled();
});

test('a service that does not come back when asked is restarted', async () => {
  jest.useFakeTimers();
  mockNative.isConnected.mockReturnValue(false);
  await open();
  expect(mockNative.restartService).not.toHaveBeenCalled();
  await act(async () => jest.advanceTimersByTime(1500));
  expect(mockNative.restartService).toHaveBeenCalledTimes(1);
  await act(async () => jest.advanceTimersByTime(1500));
  expect(mockPush).toHaveBeenLastCalledWith({ package: 'shade' }, { seenAgain: true });
  jest.useRealTimers();
});

test('an unbound service is asked back, and the shade is read once it had time to return', async () => {
  jest.useFakeTimers();
  mockNative.isConnected.mockReturnValue(false);
  await open();
  expect(mockNative.requestRebind).toHaveBeenCalledTimes(1);
  expect(mockNative.getActiveAllowed).not.toHaveBeenCalled();
  mockNative.isConnected.mockReturnValue(true); // Android bound it again
  await act(async () => jest.advanceTimersByTime(1500));
  expect(mockNative.restartService).not.toHaveBeenCalled();
  expect(mockPush).toHaveBeenLastCalledWith({ package: 'shade' }, { seenAgain: true });
  jest.useRealTimers();
});

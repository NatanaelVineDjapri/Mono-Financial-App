import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getSetting } from '@/data/repo/settings';
import { LockGate } from '../LockGate';
import { useLock } from '../useLock';

jest.mock('expo-linking', () => ({
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  getInitialURL: jest.fn(async () => null),
  parse: jest.fn((url: string) => ({ path: url })),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => ({ push: mockPush }),
}));

const mockDb = {};
jest.mock('@/data/db/DbProvider', () => ({
  useDb: () => mockDb,
}));

jest.mock('@/data/repo/settings', () => ({
  getSetting: jest.fn(async () => '1'),
}));

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(async () => true),
  isEnrolledAsync: jest.fn(async () => true),
  getEnrolledLevelAsync: jest.fn(async () => 1),
  // Default to user_cancel so auto-prompt stays on LockScreen unless unlocked in test
  authenticateAsync: jest.fn(async () => ({ success: false, error: 'user_cancel' })),
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC: 2 },
}));

let appStateListeners: ((state: string) => void)[] = [];
jest.spyOn(AppState, 'addEventListener').mockImplementation((event, listener) => {
  if (event === 'change') {
    appStateListeners.push(listener);
  }
  return {
    remove: () => {
      appStateListeners = appStateListeners.filter(l => l !== listener);
    },
  } as never;
});

const METRICS = { insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 390, height: 844 } };

async function renderGate(autoPrompt = false) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider initialMetrics={METRICS}>
        <LockGate autoPrompt={autoPrompt}>
          <Text testID="app-content">App Content Protected</Text>
        </LockGate>
      </SafeAreaProvider>
    </QueryClientProvider>,
  );
}

describe('LockGate', () => {
  beforeEach(() => {
    appStateListeners = [];
    useLock.getState().reset();
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  test('cold start with app_lock on: renders LockScreen, does NOT mount child content', async () => {
    (getSetting as jest.Mock).mockResolvedValue('1');

    const screen = await renderGate();

    await waitFor(() => {
      expect(useLock.getState().status).toBe('locked');
      expect(screen.getByTestId('lock-screen')).toBeTruthy();
    });

    expect(screen.queryByTestId('app-content')).toBeNull();
  });

  test('cold start with app_lock off: mounts child content directly', async () => {
    (getSetting as jest.Mock).mockResolvedValue('0');

    const screen = await renderGate();

    await waitFor(() => {
      expect(useLock.getState().status).toBe('unlocked');
      expect(screen.getByTestId('app-content')).toBeTruthy();
    });

    expect(screen.queryByTestId('lock-screen')).toBeNull();
  });

  test('unlocking mounts child content and navigates to pending deep link', async () => {
    (getSetting as jest.Mock).mockResolvedValue('1');

    const screen = await renderGate();

    await waitFor(() => {
      expect(screen.getByTestId('lock-screen')).toBeTruthy();
    });

    // Deep link received while locked
    await act(async () => {
      useLock.getState().setPendingTarget('mono://tx/42');
    });

    // Directly unlock the store (as would happen after biometrics)
    await act(async () => {
      useLock.getState().unlock();
    });

    await waitFor(() => {
      expect(screen.getByTestId('app-content')).toBeTruthy();
      expect(screen.queryByTestId('lock-screen')).toBeNull();
      expect(mockPush).toHaveBeenCalledWith('/tx/42');
    });
  });

  test('backgrounding for 30s locks app; suspended prevents locking', async () => {
    (getSetting as jest.Mock).mockResolvedValue('1');

    const screen = await renderGate();

    await waitFor(() => {
      expect(useLock.getState().status).toBe('locked');
    });

    // Start unlocked
    await act(async () => {
      useLock.getState().unlock();
    });
    await waitFor(() => {
      expect(screen.getByTestId('app-content')).toBeTruthy();
    });

    // Simulate backgrounding at T0
    const now = 1000000;
    jest.spyOn(Date, 'now').mockReturnValue(now);
    await act(async () => {
      appStateListeners.forEach(l => l('background'));
    });
    expect(useLock.getState().backgroundedAt).toBe(now);

    // Come back 31s later without suspended -> locks!
    jest.spyOn(Date, 'now').mockReturnValue(now + 31000);
    await act(async () => {
      appStateListeners.forEach(l => l('active'));
    });

    await waitFor(() => {
      expect(useLock.getState().status).toBe('locked');
      expect(screen.getByTestId('lock-screen')).toBeTruthy();
      expect(screen.queryByTestId('app-content')).toBeNull();
    });

    // Now test with suspended:
    await act(async () => {
      useLock.getState().unlock();
      useLock.getState().setSuspended(true);
      useLock.getState().setBackgroundedAt(now);
    });

    jest.spyOn(Date, 'now').mockReturnValue(now + 60000);
    await act(async () => {
      appStateListeners.forEach(l => l('active'));
    });

    // Should NOT lock because suspended is true
    expect(useLock.getState().status).toBe('unlocked');
    await waitFor(() => {
      expect(screen.getByTestId('app-content')).toBeTruthy();
    });
  });
});

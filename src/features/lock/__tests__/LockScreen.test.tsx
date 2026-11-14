import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { BackHandler, Linking } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { setSetting } from '@/data/repo/settings';
import { LockScreen } from '../LockScreen';
import { useLock } from '../useLock';

jest.mock('@/data/db/DbProvider', () => ({
  useDb: () => ({}),
}));

jest.mock('@/data/repo/settings', () => ({
  setSetting: jest.fn(async () => {}),
}));

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(async () => true),
  isEnrolledAsync: jest.fn(async () => true),
  getEnrolledLevelAsync: jest.fn(async () => 1),
  authenticateAsync: jest.fn(async () => ({ success: true })),
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC: 2 },
}));

const METRICS = { insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 390, height: 844 } };

async function renderLockScreen(autoPrompt = false) {
  const queryClient = new QueryClient();
  return await render(
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider initialMetrics={METRICS}>
        <LockScreen autoPrompt={autoPrompt} />
      </SafeAreaProvider>
    </QueryClientProvider>,
  );
}

describe('LockScreen', () => {
  beforeEach(() => {
    useLock.getState().reset();
    useLock.getState().lock();
    jest.clearAllMocks();
  });

  test('renders lockup, title, subtext, buttons, and footer note', async () => {
    const screen = await renderLockScreen();

    expect(screen.getByText('MONO Finance')).toBeTruthy();
    expect(screen.getByText('Buka dengan sidik jari atau PIN perangkat.')).toBeTruthy();
    expect(screen.getByTestId('lock-fingerprint-btn')).toBeTruthy();
    expect(screen.getByTestId('lock-unlock-btn')).toBeTruthy();
    expect(screen.getByText('Dikunci otomatis setelah 30 detik di latar belakang.')).toBeTruthy();
  });

  test('successful authentication unlocks the app', async () => {
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValueOnce({ success: true });

    const screen = await renderLockScreen();
    await fireEvent.press(screen.getByTestId('lock-unlock-btn'));

    await waitFor(() => {
      expect(useLock.getState().status).toBe('unlocked');
    });
  });

  test('failed authentication displays Lock-Failed message', async () => {
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValueOnce({
      success: false,
      error: 'not_recognized',
    });

    const screen = await renderLockScreen();
    await fireEvent.press(screen.getByTestId('lock-unlock-btn'));

    await waitFor(() => {
      expect(
        screen.getByText('Sidik jari tidak dikenali. Coba lagi atau pakai PIN perangkat.'),
      ).toBeTruthy();
    });
    expect(useLock.getState().status).toBe('locked');
  });

  test('user cancel returns to normal without error message', async () => {
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValueOnce({
      success: false,
      error: 'user_cancel',
    });

    const screen = await renderLockScreen();
    await fireEvent.press(screen.getByTestId('lock-unlock-btn'));

    await waitFor(() => {
      expect(screen.getByText('Buka dengan sidik jari atau PIN perangkat.')).toBeTruthy();
    });
    expect(screen.queryByText('Sidik jari tidak dikenali. Coba lagi atau pakai PIN perangkat.')).toBeNull();
  });

  test('system lockout displays lockout message and disables buttons', async () => {
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValueOnce({
      success: false,
      error: 'lockout',
    });

    const screen = await renderLockScreen();
    await fireEvent.press(screen.getByTestId('lock-unlock-btn'));

    await waitFor(() => {
      expect(screen.getByText('Terlalu banyak percobaan. Coba lagi sebentar.')).toBeTruthy();
    });
    expect(useLock.getState().failedReason).toBe('lockout');
  });

  test('device without lock screen offers settings and disable option', async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValueOnce(false);

    const screen = await renderLockScreen();

    await waitFor(() => {
      expect(screen.getByText('Perangkat ini tidak punya kunci layar lagi.')).toBeTruthy();
    });

    expect(screen.getByTestId('lock-open-settings-btn')).toBeTruthy();
    expect(screen.getByTestId('lock-disable-btn')).toBeTruthy();

    const openSettingsSpy = jest.spyOn(Linking, 'openSettings').mockImplementation(async () => {});
    await fireEvent.press(screen.getByTestId('lock-open-settings-btn'));
    expect(openSettingsSpy).toHaveBeenCalled();

    // Disable lock
    await fireEvent.press(screen.getByTestId('lock-disable-btn'));
    expect(setSetting).toHaveBeenCalledWith(expect.anything(), 'app_lock', '0');
    expect(useLock.getState().status).toBe('unlocked');
  });

  test('hardware back press calls BackHandler.exitApp', async () => {
    const exitSpy = jest.spyOn(BackHandler, 'exitApp').mockImplementation(() => {});
    const addListenerSpy = jest.spyOn(BackHandler, 'addEventListener');

    await renderLockScreen();

    const handler = addListenerSpy.mock.calls.find(call => call[0] === 'hardwareBackPress')?.[1];
    expect(handler).toBeDefined();
    // @ts-expect-error handler call
    handler();

    expect(exitSpy).toHaveBeenCalled();
  });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useNeedsWelcome } from '../useNeedsWelcome';
import { finishWelcome } from '../welcomeState';
import { WelcomeView } from '../WelcomeView';

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => ({ replace: mockReplace, push: mockPush, back: jest.fn() }),
}));
jest.mock('@/data/db/DbProvider', () => ({ useDb: () => ({}) }));
jest.mock('../useNeedsWelcome');
jest.mock('../welcomeState', () => ({ ...jest.requireActual('../welcomeState'), finishWelcome: jest.fn(async () => {}) }));
jest.mock('@/components/toast-store', () => ({ showToast: jest.fn() }));
jest.mock('../MascotVideo', () => ({ MascotVideo: () => null }));

const mockNeeds = useNeedsWelcome as jest.MockedFunction<typeof useNeedsWelcome>;
const mockFinish = finishWelcome as jest.MockedFunction<typeof finishWelcome>;

const METRICS = { insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 390, height: 844 } };

async function open() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return await render(
    <QueryClientProvider client={client}>
      <SafeAreaProvider initialMetrics={METRICS}>
        <WelcomeView />
      </SafeAreaProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockNeeds.mockReturnValue(true);
});

test('the board: title, line, three promises, nickname, Mulai and the restore link', async () => {
  await open();
  expect(screen.getByText('Selamat datang di MONO')).toBeTruthy();
  expect(screen.getByText('Catat uang, pantau anggaran, dan lihat kekayaan bersihmu. Semuanya tersimpan di ponsel ini.')).toBeTruthy();
  expect(screen.getByText('Hanya di perangkat ini. Tanpa akun, tanpa sinkronisasi.')).toBeTruthy();
  expect(screen.getByText('Tanpa login bank atau nomor kartu.')).toBeTruthy();
  expect(screen.getByText('Semua angka dihitung dari catatanmu.')).toBeTruthy();
  expect(screen.getByText('Nama panggilan')).toBeTruthy();
  expect(screen.getByText('Opsional')).toBeTruthy();
  expect(screen.getByText('Hanya dipakai untuk sapaan di layar Overview.')).toBeTruthy();
  expect(screen.getByText('Mulai')).toBeTruthy();
  expect(screen.getByLabelText('Punya berkas cadangan? Pulihkan')).toBeTruthy();
});

test('Mulai saves the nickname and goes to the Overview, replacing Welcome', async () => {
  await open();
  await fireEvent.changeText(screen.getByTestId('welcome-nickname-input'), 'Nael');
  await fireEvent.press(screen.getByTestId('welcome-start'));
  expect(mockFinish).toHaveBeenCalledWith(expect.anything(), 'Nael');
  expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
});

test('Mulai works with no nickname at all', async () => {
  await open();
  await fireEvent.press(screen.getByTestId('welcome-start'));
  expect(mockFinish).toHaveBeenCalledWith(expect.anything(), '');
  expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
});

test('"Punya berkas cadangan? Pulihkan" opens Backup', async () => {
  await open();
  await fireEvent.press(screen.getByTestId('welcome-restore'));
  expect(mockPush).toHaveBeenCalledWith('/backup');
});

test('the nickname is limited to 24 characters', async () => {
  await open();
  expect(screen.getByTestId('welcome-nickname-input').props.maxLength).toBe(24);
});

test('when data has appeared (a restore), Welcome steps aside by itself', async () => {
  mockNeeds.mockReturnValue(false);
  await open();
  expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
});

test('while it is still reading, nothing navigates', async () => {
  mockNeeds.mockReturnValue(undefined);
  await open();
  expect(mockReplace).not.toHaveBeenCalled();
});

test('a failed save keeps the person here with a message, not on a blank screen', async () => {
  mockFinish.mockRejectedValueOnce(new Error('disk'));
  await open();
  await fireEvent.press(screen.getByTestId('welcome-start'));
  expect(mockReplace).not.toHaveBeenCalled();
  expect(require('@/components/toast-store').showToast).toHaveBeenCalledWith('Belum bisa menyimpan. Coba lagi.');
});

test('the system back button leaves the app instead of returning to the tabs', async () => {
  const exit = jest.spyOn(BackHandler, 'exitApp').mockImplementation(() => {});
  let handler: (() => boolean) | undefined;
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, cb) => {
    handler = cb as () => boolean;
    return { remove: jest.fn() };
  });
  await open();
  await act(async () => {
    expect(handler?.()).toBe(true);
  });
  expect(exit).toHaveBeenCalled();
});

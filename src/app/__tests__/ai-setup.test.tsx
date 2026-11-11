import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import { Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { showToast } from '@/components/toast-store';
import { testKey } from '@/features/ai_chat/client';
import { clearKey, hasKey, saveKey } from '@/features/ai_chat/keystore';
import { getSetting, setSetting } from '@/data/repo/settings';

import AiSetupScreen from '../ai-setup';

jest.mock('@/data/db/DbProvider', () => ({ useDb: () => ({ fake: 'db' }) }));
jest.mock('@/data/repo/settings', () => ({ getSetting: jest.fn(async () => null), setSetting: jest.fn(async () => {}) }));
jest.mock('@/features/ai_chat/keystore', () => ({ hasKey: jest.fn(async () => false), getKey: jest.fn(async () => null), saveKey: jest.fn(async () => {}), clearKey: jest.fn(async () => {}) }));
jest.mock('@/features/ai_chat/client', () => ({ ...jest.requireActual('@/features/ai_chat/client'), testKey: jest.fn() }));
jest.mock('expo-clipboard', () => ({ getStringAsync: jest.fn(async () => 'AIzaPASTED-KEY-123') }));
jest.mock('expo-screen-capture', () => ({ preventScreenCaptureAsync: jest.fn(async () => {}), allowScreenCaptureAsync: jest.fn(async () => {}) }));
jest.mock('@/components/toast-store', () => ({ showToast: jest.fn() }));

const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => ({ replace: mockReplace, back: mockBack, push: jest.fn() }),
}));

const mockTestKey = testKey as jest.MockedFunction<typeof testKey>;
const mockHasKey = hasKey as jest.MockedFunction<typeof hasKey>;
const mockSaveKey = saveKey as jest.MockedFunction<typeof saveKey>;
const mockSetSetting = setSetting as jest.MockedFunction<typeof setSetting>;
const mockGetSetting = getSetting as jest.MockedFunction<typeof getSetting>;

const METRICS = { insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 390, height: 844 } };
const clients: QueryClient[] = [];

async function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 } } });
  clients.push(client);
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <QueryClientProvider client={client}>
        <AiSetupScreen />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

const disabled = (el: { props: { accessibilityState?: { disabled?: boolean } } }) => el.props.accessibilityState?.disabled === true;
const KEY = 'AIzaSyGOOD-KEY-0123456789';

afterEach(() => {
  clients.splice(0).forEach(c => c.clear());
});

beforeEach(() => {
  jest.clearAllMocks();
  mockHasKey.mockResolvedValue(false);
  mockGetSetting.mockResolvedValue(null);
});

describe('K1: what the screen says', () => {
  test('title, optional-feature label, one paragraph, and the two halves of the disclosure', async () => {
    const screen = await renderScreen();
    expect(screen.getByRole('header', { name: 'Catat lewat chat' })).toBeTruthy();
    expect(screen.getByText('FITUR OPSIONAL')).toBeTruthy();
    expect(screen.getByText(/Kamu cek, lalu simpan/)).toBeTruthy();

    for (const text of ['DIKIRIM KE GEMINI', 'Pesan yang kamu ketik', 'Nama akun dan nama kategori, supaya draf cocok dengan datamu', 'Tanggal hari ini', 'TIDAK DIKIRIM', 'Saldo, riwayat transaksi, anggaran, dan target', 'Berkas cadangan']) {
      expect(screen.getByText(text)).toBeTruthy();
    }
  });

  test('the notes: Google AI Studio, only on the phone (Keystore), no server; the billing and internet warning', async () => {
    const screen = await renderScreen();
    expect(screen.getByText(/Dibuat di Google AI Studio\. Disimpan hanya di ponsel ini \(Android Keystore\)\. MONO tidak punya server/)).toBeTruthy();
    expect(screen.getByText(/Pesanmu diproses lewat API key-mu\. Pemakaian mengikuti kuota atau tagihan tersebut\. Fitur ini perlu internet/)).toBeTruthy();
    expect(screen.getByText(/Tes mengirim satu pesan singkat\. Tidak ada data keuangan/)).toBeTruthy();
  });

  test('"Nanti saja" goes back and saves nothing', async () => {
    const screen = await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Nanti saja' }));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockSaveKey).not.toHaveBeenCalled();
    expect(mockTestKey).not.toHaveBeenCalled();
  });
});

describe('the key field', () => {
  test('it is masked, has an eye to show it, and Tempel pastes from the clipboard', async () => {
    const screen = await renderScreen();
    const input = screen.getByTestId('key-input');
    expect(input.props.secureTextEntry).toBe(true);
    expect(input.props.autoCorrect).toBe(false);
    expect(input.props.autoCapitalize).toBe('none');

    await fireEvent.press(screen.getByRole('button', { name: 'Tampilkan kunci' }));
    expect(screen.getByTestId('key-input').props.secureTextEntry).toBe(false);
    expect(screen.getByRole('button', { name: 'Sembunyikan kunci' })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Tempel' }));
    await waitFor(() => expect(screen.getByTestId('key-input').props.value).toBe('AIzaPASTED-KEY-123'));
    expect(Clipboard.getStringAsync).toHaveBeenCalledTimes(1);
  });

  test('"Kunci ditolak?" opens a short help text', async () => {
    const screen = await renderScreen();
    expect(screen.queryByTestId('rejected-help')).toBeNull();
    await fireEvent.press(screen.getByRole('link', { name: 'Kunci ditolak?' }));
    expect(screen.getByTestId('rejected-help')).toBeTruthy();
  });

  test('"Simpan dan tes kunci" is off until there is a key to test', async () => {
    const screen = await renderScreen();
    expect(disabled(screen.getByTestId('key-save'))).toBe(true);
    await fireEvent.changeText(screen.getByTestId('key-input'), 'abc');
    expect(disabled(screen.getByTestId('key-save'))).toBe(true);
    await fireEvent.changeText(screen.getByTestId('key-input'), KEY);
    expect(disabled(screen.getByTestId('key-save'))).toBe(false);
  });
});

describe('where to get a key', () => {
  test('a link under the field opens Google AI Studio in the browser; the app itself calls nothing', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue();
    const screen = await renderScreen();
    expect(screen.getByText('Belum punya kunci? Buat di Google AI Studio')).toBeTruthy();
    await fireEvent.press(screen.getByRole('link', { name: 'Buka Google AI Studio di browser untuk membuat API key' }));
    expect(open).toHaveBeenCalledWith('https://aistudio.google.com/api-keys');
    expect(testKey).not.toHaveBeenCalled();
    open.mockRestore();
  });
});

describe('saving the key', () => {
  test('a good key: tested, then saved, the switch is turned on, the state is emptied, and the chat opens', async () => {
    mockTestKey.mockResolvedValueOnce({ ok: true });
    const screen = await renderScreen();
    await fireEvent.changeText(screen.getByTestId('key-input'), `  ${KEY}  `);
    await fireEvent.press(screen.getByTestId('key-save'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/ai-chat'));
    expect(mockTestKey).toHaveBeenCalledWith(KEY);
    expect(mockSaveKey).toHaveBeenCalledWith(KEY);
    expect(mockSetSetting).toHaveBeenCalledWith({ fake: 'db' }, 'ai_enabled', '1');
    expect(screen.getByTestId('key-input').props.value).toBe(''); // the key is gone from state
    expect(showToast).not.toHaveBeenCalled();
  });

  test('a rejected key: "Kunci Gemini ditolak." with an icon and words; nothing is saved, the chat does not open', async () => {
    mockTestKey.mockResolvedValueOnce({ ok: false, code: 'key_rejected' });
    const screen = await renderScreen();
    await fireEvent.changeText(screen.getByTestId('key-input'), KEY);
    await fireEvent.press(screen.getByTestId('key-save'));

    expect(await screen.findByText('Kunci Gemini ditolak.')).toBeTruthy();
    expect(screen.getByText('Cek kunci di Pengaturan. Tidak ada transaksi yang dibuat.')).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(mockSaveKey).not.toHaveBeenCalled();
    expect(mockSetSetting).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    // the text stays so a typo can be fixed; typing again clears the message
    expect(screen.getByTestId('key-input').props.value).toBe(KEY);
    await fireEvent.changeText(screen.getByTestId('key-input'), `${KEY}x`);
    expect(screen.queryByText('Kunci Gemini ditolak.')).toBeNull();
  });

  test('no internet while testing says so, and saves nothing', async () => {
    mockTestKey.mockResolvedValueOnce({ ok: false, code: 'no_internet' });
    const screen = await renderScreen();
    await fireEvent.changeText(screen.getByTestId('key-input'), KEY);
    await fireEvent.press(screen.getByTestId('key-save'));
    expect(await screen.findByText('Tidak ada internet.')).toBeTruthy();
    expect(mockSaveKey).not.toHaveBeenCalled();
  });

  test('while testing the button says so and cannot be pressed twice', async () => {
    let finish: (r: { ok: true }) => void = () => {};
    mockTestKey.mockImplementationOnce(() => new Promise(resolve => (finish = resolve)));
    const screen = await renderScreen();
    await fireEvent.changeText(screen.getByTestId('key-input'), KEY);
    await fireEvent.press(screen.getByTestId('key-save'));
    expect(await screen.findByText('Menguji kunci…')).toBeTruthy();
    expect(disabled(screen.getByTestId('key-save'))).toBe(true);
    await fireEvent.press(screen.getByTestId('key-save'));
    expect(mockTestKey).toHaveBeenCalledTimes(1);
    finish({ ok: true });
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
  });

  test('the key never reaches the console, a toast, or a visible message', async () => {
    const spies = (['log', 'info', 'warn', 'error'] as const).map(m => jest.spyOn(console, m).mockImplementation(() => {}));
    try {
      mockTestKey.mockResolvedValueOnce({ ok: false, code: 'key_rejected' });
      const screen = await renderScreen();
      await fireEvent.changeText(screen.getByTestId('key-input'), KEY);
      await fireEvent.press(screen.getByTestId('key-save'));
      await screen.findByText('Kunci Gemini ditolak.');
      expect(screen.queryByText(KEY, { exact: false })).toBeNull();
      expect(spies.flatMap(s => s.mock.calls.flat()).map(String).join('\n')).not.toContain(KEY);
      expect(showToast).not.toHaveBeenCalled();
    } finally {
      spies.forEach(s => s.mockRestore());
    }
  });
});

describe('with a key already saved', () => {
  test('the screen shows it is saved, with the switch and "Hapus kunci", and a field to replace it', async () => {
    mockHasKey.mockResolvedValue(true);
    mockGetSetting.mockImplementation(async (_db, key) => (key === 'ai_enabled' ? '1' : null));
    const screen = await renderScreen();
    expect(await screen.findByText('Kunci tersimpan')).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Catat lewat chat (AI)' }).props.accessibilityState).toMatchObject({ checked: true, disabled: false });
    expect(screen.getByRole('button', { name: 'Hapus kunci' })).toBeTruthy();
    expect(screen.getByText('GANTI KUNCI')).toBeTruthy();
  });

  test('without a key there is no saved card and no way to delete', async () => {
    const screen = await renderScreen();
    expect(screen.queryByTestId('key-saved-card')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Hapus kunci' })).toBeNull();
    expect(clearKey).not.toHaveBeenCalled();
  });
});

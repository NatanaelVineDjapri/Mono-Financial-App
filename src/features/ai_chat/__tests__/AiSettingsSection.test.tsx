import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { useToastStore } from '@/components/toast-store';
import { getSetting, setSetting } from '@/data/repo/settings';

import { AiSettingsSection } from '../AiSettingsSection';
import { useChatStore } from '../chatStore';
import { clearKey, hasKey } from '../keystore';

jest.mock('@/data/db/DbProvider', () => ({ useDb: () => ({ fake: 'db' }) }));
jest.mock('@/data/repo/settings', () => ({ getSetting: jest.fn(async () => null), setSetting: jest.fn(async () => {}) }));
jest.mock('../keystore', () => ({ hasKey: jest.fn(async () => false), getKey: jest.fn(async () => null), saveKey: jest.fn(async () => {}), clearKey: jest.fn(async () => {}) }));

const mockHasKey = hasKey as jest.MockedFunction<typeof hasKey>;
const mockGetSetting = getSetting as jest.MockedFunction<typeof getSetting>;
const mockSetSetting = setSetting as jest.MockedFunction<typeof setSetting>;
const mockClearKey = clearKey as jest.MockedFunction<typeof clearKey>;

const clients: QueryClient[] = [];
async function renderSection(onOpenSetup?: () => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 } } });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <AiSettingsSection onOpenSetup={onOpenSetup} />
    </QueryClientProvider>,
  );
}

afterEach(() => clients.splice(0).forEach(c => c.clear()));
beforeEach(() => {
  jest.clearAllMocks();
  mockHasKey.mockResolvedValue(false);
  mockGetSetting.mockResolvedValue(null);
  useToastStore.getState().dismiss();
});

describe('the switch "Catat lewat chat (AI)"', () => {
  test('off by default, and it cannot be turned on before a key has passed its test', async () => {
    const screen = await renderSection();
    const toggle = screen.getByRole('switch', { name: 'Catat lewat chat (AI)' });
    await waitFor(() => expect(screen.getByText('Simpan dan tes kunci dulu.')).toBeTruthy());
    expect(toggle.props.accessibilityState).toMatchObject({ checked: false, disabled: true });
    await fireEvent.press(toggle);
    expect(mockSetSetting).not.toHaveBeenCalled();
  });

  test('with a key it can be turned on and off, and turning it off does not delete the key', async () => {
    mockHasKey.mockResolvedValue(true);
    const screen = await renderSection();
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Catat lewat chat (AI)' }).props.accessibilityState.disabled).toBe(false));
    await fireEvent.press(screen.getByRole('switch', { name: 'Catat lewat chat (AI)' }));
    await waitFor(() => expect(mockSetSetting).toHaveBeenCalledWith({ fake: 'db' }, 'ai_enabled', '1'));

    mockGetSetting.mockResolvedValue('1');
    const on = await renderSection();
    await waitFor(() => expect(on.getByRole('switch', { name: 'Catat lewat chat (AI)' }).props.accessibilityState.checked).toBe(true));
    await fireEvent.press(on.getByRole('switch', { name: 'Catat lewat chat (AI)' }));
    await waitFor(() => expect(mockSetSetting).toHaveBeenCalledWith({ fake: 'db' }, 'ai_enabled', '0'));
    expect(mockClearKey).not.toHaveBeenCalled();
  });

  test('a saved switch without a key reads as off', async () => {
    mockGetSetting.mockResolvedValue('1');
    mockHasKey.mockResolvedValue(false);
    const screen = await renderSection();
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Catat lewat chat (AI)' }).props.accessibilityState.checked).toBe(false));
  });
});

describe('the key row and "Hapus kunci"', () => {
  test('the row opens the setup screen and says whether a key is saved', async () => {
    const open = jest.fn();
    mockHasKey.mockResolvedValue(true);
    const screen = await renderSection(open);
    const row = await screen.findByRole('button', { name: 'API key Gemini, Tersimpan' });
    await fireEvent.press(row);
    expect(open).toHaveBeenCalledTimes(1);
  });

  test('no row without a handler', async () => {
    const screen = await renderSection();
    expect(screen.queryByTestId('ai-key-row')).toBeNull();
  });

  test('"Hapus kunci" asks first; Batal changes nothing', async () => {
    mockHasKey.mockResolvedValue(true);
    const screen = await renderSection();
    await fireEvent.press(await screen.findByRole('button', { name: 'Hapus kunci' }));
    expect(await screen.findByText('Hapus kunci?')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Batal' }));
    expect(mockClearKey).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('Hapus kunci?')).toBeNull());
  });

  test('confirming deletes the key, turns the switch off, empties the conversation and says so', async () => {
    mockHasKey.mockResolvedValue(true);
    useChatStore.getState().addMessage({ role: 'user', text: 'kopi 25rb' });
    const screen = await renderSection();
    await fireEvent.press(await screen.findByRole('button', { name: 'Hapus kunci' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Hapus' }));

    await waitFor(() => expect(mockClearKey).toHaveBeenCalledTimes(1));
    expect(mockSetSetting).toHaveBeenCalledWith({ fake: 'db' }, 'ai_enabled', '0');
    expect(useChatStore.getState().messages).toHaveLength(0);
    await waitFor(() => expect(useToastStore.getState().message).toBe('Kunci dihapus.'));
  });
});

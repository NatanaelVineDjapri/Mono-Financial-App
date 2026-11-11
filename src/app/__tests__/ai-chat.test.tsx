import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useToastStore } from '@/components/toast-store';
import { useChatStore } from '@/features/ai_chat/chatStore';
import { callGemini } from '@/features/ai_chat/client';
import { processResponse, interpret, type InterpretResult } from '@/features/ai_chat/interpret';
import { saveDrafts, undoDrafts } from '@/features/ai_chat/saveDrafts';
import { ACCOUNTS, CATEGORIES, CTX, response, tx } from '@/features/ai_chat/__tests__/fixtures';

import AiChatScreen from '../ai-chat';

jest.mock('@/data/db/DbProvider', () => ({ useDb: () => ({ fake: 'db' }) }));
jest.mock('@/data/repo/settings', () => ({ getSetting: jest.fn(async (_db: unknown, key: string) => (key === 'display_name' ? 'Budi' : null)) }));
jest.mock('@/domain/txForm', () => {
  const f = jest.requireActual('@/features/ai_chat/__tests__/fixtures');
  return { getTxFormData: jest.fn(async () => ({ accounts: f.ACCOUNTS, categories: f.CATEGORIES, record: null })) };
});
jest.mock('expo-screen-capture', () => ({ preventScreenCaptureAsync: jest.fn(async () => {}), allowScreenCaptureAsync: jest.fn(async () => {}) }));
jest.mock('@/features/ai_chat/interpret', () => ({ ...jest.requireActual('@/features/ai_chat/interpret'), interpret: jest.fn() }));
jest.mock('@/features/ai_chat/client', () => ({ ...jest.requireActual('@/features/ai_chat/client'), callGemini: jest.fn() }));
jest.mock('@/features/ai_chat/saveDrafts', () => ({ ...jest.requireActual('@/features/ai_chat/saveDrafts'), saveDrafts: jest.fn(), undoDrafts: jest.fn() }));

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn() }),
}));

const mockInterpret = interpret as jest.MockedFunction<typeof interpret>;
const mockCallGemini = callGemini as jest.MockedFunction<typeof callGemini>;
const mockSaveDrafts = saveDrafts as jest.MockedFunction<typeof saveDrafts>;
const mockUndoDrafts = undoDrafts as jest.MockedFunction<typeof undoDrafts>;

const METRICS = { insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 390, height: 844 } };

const clients: QueryClient[] = [];

async function renderScreen() {
  // gcTime 0: no cache timer is left running after the test, so Jest can exit.
  const client = new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 } } });
  clients.push(client);
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <QueryClientProvider client={client}>
        <AiChatScreen />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

type Item = Parameters<typeof tx>[0];
const kopi: Item = { amount: 25000, amount_text: '25rb', description: 'Kopi', category: 'Food & drink', account: 'GoPay' };
const bensin: Item = { amount: 4000, amount_text: '40rb', description: 'Bensin', category: 'Transport', account: 'Cash wallet' };
const headphone: Item = { amount: 1500000, amount_text: '1,5jt', description: 'Headphone', category: 'Shopping', account: 'Cash wallet' };

function modelReplies(intent: Parameters<typeof response>[0], items: Item[], extra: Parameters<typeof response>[2] = {}) {
  mockInterpret.mockImplementationOnce(async (message: string, ctx) => processResponse(response(intent, items.map(i => tx(i)), extra), message, ctx));
}

const errorResult = (code: 'no_internet' | 'aborted', text = ''): InterpretResult => ({ kind: 'error', code, title: text, detail: '', text, action: code === 'no_internet' ? 'manual' : null, actionLabel: code === 'no_internet' ? 'Catat manual' : null });

async function type(screen: Awaited<ReturnType<typeof renderScreen>>, text: string) {
  await fireEvent.changeText(screen.getByTestId('chat-input'), text);
}

const disabled = (el: { props: { accessibilityState?: { disabled?: boolean } } }) => el.props.accessibilityState?.disabled === true;

afterEach(() => {
  clients.splice(0).forEach(c => c.clear());
});

beforeEach(() => {
  jest.clearAllMocks();
  useChatStore.getState().reset();
  useToastStore.getState().dismiss();
});

describe('opening', () => {
  test('the assistant greets by name, and the box is empty with Kirim disabled', async () => {
    const screen = await renderScreen();
    expect(await screen.findByText(/Halo Budi! Ketik transaksimu seperti ngobrol/)).toBeTruthy();
    expect(screen.getByLabelText(/^MONO: Halo Budi!/)).toBeTruthy();
    expect(disabled(screen.getByRole('button', { name: 'Kirim' }))).toBe(true);
    expect(screen.getByText('Hanya membuat draf')).toBeTruthy();
  });

  test('the header has back and the key icon (AI settings), and no "Catat manual" button', async () => {
    const screen = await renderScreen();
    expect(screen.queryByRole('button', { name: 'Catat manual' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Pengaturan AI' }));
    expect(mockPush).toHaveBeenCalledWith('/ai-setup');
    await fireEvent.press(screen.getByRole('button', { name: 'Kembali' }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  test('a suggestion only fills the box and sends nothing', async () => {
    const screen = await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Beli bensin 40rb' }));
    expect(screen.getByTestId('chat-input').props.value).toBe('Beli bensin 40rb');
    expect(mockInterpret).not.toHaveBeenCalled();
    expect(mockCallGemini).not.toHaveBeenCalled();
  });
});

describe('sending', () => {
  test('a message becomes a user bubble and a draft card; the box is emptied; nothing is saved', async () => {
    modelReplies('create_transactions', [kopi]);
    const screen = await renderScreen();
    await type(screen, 'kopi 25rb pake gopay');
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim' }));

    expect(await screen.findByText('DRAF · PENGELUARAN')).toBeTruthy();
    expect(screen.getByLabelText('Kamu: kopi 25rb pake gopay')).toBeTruthy();
    expect(screen.getByText('Oke, ini drafnya. Belum ada yang tersimpan.')).toBeTruthy();
    expect(screen.getByText('−Rp25.000')).toBeTruthy();
    expect(screen.getByText('Rp287.500')).toBeTruthy();
    expect(screen.getByTestId('chat-input').props.value).toBe('');
    expect(mockSaveDrafts).not.toHaveBeenCalled();
    expect(mockInterpret.mock.calls[0][0]).toBe('kopi 25rb pake gopay');
  });

  test('while processing: three dots and "Menyiapkan draf…", the text stays, Kirim is off; Batal stops it and changes nothing', async () => {
    mockInterpret.mockImplementationOnce(
      (_message, _ctx, _pending, deps) =>
        new Promise<InterpretResult>(resolve => {
          deps?.signal?.addEventListener('abort', () => resolve(errorResult('aborted')));
        }),
    );
    const screen = await renderScreen();
    await type(screen, 'kopi 25rb pake gopay');
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim' }));

    expect(await screen.findByText('Menyiapkan draf…')).toBeTruthy();
    expect(screen.getByTestId('chat-input').props.value).toBe('kopi 25rb pake gopay');
    expect(disabled(screen.getByRole('button', { name: 'Kirim' }))).toBe(true);

    await fireEvent.press(screen.getByRole('button', { name: 'Batal' }));
    await waitFor(() => expect(screen.queryByText('Menyiapkan draf…')).toBeNull());
    expect(mockInterpret.mock.calls[0][3]?.signal?.aborted).toBe(true);
    // no message, no card, no error; the text is still in the box
    expect(screen.queryByLabelText('Kamu: kopi 25rb pake gopay')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByTestId('chat-input').props.value).toBe('kopi 25rb pake gopay');
    expect(useChatStore.getState().messages).toHaveLength(0);
    expect(mockSaveDrafts).not.toHaveBeenCalled();
  });

  test('a failed message stays in the box and shows the system card with a way out', async () => {
    mockInterpret.mockResolvedValueOnce(errorResult('no_internet', 'Tidak ada internet.'));
    const screen = await renderScreen();
    await type(screen, 'kopi 25rb pake gopay');
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim' }));

    expect(await screen.findByTestId('error-card')).toBeTruthy();
    expect(screen.getByText('Tidak ada internet.')).toBeTruthy();
    expect(screen.getByTestId('chat-input').props.value).toBe('kopi 25rb pake gopay');
    await fireEvent.press(screen.getByTestId('error-manual'));
    expect(mockPush).toHaveBeenCalledWith('/tx/add');
  });

  test('an off-topic reply shows the fixed sentence; its example chips fill the box without sending', async () => {
    modelReplies('out_of_scope', [], { reason: 'question' });
    const screen = await renderScreen();
    await type(screen, 'ibukota prancis apa?');
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim' }));
    expect(await screen.findByText('Aku cuma bisa mencatat transaksi. Coba ketik seperti “kopi 25rb pake gopay”.')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Kopi 25rb pake gopay' }));
    expect(screen.getByTestId('chat-input').props.value).toBe('Kopi 25rb pake gopay');
    expect(mockInterpret).toHaveBeenCalledTimes(1);
  });

  test('a balance question offers "Buka Accounts"', async () => {
    modelReplies('out_of_scope', [], { reason: 'data_lookup' });
    const screen = await renderScreen();
    await type(screen, 'berapa saldo gopay?');
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Buka Accounts' }));
    expect(mockPush).toHaveBeenCalledWith('/accounts');
  });
});

describe('clarification', () => {
  test('"bayar 150rb": chips fill the draft locally; the model and callGemini are not called again', async () => {
    modelReplies('clarify', [{ amount: 150000, amount_text: '150rb', description: 'Bayar' }], { missing: ['account', 'category'] });
    const screen = await renderScreen();
    await type(screen, 'bayar 150rb');
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim' }));
    expect(await screen.findByText('Dari akun mana, dan untuk apa? Satu ketukan cukup.')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'BCA Tabungan' }));
    expect(await screen.findByText('Untuk apa?')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Bills' }));

    expect(await screen.findByText('DRAF · PENGELUARAN')).toBeTruthy();
    expect(screen.getByText('Bills')).toBeTruthy();
    expect(screen.getByText('BCA Tabungan')).toBeTruthy();
    expect(mockInterpret).toHaveBeenCalledTimes(1);
    expect(mockCallGemini).not.toHaveBeenCalled();
  });

  test('a typed answer goes out with the earlier message as pending', async () => {
    modelReplies('clarify', [{ amount: 150000, amount_text: '150rb', description: 'Bayar' }], { missing: ['account', 'category'] });
    const screen = await renderScreen();
    await type(screen, 'bayar 150rb');
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim' }));
    await screen.findByText('Untuk apa', { exact: false });

    modelReplies('create_transactions', [{ amount: 150000, amount_text: '150rb', description: 'Bayar', category: 'Bills', account: 'GoPay' }]);
    await type(screen, 'pakai gopay untuk tagihan');
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim' }));
    await screen.findByText('DRAF · PENGELUARAN');
    expect(mockInterpret.mock.calls[1][2]).toEqual({ previousMessage: 'bayar 150rb' });
  });

  test('a transfer to someone unknown: "Catat pengeluaran" and "Batal"', async () => {
    modelReplies('clarify', [{ type: 'transfer', amount: 200000, amount_text: '200rb', description: 'Ke Budi', account: 'BCA Tabungan', to_account: 'Budi' }], { missing: ['to_account'] });
    const screen = await renderScreen();
    await type(screen, 'transfer ke Budi 200rb dari bca');
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim' }));
    expect(await screen.findByText(/Aku tidak menemukan akun bernama “Budi”/)).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Catat pengeluaran' }));
    expect(await screen.findByText('Untuk apa?')).toBeTruthy();
    expect(mockInterpret).toHaveBeenCalledTimes(1);
  });
});

describe('the draft card in the chat', () => {
  async function sendDraft(items: Item[], message: string) {
    modelReplies('create_transactions', items);
    const screen = await renderScreen();
    await type(screen, message);
    await fireEvent.press(screen.getByRole('button', { name: 'Kirim' }));
    await screen.findByText(/DRAF/);
    return screen;
  }

  test('a draft whose amount needs checking: Simpan is off until one amount is chosen, then on', async () => {
    const screen = await sendDraft([bensin], 'bensin 40rb cash');
    expect(screen.getByText('Nominal perlu dicek. Kamu mengetik “40rb” (Rp40.000), drafnya Rp4.000.')).toBeTruthy();
    expect(disabled(screen.getByTestId('draft-save'))).toBe(true);
    await fireEvent.press(screen.getByTestId('draft-save'));
    expect(mockSaveDrafts).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Pakai Rp40.000' }));
    await waitFor(() => expect(disabled(screen.getByTestId('draft-save'))).toBe(false));
    expect(screen.getByText('−Rp40.000')).toBeTruthy();
    expect(screen.queryByText(/Nominal perlu dicek/)).toBeNull();
  });

  test('a draft that cannot be saved: the sentence, "Ganti akun", "Ubah jumlah", Simpan off', async () => {
    const screen = await sendDraft([headphone], 'beli headphone 1,5jt pake cash');
    expect(screen.getByText('Kurang Rp1.050.000. Ganti akun, kecilkan jumlah, atau pindahkan uang dulu.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ganti akun' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ubah jumlah' })).toBeTruthy();
    expect(disabled(screen.getByTestId('draft-save'))).toBe(true);
    await fireEvent.press(screen.getByTestId('draft-save'));
    expect(mockSaveDrafts).not.toHaveBeenCalled();
  });

  test('Simpan: the card turns solid, the toast says the balance and offers Urungkan, and Urungkan brings the draft back', async () => {
    mockSaveDrafts.mockResolvedValueOnce({
      ok: true,
      value: { ids: [7], saved: [{ draftId: 'd1', id: 7, type: 'expense', accountId: 3, toAccountId: null }], balances: [{ accountId: 3, balance: 287500 }] },
    });
    mockUndoDrafts.mockResolvedValueOnce({ ok: true, value: null });
    const screen = await sendDraft([kopi], 'kopi 25rb pake gopay');

    await fireEvent.press(screen.getByTestId('draft-save'));
    await waitFor(() => expect(screen.queryByTestId('draft-save')).toBeNull());
    expect(mockSaveDrafts).toHaveBeenCalledTimes(1);
    expect(mockSaveDrafts.mock.calls[0][2]).toEqual(['d1']);
    expect(screen.getByText('Tersimpan')).toBeTruthy();

    const toast = useToastStore.getState();
    expect(toast.message).toBe('Pengeluaran tersimpan. GoPay sekarang Rp287.500.');
    expect(toast.actionLabel).toBe('Urungkan');

    await act(async () => {
      toast.onAction?.();
    });
    await waitFor(() => expect(screen.getByTestId('draft-save')).toBeTruthy());
    expect(mockUndoDrafts).toHaveBeenCalledWith({ fake: 'db' }, [7]);
    expect(screen.getByText('Belum tersimpan')).toBeTruthy();
  });

  test('two drafts: one card of "2 DRAF", and "Simpan 2 transaksi" saves both together', async () => {
    mockSaveDrafts.mockResolvedValueOnce({
      ok: true,
      value: {
        ids: [1, 2],
        saved: [
          { draftId: 'd1', id: 1, type: 'expense', accountId: 2, toAccountId: null },
          { draftId: 'd2', id: 2, type: 'expense', accountId: 2, toAccountId: null },
        ],
        balances: [{ accountId: 2, balance: 397000 }],
      },
    });
    const screen = await sendDraft(
      [
        { amount: 48000, amount_text: '48rb', description: 'Makan siang', category: 'Food & drink', account: 'Cash wallet' },
        { amount: 5000, amount_text: '5rb', description: 'Parkir', category: 'Transport', account: 'Cash wallet' },
      ],
      'makan siang 48rb cash, parkir 5rb',
    );
    expect(screen.getByText('2 DRAF')).toBeTruthy();
    expect(screen.getByText('Aku menemukan 2 transaksi. Cek dulu ya.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Simpan 2 transaksi' }));
    await waitFor(() => expect(mockSaveDrafts).toHaveBeenCalledTimes(1));
    expect(mockSaveDrafts.mock.calls[0][2]).toEqual(['d1', 'd2']);
    expect(useToastStore.getState().message).toBe('2 transaksi tersimpan.');
  });

  test('"Ubah" opens the edit screen with that draft; "Batal" removes the card without writing', async () => {
    const screen = await sendDraft([kopi], 'kopi 25rb pake gopay');
    await fireEvent.press(screen.getByTestId('draft-edit'));
    expect(mockPush).toHaveBeenCalledWith('/ai-draft-edit');
    expect(useChatStore.getState().edit?.drafts.map(d => d.id)).toEqual(['d1']);

    await fireEvent.press(screen.getByTestId('draft-cancel'));
    await waitFor(() => expect(screen.queryByText('DRAF · PENGELUARAN')).toBeNull());
    expect(mockSaveDrafts).not.toHaveBeenCalled();
  });

  test('"Ubah satu per satu" opens the edit screen with every draft', async () => {
    const screen = await sendDraft(
      [
        { amount: 48000, amount_text: '48rb', description: 'Makan siang', category: 'Food & drink', account: 'Cash wallet' },
        { amount: 5000, amount_text: '5rb', description: 'Parkir', category: 'Transport', account: 'Cash wallet' },
      ],
      'makan siang 48rb cash, parkir 5rb',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Ubah satu per satu' }));
    expect(useChatStore.getState().edit?.drafts.map(d => d.id)).toEqual(['d1', 'd2']);
    expect(mockPush).toHaveBeenCalledWith('/ai-draft-edit');
  });
});

test('fixtures used here are the sample dataset', () => {
  expect(ACCOUNTS).toHaveLength(4);
  expect(CATEGORIES.length).toBeGreaterThan(4);
  expect(CTX.today).toBe('2026-10-28');
});

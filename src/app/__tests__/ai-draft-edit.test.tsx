import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useToastStore } from '@/components/toast-store';
import { startEditing } from '@/features/ai_chat/chatActions';
import { useChatStore } from '@/features/ai_chat/chatStore';
import { processResponse } from '@/features/ai_chat/interpret';
import { saveDrafts, undoDrafts } from '@/features/ai_chat/saveDrafts';
import { CTX, response, tx } from '@/features/ai_chat/__tests__/fixtures';

import AiDraftEditScreen from '../ai-draft-edit';

jest.mock('@/data/db/DbProvider', () => ({ useDb: () => ({ fake: 'db' }) }));
jest.mock('@/domain/txForm', () => {
  const f = jest.requireActual('@/features/ai_chat/__tests__/fixtures');
  return { getTxFormData: jest.fn(async () => ({ accounts: f.ACCOUNTS, categories: f.CATEGORIES, pockets: [], rates: {}, record: null })) };
});
jest.mock('@/features/transactions/form/useTxForm', () => {
  const f = jest.requireActual('@/features/ai_chat/__tests__/fixtures');
  const data = { accounts: f.ACCOUNTS, categories: f.CATEGORIES, pockets: [], rates: {}, record: null };
  const refetch = jest.fn(async () => ({}));
  return { useTxFormData: () => ({ data, isLoading: false, isError: false, refetch }) };
});
jest.mock('@/features/ai_chat/saveDrafts', () => ({ ...jest.requireActual('@/features/ai_chat/saveDrafts'), saveDrafts: jest.fn(), undoDrafts: jest.fn() }));

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }),
}));

const mockSaveDrafts = saveDrafts as jest.MockedFunction<typeof saveDrafts>;
const mockUndoDrafts = undoDrafts as jest.MockedFunction<typeof undoDrafts>;

const METRICS = { insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 390, height: 844 } };
const clients: QueryClient[] = [];

async function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 } } });
  clients.push(client);
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <QueryClientProvider client={client}>
        <AiDraftEditScreen />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

type Item = Parameters<typeof tx>[0];
const lunch: Item = { amount: 48000, amount_text: '48rb', description: 'Makan siang', category: 'Food & drink', account: 'Cash wallet' };
const parking: Item = { amount: 5000, amount_text: '5rb', description: 'Parkir', category: 'Transport', account: 'Cash wallet' };
const MESSAGE = 'makan siang 48rb cash, parkir 5rb';

// A card of drafts in the chat store and an edit session over it, as the chat leaves them.
function startSession(items: Item[], message = MESSAGE, draftIds?: string[]) {
  const result = processResponse(response('create_transactions', items.map(i => tx(i))), message, CTX);
  if (result.kind !== 'drafts') throw new Error(result.kind);
  const id = useChatStore.getState().addMessage({
    role: 'assistant',
    content: { type: 'drafts', drafts: result.drafts, text: result.text, selected: result.drafts.map(d => d.id), sourceMessage: message, saved: null, saving: false, saveError: null },
  });
  expect(startEditing(id, draftIds)).toBe(true);
  return id;
}

function savedOk(draftId: string, id: number) {
  mockSaveDrafts.mockResolvedValueOnce({ ok: true, value: { ids: [id], saved: [{ draftId, id, type: 'expense', accountId: 2, toAccountId: null }], balances: [{ accountId: 2, balance: 402000 }] } });
}

const disabled = (el: { props: { accessibilityState?: { disabled?: boolean } } }) => el.props.accessibilityState?.disabled === true;

afterEach(() => clients.splice(0).forEach(c => c.clear()));
beforeEach(() => {
  jest.clearAllMocks();
  useChatStore.getState().reset();
  useToastStore.getState().dismiss();
});

describe('K4: the screen', () => {
  test('"Ubah draf", "1 dari 2", two progress segments with the first filled, and the person\'s own message quoted', async () => {
    startSession([lunch, parking]);
    const screen = await renderScreen();
    expect(screen.getByRole('header', { name: 'Ubah draf' })).toBeTruthy();
    expect(screen.getByText('1 dari 2')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: '1 dari 2' })).toBeTruthy();
    expect(screen.getAllByTestId('segment-on')).toHaveLength(1);
    expect(screen.getAllByTestId('segment-off')).toHaveLength(1);
    expect(screen.getByText('Dari pesanmu')).toBeTruthy();
    expect(screen.getByText(MESSAGE)).toBeTruthy();
  });

  test('the form is the ordinary one, filled from the draft: description, and "Simpan dan lanjut" and "Lewati" below', async () => {
    startSession([lunch, parking]);
    const screen = await renderScreen();
    expect(screen.getByTestId('tx-description').props.value).toBe('Makan siang');
    expect(screen.getByRole('button', { name: 'Simpan dan lanjut' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Lewati' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  test('one draft is "1 dari 1" and its button is "Simpan"', async () => {
    startSession([lunch], 'makan siang 48rb cash');
    const screen = await renderScreen();
    expect(screen.getByText('1 dari 1')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull(); // a single segment would only be a white line
    expect(screen.getByRole('button', { name: 'Simpan' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Simpan dan lanjut' })).toBeNull();
  });

  test('without a session there is nothing to edit', async () => {
    const screen = await renderScreen();
    expect(screen.getByText('Tidak ada draf untuk diubah.')).toBeTruthy();
  });
});

describe('Simpan dan lanjut / Lewati', () => {
  test('Simpan saves THIS draft as edited (source ai, one at a time) and opens the next; the last one says "Simpan"', async () => {
    startSession([lunch, parking]);
    savedOk('d1', 11);
    const screen = await renderScreen();

    await fireEvent.changeText(screen.getByTestId('tx-description'), 'Makan siang ber-2');
    await fireEvent.press(screen.getByRole('button', { name: 'Simpan dan lanjut' }));

    await waitFor(() => expect(screen.getByText('2 dari 2')).toBeTruthy());
    expect(mockSaveDrafts).toHaveBeenCalledTimes(1);
    const [, drafts, selected] = mockSaveDrafts.mock.calls[0];
    expect(selected).toEqual(['d1']);
    expect(drafts[0]).toMatchObject({ description: 'Makan siang ber-2', amount: 48000, status: { kind: 'ready' } });
    expect(screen.getAllByTestId('segment-on')).toHaveLength(2);
    expect(screen.getByTestId('tx-description').props.value).toBe('Parkir');
    expect(screen.getByRole('button', { name: 'Simpan' })).toBeTruthy();
    expect(useChatStore.getState().edit?.savedIds).toEqual([11]);
    expect(mockBack).not.toHaveBeenCalled();
  });

  test('saving both returns to the chat with "2 transaksi tersimpan." and one Urungkan for the whole batch', async () => {
    const id = startSession([lunch, parking]);
    savedOk('d1', 11);
    savedOk('d2', 12);
    const screen = await renderScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Simpan dan lanjut' }));
    await waitFor(() => expect(screen.getByText('2 dari 2')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Simpan' }));

    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(useChatStore.getState().edit).toBeNull();
    const toast = useToastStore.getState();
    expect(toast.message).toBe('2 transaksi tersimpan.');
    expect(toast.actionLabel).toBe('Urungkan');
    const message = useChatStore.getState().messages.find(m => m.id === id);
    expect(message?.role === 'assistant' && message.content.type === 'drafts' && message.content.saved).toEqual({ ids: [11, 12], draftIds: ['d1', 'd2'] });

    mockUndoDrafts.mockResolvedValueOnce({ ok: true, value: null });
    await act(async () => {
      toast.onAction?.();
    });
    await waitFor(() => expect(mockUndoDrafts).toHaveBeenCalledWith({ fake: 'db' }, [11, 12]));
  });

  test('Lewati opens the next draft without saving; skipping the last one goes back with nothing saved', async () => {
    startSession([lunch, parking]);
    const screen = await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Lewati' }));
    expect(await screen.findByText('2 dari 2')).toBeTruthy();
    expect(mockSaveDrafts).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Lewati' }));
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(mockSaveDrafts).not.toHaveBeenCalled();
    expect(useToastStore.getState().visible).toBe(false);
  });

  test('a save the database refuses shows its message, stays on this draft, and records nothing', async () => {
    startSession([lunch, parking]);
    mockSaveDrafts.mockResolvedValueOnce({ ok: false, message: 'Short by Rp10.000.' });
    const screen = await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Simpan dan lanjut' }));
    expect(await screen.findByText('Short by Rp10.000.')).toBeTruthy();
    expect(screen.getByText('1 dari 2')).toBeTruthy();
    expect(useChatStore.getState().edit?.savedIds).toEqual([]);
  });
});

describe('closing before the end', () => {
  test('"Buang perubahan?" asks first; "Lanjut mengubah" keeps editing', async () => {
    startSession([lunch, parking]);
    const screen = await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(await screen.findByText('Buang perubahan?')).toBeTruthy();
    expect(screen.getByText('Draf yang belum kamu simpan akan hilang. Yang sudah tersimpan tetap tersimpan.')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Lanjut' }));
    await waitFor(() => expect(screen.queryByText('Buang perubahan?')).toBeNull());
    expect(mockBack).not.toHaveBeenCalled();
    expect(useChatStore.getState().edit).not.toBeNull();
  });

  test('"Buang" leaves; what was already saved is kept and still offers Urungkan', async () => {
    startSession([lunch, parking]);
    savedOk('d1', 11);
    const screen = await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Simpan dan lanjut' }));
    await waitFor(() => expect(screen.getByText('2 dari 2')).toBeTruthy());

    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Buang' }));
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(mockUndoDrafts).not.toHaveBeenCalled(); // saved drafts are not cancelled
    expect(useToastStore.getState().message).toMatch(/^Pengeluaran tersimpan\./);
    expect(useToastStore.getState().actionLabel).toBe('Urungkan');
  });

  test('"Buang" with nothing saved just leaves', async () => {
    startSession([lunch, parking]);
    const screen = await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Buang' }));
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(mockSaveDrafts).not.toHaveBeenCalled();
    expect(useToastStore.getState().visible).toBe(false);
  });
});

test('"Ubah" on one card edits that draft only: "1 dari 1" with its own text', async () => {
  startSession([lunch, parking], MESSAGE, ['d2']);
  const screen = await renderScreen();
  expect(screen.getByText('1 dari 1')).toBeTruthy();
  expect(screen.getByTestId('tx-description').props.value).toBe('Parkir');
  expect(disabled(screen.getByTestId('tx-save'))).toBe(false);
});

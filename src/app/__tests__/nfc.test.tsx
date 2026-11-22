// The card scan screens, end to end against the real schema and the pretend reader (the emulator has no NFC): every
// scenario of the Dev tools list, the result with its one button, the new-card screen, and the entry points.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { createHash } from 'crypto';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useToastStore } from '@/components/toast-store';
import { openMigratedTestDb } from '@/data/db/openTestDb';
import type { Db } from '@/data/db/types';
import { createAccount } from '@/domain/accounts';
import { findCardAccount } from '@/domain/cards/links';
import { importCategoryLabel, undoLabel } from '@/i18n';
import type { CardInfo } from '@/domain/cards/types';
import { useScanSession } from '@/features/nfc/scanSession';
import { MOCK_SCENARIOS, useMockCardStore, type MockScenario } from '@/features/nfc/mock/mockCardReader';

import NfcNewRoute from '../nfc/new';
import NfcResultRoute from '../nfc/result';
import NfcScanRoute from '../nfc/scan';

const mockRouter = { back: jest.fn(), replace: jest.fn(), push: jest.fn() };
let mockDb: Db;

jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => mockRouter,
}));
jest.mock('@/data/db/DbProvider', () => ({ useDb: () => mockDb }));
jest.mock('@/core/sha256', () => ({ sha256Hex: async (text: string) => require('crypto').createHash('sha256').update(text).digest('hex') }));
jest.mock('expo-crypto', () => ({ getRandomBytesAsync: async (n: number) => new Uint8Array(n).fill(9) }));

const METRICS = { insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 400, height: 800 } };
const NOW = '2026-11-03T10:00:00+07:00';

async function renderRoute(node: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <QueryClientProvider client={client}>{node}</QueryClientProvider>
    </SafeAreaProvider>,
  );
}

function pretend(scenario: MockScenario) {
  useMockCardStore.setState({ enabled: true, scenario, stepMs: 0 });
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockDb = await openMigratedTestDb();
  useScanSession.getState().clear();
  useToastStore.getState().dismiss();
});
afterEach(() => useMockCardStore.setState({ enabled: false, scenario: 'known_less', stepMs: 700 }));

const sha = async (text: string) => createHash('sha256').update(text).digest('hex');
void sha;

const card = (over: Partial<CardInfo> = {}): CardInfo => ({ issuer: 'mandiri', last4: '7731', fingerprint: 'fp-7731', balance: 84_000, readAt: NOW, estimated: false, ...over });

async function linkedAccount(balance = 100_000, fingerprint = 'fp-7731') {
  const id = await createAccount(mockDb, { name: 'E-money Mandiri', type: 'ewallet', openingBalance: balance, openingDate: '2026-01-01' }, NOW);
  await mockDb.runAsync("insert into card_links (account_id, issuer, last4, fingerprint, linked_at) values (?, 'mandiri', '7731', ?, ?)", [id, fingerprint, NOW]);
  return id;
}

describe('Scan card, every scenario of the Dev tools list', () => {
  test('the list is the one the tests cover', () => {
    expect(MOCK_SCENARIOS.map(s => s.id)).toEqual(['known_less', 'known_more', 'known_same', 'new_mandiri', 'flazz_experimental', 'unsupported', 'lost', 'nfc_off']);
  });

  test.each(['known_less', 'known_more', 'known_same'] as const)('%s: a known card goes to the result', async scenario => {
    pretend(scenario);
    await renderRoute(<NfcScanRoute />);
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/nfc/result'));
    expect(useScanSession.getState().card).toMatchObject({ issuer: 'mandiri', last4: '7731' });
  });

  test.each(['new_mandiri', 'flazz_experimental'] as const)('%s: a card nobody has goes to the new-card screen', async scenario => {
    pretend(scenario);
    await renderRoute(<NfcScanRoute />);
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/nfc/new'));
    expect(useScanSession.getState().card).not.toBeNull();
  });

  test('unsupported: says so, offers another card and manual entry, and goes nowhere', async () => {
    pretend('unsupported');
    await renderRoute(<NfcScanRoute />);
    await waitFor(() => expect(screen.getByTestId('nfc-state-unsupported')).toBeTruthy());
    expect(screen.getByText('Kartu ini belum didukung')).toBeTruthy();
    expect(screen.getByText('Hanya kartu e-money tertentu yang bisa dibaca. Kartu debit dan kredit tidak menyimpan saldo, jadi tidak bisa dipakai di sini.')).toBeTruthy();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('nfc-manual'));
    expect(mockRouter.replace).toHaveBeenCalledWith('/account/edit');
  });

  test('lost: says the card left too early, and "Coba lagi" waits again', async () => {
    pretend('lost');
    await renderRoute(<NfcScanRoute />);
    await waitFor(() => expect(screen.getByTestId('nfc-state-lost')).toBeTruthy());
    expect(screen.getByText('Kartu terlepas terlalu cepat')).toBeTruthy();
    expect(screen.getByText('Tempelkan lagi dan tahan sampai ada getaran, jangan digeser.')).toBeTruthy();
    pretend('known_less');
    await fireEvent.press(screen.getByTestId('nfc-try-again'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/nfc/result'));
  });

  test('NFC off: says so and offers the phone settings', async () => {
    pretend('nfc_off');
    await renderRoute(<NfcScanRoute />);
    await waitFor(() => expect(screen.getByTestId('nfc-state-off')).toBeTruthy());
    expect(screen.getByText('NFC belum aktif')).toBeTruthy();
    expect(screen.getByText('Nyalakan NFC di pengaturan ponsel, lalu kembali ke MONO.')).toBeTruthy();
    expect(screen.getByText('Buka pengaturan NFC')).toBeTruthy();
    expect(screen.getByText('Isi manual')).toBeTruthy();
  });

  test('waiting: the exact texts of the board, and Batal goes back', async () => {
    pretend('known_less');
    useMockCardStore.setState({ stepMs: 5000 }); // keeps waiting for a card
    await renderRoute(<NfcScanRoute />);
    await waitFor(() => expect(screen.getByTestId('nfc-state-waiting')).toBeTruthy());
    expect(screen.getByText('Scan kartu')).toBeTruthy();
    expect(screen.getByText('Tempelkan kartu ke belakang ponsel')).toBeTruthy();
    expect(screen.getByText('Tahan sebentar sampai ada getaran. Jangan digeser. Bagian NFC biasanya ada di dekat kamera belakang.')).toBeTruthy();
    expect(screen.getByText('Khusus kartu e-money')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('nfc-cancel'));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  test('leaving the screen before a card comes records nothing and creates nothing', async () => {
    pretend('known_less');
    useMockCardStore.setState({ stepMs: 200 });
    await renderRoute(<NfcScanRoute />);
    await act(async () => screen.unmount());
    await act(async () => new Promise(resolve => setTimeout(resolve, 500)));
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect((await mockDb.getFirstAsync<{ n: number }>('select count(*) as n from transactions'))!.n).toBe(0);
  });
});

describe('Saldo kartu terbaca', () => {
  async function openResult(cardBalance: number, over: Partial<CardInfo> = {}) {
    const account = await linkedAccount(100_000);
    useScanSession.getState().setCard(card({ balance: cardBalance, ...over }));
    await renderRoute(<NfcResultRoute />);
    await waitFor(() => expect(screen.getByTestId('nfc-result')).toBeTruthy());
    return account;
  }

  test('less on the card: shows both balances and the negative difference, and the exact texts', async () => {
    await openResult(84_000);
    expect(screen.getByText('Saldo kartu terbaca')).toBeTruthy();
    expect(screen.getByText('Kartu e-money')).toBeTruthy();
    expect(screen.getByText('E-money Mandiri')).toBeTruthy();
    expect(screen.getByText('Saldo di kartu')).toBeTruthy();
    expect(screen.getByText('Di MONO')).toBeTruthy();
    expect(screen.getByText('Selisih')).toBeTruthy();
    expect(screen.getByTestId('nfc-card-balance').props.children).toBe('Rp84.000');
    expect(screen.getByTestId('nfc-app-balance').props.children).toBe('Rp100.000');
    expect(screen.getByTestId('nfc-diff').props.children).toBe('−Rp16.000');
    expect(screen.getByTestId('nfc-account').props.children).toBe('E-money Mandiri · •••• 7731');
    expect(screen.getByText(importCategoryLabel())).toBeTruthy();
    expect(screen.getByTestId('nfc-category').props.children).toBe('Penyesuaian saldo');
    expect(screen.getByText('Selisih dicatat sebagai pengeluaran "Penyesuaian saldo" supaya saldo MONO sama dengan kartu. Saldo tidak diubah langsung.')).toBeTruthy();
    expect(screen.getByText('Catat penyesuaian −Rp16.000')).toBeTruthy();
    expect(screen.getByText('Lewati, jangan catat')).toBeTruthy();
    expect(screen.queryByTestId('nfc-experimental-note')).toBeNull(); // mandiri is not experimental
  });

  test('more on the card: the explanation says income, and the button the positive amount', async () => {
    await openResult(120_500);
    expect(screen.getByTestId('nfc-diff').props.children).toBe('+Rp20.500');
    expect(screen.getByText(/dicatat sebagai pemasukan/)).toBeTruthy();
    expect(screen.getByText('Catat penyesuaian +Rp20.500')).toBeTruthy();
  });

  test('the same balance: says so, offers only Selesai, and records nothing', async () => {
    await openResult(100_000);
    expect(screen.getByText('Saldo MONO sudah sama dengan kartu.')).toBeTruthy();
    expect(screen.queryByTestId('nfc-record')).toBeNull();
    await fireEvent.press(screen.getByTestId('nfc-done'));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect((await mockDb.getFirstAsync<{ n: number }>('select count(*) as n from transactions'))!.n).toBe(0);
  });

  test('an experimental issuer carries the note to compare the numbers; an estimate says so too', async () => {
    await openResult(84_000, { issuer: 'brizzi', estimated: true });
    expect(screen.getByTestId('nfc-experimental-note')).toBeTruthy();
    expect(screen.getByText('Dibaca dengan dukungan percobaan. Cocokkan angkanya dengan struk atau aplikasi banknya.')).toBeTruthy();
    expect(screen.getByTestId('nfc-estimated-note')).toBeTruthy();
  });

  test('Lewati records nothing and goes back', async () => {
    await openResult(84_000);
    await fireEvent.press(screen.getByTestId('nfc-skip'));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect((await mockDb.getFirstAsync<{ n: number }>('select count(*) as n from transactions'))!.n).toBe(0);
    expect(useScanSession.getState().card).toBeNull();
  });

  test('Catat penyesuaian records one expense, the two balances become equal, the snackbar offers Undo, and Undo puts it back', async () => {
    const account = await openResult(84_000);
    await fireEvent.press(screen.getByTestId('nfc-record'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/account/[id]', params: { id: String(account) } }));

    expect(await mockDb.getFirstAsync('select kind, amount, source, description from transactions')).toEqual({ kind: 'expense', amount: 16_000, source: 'nfc', description: 'Penyesuaian saldo dari kartu' });
    expect(await mockDb.getFirstAsync('select balance from v_account_balance where id = ?', [account])).toEqual({ balance: 84_000 });
    expect(await mockDb.getAllAsync('select * from v_integrity_issues')).toEqual([]);

    const toast = useToastStore.getState();
    expect(toast.visible).toBe(true);
    expect(toast.message).toBe('Penyesuaian dicatat. E-money Mandiri sekarang Rp84.000.');
    expect(toast.actionLabel).toBe(undoLabel());

    await act(async () => toast.onAction?.());
    await waitFor(async () => expect(await mockDb.getFirstAsync('select balance from v_account_balance where id = ?', [account])).toEqual({ balance: 100_000 }));
    expect((await mockDb.getFirstAsync<{ n: number }>('select count(*) as n from transactions'))!.n).toBe(0);
  });

  test('more on the card records an income', async () => {
    const account = await openResult(120_500);
    await fireEvent.press(screen.getByTestId('nfc-record'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalled());
    expect(await mockDb.getFirstAsync('select kind, amount from transactions')).toEqual({ kind: 'income', amount: 20_500 });
    expect(await mockDb.getFirstAsync('select balance from v_account_balance where id = ?', [account])).toEqual({ balance: 120_500 });
  });

  test('if the account moved after the screen was drawn, nothing is recorded and the person is told', async () => {
    const account = await openResult(84_000);
    await mockDb.runAsync("insert into transactions (kind, account_id, currency, category_id, amount, amount_idr, occurred_on, description, source, created_at, updated_at) values ('expense', ?, 'IDR', 1, 5000, 5000, '2026-11-02', 'x', 'manual', ?, ?)", [account, NOW, NOW]);
    await fireEvent.press(screen.getByTestId('nfc-record'));
    await waitFor(() => expect(screen.getByTestId('nfc-result-error')).toBeTruthy());
    expect(screen.getByTestId('nfc-result-error').props.children).toBe('Saldo MONO berubah setelah kamu scan. Scan lagi untuk melihat selisih terbaru.');
    expect((await mockDb.getFirstAsync<{ n: number }>("select count(*) as n from transactions where source = 'nfc'"))!.n).toBe(0);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  test('without a card to show, it goes back', async () => {
    await renderRoute(<NfcResultRoute />);
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
  });
});

describe('Kartu baru', () => {
  async function openNew(over: Partial<CardInfo> = {}) {
    useScanSession.getState().setCard(card({ fingerprint: 'fp-new', last4: '1234', balance: 84_000, ...over }));
    await renderRoute(<NfcNewRoute />);
    await waitFor(() => expect(screen.getByTestId('nfc-new')).toBeTruthy());
  }

  test('the exact texts, the default name, the masked number and the balance from the card', async () => {
    await openNew();
    expect(screen.getByText('Kartu baru')).toBeTruthy();
    expect(screen.getByText('Kartu e-money')).toBeTruthy();
    expect(screen.getByText('Saldo di kartu')).toBeTruthy();
    expect(screen.getByText('Nama akun')).toBeTruthy();
    expect(screen.getByTestId('nfc-new-name').props.value).toBe('E-money Mandiri');
    expect(screen.getByTestId('nfc-new-last4').props.children).toBe('•••• 1234');
    expect(screen.getByText('Hanya 4 digit terakhir dan sidik nomor yang disimpan')).toBeTruthy();
    expect(screen.getByText('Diambil dari kartu, bisa diubah')).toBeTruthy();
    expect(screen.getByText('Saldo awal')).toBeTruthy();
    expect(screen.getByTestId('nfc-new-balance').props.value).toBe('84000');
    expect(screen.getByText('Kartu ini belum terdaftar di MONO. Setelah dibuat, scan berikutnya langsung mengenali akunnya.')).toBeTruthy();
    expect(screen.getByText('Buat akun e-money')).toBeTruthy();
    expect(screen.getByText('Tautkan ke akun yang sudah ada')).toBeTruthy();
  });

  test('Buat akun e-money makes an e-wallet account with a link, and the same card is recognised after', async () => {
    await openNew();
    await fireEvent.press(screen.getByTestId('nfc-new-create'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalled());
    const account = await mockDb.getFirstAsync<{ id: number; name: string; type: string; opening_balance: number }>('select id, name, type, opening_balance from accounts');
    expect(account).toMatchObject({ name: 'E-money Mandiri', type: 'ewallet', opening_balance: 84_000 });
    expect((await findCardAccount(mockDb, 'fp-new'))?.account_id).toBe(account!.id);
    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/account/[id]', params: { id: String(account!.id) } });
    expect(useToastStore.getState().message).toBe('Akun E-money Mandiri dibuat.');
  });

  test('the name and the opening balance can be changed first', async () => {
    await openNew();
    await fireEvent.changeText(screen.getByTestId('nfc-new-name'), 'Kartu tol');
    await fireEvent.changeText(screen.getByTestId('nfc-new-balance'), '50000');
    await fireEvent.press(screen.getByTestId('nfc-new-create'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalled());
    expect(await mockDb.getFirstAsync('select name, opening_balance from accounts')).toEqual({ name: 'Kartu tol', opening_balance: 50_000 });
  });

  test('a name that is taken is said in words and nothing is made', async () => {
    await createAccount(mockDb, { name: 'E-money Mandiri', type: 'ewallet', openingBalance: 0, openingDate: '2026-01-01' }, NOW);
    await openNew();
    await fireEvent.press(screen.getByTestId('nfc-new-create'));
    await waitFor(() => expect(screen.getByTestId('nfc-new-error')).toBeTruthy());
    expect(screen.getByTestId('nfc-new-error').props.children).toBe('Kamu sudah punya akun dengan nama ini.');
    expect(await mockDb.getAllAsync('select * from card_links')).toEqual([]);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  test('Tautkan lists the e-wallet accounts that have no card, and linking goes on to the comparison', async () => {
    const gopay = await createAccount(mockDb, { name: 'GoPay', type: 'ewallet', openingBalance: 312_500, openingDate: '2026-01-01' }, NOW);
    await createAccount(mockDb, { name: 'BCA', type: 'bank', openingBalance: 1, openingDate: '2026-01-01' }, NOW);
    await openNew();
    await fireEvent.press(screen.getByTestId('nfc-new-link'));
    await waitFor(() => expect(screen.getByTestId(`nfc-pick-${gopay}`)).toBeTruthy());
    expect(screen.queryByText('BCA')).toBeNull(); // not an e-wallet
    await fireEvent.press(screen.getByTestId(`nfc-pick-${gopay}`));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/nfc/result'));
    expect((await findCardAccount(mockDb, 'fp-new'))?.account_id).toBe(gopay);
  });

  test('with no e-wallet account to link, it says so', async () => {
    await openNew();
    await fireEvent.press(screen.getByTestId('nfc-new-link'));
    await waitFor(() => expect(screen.getByTestId('nfc-picker-empty')).toBeTruthy());
    expect(screen.getByText('Belum ada akun e-wallet yang bisa ditautkan.')).toBeTruthy();
  });
});

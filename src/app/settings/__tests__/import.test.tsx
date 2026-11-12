// /settings/import wired to its data: switching an app on needs an account (the account picker
// opens first when it has none), the refusal reasons are worded, the guide shows only while the
// permission is off, and the allowlist actions are the domain's.
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { FormAccount } from '@/core/tx/validate';
import type { ImportAppRow } from '@/data/repo/importApps';
import * as access from '@/features/import/notifications/access';
import * as native from '@/features/import/notifications/native';
import { useImportAppActions, useImportApps } from '@/features/import/useImportApps';
import { useTxFormData } from '@/features/transactions/form/useTxForm';

import ImportSettingsRoute from '../import';

jest.mock('@/features/import/useImportApps', () => ({ useImportApps: jest.fn(), useImportAppActions: jest.fn() }));
jest.mock('@/features/transactions/form/useTxForm', () => ({ useTxFormData: jest.fn() }));
jest.mock('@/features/import/notifications/native', () => ({
  openAppInfo: jest.fn(),
  openAccessSettings: jest.fn(),
  openBatterySettings: jest.fn(),
  requestRebind: jest.fn(),
}));
jest.mock('@/features/import/notifications/access', () => ({
  ...jest.requireActual('@/features/import/notifications/access'),
  useNotificationAccess: jest.fn(),
}));

const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => ({ back: mockBack, push: mockPush }),
}));

const METRICS = { insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 400, height: 800 } };
const ACCESS_ON = { available: true, accessEnabled: true, connected: true, ignoringBattery: true, lastReadAt: null };
const ACCESS_OFF = { ...ACCESS_ON, accessEnabled: false, connected: false };

const BCA_ACCOUNT: FormAccount = { id: 1, name: 'BCA Tabungan', type: 'bank', icon: 'bca', balance: 100, openingDate: '2026-01-01' };
const GOPAY_ACCOUNT: FormAccount = { id: 2, name: 'GoPay', type: 'ewallet', icon: null, balance: 100, openingDate: '2026-01-01' };
const VALAS_ACCOUNT: FormAccount = { id: 3, name: 'Valas', type: 'forex', icon: null, balance: 100, openingDate: '2026-01-01' };

const row = (over: Partial<ImportAppRow>): ImportAppRow => ({ package: 'com.bca.mobile', app_name: 'BCA mobile', enabled: 0, account_id: null, supported_level: 'generic', last_seen_at: '2026-11-05T07:12:00+07:00', ...over });

const activate = jest.fn();
const deactivate = jest.fn();
const setAccount = jest.fn();

function setup(apps: ImportAppRow[], accessState = ACCESS_ON) {
  (useImportApps as jest.Mock).mockReturnValue({ data: { apps, pending: 0 } });
  (useTxFormData as jest.Mock).mockReturnValue({ data: { accounts: [BCA_ACCOUNT, GOPAY_ACCOUNT, VALAS_ACCOUNT], categories: [], record: null } });
  (useImportAppActions as jest.Mock).mockReturnValue({ activate, deactivate, setAccount });
  (access.useNotificationAccess as jest.Mock).mockReturnValue({ access: accessState, refresh: jest.fn() });
}

async function renderRoute() {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ImportSettingsRoute />
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  activate.mockResolvedValue({ ok: true });
  deactivate.mockResolvedValue({ ok: true });
  setAccount.mockResolvedValue({ ok: true });
});

describe('switching an app on', () => {
  test('without an account the account picker opens first and nothing is switched on yet', async () => {
    setup([row({})]);
    const view = await renderRoute();
    await fireEvent.press(view.getByRole('switch', { name: 'BCA mobile, mati' }));
    expect(activate).not.toHaveBeenCalled();
    expect(view.getByTestId('tx-account-sheet')).toBeTruthy();
  });

  test('choosing an account then switches it on with that account', async () => {
    setup([row({})]);
    const view = await renderRoute();
    await fireEvent.press(view.getByRole('switch', { name: 'BCA mobile, mati' }));
    await fireEvent.press(view.getByTestId('tx-account-option-1'));
    await waitFor(() => expect(activate).toHaveBeenCalledWith('com.bca.mobile', 1));
  });

  test('a Valas account cannot be chosen in the picker', async () => {
    setup([row({})]);
    const view = await renderRoute();
    await fireEvent.press(view.getByRole('switch', { name: 'BCA mobile, mati' }));
    expect(view.getByTestId('tx-account-option-3').props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(view.getByTestId('tx-account-option-3'));
    expect(activate).not.toHaveBeenCalled();
  });

  test('with an account already, it switches on straight away', async () => {
    setup([row({ account_id: 2 })]);
    const view = await renderRoute();
    await fireEvent.press(view.getByRole('switch', { name: 'BCA mobile, mati' }));
    await waitFor(() => expect(activate).toHaveBeenCalledWith('com.bca.mobile', null));
    expect(view.queryByTestId('tx-account-sheet')).toBeNull();
  });

  test('switching off needs no account', async () => {
    setup([row({ enabled: 1, account_id: 1 })]);
    const view = await renderRoute();
    await fireEvent.press(view.getByRole('switch', { name: 'BCA mobile, aktif' }));
    await waitFor(() => expect(deactivate).toHaveBeenCalledWith('com.bca.mobile'));
  });

  test('tapping the row changes the account of an app that already has one', async () => {
    setup([row({ enabled: 1, account_id: 1 })]);
    const view = await renderRoute();
    await fireEvent.press(view.getByTestId('import-app-pick-com.bca.mobile'));
    await fireEvent.press(view.getByTestId('tx-account-option-2'));
    await waitFor(() => expect(setAccount).toHaveBeenCalledWith('com.bca.mobile', 2));
    expect(activate).not.toHaveBeenCalled();
  });
});

describe('refusals are worded for the person', () => {
  test.each([
    ['needs_account', 'Pilih akun MONO tujuan dulu. Tanpa akun, aplikasi tetap mati.'],
    ['account_not_rupiah', 'Impor hanya bisa ke akun rupiah, bukan akun Valas.'],
    ['account_missing', 'Akun itu tidak ditemukan atau sudah diarsipkan.'],
    ['unexpected', 'Tidak bisa mengubah pengaturan. Tidak ada yang berubah.'],
  ])('%s', async (code, text) => {
    setup([row({ account_id: 1 })]);
    activate.mockResolvedValue({ ok: false, code });
    const view = await renderRoute();
    await fireEvent.press(view.getByRole('switch', { name: 'BCA mobile, mati' }));
    await waitFor(() => expect(view.getByText(text)).toBeTruthy());
  });

  test('a later success clears the message', async () => {
    setup([row({ account_id: 1 })]);
    activate.mockResolvedValueOnce({ ok: false, code: 'needs_account' }).mockResolvedValueOnce({ ok: true });
    const view = await renderRoute();
    await fireEvent.press(view.getByRole('switch', { name: 'BCA mobile, mati' }));
    await waitFor(() => expect(view.getByTestId('import-message')).toBeTruthy());
    await fireEvent.press(view.getByRole('switch', { name: 'BCA mobile, mati' }));
    await waitFor(() => expect(view.queryByTestId('import-message')).toBeNull());
  });
});

describe('the permission guide', () => {
  test('"Aktifkan akses notifikasi" opens it while the permission is off', async () => {
    setup([], ACCESS_OFF);
    const view = await renderRoute();
    expect(view.queryByTestId('import-guide')).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: 'Aktifkan akses notifikasi' }));
    expect(view.getByTestId('import-guide')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Buka pengaturan Android' }));
    expect(native.openAppInfo).toHaveBeenCalledTimes(1);
    await fireEvent.press(view.getByRole('button', { name: 'Langsung ke Akses notifikasi' }));
    expect(native.openAccessSettings).toHaveBeenCalledTimes(1);
  });

  test('"Nanti saja" closes it', async () => {
    setup([], ACCESS_OFF);
    const view = await renderRoute();
    await fireEvent.press(view.getByRole('button', { name: 'Aktifkan akses notifikasi' }));
    await fireEvent.press(view.getByRole('button', { name: 'Nanti saja' }));
    await waitFor(() => expect(view.queryByText('Karena MONO dipasang di luar Play Store, Android 13 ke atas meminta satu langkah tambahan:')).toBeNull());
  });

  test('once the permission is on the guide is not shown, even if it was open', async () => {
    setup([], ACCESS_OFF);
    const view = await renderRoute();
    await fireEvent.press(view.getByRole('button', { name: 'Aktifkan akses notifikasi' }));
    expect(view.getByTestId('import-guide')).toBeTruthy();

    // the person turns access on in Android's settings and comes back
    (access.useNotificationAccess as jest.Mock).mockReturnValue({ access: ACCESS_ON, refresh: jest.fn() });
    await view.rerender(
      <SafeAreaProvider initialMetrics={METRICS}>
        <ImportSettingsRoute />
      </SafeAreaProvider>,
    );
    await act(async () => undefined);
    // the sheet's panel is gone (its empty wrapper may linger for the exit animation)
    expect(view.queryByTestId('import-guide-open')).toBeNull();
    expect(view.getByTestId('import-guide').props.pointerEvents).toBe('none');
  });

  test('the problem link opens the guide too, and the service can be restarted', async () => {
    setup([row({ enabled: 1, account_id: 1 })], ACCESS_OFF);
    const view = await renderRoute();
    await fireEvent.press(view.getByRole('button', { name: 'Buka panduan izin' }));
    expect(view.getByTestId('import-guide')).toBeTruthy();
  });

  test('restart and battery links reach the native module', async () => {
    setup([row({ enabled: 1, account_id: 1 })], { ...ACCESS_ON, connected: false, ignoringBattery: false });
    const view = await renderRoute();
    await fireEvent.press(view.getByRole('button', { name: 'Hidupkan ulang' }));
    expect(native.requestRebind).toHaveBeenCalledTimes(1);
    await fireEvent.press(view.getByRole('button', { name: 'Buka pengaturan baterai' }));
    expect(native.openBatterySettings).toHaveBeenCalledTimes(1);
  });
});

describe('the screen', () => {
  test('waits for its data', async () => {
    (useImportApps as jest.Mock).mockReturnValue({ data: undefined });
    (useTxFormData as jest.Mock).mockReturnValue({ data: undefined });
    (useImportAppActions as jest.Mock).mockReturnValue({ activate, deactivate, setAccount });
    (access.useNotificationAccess as jest.Mock).mockReturnValue({ access: ACCESS_ON, refresh: jest.fn() });
    const view = await renderRoute();
    expect(view.queryByRole('header', { name: 'Impor otomatis' })).toBeNull();
  });

  test('back goes back', async () => {
    setup([], ACCESS_OFF);
    const view = await renderRoute();
    await fireEvent.press(view.getByRole('button', { name: 'Back' }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});

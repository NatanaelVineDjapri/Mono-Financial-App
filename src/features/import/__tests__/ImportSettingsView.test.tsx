// Automatic import, the screen (Import-Setup and Import-Settings) and the permission guide
// (Import-Permission), drawn from plain props.
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { ImportAppRow } from '@/data/repo/importApps';

import { ImportPermissionSheet } from '../ImportPermissionSheet';
import { appCode, ImportScreenView, type ImportScreenViewProps } from '../ImportSettingsView';
import type { AccessSnapshot } from '../notifications/access';

const METRICS = { insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 400, height: 800 } };

const ON: AccessSnapshot = { available: true, accessEnabled: true, connected: true, ignoringBattery: true, lastReadAt: Date.UTC(2026, 10, 5, 0, 12, 0) };
const OFF: AccessSnapshot = { available: true, accessEnabled: false, connected: false, ignoringBattery: true, lastReadAt: null };

const app = (over: Partial<ImportAppRow>): ImportAppRow => ({
  package: 'com.bca.mobile',
  app_name: 'BCA mobile',
  enabled: 0,
  account_id: null,
  supported_level: 'generic',
  last_seen_at: '2026-11-05T07:12:00+07:00',
  ...over,
});

const BCA = app({ enabled: 1, account_id: 1 });
const GOPAY = app({ package: 'com.gojek.gopay', app_name: 'GoPay', enabled: 1, account_id: 2 });
const DANA = app({ package: 'id.dana', app_name: 'DANA' });
const NAMES = new Map([
  [1, 'BCA Tabungan'],
  [2, 'GoPay'],
]);

function handlers() {
  return {
    onBack: jest.fn(),
    onOpenGuide: jest.fn(),
    onToggle: jest.fn(),
    onPickAccount: jest.fn(),
    onOpenPending: jest.fn(),
    onRestartService: jest.fn(),
    onOpenBattery: jest.fn(),
  };
}

async function renderView(over: Partial<ImportScreenViewProps> = {}) {
  const h = handlers();
  const view = await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ImportScreenView access={ON} apps={[]} pending={0} accountNames={NAMES} message={null} {...h} {...over} />
    </SafeAreaProvider>,
  );
  return { view, h };
}

describe('Import-Setup: nothing set up yet', () => {
  test('explains what is read and what is not, and offers to turn on access', async () => {
    const { view, h } = await renderView({ access: OFF });
    expect(view.getByTestId('import-setup')).toBeTruthy();
    expect(view.getByRole('header', { name: 'Impor otomatis' })).toBeTruthy();
    expect(view.getByText(/Kurangi catat manual\./)).toBeTruthy();
    expect(view.getByText('Notifikasi Android')).toBeTruthy();
    expect(view.getByText('Belum aktif')).toBeTruthy();
    expect(view.getByText('Yang dibaca MONO')).toBeTruthy();
    expect(view.getByText('Hanya notifikasi dari aplikasi yang kamu pilih.')).toBeTruthy();
    expect(view.getByText('Yang tidak dibaca atau disimpan')).toBeTruthy();
    expect(view.getByText('Isi lengkap pesan. Yang disimpan hanya hasil bacanya.')).toBeTruthy();
    expect(view.getByText('Kata sandi atau PIN. MONO tidak pernah memintanya.')).toBeTruthy();

    await fireEvent.press(view.getByRole('button', { name: 'Aktifkan akses notifikasi' }));
    expect(h.onOpenGuide).toHaveBeenCalledTimes(1);
  });

  test('Gmail is not on the screen at all: that source is postponed', async () => {
    const { view } = await renderView({ access: OFF });
    expect(view.queryByText(/gmail|email|google/i)).toBeNull();
    expect(view.queryByText(/Hubungkan/)).toBeNull();
  });

  test('the back arrow leaves', async () => {
    const { view, h } = await renderView({ access: OFF });
    await fireEvent.press(view.getByRole('button', { name: 'Back' }));
    expect(h.onBack).toHaveBeenCalledTimes(1);
  });

  test('a build without the native reader says so', async () => {
    const { view } = await renderView({ access: { ...OFF, available: false } });
    expect(view.getByTestId('import-native-missing')).toBeTruthy();
    expect(view.getByText(/Pembaca notifikasi belum ada di build ini/)).toBeTruthy();
  });
});

describe('Import-Settings: set up', () => {
  test('access status, last read time and the empty "Didukung penuh" group', async () => {
    const { view } = await renderView({ apps: [BCA] });
    expect(view.getByTestId('import-settings')).toBeTruthy();
    expect(view.getByText('Akses notifikasi')).toBeTruthy();
    expect(view.getByText(/^Terakhir membaca 5 Nov 2026, 07:12$/)).toBeTruthy();
    expect(view.getByText('Didukung penuh')).toBeTruthy();
    expect(view.getByTestId('import-full-empty')).toBeTruthy();
  });

  test('no notification read yet', async () => {
    const { view } = await renderView({ apps: [BCA], access: { ...ON, lastReadAt: null } });
    expect(view.getByText('Belum ada notifikasi yang dibaca')).toBeTruthy();
  });

  test('"Aplikasi terdeteksi": a row per app with its account, an unlinked one saying so, and the help text', async () => {
    const { view } = await renderView({ apps: [BCA, GOPAY, DANA] });
    expect(view.getByText('Aplikasi terdeteksi')).toBeTruthy();
    expect(view.getByTestId('import-detected-list')).toBeTruthy();
    expect(view.getByText('BCA mobile')).toBeTruthy();
    expect(view.getByText('Ke akun BCA Tabungan')).toBeTruthy();
    expect(view.getByText('Ke akun GoPay')).toBeTruthy();
    expect(view.getByText('DANA')).toBeTruthy();
    expect(view.getByText('Belum dipetakan ke akun')).toBeTruthy();
    expect(view.getByText('Dibaca dengan pembacaan umum. Hasilnya selalu perlu kamu periksa.')).toBeTruthy();
    expect(view.getByText('Hanya aplikasi yang menyala di atas yang dibaca. Tiap aplikasi dihubungkan ke satu akun MONO.')).toBeTruthy();
    // the three-letter tiles
    expect(view.getByText('BCA')).toBeTruthy();
    expect(view.getByText('DAN')).toBeTruthy();
  });

  test('the switches show on and off, and tapping one reports the new value', async () => {
    const { view, h } = await renderView({ apps: [BCA, DANA] });
    expect(view.getByRole('switch', { name: 'BCA mobile, aktif' }).props.accessibilityState).toMatchObject({ checked: true });
    expect(view.getByRole('switch', { name: 'DANA, mati' }).props.accessibilityState).toMatchObject({ checked: false });

    await fireEvent.press(view.getByRole('switch', { name: 'DANA, mati' }));
    expect(h.onToggle).toHaveBeenCalledWith(DANA, true);
    await fireEvent.press(view.getByRole('switch', { name: 'BCA mobile, aktif' }));
    expect(h.onToggle).toHaveBeenCalledWith(BCA, false);
  });

  test('tapping the row (not the switch) is for choosing the account', async () => {
    const { view, h } = await renderView({ apps: [BCA, DANA] });
    await fireEvent.press(view.getByTestId('import-app-pick-id.dana'));
    expect(h.onPickAccount).toHaveBeenCalledWith(DANA);
  });

  test('an app with a parser of its own is listed under "Didukung penuh", the others stay detected', async () => {
    const full = app({ package: 'com.bca.full', app_name: 'BCA khusus', supported_level: 'full', enabled: 1, account_id: 1 });
    const { view } = await renderView({ apps: [full, DANA] });
    expect(view.queryByTestId('import-full-empty')).toBeNull();
    expect(view.getByTestId('import-full-list')).toBeTruthy();
    expect(view.getByText('BCA khusus')).toBeTruthy();
    expect(view.getByTestId('import-detected-list')).toBeTruthy();
  });

  test('no detected app yet: an explanation instead of an empty box', async () => {
    const { view } = await renderView({ apps: [] });
    expect(view.getByTestId('import-detected-empty')).toBeTruthy();
    expect(view.getByText(/Belum ada aplikasi yang terdeteksi/)).toBeTruthy();
  });

  test('a refusal is shown above the list', async () => {
    const { view } = await renderView({ apps: [BCA], message: 'Pilih akun MONO tujuan dulu. Tanpa akun, aplikasi tetap mati.' });
    expect(view.getByTestId('import-message')).toBeTruthy();
    expect(view.getByText('Pilih akun MONO tujuan dulu. Tanpa akun, aplikasi tetap mati.')).toBeTruthy();
  });
});

describe('the link to the review queue', () => {
  test('nothing waits yet: the card says so and is not a button', async () => {
    const { view, h } = await renderView({ apps: [BCA], pending: 0 });
    expect(view.getByText('Belum ada transaksi yang menunggu tinjauan')).toBeTruthy();
    expect(view.getByText('Belum ada yang tersimpan')).toBeTruthy();
    await fireEvent.press(view.getByTestId('import-pending'));
    expect(h.onOpenPending).not.toHaveBeenCalled();
  });

  test('with items waiting it reads "N transaksi menunggu tinjauan" and opens the queue', async () => {
    const { view, h } = await renderView({ apps: [BCA], pending: 4 });
    expect(view.getByText('4 transaksi menunggu tinjauan')).toBeTruthy();
    await fireEvent.press(view.getByTestId('import-pending'));
    expect(h.onOpenPending).toHaveBeenCalledTimes(1);
  });
});

describe('"Kalau ada masalah"', () => {
  test('access off with an app switched on: a red problem with a link to the guide', async () => {
    const { view, h } = await renderView({ apps: [BCA], access: { ...OFF } });
    expect(view.getByText('Kalau ada masalah')).toBeTruthy();
    expect(view.getByTestId('import-problem-access_off')).toBeTruthy();
    expect(view.getByText(/Akses notifikasi mati\./)).toBeTruthy();
    expect(view.getByText('Mati')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Buka panduan izin' }));
    expect(h.onOpenGuide).toHaveBeenCalledTimes(1);
  });

  test('the service stopped (the phone killed it): a problem with a way to restart it', async () => {
    const { view, h } = await renderView({ apps: [BCA], access: { ...ON, connected: false } });
    expect(view.getByTestId('import-problem-service_stopped')).toBeTruthy();
    expect(view.getByText(/MONO berhenti membaca\./)).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Hidupkan ulang' }));
    expect(h.onRestartService).toHaveBeenCalledTimes(1);
  });

  test('battery optimisation: a note with a link to the battery settings', async () => {
    const { view, h } = await renderView({ apps: [BCA], access: { ...ON, ignoringBattery: false } });
    expect(view.getByTestId('import-problem-battery')).toBeTruthy();
    expect(view.getByText(/Atur MONO ke "Tanpa pembatasan"/)).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Buka pengaturan baterai' }));
    expect(h.onOpenBattery).toHaveBeenCalledTimes(1);
  });

  test('nothing wrong: the section is not there', async () => {
    const { view } = await renderView({ apps: [BCA] });
    expect(view.queryByText('Kalau ada masalah')).toBeNull();
  });
});

describe('appCode', () => {
  test('three letters from the app name', () => {
    expect(appCode('BCA mobile')).toBe('BCA');
    expect(appCode('GoPay')).toBe('GOP');
    expect(appCode('DANA')).toBe('DAN');
    expect(appCode('ID')).toBe('ID');
    expect(appCode('!!')).toBe('APP');
  });
});

describe('Import-Permission: the guide', () => {
  async function renderSheet(visible = true) {
    const onClose = jest.fn();
    const onOpenSettings = jest.fn();
    const onOpenAccess = jest.fn();
    const view = await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <ImportPermissionSheet visible={visible} onClose={onClose} onOpenSettings={onOpenSettings} onOpenAccess={onOpenAccess} />
      </SafeAreaProvider>,
    );
    return { view, onClose, onOpenSettings, onOpenAccess };
  }

  test('four steps for the restricted settings of Android 13 and up, with the reassurance line', async () => {
    const { view } = await renderSheet();
    expect(view.getByText('Aktifkan akses notifikasi')).toBeTruthy();
    expect(view.getByText(/Karena MONO dipasang di luar Play Store/)).toBeTruthy();
    for (const title of ['Buka Info aplikasi MONO', 'Ketuk titik tiga di pojok kanan atas', 'Buka Akses notifikasi', 'Nyalakan MONO']) {
      expect(view.getByText(title)).toBeTruthy();
    }
    expect(view.getByText('Pilih "Izinkan setelan terbatas".')).toBeTruthy();
    expect(view.getByText('Izin ini bisa kamu cabut kapan saja. MONO tidak membaca notifikasi dari aplikasi yang tidak kamu pilih.')).toBeTruthy();
  });

  test('"Buka pengaturan Android", the direct link and "Nanti saja"', async () => {
    const { view, onClose, onOpenSettings, onOpenAccess } = await renderSheet();
    await fireEvent.press(view.getByRole('button', { name: 'Buka pengaturan Android' }));
    await fireEvent.press(view.getByRole('button', { name: 'Langsung ke Akses notifikasi' }));
    await fireEvent.press(view.getByRole('button', { name: 'Nanti saja' }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(onOpenAccess).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('closed, it draws nothing', async () => {
    const { view } = await renderSheet(false);
    expect(view.queryByText('Aktifkan akses notifikasi')).toBeNull();
  });
});

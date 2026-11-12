// Scan a receipt (/tx/scan): the camera, its permission states, reading, and the failure card.
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { useCameraPermissions } from 'expo-camera';
import { Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useReceiptStore } from '@/features/receipt/store';
import { scanImage } from '@/features/receipt/scan';
import ScanReceiptScreen from '../scan/index';

jest.mock('expo-camera', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const takePictureAsync = jest.fn();
  const CameraView = React.forwardRef(function CameraViewMock(props: object, ref: React.Ref<unknown>) {
    React.useImperativeHandle(ref, () => ({ takePictureAsync }));
    return <View testID="camera" {...props} />;
  });
  return { CameraView, useCameraPermissions: jest.fn(), __takePictureAsync: takePictureAsync };
});
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('@/features/receipt/scan', () => ({ scanImage: jest.fn() }));
jest.mock('@/features/receipt/cache', () => ({ discardCachedImage: jest.fn() }));

const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => ({ replace: mockReplace, back: mockBack }),
}));

const takePicture = (jest.requireMock('expo-camera') as { __takePictureAsync: jest.Mock }).__takePictureAsync;
const permissions = useCameraPermissions as jest.Mock;
const scan = scanImage as jest.Mock;
const pick = ImagePicker.launchImageLibraryAsync as jest.Mock;

const METRICS = { insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 400, height: 800 } };
const request = jest.fn();
const refresh = jest.fn();

const PARSED = {
  merchant: 'Toko Sumber Rejeki',
  date: '2026-10-28',
  dateFromReceipt: true,
  totals: [{ amount: 48000, score: 113 }],
  foreignCurrency: false,
};

function grant(permission: { granted: boolean; status?: string; canAskAgain?: boolean } | null) {
  permissions.mockReturnValue([permission && { status: permission.granted ? 'granted' : 'denied', canAskAgain: false, ...permission }, request, refresh]);
}

async function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ScanReceiptScreen />
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  useReceiptStore.getState().clear();
});

describe('camera permission', () => {
  test('denied: the explanation, "Buka pengaturan" and "Pilih dari galeri" (and a way to fill the form by hand)', async () => {
    grant({ granted: false });
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    const result = await renderScreen();

    expect(result.getByText('Kamera belum diizinkan')).toBeTruthy();
    expect(result.getByText(/dibaca di perangkat, tidak disimpan, dan tidak dikirim ke mana pun/)).toBeTruthy();
    expect(result.queryByTestId('camera')).toBeNull();
    expect(result.queryByTestId('scan-allow-camera')).toBeNull(); // cannot ask again

    await fireEvent.press(result.getByRole('button', { name: 'Buka pengaturan' }));
    expect(openSettings).toHaveBeenCalledTimes(1);

    await fireEvent.press(result.getByTestId('scan-manual'));
    expect(mockReplace).toHaveBeenCalledWith('/tx/add');
    openSettings.mockRestore();
  });

  test('denied once, but the system will still ask: "Izinkan kamera" asks again', async () => {
    grant({ granted: false, canAskAgain: true, status: 'denied' });
    const result = await renderScreen();
    await fireEvent.press(result.getByRole('button', { name: 'Izinkan kamera' }));
    expect(request).toHaveBeenCalledTimes(1);
  });

  test('the first visit asks for the camera by itself', async () => {
    grant({ granted: false, canAskAgain: true, status: 'undetermined' });
    await renderScreen();
    expect(request).toHaveBeenCalledTimes(1);
  });

  test('"Pilih dari galeri" works without the camera: the picked photo is read', async () => {
    grant({ granted: false });
    pick.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cache/ImagePicker/a.jpg' }] });
    scan.mockResolvedValue({ ok: true, parsed: PARSED });
    const result = await renderScreen();

    await fireEvent.press(result.getByTestId('scan-gallery'));
    await waitFor(() => expect(scan).toHaveBeenCalledWith('file:///cache/ImagePicker/a.jpg', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/tx/scan/review'));
  });

  test('nothing is shown until the permission is known', async () => {
    grant(null);
    const result = await renderScreen();
    expect(result.queryByText('Kamera belum diizinkan')).toBeNull();
    expect(result.queryByTestId('camera')).toBeNull();
  });
});

describe('the camera', () => {
  beforeEach(() => grant({ granted: true }));

  test('shows the viewfinder, the hint and the four controls', async () => {
    const result = await renderScreen();
    expect(result.getByTestId('camera')).toBeTruthy();
    expect(result.getByRole('header', { name: 'Scan struk' })).toBeTruthy();
    expect(result.getByText('Masukkan seluruh struk ke dalam bingkai. Pastikan teks terbaca dan tidak buram.')).toBeTruthy();
    expect(result.getByRole('button', { name: 'Tutup' })).toBeTruthy();
    expect(result.getByRole('button', { name: 'Nyalakan flash' })).toBeTruthy();
    expect(result.getByRole('button', { name: 'Pilih dari galeri' })).toBeTruthy();
    expect(result.getByRole('button', { name: 'Ambil foto' })).toBeTruthy();
    expect(result.getByText('Isi manual')).toBeTruthy();
  });

  test('the flash toggles and is passed to the camera', async () => {
    const result = await renderScreen();
    expect(result.getByTestId('camera').props.flash).toBe('off');
    await fireEvent.press(result.getByRole('button', { name: 'Nyalakan flash' }));
    expect(result.getByTestId('camera').props.flash).toBe('on');
    expect(result.getByRole('button', { name: 'Matikan flash' }).props.accessibilityState).toMatchObject({ selected: true });
  });

  test('the shutter reads the picture and opens the review with the draft in the store', async () => {
    takePicture.mockResolvedValue({ uri: 'file:///cache/Camera/r.jpg' });
    scan.mockResolvedValue({ ok: true, parsed: PARSED, imageUri: 'file:///cache/Camera/r.jpg' });
    const result = await renderScreen();

    await fireEvent.press(result.getByRole('button', { name: 'Ambil foto' }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/tx/scan/review'));
    expect(scan).toHaveBeenCalledWith('file:///cache/Camera/r.jpg', expect.any(String));
    expect(useReceiptStore.getState().result).toEqual(PARSED);
    expect(useReceiptStore.getState().imageUri).toBe('file:///cache/Camera/r.jpg');
  });

  test('while it reads, "Membaca struk…" shows and a second tap does nothing', async () => {
    takePicture.mockResolvedValue({ uri: 'file:///cache/Camera/r.jpg' });
    let finish: (v: unknown) => void = () => undefined;
    scan.mockReturnValue(new Promise(resolve => (finish = resolve)));
    const result = await renderScreen();

    await fireEvent.press(result.getByRole('button', { name: 'Ambil foto' }));
    await waitFor(() => expect(result.getByTestId('scan-reading')).toBeTruthy());
    expect(result.getByText('Membaca struk…')).toBeTruthy();
    // behind the overlay the shutter is hidden from screen readers; a touch that still reached it does nothing
    await fireEvent.press(result.getByTestId('scan-shutter', { includeHiddenElements: true }));
    expect(takePicture).toHaveBeenCalledTimes(1);

    await act(async () => finish({ ok: false, reason: 'unreadable' }));
    await waitFor(() => expect(result.queryByTestId('scan-reading')).toBeNull());
  });

  test('an unreadable receipt: the message with Foto ulang and Isi manual; nothing is saved or stored', async () => {
    takePicture.mockResolvedValue({ uri: 'file:///cache/Camera/r.jpg' });
    scan.mockResolvedValue({ ok: false, reason: 'unreadable' });
    const result = await renderScreen();

    await fireEvent.press(result.getByRole('button', { name: 'Ambil foto' }));
    await waitFor(() => expect(result.getByTestId('scan-failure')).toBeTruthy());
    expect(result.getByText('Struk belum terbaca. Coba foto ulang atau isi manual.')).toBeTruthy();
    expect(useReceiptStore.getState().result).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();

    await fireEvent.press(result.getByRole('button', { name: 'Foto ulang' }));
    expect(result.queryByTestId('scan-failure')).toBeNull();
  });

  test('the failure card leads to the manual form', async () => {
    takePicture.mockResolvedValue({ uri: 'file:///cache/Camera/r.jpg' });
    scan.mockResolvedValue({ ok: false, reason: 'unreadable' });
    const result = await renderScreen();
    await fireEvent.press(result.getByRole('button', { name: 'Ambil foto' }));
    await waitFor(() => expect(result.getByTestId('scan-failure')).toBeTruthy());

    await fireEvent.press(result.getByTestId('scan-failure-manual'));
    expect(mockReplace).toHaveBeenCalledWith('/tx/add');
  });

  test('a foreign-currency receipt is refused with its own sentence and the same two buttons', async () => {
    takePicture.mockResolvedValue({ uri: 'file:///cache/Camera/r.jpg' });
    scan.mockResolvedValue({ ok: false, reason: 'foreign' });
    const result = await renderScreen();
    await fireEvent.press(result.getByRole('button', { name: 'Ambil foto' }));
    await waitFor(() => expect(result.getByText('Struk dalam mata uang asing belum bisa dibaca di sini. Isi manual saja.')).toBeTruthy());
    expect(result.getByRole('button', { name: 'Foto ulang' })).toBeTruthy();
    // the controls behind the card are hidden from screen readers, so there is exactly one of each
    expect(result.getByRole('button', { name: 'Isi manual' })).toBeTruthy();
  });

  test('a camera that fails to take the picture is the same failure card', async () => {
    takePicture.mockRejectedValue(new Error('camera busy'));
    const result = await renderScreen();
    await fireEvent.press(result.getByRole('button', { name: 'Ambil foto' }));
    await waitFor(() => expect(result.getByText('Struk belum terbaca. Coba foto ulang atau isi manual.')).toBeTruthy());
  });

  test('picking from the gallery and cancelling the picker', async () => {
    pick.mockResolvedValue({ canceled: true, assets: [] });
    const result = await renderScreen();
    await fireEvent.press(result.getByRole('button', { name: 'Pilih dari galeri' }));
    await waitFor(() => expect(pick).toHaveBeenCalledTimes(1));
    expect(scan).not.toHaveBeenCalled();
    expect(result.queryByTestId('scan-failure')).toBeNull();
  });

  test('Isi manual replaces this screen with the manual form, and Tutup goes back', async () => {
    const result = await renderScreen();
    await fireEvent.press(result.getByTestId('scan-manual'));
    expect(mockReplace).toHaveBeenCalledWith('/tx/add');
    await fireEvent.press(result.getByRole('button', { name: 'Tutup' }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  test('a draft left from an earlier scan is gone when a new scan starts', async () => {
    useReceiptStore.getState().setResult(PARSED);
    await renderScreen();
    expect(useReceiptStore.getState().result).toBeNull();
  });
});

// "Check reading" says where a notification stops, and never what it says.
import { diagnose, diagnosisLines } from '../diagnosis';

const mockShade = jest.fn();
const mockActive = jest.fn();
jest.mock('../notifications/native', () => ({
  isAccessEnabled: () => true,
  isConnected: () => false,
  describeShade: () => mockShade(),
  getActiveAllowed: () => mockActive(),
}));

const entry = { package: 'com.bca.mybca.omni.android', allowed: true, ongoing: false, groupSummary: false, hasText: true };

test('each notification says what would happen to it, without its text or amount', () => {
  mockShade.mockReturnValue([entry, { ...entry, package: 'com.bca', allowed: false }]);
  mockActive.mockReturnValue([{ package: entry.package, title: 'Catatan Finansial', text: 'Pengeluaran sebesar IDR 52,760.00 di kategori Pembayaran.', bigText: null, postedAt: 0 }]);
  const lines = diagnosisLines(diagnose(['myBCA']));
  expect(lines).toEqual([
    'Akses notifikasi: aktif',
    'Layanan pembaca: TIDAK tersambung',
    'Aktif: myBCA',
    'Di bar, com.bca.mybca.omni.android: bisa dibaca',
    'Di bar, com.bca: diabaikan, app ini belum dinyalakan',
  ]);
  expect(lines.join(' ')).not.toContain('52');
});

test('an empty bar says what to do', () => {
  mockShade.mockReturnValue([]);
  mockActive.mockReturnValue([]);
  expect(diagnosisLines(diagnose([]))).toContain('Aktif: belum ada. Nyalakan app bank di atas.');
});

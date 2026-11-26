import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BASE_WEIGHTS, COMPONENT_IDS, MIN_SPAN_DAYS, MIN_TRANSACTIONS } from '@/domain/health';
import { analysisHowDrop } from '@/i18n';

import HowScreen from '../analysis/how';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => ({ push: jest.fn(), back: mockBack }),
}));

const METRICS = { insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 390, height: 844 } };

async function open() {
  return await render(<SafeAreaProvider initialMetrics={METRICS}><HowScreen /></SafeAreaProvider>);
}

test('title, intro and the five parts with their weights, which add up to 100', async () => {
  await open();
  expect(screen.getByText('Cara menghitung')).toBeTruthy();
  expect(screen.getByText(/tanpa AI, jadi data yang sama selalu memberi skor yang sama/)).toBeTruthy();
  expect(screen.getByText('total 100 poin')).toBeTruthy();
  for (const id of COMPONENT_IDS) {
    expect(screen.getByTestId(`analysis-how-${id}`)).toBeTruthy();
    expect(screen.getAllByText(`${BASE_WEIGHTS[id]} poin`).length).toBeGreaterThan(0);
  }
});

test('the examples are the real formula on the October sample: 21, 7 and 15 points', async () => {
  await open();
  expect(screen.getByText('Contoh: 5 dari 6 = 83% dari 25 poin = 21 poin.')).toBeTruthy();
  expect(screen.getByText(/Contoh: Rp8\.880\.000 ÷ Rp4\.257\.000 = 2,09 bulan = 35% dari 20 poin = 7 poin\./)).toBeTruthy();
  expect(screen.getByText('Contoh: naik 5 dari 5 perbandingan = 15 poin.')).toBeTruthy();
});

test('the thresholds are the ones the formula uses', async () => {
  await open();
  expect(screen.getByText('Penuh di 20% atau lebih. Nol di 0% atau kurang. Di antaranya naik lurus.')).toBeTruthy();
  expect(screen.getByText('Penuh di 20% atau kurang. Nol di 40% atau lebih.')).toBeTruthy();
  expect(screen.getByText(`Skor muncul setelah minimal ${MIN_TRANSACTIONS} transaksi dan data ${MIN_SPAN_DAYS} hari.`)).toBeTruthy();
});

test('explains the savings-drop deduction with the numbers the formula uses', async () => {
  await open();
  expect(screen.getByText(analysisHowDrop(2, 15, 10))).toBeTruthy();
});

test('what the score means: the four bands and their ranges', async () => {
  await open();
  for (const [range, name] of [['80 – 100', 'Sehat'], ['60 – 79', 'Cukup'], ['40 – 59', 'Rawan'], ['0 – 39', 'Perlu dibenahi']]) {
    expect(screen.getByText(range)).toBeTruthy();
    expect(screen.getAllByText(name).length).toBeGreaterThan(0);
  }
});

test('says it is not financial advice, and back goes back', async () => {
  await open();
  expect(screen.getByText('Skor dibuat dari catatanmu sendiri dan bukan nasihat keuangan.')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('analysis-how-back'));
  expect(mockBack).toHaveBeenCalled();
});

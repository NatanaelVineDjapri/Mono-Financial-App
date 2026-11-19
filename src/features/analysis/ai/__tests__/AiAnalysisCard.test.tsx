import { fireEvent, render, screen } from '@testing-library/react-native';

import { AiAnalysisCard, type AiAnalysisCardProps } from '../AiAnalysisCard';

const handlers = { onSetup: jest.fn(), onAllow: jest.fn(), onNotNow: jest.fn(), onTurnOff: jest.fn(), onRetry: jest.fn() };

async function show(state: AiAnalysisCardProps['state']) {
  return await render(<AiAnalysisCard state={state} {...handlers} />);
}

beforeEach(() => jest.clearAllMocks());

test('hidden: nothing is drawn', async () => {
  await show({ kind: 'hidden' });
  expect(screen.queryByTestId('analysis-ai')).toBeNull();
});

test('every state says the words are written by AI', async () => {
  await show({ kind: 'loading' });
  expect(screen.getByText('Analisis AI')).toBeTruthy();
  expect(screen.getByText('Ditulis AI')).toBeTruthy();
  expect(screen.getByTestId('analysis-ai-loading')).toBeTruthy();
});

test('setup: explains and opens the AI setup', async () => {
  await show({ kind: 'setup' });
  await fireEvent.press(screen.getByTestId('analysis-ai-setup'));
  expect(handlers.onSetup).toHaveBeenCalled();
});

test('consent: says what is sent and what is never sent, and offers Allow and Not now', async () => {
  await show({ kind: 'consent' });
  expect(screen.getByText(/10 pengeluaran terbesar/)).toBeTruthy();
  expect(screen.getByText(/Tidak pernah dikirim: nama akun, saldo, target, catatan, struk, cadangan, atau kuncimu/)).toBeTruthy();
  expect(screen.getByText(/otomatis/)).toBeTruthy();
  await fireEvent.press(screen.getByTestId('analysis-ai-allow'));
  expect(handlers.onAllow).toHaveBeenCalled();
  await fireEvent.press(screen.getByTestId('analysis-ai-later'));
  expect(handlers.onNotNow).toHaveBeenCalled();
});

test('ready: the summary, the findings, the tips, the warning and the two links', async () => {
  await show({
    kind: 'ready',
    result: {
      summary: 'Bulan ini keuanganmu sehat.',
      findings: [{ title: 'Shopping melebihi batas', body: 'Terpakai Rp812.000 dari Rp700.000.' }],
      tips: ['Sisihkan Rp112.000.'],
    },
  });
  expect(screen.getByTestId('analysis-ai-summary').props.children).toBe('Bulan ini keuanganmu sehat.');
  expect(screen.getByText('Shopping melebihi batas')).toBeTruthy();
  expect(screen.getByText('• Sisihkan Rp112.000.')).toBeTruthy();
  expect(screen.getByText(/Bisa keliru dan bukan nasihat keuangan/)).toBeTruthy();
  await fireEvent.press(screen.getByTestId('analysis-ai-regenerate'));
  expect(handlers.onRetry).toHaveBeenCalled();
  await fireEvent.press(screen.getByTestId('analysis-ai-turn-off'));
  expect(handlers.onTurnOff).toHaveBeenCalled();
});

test('ready with no findings and no tips draws only the summary', async () => {
  await show({ kind: 'ready', result: { summary: 'Data masih sedikit.', findings: [], tips: [] } });
  expect(screen.queryByTestId('analysis-ai-finding-0')).toBeNull();
  expect(screen.queryByTestId('analysis-ai-tips')).toBeNull();
});

test('an error is a sentence written by the app, with a retry; a rejected key goes to the settings', async () => {
  await show({ kind: 'error', code: 'no_internet' });
  expect(screen.getByTestId('analysis-ai-error')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('analysis-ai-retry'));
  expect(handlers.onRetry).toHaveBeenCalled();
});

test('a rejected key offers the AI settings, not a retry', async () => {
  await show({ kind: 'error', code: 'key_rejected' });
  expect(screen.queryByTestId('analysis-ai-retry')).toBeNull();
  await fireEvent.press(screen.getByText('Buka pengaturan AI'));
  expect(handlers.onSetup).toHaveBeenCalled();
});

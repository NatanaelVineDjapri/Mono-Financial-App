import { fireEvent, render } from '@testing-library/react-native';

import { processResponse, type InterpretResult } from '../interpret';
import { errorMessage, outOfScopeMessage } from '../messages';
import type { ClarifyResult, ErrorResult, OutOfScopeResult } from '../chatStore';
import { AssistantBubble, UserBubble } from '../ui/Bubbles';
import { ClarifyCard, ErrorCard, OutOfScopeCard, ProcessingBubble } from '../ui/MessageCards';
import { CTX, response, tx } from './fixtures';

function clarify(items: Parameters<typeof tx>[0][], message: string): ClarifyResult {
  const result: InterpretResult = processResponse(response('clarify', items.map(i => tx(i))), message, CTX);
  if (result.kind !== 'clarify') throw new Error(result.kind);
  return result;
}

// The mascot's picture is an asset whose path a snapshot would record: keep it out of the snapshot.
jest.mock('../ui/MascotAvatar', () => ({ MascotAvatar: () => null }));

const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

describe('bubbles', () => {
  test('the person\'s bubble: solid light, dark text, radius 16/16/4/16, at most 80% wide, read as "Kamu: …"', async () => {
    const result = await render(<UserBubble text="kopi 25rb pake gopay" />);
    const text = result.getByLabelText('Kamu: kopi 25rb pake gopay');
    expect(text.props.accessibilityRole).toBe('text');
    expect(flat(text.props.style).color).toBe('#0A0A0A');
    // the bubble is the text's parent
    const bubble = result.getByText('kopi 25rb pake gopay').parent!;
    expect(flat(bubble.props.style)).toMatchObject({ backgroundColor: '#F5F5F5', maxWidth: '80%', borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottomRightRadius: 4, borderBottomLeftRadius: 16 });
  });

  test('the assistant\'s bubble: a card #151516 with a 1px #272728 border, radius 16/16/16/4, read as "MONO: …"', async () => {
    const result = await render(<AssistantBubble text="Halo!" />);
    expect(result.getByLabelText('MONO: Halo!')).toBeTruthy();
    const card = result.getByText('Halo!').parent!;
    expect(flat(card.props.style)).toMatchObject({ backgroundColor: '#151516', borderWidth: 1, borderColor: '#272728', borderBottomLeftRadius: 4, borderTopLeftRadius: 16 });
  });

  test('the newest reply is a polite live region; older ones are not', async () => {
    const live = await render(<AssistantBubble text="Baru" live />);
    expect(live.getByText('Baru').props.accessibilityLiveRegion).toBe('polite');
    const old = await render(<AssistantBubble text="Lama" />);
    expect(old.getByText('Lama').props.accessibilityLiveRegion).toBe('none');
  });
});

describe('ClarifyCard (K3, 1)', () => {
  test('"bayar 150rb": the question, an account chip per rupiah account and a category chip per expense category', async () => {
    const result = clarify([{ amount: 150000, amount_text: '150rb', description: 'Bayar' }], 'bayar 150rb');
    const onChoose = jest.fn();
    const screen = await render(<ClarifyCard result={result} onChoose={onChoose} onRecordAsExpense={jest.fn()} onCancel={jest.fn()} />);

    expect(screen.getByText('Dari akun mana, dan untuk apa? Satu ketukan cukup.')).toBeTruthy();
    for (const name of ['BCA Tabungan', 'Cash wallet', 'GoPay', 'Jago Pocket', 'Food & drink', 'Transport', 'Shopping', 'Bills']) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
    expect(screen.queryByRole('button', { name: 'Salary' })).toBeNull(); // an income category, not for an expense
    expect(screen.queryByTestId('record-as-expense')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'GoPay' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Bills' }));
    expect(onChoose).toHaveBeenNthCalledWith(1, 'account', 3);
    expect(onChoose).toHaveBeenNthCalledWith(2, 'category', 13);
  });

  test('a missing amount: the question and no chips at all', async () => {
    const result = clarify([{ description: 'Bensin', category: 'Transport', account: 'Cash wallet' }], 'isi bensin pake cash');
    const screen = await render(<ClarifyCard result={result} onChoose={jest.fn()} onRecordAsExpense={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByText('Berapa nominalnya?')).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  test('a transfer to an unknown name: the fixed sentence and two buttons, "Catat pengeluaran" and "Batal"', async () => {
    const result = clarify([{ type: 'transfer', amount: 200000, amount_text: '200rb', description: 'Ke Budi', account: 'BCA Tabungan', to_account: 'Budi' }], 'transfer ke Budi 200rb dari bca');
    const onRecord = jest.fn();
    const onCancel = jest.fn();
    const screen = await render(<ClarifyCard result={result} onChoose={jest.fn()} onRecordAsExpense={onRecord} onCancel={onCancel} />);
    expect(screen.getByText('Aku tidak menemukan akun bernama “Budi”. Transfer hanya bisa antar akunmu sendiri. Mau dicatat sebagai pengeluaran?')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Catat pengeluaran' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Batal' }));
    expect(onRecord).toHaveBeenCalledWith('d1');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test('chips have a 40 dp height and are reachable by role and name', async () => {
    const result = clarify([{ amount: 150000, amount_text: '150rb', description: 'Bayar', account: 'GoPay' }], 'bayar 150rb pake gopay');
    const screen = await render(<ClarifyCard result={result} onChoose={jest.fn()} onRecordAsExpense={jest.fn()} onCancel={jest.fn()} />);
    expect(flat(screen.getByRole('button', { name: 'Bills' }).props.style).height).toBe(40);
  });

  test('snapshot', async () => {
    const result = clarify([{ amount: 150000, amount_text: '150rb', description: 'Bayar' }], 'bayar 150rb');
    const screen = await render(<ClarifyCard result={result} onChoose={jest.fn()} onRecordAsExpense={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.toJSON()).toMatchSnapshot();
  });
});

function outOfScope(reason: OutOfScopeResult['reason']): OutOfScopeResult {
  return { kind: 'out_of_scope', reason, ...outOfScopeMessage(reason) };
}

describe('OutOfScopeCard (K3, 3 / K5, 1)', () => {
  test('the fixed sentence with example chips that only fill the input; no warning icon and no alert role', async () => {
    const onExample = jest.fn();
    const screen = await render(<OutOfScopeCard result={outOfScope('question')} onExample={onExample} onOpenAccounts={jest.fn()} />);
    expect(screen.getByText('Aku cuma bisa mencatat transaksi. Coba ketik seperti “kopi 25rb pake gopay”.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Kopi 25rb pake gopay' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Transfer 500rb BCA ke Jago' }));
    expect(onExample).toHaveBeenNthCalledWith(1, 'Kopi 25rb pake gopay');
    expect(onExample).toHaveBeenNthCalledWith(2, 'Transfer 500rb BCA ke Jago');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test.each(['advice', 'override', 'other'] as const)('%s gets the same sentence', async reason => {
    const screen = await render(<OutOfScopeCard result={outOfScope(reason)} onExample={jest.fn()} onOpenAccounts={jest.fn()} />);
    expect(screen.getByText('Aku cuma bisa mencatat transaksi. Coba ketik seperti “kopi 25rb pake gopay”.')).toBeTruthy();
  });

  test('a balance question points to the Accounts tab with "Buka Accounts"', async () => {
    const onOpen = jest.fn();
    const screen = await render(<OutOfScopeCard result={outOfScope('data_lookup')} onExample={jest.fn()} onOpenAccounts={onOpen} />);
    expect(screen.getByText('Aku tidak membaca saldomu, aku hanya mencatat. Saldo ada di tab Accounts.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Buka Accounts' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

function error(code: ErrorResult['code']): ErrorResult {
  return { kind: 'error', code, ...errorMessage(code) };
}

describe('ErrorCard (K3, 4): what happened, nothing changed, another way', () => {
  const setup = async (code: ErrorResult['code']) => {
    const handlers = { onManual: jest.fn(), onOpenSettings: jest.fn(), onRetry: jest.fn() };
    const screen = await render(<ErrorCard result={error(code)} {...handlers} />);
    return { screen, ...handlers };
  };

  test('no internet: the sentence and "Catat manual"', async () => {
    const { screen, onManual } = await setup('no_internet');
    expect(screen.getByText('Tidak ada internet.')).toBeTruthy();
    expect(screen.getByText(/Chat butuh koneksi\. Kamu tetap bisa mencatat manual\./)).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy(); // an icon and words, not colour alone
    await fireEvent.press(screen.getByRole('button', { name: 'Catat manual' }));
    expect(onManual).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Coba lagi' })).toBeNull();
  });

  test('key rejected: "Buka pengaturan AI"', async () => {
    const { screen, onOpenSettings } = await setup('key_rejected');
    expect(screen.getByText('Kunci Gemini ditolak.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Buka pengaturan AI' }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  test('quota and unreadable: "Catat manual"', async () => {
    for (const code of ['quota', 'unreadable'] as const) {
      const { screen } = await setup(code);
      expect(screen.getByRole('button', { name: 'Catat manual' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Coba lagi' })).toBeNull();
    }
    const { screen } = await setup('quota');
    expect(screen.getByText(/Pesanmu tetap ada di kolom ketik\./)).toBeTruthy();
  });

  test('timeout and generic: "Coba lagi" and "Catat manual"', async () => {
    for (const code of ['timeout', 'generic'] as const) {
      const { screen, onRetry } = await setup(code);
      await fireEvent.press(screen.getByRole('button', { name: 'Coba lagi' }));
      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Catat manual' })).toBeTruthy();
    }
    const { screen } = await setup('generic');
    expect(screen.getByText('Gagal memproses.')).toBeTruthy();
    expect(screen.getByText(/Tidak ada yang berubah\./)).toBeTruthy();
  });

  test('the whole message is one alert for TalkBack, with a red 1.5 px frame', async () => {
    const { screen } = await setup('no_internet');
    expect(screen.getByRole('alert').props.accessibilityLabel).toBe('MONO: Tidak ada internet. Chat butuh koneksi. Kamu tetap bisa mencatat manual.');
    expect(flat(screen.getByTestId('error-card').children[0] ? (screen.getByTestId('error-card').props.children as { props: { style: unknown } }).props.style : {})).toMatchObject({ borderWidth: 1.5, borderColor: '#FF6B6B' });
  });
});

describe('ProcessingBubble', () => {
  test('three dots and "Menyiapkan draf…" as a polite live region, and Batal', async () => {
    const onCancel = jest.fn();
    const screen = await render(<ProcessingBubble onCancel={onCancel} />);
    expect(screen.getByText('Menyiapkan draf…')).toBeTruthy();
    expect(screen.getByLabelText('MONO: Menyiapkan draf…').props.accessibilityLiveRegion).toBe('polite');
    await fireEvent.press(screen.getByRole('button', { name: 'Batal' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(flat(screen.getByTestId('processing-cancel').props.style).minHeight).toBeGreaterThanOrEqual(44);
  });
});

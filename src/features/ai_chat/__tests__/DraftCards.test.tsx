import { fireEvent, render } from '@testing-library/react-native';

import { MonoColors } from '@/theme/tokens';

import { evaluateDrafts, type Draft } from '../draft';
import { processResponse } from '../interpret';
import { DraftCard, MultiDraftCard, type DraftCardProps, type MultiDraftCardProps } from '../ui/DraftCards';
import type { Names } from '../ui/draftView';
import { ACCOUNTS, CATEGORIES, CTX, response, tx } from './fixtures';

const names: Names = {
  accounts: new Map(ACCOUNTS.map(a => [a.id, a.name])),
  categories: new Map(CATEGORIES.map(c => [c.id, c.name])),
};

function draftsOf(message: string, ...items: Parameters<typeof tx>[0][]): Draft[] {
  const result = processResponse(response('create_transactions', items.map(i => tx(i))), message, CTX);
  if (result.kind !== 'drafts' && result.kind !== 'clarify') throw new Error(result.kind);
  return result.drafts;
}

const kopi = { amount: 25000, amount_text: '25rb', description: 'Kopi', category: 'Food & drink', account: 'GoPay' };
const bensin = { amount: 4000, amount_text: '40rb', description: 'Bensin', category: 'Transport', account: 'Cash wallet' };
const headphone = { amount: 1500000, amount_text: '1,5jt', description: 'Headphone', category: 'Shopping', account: 'Cash wallet' };
const lunch = { amount: 48000, amount_text: '48rb', description: 'Makan siang', category: 'Food & drink', account: 'Cash wallet' };
const parking = { amount: 5000, amount_text: '5rb', description: 'Parkir', category: 'Transport', account: 'Cash wallet' };

function cardProps(draft: Draft, overrides: Partial<DraftCardProps> = {}): DraftCardProps {
  return {
    draft,
    names,
    hidden: false,
    saved: false,
    saving: false,
    saveError: null,
    onSave: jest.fn(),
    onEdit: jest.fn(),
    onCancel: jest.fn(),
    onPickAmount: jest.fn(),
    testID: 'card',
    ...overrides,
  };
}

const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
const disabled = (el: { props: { accessibilityState?: { disabled?: boolean } } }) => el.props.accessibilityState?.disabled === true;

describe('DraftCard', () => {
  test('a ready draft: tag, unsaved status, signed amount, rows and the local balance after', async () => {
    const [draft] = draftsOf('kopi 25rb pake gopay', kopi);
    const result = await render(<DraftCard {...cardProps(draft)} />);
    for (const text of ['DRAF · PENGELUARAN', 'Belum tersimpan', 'Kopi', '−Rp25.000', 'Kategori', 'Food & drink', 'Akun', 'GoPay', 'Tanggal', 'Saldo GoPay setelah', 'Rp287.500']) {
      expect(result.getByText(text)).toBeTruthy();
    }
    expect(result.getByText('−Rp25.000')).toHaveStyle({ color: MonoColors.negative });
  });

  test('the frame is dashed 1.5 px #737373 on #101011 with radius 16 until saved, then a solid 1 px line', async () => {
    const [draft] = draftsOf('kopi 25rb pake gopay', kopi);
    const unsaved = await render(<DraftCard {...cardProps(draft)} />);
    expect(flat(unsaved.getByTestId('card').props.style)).toMatchObject({ borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#737373', backgroundColor: '#101011', borderRadius: 16, padding: 14 });

    const saved = await render(<DraftCard {...cardProps(draft, { saved: true })} />);
    expect(flat(saved.getByTestId('card').props.style)).toMatchObject({ borderStyle: 'solid', borderWidth: 1 });
    expect(saved.getByText('Tersimpan')).toBeTruthy();
    expect(saved.queryByTestId('draft-save')).toBeNull(); // nothing left to do on a saved card
  });

  test('TalkBack reads one summary of the draft', async () => {
    const [draft] = draftsOf('kopi 25rb pake gopay', kopi);
    const result = await render(<DraftCard {...cardProps(draft)} />);
    expect(result.getByLabelText('Draf pengeluaran, Kopi, minus Rp25.000, Food & drink, GoPay, belum tersimpan')).toBeTruthy();
  });

  test('Simpan, Ubah and Batal call back; Batal is at least 44 high', async () => {
    const [draft] = draftsOf('kopi 25rb pake gopay', kopi);
    const props = cardProps(draft);
    const result = await render(<DraftCard {...props} />);
    await fireEvent.press(result.getByTestId('draft-save'));
    await fireEvent.press(result.getByTestId('draft-edit'));
    await fireEvent.press(result.getByTestId('draft-cancel'));
    expect(props.onSave).toHaveBeenCalledTimes(1);
    expect(props.onEdit).toHaveBeenCalledTimes(1);
    expect(props.onCancel).toHaveBeenCalledTimes(1);
    expect(flat(result.getByTestId('draft-cancel').props.style).minHeight).toBeGreaterThanOrEqual(44);
  });

  test('income is green with a plus; a transfer is never coloured', async () => {
    const [income] = draftsOf('gaji 8jt ke bca', { type: 'income', amount: 8000000, amount_text: '8jt', description: 'Gaji', category: 'Salary', account: 'BCA Tabungan' });
    const a = await render(<DraftCard {...cardProps(income)} />);
    expect(a.getByText('DRAF · PEMASUKAN')).toBeTruthy();
    expect(a.getByText('+Rp8.000.000')).toHaveStyle({ color: MonoColors.positive });

    const [transfer] = draftsOf('transfer 500rb bca ke jago', { type: 'transfer', amount: 500000, amount_text: '500rb', description: 'Ke Jago', account: 'BCA Tabungan', to_account: 'Jago Pocket' });
    const b = await render(<DraftCard {...cardProps(transfer)} />);
    expect(b.getByText('DRAF · TRANSFER')).toBeTruthy();
    expect(b.getByText('Rp500.000')).toHaveStyle({ color: MonoColors.text });
    expect(b.getByText('Dari')).toBeTruthy();
    expect(b.getByText('Ke')).toBeTruthy();
    expect(b.queryByText('Kategori')).toBeNull();
  });

  test('hidden-amounts mode masks the amount and the balance', async () => {
    const [draft] = draftsOf('kopi 25rb pake gopay', kopi);
    const result = await render(<DraftCard {...cardProps(draft, { hidden: true })} />);
    expect(result.queryByText('−Rp25.000')).toBeNull();
    expect(result.queryByText('Rp287.500')).toBeNull();
    expect(result.getAllByText(/Rp••••••••/).length).toBeGreaterThanOrEqual(2);
  });

  test('check amount: a red-framed box with the sentence and one button per amount; Simpan is locked until one is chosen', async () => {
    const [draft] = draftsOf('bensin 40rb cash', bensin);
    const props = cardProps(draft);
    const result = await render(<DraftCard {...props} />);

    const box = result.getByTestId('check-amount-d1');
    expect(flat(box.props.style)).toMatchObject({ borderWidth: 1.5, borderColor: '#FF6B6B' });
    expect(result.getByText('Nominal perlu dicek. Kamu mengetik “40rb” (Rp40.000), drafnya Rp4.000.')).toBeTruthy();
    expect(disabled(result.getByTestId('draft-save'))).toBe(true);
    await fireEvent.press(result.getByTestId('draft-save'));
    expect(props.onSave).not.toHaveBeenCalled();

    await fireEvent.press(result.getByRole('button', { name: 'Pakai Rp40.000' }));
    await fireEvent.press(result.getByRole('button', { name: 'Pakai Rp4.000' }));
    expect(props.onPickAmount).toHaveBeenNthCalledWith(1, 40000);
    expect(props.onPickAmount).toHaveBeenNthCalledWith(2, 4000);
  });

  test('blocked: the sentence with an alert icon, "Ganti akun" and "Ubah jumlah", Simpan disabled', async () => {
    const [draft] = draftsOf('beli headphone 1,5jt pake cash', headphone);
    const props = cardProps(draft);
    const result = await render(<DraftCard {...props} />);

    expect(result.getByText('Draf dibuat, tapi tidak bisa disimpan.')).toBeTruthy();
    expect(result.getByText('Kurang Rp1.050.000. Ganti akun, kecilkan jumlah, atau pindahkan uang dulu.')).toBeTruthy();
    expect(flat(result.getByTestId('blocked-d1').props.style)).toMatchObject({ borderWidth: 1.5, borderColor: '#FF6B6B' });
    expect(result.getByRole('alert')).toBeTruthy();
    expect(disabled(result.getByTestId('draft-save'))).toBe(true);
    await fireEvent.press(result.getByTestId('draft-save'));
    expect(props.onSave).not.toHaveBeenCalled();

    await fireEvent.press(result.getByRole('button', { name: 'Ganti akun' }));
    await fireEvent.press(result.getByRole('button', { name: 'Ubah jumlah' }));
    expect(props.onEdit).toHaveBeenCalledTimes(2);
  });

  test('a draft with a gap (needs) cannot be saved either', async () => {
    const [draft] = draftsOf('bayar 150rb', { amount: 150000, amount_text: '150rb', description: 'Bayar' });
    expect(draft.status.kind).toBe('needs');
    const props = cardProps(draft);
    const result = await render(<DraftCard {...props} />);
    expect(disabled(result.getByTestId('draft-save'))).toBe(true);
  });

  test('while saving, Simpan is disabled and says so; a failed save says why', async () => {
    const [draft] = draftsOf('kopi 25rb pake gopay', kopi);
    const saving = await render(<DraftCard {...cardProps(draft, { saving: true })} />);
    expect(disabled(saving.getByTestId('draft-save'))).toBe(true);
    expect(saving.getByText('Menyimpan…')).toBeTruthy();

    const failed = await render(<DraftCard {...cardProps(draft, { saveError: 'Tidak bisa menyimpan.' })} />);
    expect(failed.getByText('Tidak bisa menyimpan.')).toBeTruthy();
    expect(failed.getByTestId('save-error')).toBeTruthy();
  });

  test.each([
    ['ready', 'kopi 25rb pake gopay', kopi],
    ['check amount', 'bensin 40rb cash', bensin],
    ['blocked', 'beli headphone 1,5jt pake cash', headphone],
  ] as const)('snapshot: %s', async (_name, message, item) => {
    const [draft] = draftsOf(message, item);
    const result = await render(<DraftCard {...cardProps(draft)} />);
    expect(result.toJSON()).toMatchSnapshot();
  });
});

function multiProps(drafts: Draft[], selected: string[], overrides: Partial<MultiDraftCardProps> = {}): MultiDraftCardProps {
  return {
    drafts,
    selected: new Set(selected),
    names,
    hidden: false,
    savedDraftIds: null,
    saving: false,
    saveError: null,
    onToggle: jest.fn(),
    onSave: jest.fn(),
    onEditEach: jest.fn(),
    onCancel: jest.fn(),
    onPickAmount: jest.fn(),
    testID: 'multi',
    ...overrides,
  };
}

describe('MultiDraftCard', () => {
  const two = () => draftsOf('makan siang 48rb cash, parkir 5rb', lunch, parking);

  test('"2 DRAF" with a checkbox per row, the total, the balance after and the buttons', async () => {
    const props = multiProps(two(), ['d1', 'd2']);
    const result = await render(<MultiDraftCard {...props} />);
    for (const text of ['2 DRAF', 'Belum tersimpan', 'Makan siang', 'Parkir', '−Rp48.000', '−Rp5.000', 'Total', '−Rp53.000', 'Saldo Cash wallet setelah', 'Rp397.000']) {
      expect(result.getByText(text)).toBeTruthy();
    }
    expect(result.getByRole('button', { name: 'Simpan 2 transaksi' })).toBeTruthy();
    expect(result.getByRole('button', { name: 'Ubah satu per satu' })).toBeTruthy();
    expect(result.getAllByRole('checkbox')).toHaveLength(2);
    expect(result.getAllByRole('checkbox').every(c => c.props.accessibilityState.checked === true)).toBe(true);
    expect(flat(result.getByTestId('multi').props.style)).toMatchObject({ borderStyle: 'dashed' });
  });

  test('a checkbox is 22 with radius 6; checked is solid light with a check icon', async () => {
    const result = await render(<MultiDraftCard {...multiProps(two(), ['d1'])} />);
    const [first, second] = result.getAllByRole('checkbox');
    expect(first.props.accessibilityState.checked).toBe(true);
    expect(second.props.accessibilityState.checked).toBe(false);
    expect(flat(first.props.style).minHeight).toBeGreaterThanOrEqual(44 - 4);
  });

  test('unticking calls onToggle, and "Simpan N" follows the selection; none ticked disables it', async () => {
    const props = multiProps(two(), ['d1']);
    const result = await render(<MultiDraftCard {...props} />);
    expect(result.getByRole('button', { name: 'Simpan 1 transaksi' })).toBeTruthy();
    await fireEvent.press(result.getAllByRole('checkbox')[1]);
    expect(props.onToggle).toHaveBeenCalledWith('d2');

    const none = await render(<MultiDraftCard {...multiProps(two(), [])} />);
    expect(disabled(none.getByTestId('drafts-save'))).toBe(true);
  });

  test('only ready drafts can be ticked: a blocked row is locked, labelled, and cannot be toggled', async () => {
    const drafts = draftsOf('beli 300rb cash, beli 200rb cash', { amount: 300000, amount_text: '300rb', description: 'A', category: 'Shopping', account: 'Cash wallet' }, { amount: 200000, amount_text: '200rb', description: 'B', category: 'Shopping', account: 'Cash wallet' });
    expect(drafts.map(d => d.status.kind)).toEqual(['ready', 'blocked']);
    const props = multiProps(drafts, ['d1']);
    const result = await render(<MultiDraftCard {...props} />);

    expect(result.getByText('Tidak bisa disimpan')).toBeTruthy();
    const locked = result.getByTestId('draft-row-d2');
    expect(disabled(locked)).toBe(true);
    expect(locked.props.accessibilityLabel).toBe('B, Tidak bisa disimpan');
    await fireEvent.press(locked);
    expect(props.onToggle).not.toHaveBeenCalled();
    expect(result.getByText(/Kurang Rp50\.000/)).toBeTruthy();
  });

  test('a row whose amount needs checking is locked and carries its own two buttons', async () => {
    const drafts = draftsOf('bensin 40rb cash, parkir 5rb', bensin, parking);
    const props = multiProps(drafts, ['d2']);
    const result = await render(<MultiDraftCard {...props} />);
    expect(result.getByText('Nominal perlu dicek')).toBeTruthy();
    expect(disabled(result.getByTestId('draft-row-d1'))).toBe(true);
    await fireEvent.press(result.getByRole('button', { name: 'Pakai Rp40.000' }));
    expect(props.onPickAmount).toHaveBeenCalledWith('d1', 40000);
  });

  test('saved: a solid frame with only the saved rows, no checkboxes and no buttons', async () => {
    const result = await render(<MultiDraftCard {...multiProps(two(), [], { savedDraftIds: ['d1', 'd2'] })} />);
    expect(flat(result.getByTestId('multi').props.style)).toMatchObject({ borderStyle: 'solid', borderWidth: 1 });
    expect(result.getByText('Tersimpan')).toBeTruthy();
    expect(result.queryAllByRole('checkbox')).toHaveLength(0);
    expect(result.queryByTestId('drafts-save')).toBeNull();
  });

  test('TalkBack: the card is announced with its count and total', async () => {
    const result = await render(<MultiDraftCard {...multiProps(two(), ['d1', 'd2'])} />);
    expect(result.getByLabelText('2 draf transaksi, total −Rp53.000, belum tersimpan')).toBeTruthy();
  });

  test('snapshot', async () => {
    const result = await render(<MultiDraftCard {...multiProps(two(), ['d1', 'd2'])} />);
    expect(result.toJSON()).toMatchSnapshot();
  });
});

describe('evaluateDrafts is what the screen calls on every tick', () => {
  test('selection changes the balance the next row is judged against', () => {
    const drafts = draftsOf('beli 300rb cash, beli 200rb cash', { amount: 300000, amount_text: '300rb', category: 'Shopping', account: 'Cash wallet' }, { amount: 200000, amount_text: '200rb', category: 'Shopping', account: 'Cash wallet' });
    expect(evaluateDrafts(drafts, CTX, new Set(['d2']))[1].status.kind).toBe('ready');
  });
});

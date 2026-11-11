import { openTestDb } from '../../../data/db/openTestDb';
import { getPocketBalanceNow } from '../../../data/repo/transactionDetail';
import { getTransaction } from '../../../data/repo/transactions';
import { createAccount } from '../../../domain/accounts';
import {
  chooseAmountForDraft,
  chooseOption,
  discardCard,
  finishEditing,
  recordTransferAsExpense,
  restoreDrafts,
  saveEditedDraft,
  saveSelected,
  sendMessage,
  startEditing,
  toggleDraft,
  type ChatEnv,
} from '../chatActions';
import { useChatStore } from '../chatStore';
import { loadChatContext } from '../chatActions';
import { MAX_CHARS } from '../config';
import { processResponse, type InterpretResult } from '../interpret';
import { replyText } from './fixtures';
import { parseAiResponse } from '../schema';

const NOW = '2026-10-28T12:41:09+07:00';

async function setup(hidden = false) {
  useChatStore.getState().reset();
  const db = openTestDb();
  const bca = await createAccount(db, { name: 'BCA Tabungan', type: 'bank', openingBalance: 6842500, openingDate: '2026-01-01' }, NOW);
  const cash = await createAccount(db, { name: 'Cash wallet', type: 'cash', openingBalance: 450000, openingDate: '2026-01-01' }, NOW);
  const gopay = await createAccount(db, { name: 'GoPay', type: 'ewallet', openingBalance: 312500, openingDate: '2026-01-01' }, NOW);
  const jago = await createAccount(db, { name: 'Jago Pocket', type: 'savings', openingBalance: 1275000, openingDate: '2026-01-01' }, NOW);

  const toasts: { message: string; actionLabel?: string; onAction?: () => void }[] = [];
  const generic: InterpretResult = { kind: 'error', code: 'generic', title: '', detail: '', text: '', action: null, actionLabel: null };
  // What the "model" answers: either a ready result (errors) or a reply that goes through the
  // app's real checks, against the balances sendMessage read at that moment.
  let responder: (message: string, ctx: Parameters<typeof processResponse>[2]) => InterpretResult = () => generic;
  const interpret = jest.fn(async (message: string, ctx: Parameters<typeof processResponse>[2]) => responder(message, ctx)) as unknown as jest.MockedFunction<NonNullable<ChatEnv['interpret']>>;
  const invalidate = jest.fn(async () => {});
  const env: ChatEnv = {
    db,
    invalidate,
    showToast: (message, options) => toasts.push({ message, ...options }),
    isHidden: () => hidden,
    now: () => NOW,
    today: () => '2026-10-28',
    interpret,
  };
  const modelSays = (intent: Parameters<typeof replyText>[0], transactions: Parameters<typeof replyText>[1], extra?: Parameters<typeof replyText>[2]) => {
    responder = (message, ctx) => processResponse(parseAiResponse(replyText(intent, transactions, extra)) as NonNullable<ReturnType<typeof parseAiResponse>>, message, ctx);
  };

  const count = async () => (await db.getFirstAsync<{ n: number }>('select count(*) as n from transactions'))!.n;
  const balance = (id: number) => getPocketBalanceNow(db, id, 'IDR');
  const messages = () => useChatStore.getState().messages;
  const lastAssistant = () => {
    const m = [...messages()].reverse().find(x => x.role === 'assistant');
    if (m?.role !== 'assistant') throw new Error('no assistant message');
    return m;
  };
  return { env, db, ids: { bca, cash, gopay, jago }, toasts, interpret, invalidate, modelSays, count, balance, messages, lastAssistant, setReply: (f: () => InterpretResult) => (responder = f) };
}

const kopi = { amount: 25000, amount_text: '25rb', description: 'Kopi', category: 'Food & drink', account: 'GoPay' };
const lunch = { amount: 48000, amount_text: '48rb', description: 'Makan siang', category: 'Food & drink', account: 'Cash wallet' };
const parking = { amount: 5000, amount_text: '5rb', description: 'Parkir', category: 'Transport', account: 'Cash wallet' };

function draftsContent(f: Awaited<ReturnType<typeof setup>>) {
  const c = f.lastAssistant().content;
  if (c.type !== 'drafts') throw new Error(`expected drafts, got ${c.type}`);
  return c;
}

describe('sending', () => {
  test('a clear message becomes a draft card; the model is called once and nothing is written', async () => {
    const f = await setup();
    f.modelSays('create_transactions', [kopi]);
    expect(await sendMessage(f.env, 'kopi 25rb pake gopay')).toBe('sent');

    expect(f.messages().map(m => m.role)).toEqual(['user', 'assistant']);
    const card = draftsContent(f);
    expect(card.drafts[0]).toMatchObject({ amount: 25000, balanceAfter: 287500, status: { kind: 'ready' } });
    expect(card.selected).toEqual(['d1']);
    expect(card.saved).toBeNull();
    expect(f.interpret).toHaveBeenCalledTimes(1);
    expect(f.count()).resolves.toBe(0);
    expect(useChatStore.getState().processing).toBe(false);
  });

  test('empty, over the limit and while processing are ignored without a call', async () => {
    const f = await setup();
    expect(await sendMessage(f.env, '   ')).toBe('ignored');
    expect(await sendMessage(f.env, 'a'.repeat(MAX_CHARS + 1))).toBe('ignored');
    useChatStore.getState().setProcessing(true);
    expect(await sendMessage(f.env, 'kopi 25rb')).toBe('ignored');
    expect(f.interpret).not.toHaveBeenCalled();
    expect(f.messages()).toHaveLength(0);
  });

  test('an error shows a system card, keeps the bubble, and changes nothing', async () => {
    const f = await setup();
    f.setReply(() => ({ kind: 'error', code: 'no_internet', title: 'Tidak ada internet.', detail: 'x', text: 'Tidak ada internet. x', action: 'manual', actionLabel: 'Catat manual' }));
    expect(await sendMessage(f.env, 'kopi 25rb pake gopay')).toBe('failed');
    expect(f.messages().map(m => m.role)).toEqual(['user', 'assistant']);
    expect(f.lastAssistant().content.type).toBe('error');
    expect(await f.count()).toBe(0);
  });

  test('Batal: an aborted request leaves no trace, and an open question stays open', async () => {
    const f = await setup();
    useChatStore.getState().setPending('bayar 150rb');
    f.setReply(() => ({ kind: 'error', code: 'aborted', title: '', detail: '', text: '', action: null, actionLabel: null }));
    expect(await sendMessage(f.env, 'pakai gopay')).toBe('aborted');
    expect(f.messages()).toHaveLength(0);
    expect(useChatStore.getState().pending).toBe('bayar 150rb');
    expect(useChatStore.getState().processing).toBe(false);
  });

  test('an off-topic message shows the fixed sentence and clears the pending question', async () => {
    const f = await setup();
    useChatStore.getState().setPending('bayar 150rb');
    f.modelSays('out_of_scope', [], { reason: 'data_lookup' });
    await sendMessage(f.env, 'berapa saldo gopay?');
    const c = f.lastAssistant().content;
    expect(c.type === 'out_of_scope' && c.result.text).toBe('Aku tidak membaca saldomu, aku hanya mencatat. Saldo ada di tab Accounts.');
    expect(useChatStore.getState().pending).toBeNull();
  });

  test('a typed answer goes out with the earlier message as pending', async () => {
    const f = await setup();
    f.modelSays('clarify', [{ amount: 150000, amount_text: '150rb', description: 'Bayar' }], { missing: ['account', 'category'] });
    await sendMessage(f.env, 'bayar 150rb');
    expect(useChatStore.getState().pending).toBe('bayar 150rb');
    f.modelSays('create_transactions', [{ amount: 150000, amount_text: '150rb', description: 'Bayar', category: 'Bills', account: 'GoPay' }]);
    await sendMessage(f.env, 'pakai gopay untuk tagihan');
    expect(f.interpret.mock.calls[1][2]).toEqual({ previousMessage: 'bayar 150rb' });
    expect(useChatStore.getState().pending).toBeNull();
  });
});

describe('clarification chips never call the model', () => {
  test('"bayar 150rb": account chip, category chip, then a ready draft; one call in all', async () => {
    const f = await setup();
    f.modelSays('clarify', [{ amount: 150000, amount_text: '150rb', description: 'Bayar' }], { missing: ['account', 'category'] });
    await sendMessage(f.env, 'bayar 150rb');
    const id = f.lastAssistant().id;
    expect(f.lastAssistant().content.type).toBe('clarify');

    await chooseOption(f.env, id, 'account', f.ids.bca);
    const afterAccount = f.lastAssistant().content;
    expect(afterAccount.type === 'clarify' && afterAccount.result.question).toBe('Untuk apa?');

    const bills = (await loadChatContext(f.env)).categories.find(c => c.name === 'Bills')!.id;
    await chooseOption(f.env, id, 'category', bills);
    const card = draftsContent(f);
    expect(card.drafts[0]).toMatchObject({ accountId: f.ids.bca, categoryId: bills, status: { kind: 'ready' }, balanceAfter: 6692500 });
    expect(f.interpret).toHaveBeenCalledTimes(1);
    expect(useChatStore.getState().pending).toBeNull();
  });

  test('a transfer to someone unknown becomes an expense on "Catat pengeluaran", or goes away on Batal', async () => {
    const f = await setup();
    f.modelSays('clarify', [{ type: 'transfer', amount: 200000, amount_text: '200rb', description: 'Ke Budi', account: 'BCA Tabungan', to_account: 'Budi' }], { missing: ['to_account'] });
    await sendMessage(f.env, 'transfer ke Budi 200rb dari bca');
    const id = f.lastAssistant().id;
    const c = f.lastAssistant().content;
    expect(c.type === 'clarify' && c.result.unknownTarget).toEqual({ draftId: 'd1', name: 'Budi' });

    await recordTransferAsExpense(f.env, id, 'd1');
    const next = f.lastAssistant().content;
    expect(next.type === 'clarify' && next.result.question).toBe('Untuk apa?');
    expect(f.interpret).toHaveBeenCalledTimes(1);

    discardCard(id);
    expect(f.messages().filter(m => m.role === 'assistant')).toHaveLength(0);
    expect(useChatStore.getState().pending).toBeNull();
    expect(await f.count()).toBe(0);
  });
});

describe('saving and undoing', () => {
  test('Simpan: one row with source "ai", the card is saved, the toast has the balance and an Urungkan that puts the draft back', async () => {
    const f = await setup();
    f.modelSays('create_transactions', [kopi]);
    await sendMessage(f.env, 'kopi 25rb pake gopay');
    const id = f.lastAssistant().id;

    expect(await saveSelected(f.env, id)).toBe(true);
    expect(await f.count()).toBe(1);
    expect(await f.balance(f.ids.gopay)).toBe(287500);
    const card = draftsContent(f);
    expect(card.saved?.draftIds).toEqual(['d1']);
    expect((await getTransaction(f.db, card.saved!.ids[0]))?.source).toBe('ai');
    expect(f.toasts.at(-1)).toMatchObject({ message: 'Pengeluaran tersimpan. GoPay sekarang Rp287.500.', actionLabel: 'Urungkan' });
    expect(f.invalidate).toHaveBeenCalled();

    f.toasts.at(-1)!.onAction!();
    await new Promise(r => setTimeout(r, 50));
    expect(await f.count()).toBe(0);
    expect(await f.balance(f.ids.gopay)).toBe(312500);
    const back = draftsContent(f);
    expect(back.saved).toBeNull();
    expect(back.drafts[0]).toMatchObject({ status: { kind: 'ready' }, balanceAfter: 287500 });
    expect(back.selected).toEqual(['d1']);
  });

  test('two drafts: "2 transaksi tersimpan." and one Urungkan removes both', async () => {
    const f = await setup();
    f.modelSays('create_transactions', [lunch, parking]);
    await sendMessage(f.env, 'makan siang 48rb cash, parkir 5rb');
    const id = f.lastAssistant().id;
    await saveSelected(f.env, id);
    expect(f.toasts.at(-1)?.message).toBe('2 transaksi tersimpan.');
    expect(await f.balance(f.ids.cash)).toBe(397000);

    f.toasts.at(-1)!.onAction!();
    await new Promise(r => setTimeout(r, 50));
    expect(await f.count()).toBe(0);
    expect(await f.balance(f.ids.cash)).toBe(450000);
    expect(draftsContent(f).drafts.map(d => d.balanceAfter)).toEqual([402000, 397000]);
  });

  test('unticking a row re-judges the rest, and only the ticked rows are saved', async () => {
    const f = await setup();
    f.modelSays('create_transactions', [
      { amount: 300000, amount_text: '300rb', category: 'Shopping', account: 'Cash wallet' },
      { amount: 200000, amount_text: '200rb', category: 'Shopping', account: 'Cash wallet' },
    ]);
    await sendMessage(f.env, 'beli 300rb cash, beli 200rb cash');
    const id = f.lastAssistant().id;
    const first = draftsContent(f);
    expect(first.drafts.map(d => d.status.kind)).toEqual(['ready', 'blocked']);
    expect(first.selected).toEqual(['d1']);

    // a blocked row cannot be ticked
    await toggleDraft(f.env, id, 'd2');
    expect(draftsContent(f).selected).toEqual(['d1']);

    // untick the first: the second now fits, and can be ticked
    await toggleDraft(f.env, id, 'd1');
    expect(draftsContent(f).drafts.map(d => d.status.kind)).toEqual(['ready', 'ready']);
    expect(draftsContent(f).selected).toEqual([]);
    await toggleDraft(f.env, id, 'd2');
    expect(draftsContent(f).selected).toEqual(['d2']);

    await saveSelected(f.env, id);
    expect(await f.count()).toBe(1);
    expect(await f.balance(f.ids.cash)).toBe(250000);
  });

  test('nothing ticked: Simpan does nothing', async () => {
    const f = await setup();
    f.modelSays('create_transactions', [kopi]);
    await sendMessage(f.env, 'kopi 25rb pake gopay');
    const id = f.lastAssistant().id;
    await toggleDraft(f.env, id, 'd1');
    expect(await saveSelected(f.env, id)).toBe(false);
    expect(await f.count()).toBe(0);
  });

  test('a draft whose amount needs checking: nothing is tickable until one amount is chosen, then it saves', async () => {
    const f = await setup();
    f.modelSays('create_transactions', [{ amount: 4000, amount_text: '40rb', description: 'Bensin', category: 'Transport', account: 'Cash wallet' }]);
    await sendMessage(f.env, 'bensin 40rb cash');
    const id = f.lastAssistant().id;
    expect(draftsContent(f).selected).toEqual([]);
    expect(await saveSelected(f.env, id)).toBe(false);
    expect(await f.count()).toBe(0);

    await chooseAmountForDraft(f.env, id, 'd1', 40000);
    expect(draftsContent(f)).toMatchObject({ selected: ['d1'], drafts: [{ amount: 40000, status: { kind: 'ready' }, balanceAfter: 410000 }] });
    await saveSelected(f.env, id);
    expect(f.toasts.at(-1)?.message).toBe('Pengeluaran tersimpan. Cash wallet sekarang Rp410.000.');
  });

  test('a database refusal shows its message on the card and writes nothing', async () => {
    const f = await setup();
    f.modelSays('create_transactions', [{ amount: 440000, amount_text: '440rb', category: 'Shopping', account: 'Cash wallet' }]);
    await sendMessage(f.env, 'beli 440rb cash');
    const id = f.lastAssistant().id;
    // the cash goes elsewhere before Simpan is tapped
    await f.db.runAsync(
      "insert into transactions (kind, account_id, currency, category_id, amount, amount_idr, occurred_on, description, source, created_at, updated_at) values ('expense', $a, 'IDR', 1, 100000, 100000, '2026-10-28', 'x', 'manual', $n, $n)",
      { $a: f.ids.cash, $n: NOW },
    );
    expect(await saveSelected(f.env, id)).toBe(false);
    const card = draftsContent(f);
    expect(card.saved).toBeNull();
    expect(card.saving).toBe(false);
    expect(card.saveError).toBeTruthy();
    expect(await f.count()).toBe(1);
  });

  test('hidden-amounts mode masks the figures in the toast', async () => {
    const f = await setup(true);
    f.modelSays('create_transactions', [kopi]);
    await sendMessage(f.env, 'kopi 25rb pake gopay');
    await saveSelected(f.env, f.lastAssistant().id);
    expect(f.toasts.at(-1)?.message).toBe('Pengeluaran tersimpan. GoPay sekarang Rp••••••••.');
  });

  test('restoreDrafts on a card that was never saved leaves it as a draft', async () => {
    const f = await setup();
    f.modelSays('create_transactions', [kopi]);
    await sendMessage(f.env, 'kopi 25rb pake gopay');
    await restoreDrafts(f.env, f.lastAssistant().id);
    expect(draftsContent(f).saved).toBeNull();
  });
});

describe('edit one by one', () => {
  test('save the first edited, skip the second: the card shows the edited record and one Urungkan brings it back', async () => {
    const f = await setup();
    f.modelSays('create_transactions', [lunch, parking]);
    await sendMessage(f.env, 'makan siang 48rb cash, parkir 5rb');
    const id = f.lastAssistant().id;

    expect(startEditing(id)).toBe(true);
    const session = useChatStore.getState().edit!;
    expect(session.drafts.map(d => d.id)).toEqual(['d1', 'd2']);
    expect(session.sourceMessage).toBe('makan siang 48rb cash, parkir 5rb');

    const saved = await saveEditedDraft(f.env, session.drafts[0], {
      type: 'expense',
      amount: 50000, // edited from 48.000
      categoryId: session.drafts[0].categoryId,
      accountId: f.ids.cash,
      toAccountId: null,
      date: '2026-10-28',
      description: 'Makan siang ber-2',
      note: '',
    });
    expect(saved).toEqual({ ok: true });
    expect(await f.balance(f.ids.cash)).toBe(400000);

    await finishEditing(f.env); // the second one was skipped
    expect(useChatStore.getState().edit).toBeNull();
    const card = draftsContent(f);
    expect(card.saved?.draftIds).toEqual(['d1']);
    expect(card.drafts[0]).toMatchObject({ amount: 50000, description: 'Makan siang ber-2' });
    expect(f.toasts.at(-1)).toMatchObject({ message: 'Pengeluaran tersimpan. Cash wallet sekarang Rp400.000.', actionLabel: 'Urungkan' });

    f.toasts.at(-1)!.onAction!();
    await new Promise(r => setTimeout(r, 50));
    expect(await f.count()).toBe(0);
    expect(draftsContent(f).saved).toBeNull();
    expect(draftsContent(f).drafts[0].amount).toBe(50000);
  });

  test('saving both says "2 transaksi tersimpan." and the second is judged after the first', async () => {
    const f = await setup();
    f.modelSays('create_transactions', [lunch, parking]);
    await sendMessage(f.env, 'makan siang 48rb cash, parkir 5rb');
    startEditing(f.lastAssistant().id);
    const { drafts } = useChatStore.getState().edit!;
    for (const d of drafts) {
      const result = await saveEditedDraft(f.env, d, { type: 'expense', amount: d.amount!, categoryId: d.categoryId, accountId: d.accountId, toAccountId: null, date: d.date, description: d.description, note: '' });
      expect(result.ok).toBe(true);
    }
    await finishEditing(f.env);
    expect(f.toasts.at(-1)?.message).toBe('2 transaksi tersimpan.');
    expect(await f.balance(f.ids.cash)).toBe(397000);
  });

  test('an edit the validation refuses is not saved and is not recorded', async () => {
    const f = await setup();
    f.modelSays('create_transactions', [lunch]);
    await sendMessage(f.env, 'makan siang 48rb cash');
    startEditing(f.lastAssistant().id);
    const d = useChatStore.getState().edit!.drafts[0];
    const result = await saveEditedDraft(f.env, d, { type: 'expense', amount: 9999999, categoryId: d.categoryId, accountId: d.accountId, toAccountId: null, date: d.date, description: '', note: '' });
    expect(result.ok).toBe(false);
    expect(await f.count()).toBe(0);
    expect(useChatStore.getState().edit?.savedIds).toEqual([]);
    await finishEditing(f.env);
    expect(f.toasts).toHaveLength(0);
  });

  test('"Ubah" on one card edits only that draft; a saved card cannot be edited', async () => {
    const f = await setup();
    f.modelSays('create_transactions', [lunch, parking]);
    await sendMessage(f.env, 'makan siang 48rb cash, parkir 5rb');
    const id = f.lastAssistant().id;
    expect(startEditing(id, ['d2'])).toBe(true);
    expect(useChatStore.getState().edit!.drafts.map(d => d.id)).toEqual(['d2']);
    useChatStore.getState().endEdit();
    await saveSelected(f.env, id);
    expect(startEditing(id)).toBe(false);
  });
});

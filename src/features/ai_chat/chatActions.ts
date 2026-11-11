// What happens when the person does something in the chat. Plain functions over the session
// store, with their dependencies passed in (`ChatEnv`), so every flow runs in tests against a
// real SQLite database and no screen. The screens only call these.
//
// Nothing here writes except saveSelected / saveEditedDraft (through saveDrafts.ts, one
// exclusive transaction each) and the Urungkan that deletes exactly what they wrote. Chips never
// call the model: they fill the drafts locally (interpret.ts's fillClarification & co).
import { rp, shown } from '../../core/money';
import type { TxFormValues } from '../../core/tx/validate';
import type { Db } from '../../data/db/types';
import { getTxFormData } from '../../domain/txForm';
import { aiUndoFailed, aiUndoLabel } from '../../i18n';
import { chooseAmount, evaluateDrafts, type Draft } from './draft';
import { fillClarification, interpret, recordAsExpense, type InterpretContext, type InterpretResult } from './interpret';
import { savedManyText, savedText } from './messages';
import { saveDrafts, undoDrafts, type SavedBatch } from './saveDrafts';
import { useChatStore, type AssistantContent, type SavedBatchInfo } from './chatStore';
import { MAX_CHARS } from './config';

export interface ChatEnv {
  db: Db;
  invalidate: () => Promise<void>;
  showToast: (message: string, options?: { actionLabel?: string; onAction?: () => void }) => void;
  isHidden: () => boolean;
  now: () => string; // ISO instant, WIB
  today: () => string; // 'YYYY-MM-DD', WIB
  interpret?: typeof interpret; // tests
}

const store = () => useChatStore.getState();

// What the model and the validation need: today, and the accounts' balances of THIS moment.
export async function loadChatContext(env: ChatEnv): Promise<InterpretContext> {
  const data = await getTxFormData(env.db);
  return { today: env.today(), accounts: data.accounts, categories: data.categories };
}

function format(env: ChatEnv): (n: number) => string {
  return n => shown(rp(n), env.isHidden());
}

export function contentFromResult(result: InterpretResult, sourceMessage: string): AssistantContent | null {
  switch (result.kind) {
    case 'drafts':
      return {
        type: 'drafts',
        drafts: result.drafts,
        text: result.text,
        selected: result.drafts.filter(d => d.status.kind === 'ready').map(d => d.id),
        sourceMessage,
        saved: null,
        saving: false,
        saveError: null,
      };
    case 'clarify':
      return { type: 'clarify', result, sourceMessage };
    case 'out_of_scope':
      return { type: 'out_of_scope', result };
    case 'error':
      return result.code === 'aborted' ? null : { type: 'error', result };
  }
}

// What one send did, for the screen: whether the text box may be cleared.
export type SendOutcome = 'sent' | 'failed' | 'aborted' | 'ignored';

export async function sendMessage(env: ChatEnv, text: string, signal?: AbortSignal): Promise<SendOutcome> {
  const state = store();
  const message = text.trim();
  if (state.processing || message.length === 0 || text.length > MAX_CHARS) return 'ignored';

  const userId = state.addMessage({ role: 'user', text: message });
  state.setProcessing(true);
  let result: InterpretResult;
  try {
    const ctx = await loadChatContext(env);
    result = await (env.interpret ?? interpret)(message, ctx, state.pending ? { previousMessage: state.pending } : null, { signal });
  } catch {
    result = { kind: 'error', code: 'generic', title: '', detail: '', text: '', action: null, actionLabel: null };
  }
  store().setProcessing(false);

  if (result.kind === 'error' && result.code === 'aborted') {
    // Batal: nothing happened. The question that was open stays open.
    store().removeMessage(userId);
    return 'aborted';
  }
  if (result.kind === 'error' && (result.code === 'busy' || result.code === 'empty' || result.code === 'too_long')) {
    store().removeMessage(userId);
    return 'ignored';
  }

  const content = contentFromResult(result, message);
  if (content) store().addMessage({ role: 'assistant', content });
  store().setPending(result.kind === 'clarify' ? result.pendingMessage : null);
  return result.kind === 'error' ? 'failed' : 'sent';
}

// ---------------------------------------------------------------- clarification (no model call)

function applyResult(messageId: string, result: InterpretResult, sourceMessage: string): void {
  const content = contentFromResult(result, sourceMessage);
  if (content) store().replaceContent(messageId, content);
  store().setPending(result.kind === 'clarify' ? result.pendingMessage : null);
}

export async function chooseOption(env: ChatEnv, messageId: string, field: 'account' | 'category' | 'to_account', id: number): Promise<void> {
  const message = store().messages.find(m => m.id === messageId);
  if (message?.role !== 'assistant' || message.content.type !== 'clarify') return;
  const { result, sourceMessage } = message.content;
  const ctx = await loadChatContext(env);
  applyResult(messageId, fillClarification(result.drafts, field, id, ctx, result.pendingMessage), sourceMessage);
}

export async function recordTransferAsExpense(env: ChatEnv, messageId: string, draftId: string): Promise<void> {
  const message = store().messages.find(m => m.id === messageId);
  if (message?.role !== 'assistant' || message.content.type !== 'clarify') return;
  const { result, sourceMessage } = message.content;
  const ctx = await loadChatContext(env);
  applyResult(messageId, recordAsExpense(result.drafts, draftId, ctx, result.pendingMessage), sourceMessage);
}

// "Batal" on a question or on a draft card: it goes, and nothing was written.
export function discardCard(messageId: string): void {
  store().removeMessage(messageId);
  store().setPending(null);
}

// "Pakai Rp40.000" / "Pakai Rp4.000" on a draft whose amount needs checking.
export async function chooseAmountForDraft(env: ChatEnv, messageId: string, draftId: string, amount: number): Promise<void> {
  const message = store().messages.find(m => m.id === messageId);
  if (message?.role !== 'assistant' || message.content.type !== 'drafts') return;
  const content = message.content;
  const ctx = await loadChatContext(env);
  const fixed = chooseAmount(content.drafts, draftId, amount, ctx);
  // the draft just fixed is ticked, like a ready one is from the start
  const wanted = new Set([...content.selected, draftId]);
  const drafts = evaluateDrafts(fixed, ctx, wanted);
  const selected = drafts.filter(d => wanted.has(d.id) && d.status.kind === 'ready').map(d => d.id);
  store().replaceContent(messageId, { ...content, drafts, selected, saveError: null });
}

// Ticking a row: the balances every row is judged against change with the selection.
export async function toggleDraft(env: ChatEnv, messageId: string, draftId: string): Promise<void> {
  const message = store().messages.find(m => m.id === messageId);
  if (message?.role !== 'assistant' || message.content.type !== 'drafts' || message.content.saved) return;
  const content = message.content;
  const draft = content.drafts.find(d => d.id === draftId);
  if (!draft || draft.status.kind !== 'ready') return;

  const ctx = await loadChatContext(env);
  const wanted = new Set(content.selected);
  if (wanted.has(draftId)) wanted.delete(draftId);
  else wanted.add(draftId);
  const drafts = evaluateDrafts(content.drafts, ctx, wanted);
  const selected = drafts.filter(d => wanted.has(d.id) && d.status.kind === 'ready').map(d => d.id);
  store().replaceContent(messageId, { ...content, drafts, selected, saveError: null });
}

// ---------------------------------------------------------------- saving and undoing

function savedToastText(env: ChatEnv, batch: SavedBatch, ctx: InterpretContext): string {
  if (batch.saved.length !== 1) return savedManyText(batch.saved.length);
  const saved = batch.saved[0];
  const accountName = (id: number | null) => ctx.accounts.find(a => a.id === id)?.name ?? '';
  const balance = (id: number | null) => batch.balances.find(b => b.accountId === id)?.balance ?? 0;
  return savedText(
    saved.type,
    accountName(saved.accountId),
    balance(saved.accountId),
    saved.toAccountId != null ? accountName(saved.toAccountId) : undefined,
    saved.toAccountId != null ? balance(saved.toAccountId) : undefined,
    format(env),
  );
}

// Toast with Urungkan. It lasts as long as the toast does; `onUndone` puts the card back.
function toastSaved(env: ChatEnv, text: string, ids: number[], onUndone: () => Promise<void>): void {
  env.showToast(text, {
    actionLabel: aiUndoLabel(),
    onAction: () => {
      void (async () => {
        const undone = await undoDrafts(env.db, ids);
        if (!undone.ok) {
          env.showToast(aiUndoFailed());
          return;
        }
        await env.invalidate();
        await onUndone();
      })();
    },
  });
}

export async function saveSelected(env: ChatEnv, messageId: string): Promise<boolean> {
  const message = store().messages.find(m => m.id === messageId);
  if (message?.role !== 'assistant' || message.content.type !== 'drafts') return false;
  const content = message.content;
  if (content.saving || content.saved || content.selected.length === 0) return false;

  store().replaceContent(messageId, { ...content, saving: true, saveError: null });
  const ctx = await loadChatContext(env);
  const result = await saveDrafts(env.db, content.drafts, content.selected, env.now());
  if (!result.ok) {
    store().replaceContent(messageId, { ...content, saving: false, saveError: result.message });
    return false;
  }

  const batch = result.value;
  const saved: SavedBatchInfo = { ids: batch.ids, draftIds: batch.saved.map(s => s.draftId) };
  store().replaceContent(messageId, { ...content, saving: false, saved });
  await env.invalidate();
  toastSaved(env, savedToastText(env, batch, ctx), batch.ids, () => restoreDrafts(env, messageId));
  return true;
}

// Urungkan: the rows are gone; the card is a draft again, judged against the balances of now.
export async function restoreDrafts(env: ChatEnv, messageId: string): Promise<void> {
  const message = store().messages.find(m => m.id === messageId);
  if (message?.role !== 'assistant' || message.content.type !== 'drafts') return;
  const content = message.content;
  const ctx = await loadChatContext(env);
  const drafts = evaluateDrafts(content.drafts, ctx);
  store().replaceContent(messageId, {
    ...content,
    drafts,
    selected: drafts.filter(d => d.status.kind === 'ready').map(d => d.id),
    saved: null,
    saving: false,
    saveError: null,
  });
}

// ---------------------------------------------------------------- one by one (/ai-draft-edit)

export function startEditing(messageId: string, draftIds?: string[]): boolean {
  const message = store().messages.find(m => m.id === messageId);
  if (message?.role !== 'assistant' || message.content.type !== 'drafts' || message.content.saved) return false;
  const { drafts, sourceMessage } = message.content;
  const chosen = draftIds ? drafts.filter(d => draftIds.includes(d.id)) : drafts;
  if (chosen.length === 0) return false;
  store().startEdit({ messageId, drafts: chosen, sourceMessage, savedIds: [], savedDraftIds: [] });
  return true;
}

// The edited draft, as the form left it. Checked again as a draft (so a gap or a short balance
// is caught the same way), then saved on its own through the same writer.
export async function saveEditedDraft(env: ChatEnv, draft: Draft, values: TxFormValues): Promise<{ ok: true } | { ok: false; message: string }> {
  const ctx = await loadChatContext(env);
  const edited: Draft = {
    ...draft,
    type: values.type,
    amount: values.amount,
    amountCheck: null,
    categoryId: values.categoryId,
    accountId: values.accountId,
    toAccountId: values.toAccountId,
    unknownTarget: null,
    date: values.date,
    dateStated: true,
    description: values.description,
    note: values.note,
  };
  const [checked] = evaluateDrafts([edited], ctx);
  const result = await saveDrafts(env.db, [checked], [checked.id], env.now());
  if (!result.ok) return { ok: false, message: result.message };
  const edit = store().edit;
  if (edit) {
    // the card keeps the draft as it was edited, so Urungkan brings back the edited version
    store().updateContent(edit.messageId, c => (c.type === 'drafts' ? { ...c, drafts: c.drafts.map(d => (d.id === draft.id ? edited : d)) } : c));
  }
  store().recordEditSave(draft.id, result.value.ids);
  await env.invalidate();
  return { ok: true };
}

// Leaving the edit screen, finished or not: what was saved stays saved; the card shows it, and
// the toast offers one Urungkan for the whole batch. One saved record is worded like a normal
// save, with the balance of now; several say how many.
export async function finishEditing(env: ChatEnv): Promise<void> {
  const edit = store().endEdit();
  if (!edit || edit.savedIds.length === 0) return;
  const message = store().messages.find(m => m.id === edit.messageId);
  if (message?.role !== 'assistant' || message.content.type !== 'drafts') return;
  const content = message.content;
  store().replaceContent(edit.messageId, { ...content, saved: { ids: edit.savedIds, draftIds: edit.savedDraftIds }, selected: [] });

  let text = savedManyText(edit.savedIds.length);
  if (edit.savedDraftIds.length === 1) {
    const draft = content.drafts.find(d => d.id === edit.savedDraftIds[0]);
    if (draft?.type && draft.accountId != null) {
      const ctx = await loadChatContext(env);
      const account = ctx.accounts.find(a => a.id === draft.accountId);
      const toAccount = draft.type === 'transfer' ? ctx.accounts.find(a => a.id === draft.toAccountId) : undefined;
      if (account) text = savedText(draft.type, account.name, account.balance, toAccount?.name, toAccount?.balance, format(env));
    }
  }
  toastSaved(env, text, edit.savedIds, () => restoreDrafts(env, edit.messageId));
}

// A draft as the form's starting values.
export function draftFormValues(draft: Draft): TxFormValues {
  return {
    type: draft.type ?? 'expense',
    amount: draft.amount ?? 0,
    categoryId: draft.categoryId,
    accountId: draft.accountId,
    toAccountId: draft.toAccountId,
    date: draft.date,
    description: draft.description,
    note: draft.note,
  };
}

// One typed message in, a result the chat can show out (CLAUDE.md rule 9). The model only
// proposes; everything below is the app checking it: schema, names to ids, the amount against
// the typed text, the date, then the manual form's own validation.
//
// The result is one of four kinds:
//   drafts        cards to review, nothing saved
//   clarify       something is missing; chips or a typed answer fill it
//   out_of_scope  not a transaction; one fixed sentence per reason
//   error         the call failed; nothing changed
// A tap on a clarification chip never calls the model again (fillDrafts below).
import { addDays } from '../../core/date';
import type { FormAccount, FormCategory, ValidationContext } from '../../core/tx/validate';
import {
  aiMsgAskAccount,
  aiMsgAskAccountAndCategory,
  aiMsgAskAmount,
  aiMsgAskCategory,
  aiMsgAskToAccount,
  aiMsgAskType,
  aiMsgUnknownTransferTarget,
} from '../../i18n';
import { extractAmountCandidates, parseRupiah, type AmountCandidate } from './amount';
import { callGemini, messageLengthProblem, type AiErrorCode } from './client';
import {
  chooseAmount as chooseAmountDrafts,
  convertToExpense as convertToExpenseDrafts,
  evaluateDrafts,
  fillDrafts as fillDraftsLocal,
  type AmountCheck,
  type Draft,
  type DraftField,
} from './draft';
import { getKey } from './keystore';
import { matchAccount, matchCategory } from './match';
import { errorMessage, draftsReadyText, outOfScopeMessage, type ErrorMessage, type OutOfScopeMessage } from './messages';
import { buildRequest } from './prompt';
import { parseAiResponse, type AiResponse, type AiTransaction } from './schema';

export { fillDraft } from './draft';
export type { Draft, DraftField, DraftStatus, AmountCheck } from './draft';

export interface ClarifyOptions {
  accounts: { id: number; name: string }[]; // "Dari akun mana?"
  toAccounts: { id: number; name: string }[]; // "Pindah ke akun mana?"
  categories: { id: number; name: string; kind: 'income' | 'expense' }[];
}

export type InterpretResult =
  | { kind: 'drafts'; drafts: Draft[]; text: string }
  | {
      kind: 'clarify';
      drafts: Draft[];
      missing: DraftField[];
      question: string;
      options: ClarifyOptions;
      unknownTarget: { draftId: string; name: string } | null; // offer "Catat pengeluaran"
      pendingMessage: string; // pass back as `pending` with a typed answer
    }
  | ({ kind: 'out_of_scope'; reason: NonNullable<AiResponse['reason']> } & OutOfScopeMessage)
  | ({ kind: 'error'; code: AiErrorCode } & ErrorMessage);

// The one context allowed to travel with the next message: the message a question was about.
export interface PendingClarification {
  previousMessage: string;
}

export interface InterpretDeps {
  signal?: AbortSignal;
  getKey?: () => Promise<string | null>;
  call?: typeof callGemini;
}

export type InterpretContext = ValidationContext;

function errorResult(code: AiErrorCode): InterpretResult {
  return { kind: 'error', code, ...errorMessage(code) };
}

export async function interpret(
  message: string,
  ctx: InterpretContext,
  pending?: PendingClarification | null,
  deps: InterpretDeps = {},
): Promise<InterpretResult> {
  const problem = messageLengthProblem(message);
  if (problem) return errorResult(problem);

  const key = await (deps.getKey ?? getKey)();
  if (!key) return errorResult('key_rejected');

  const request = buildRequest(message, ctx, pending?.previousMessage);
  const call = deps.call ?? callGemini;

  // A reply that is not valid JSON in the agreed shape is tried once more, then given up on.
  for (let attempt = 0; attempt < 2; attempt++) {
    const reply = await call(request, key, { signal: deps.signal });
    if (!reply.ok) {
      if (reply.code === 'unreadable') continue;
      return errorResult(reply.code);
    }
    const parsed = parseAiResponse(reply.text);
    if (parsed) return processResponse(parsed, message, ctx, pending?.previousMessage ?? null);
  }
  return errorResult('unreadable');
}

// The checks after the model has spoken. Pure: the whole app side, testable without a network.
export function processResponse(response: AiResponse, message: string, ctx: InterpretContext, previousMessage: string | null = null): InterpretResult {
  if (response.intent === 'out_of_scope') {
    const reason = response.reason ?? 'other';
    return { kind: 'out_of_scope', reason, ...outOfScopeMessage(reason) };
  }
  const candidates = [...extractAmountCandidates(message), ...(previousMessage ? extractAmountCandidates(previousMessage) : [])];
  const drafts = response.transactions.map((t, index) => buildDraft(t, index, message, candidates, ctx));
  return resultFromDrafts(evaluateDrafts(drafts, ctx), ctx, message);
}

function resolveDate(t: AiTransaction, today: string): { date: string; stated: boolean } {
  if (t.date) return { date: t.date, stated: true };
  if (t.relative_date === 'yesterday') return { date: addDays(today, -1), stated: true };
  if (t.relative_date === 'day_before_yesterday') return { date: addDays(today, -2), stated: true };
  if (t.relative_date === 'today') return { date: today, stated: true };
  return { date: today, stated: false };
}

function checkAmount(t: AiTransaction, candidates: AmountCandidate[]): AmountCheck | null {
  const ai = t.amount as number;
  const typed = parseRupiah(t.amount_text);
  if (typed === ai && candidates.some(c => c.value === ai)) return null;

  const typedInMessage = typed != null && candidates.some(c => c.value === typed);
  const offered = typedInMessage ? [typed as number] : [...new Set(candidates.map(c => c.value))];
  const choices = [...offered.filter(v => v !== ai), ai];
  return { aiAmount: ai, typedText: typedInMessage ? t.amount_text : null, choices };
}

// The destination of a transfer as the person typed it, for "Aku tidak menemukan akun bernama
// “Budi”". Taken from the person's message, not from the model's words.
function typedTransferTarget(message: string, modelName: string | null): string | null {
  if (modelName) {
    const at = message.toLowerCase().indexOf(modelName.trim().toLowerCase());
    if (at >= 0) return message.slice(at, at + modelName.trim().length);
  }
  const m = /\bke\s+([\p{L}][\p{L}\p{N} ]{0,29}?)(?=\s+(?:rp\b|\d)|[,.!?;]|$)/iu.exec(message);
  return m ? m[1].trim() : null;
}

function buildDraft(t: AiTransaction, index: number, message: string, candidates: AmountCandidate[], ctx: InterpretContext): Draft {
  const type = t.type;
  const account = matchAccount(t.account, ctx.accounts).item;

  let toAccountId: number | null = null;
  let unknownTarget: string | null = null;
  if (type === 'transfer') {
    const to = matchAccount(t.to_account, ctx.accounts);
    if (to.item && to.item.id !== account?.id) toAccountId = to.item.id; // from and to must differ
    if (!to.item) {
      const typed = typedTransferTarget(message, t.to_account);
      if (typed && matchAccount(typed, ctx.accounts).kind === 'none') unknownTarget = typed;
    }
  }

  const category = type === 'transfer' ? null : matchCategory(t.category, type, ctx.categories).item;
  const { date, stated } = resolveDate(t, ctx.today);

  return {
    id: `d${index + 1}`,
    type,
    amount: t.amount,
    amountText: t.amount_text,
    amountCheck: t.amount != null ? checkAmount(t, candidates) : null,
    description: t.description.trim().slice(0, 60),
    categoryId: category?.id ?? null,
    accountId: account?.id ?? null,
    toAccountId,
    date,
    dateStated: stated,
    note: (t.note ?? '').trim(),
    unknownTarget,
    status: { kind: 'ready' },
    balanceAfter: null,
    toBalanceAfter: null,
  };
}

function rupiahAccounts(accounts: readonly FormAccount[]) {
  return accounts.filter(a => a.type !== 'forex').map(a => ({ id: a.id, name: a.name }));
}

// "Clarify" while anything is missing, "drafts" once nothing is. Also the question and its chips.
export function resultFromDrafts(drafts: Draft[], ctx: InterpretContext, pendingMessage: string): InterpretResult {
  const needing = drafts.filter(d => d.status.kind === 'needs');
  if (needing.length === 0) return { kind: 'drafts', drafts, text: draftsReadyText(drafts.length) };

  const missing = [...new Set(needing.flatMap(d => (d.status.kind === 'needs' ? d.status.missing : [])))] as DraftField[];
  const has = (f: DraftField) => missing.includes(f);
  const empty: ClarifyOptions = { accounts: [], toAccounts: [], categories: [] };
  const options: ClarifyOptions = { ...empty };
  const categoriesFor = (kinds: Set<string>) =>
    ctx.categories.filter((c: FormCategory) => kinds.has(c.kind)).map(c => ({ id: c.id, name: c.name, kind: c.kind }));
  const needCategoryKinds = new Set(needing.filter(d => d.type && d.type !== 'transfer' && d.categoryId == null).map(d => d.type as string));

  let question: string;
  let unknownTarget: { draftId: string; name: string } | null = null;
  if (has('amount')) {
    question = aiMsgAskAmount();
  } else if (has('type')) {
    question = aiMsgAskType();
  } else if (has('account')) {
    options.accounts = rupiahAccounts(ctx.accounts);
    if (has('category')) {
      options.categories = categoriesFor(needCategoryKinds);
      question = aiMsgAskAccountAndCategory();
    } else {
      question = aiMsgAskAccount();
    }
  } else if (has('to_account')) {
    const from = new Set(needing.filter(d => d.type === 'transfer' && d.toAccountId == null).map(d => d.accountId));
    options.toAccounts = rupiahAccounts(ctx.accounts).filter(a => !from.has(a.id));
    const unknown = needing.find(d => d.unknownTarget);
    if (unknown?.unknownTarget) {
      unknownTarget = { draftId: unknown.id, name: unknown.unknownTarget };
      question = aiMsgUnknownTransferTarget(unknown.unknownTarget);
    } else {
      question = aiMsgAskToAccount();
    }
  } else {
    options.categories = categoriesFor(needCategoryKinds);
    question = aiMsgAskCategory();
  }
  return { kind: 'clarify', drafts, missing, question, options, unknownTarget, pendingMessage };
}

// Chip taps and picks. Each re-checks the whole message locally and returns what to show next.
export function fillClarification(
  drafts: readonly Draft[],
  field: 'account' | 'category' | 'to_account',
  id: number,
  ctx: InterpretContext,
  pendingMessage: string,
): InterpretResult {
  return resultFromDrafts(fillDraftsLocal(drafts, field, id, ctx), ctx, pendingMessage);
}

export function pickAmount(drafts: readonly Draft[], draftId: string, amount: number, ctx: InterpretContext, pendingMessage: string): InterpretResult {
  return resultFromDrafts(chooseAmountDrafts(drafts, draftId, amount, ctx), ctx, pendingMessage);
}

export function recordAsExpense(drafts: readonly Draft[], draftId: string, ctx: InterpretContext, pendingMessage: string): InterpretResult {
  return resultFromDrafts(convertToExpenseDrafts(drafts, draftId, ctx), ctx, pendingMessage);
}

export { fillDrafts, chooseAmount, convertToExpense, evaluateDrafts } from './draft';

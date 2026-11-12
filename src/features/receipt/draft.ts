// A scanned receipt as a draft expense. Pure: the parsed fields and the lists the form already
// reads come in, form values go out, and the form's own rules (validate.ts) decide whether it can
// be saved. Nothing is written here and no balance is computed: "balance after" is read by the
// screen from the account's balance, like the manual form does.
import { addDays } from '../../core/date';
import { validateTx, type FormAccount, type FormCategory, type TxFieldError, type TxFormValues } from '../../core/tx/validate';
import { matchAccount, matchCategory } from '../ai_chat/match';
import type { ParsedReceipt } from './parse';

export interface ScanDraft {
  description: string; // the shop's name
  date: string;
  dateFromReceipt: boolean;
  totals: number[]; // the candidates, best first (the chips)
  amount: number; // the one chosen, or typed
  categoryId: number | null;
  accountId: number | null;
}

// Local, simple rules from the shop's name to a category the person already has (matched by name,
// case-insensitive). No match, or no such category, leaves it empty for the person to choose.
// Order matters: the first rule that fits wins, and the broad "toko" / "mart" rule comes last.
const RULES: { when: RegExp; names: string[] }[] = [
  {
    when: /\b(resto|restoran|restaurant|rm|warung makan|warteg|warung|cafe|kafe|kopi|coffee|bakery|roti|bakmi|bakso|soto|nasi|ayam|mie|kfc|mcd|mcdonald|pizza|pasta|burger|starbucks|kenangan|janji jiwa|boba|kedai|depot|sushi|steak|dapur|sate)\b/i,
    names: ['Food & drink', 'Makanan & minuman', 'Makanan', 'Food'],
  },
  { when: /\b(apotek|apotik|kimia farma|guardian|watsons|klinik|rumah sakit|dokter|farma|optik)\b/i, names: ['Health', 'Kesehatan'] },
  { when: /\b(spbu|pertamina|shell|parkir|tol|bluebird|grab|gojek|kereta|bengkel)\b/i, names: ['Transport', 'Transportasi'] },
  { when: /\b(pln|pdam|telkom|indihome|pulsa|listrik)\b/i, names: ['Bills', 'Tagihan'] },
  {
    when: /\b(indomaret|alfamart|alfamidi|supermarket|hypermart|superindo|super indo|giant|lotte|farmers|ranch|transmart|carrefour|minimarket|mart|toko|swalayan|grosir)\b/i,
    names: ['Groceries', 'Belanja', 'Shopping'],
  },
];

export function guessCategoryId(merchant: string | null, categories: readonly FormCategory[]): number | null {
  if (!merchant) return null;
  const expense = categories.filter(c => c.kind === 'expense');
  for (const rule of RULES) {
    if (!rule.when.test(merchant)) continue;
    for (const name of rule.names) {
      const found = expense.find(c => c.name.trim().toLowerCase() === name.toLowerCase());
      if (found) return found.id;
    }
  }
  return null;
}

export interface DraftContext {
  accounts: readonly FormAccount[];
  categories: readonly FormCategory[];
  lastAccountId: number | null; // the account used most recently, if any
}

// The account to start on: the one used last when it is still there and in rupiah, otherwise the
// first rupiah account (the manual form's own default).
export function defaultAccountId(accounts: readonly FormAccount[], lastAccountId: number | null): number | null {
  const rupiah = accounts.filter(a => a.type !== 'forex');
  return (rupiah.find(a => a.id === lastAccountId) ?? rupiah[0])?.id ?? null;
}

export function toDraft(parsed: ParsedReceipt, ctx: DraftContext): ScanDraft {
  const totals = parsed.totals.map(t => t.amount);
  return {
    description: parsed.merchant ?? '',
    date: parsed.date,
    dateFromReceipt: parsed.dateFromReceipt,
    totals,
    amount: totals[0] ?? 0,
    categoryId: guessCategoryId(parsed.merchant, ctx.categories),
    accountId: defaultAccountId(ctx.accounts, ctx.lastAccountId),
  };
}

// What goes to the same save function as the manual form (core/tx/save.ts, with source 'scan').
export function toFormValues(draft: ScanDraft): TxFormValues {
  return {
    type: 'expense',
    amount: draft.amount,
    categoryId: draft.categoryId,
    accountId: draft.accountId,
    toAccountId: null,
    date: draft.date,
    description: draft.description.trim(),
    note: '',
  };
}

// The manual form's rules, run on the draft.
export function draftErrors(draft: ScanDraft, ctx: { today: string; accounts: readonly FormAccount[]; categories: readonly FormCategory[] }): TxFieldError[] {
  return validateTx(toFormValues(draft), { today: ctx.today, accounts: [...ctx.accounts], categories: [...ctx.categories] });
}

// The window the duplicate check looks in: the day before to the day after.
export function similarWindow(date: string): { from: string; to: string } {
  return { from: addDays(date, -1), to: addDays(date, 1) };
}

// ---------------------------------------------------------------- "Rapikan dengan AI"

export type TidyField = 'shop' | 'category' | 'account';

export interface TidyProposal {
  shop: string | null;
  category: string | null;
  account: string | null;
}

export interface AppliedTidy {
  draft: ScanDraft;
  aiCategory: boolean; // the category now shown is one the AI named (it gets a check mark)
  changed: boolean; // something in the draft is different from before
}

// The model's proposal laid over the draft. It only proposes: a field the person has changed
// themselves is left alone; a category or an account is used only when its name matches one of
// the person's own (the chat's matcher: an account needs an exact name, a category may also be an
// alias or a near spelling); an unknown or missing name changes nothing. The total and the date
// are never touched, and nothing is saved.
export function applyTidy(
  draft: ScanDraft,
  proposal: TidyProposal,
  ctx: { accounts: readonly FormAccount[]; categories: readonly FormCategory[] },
  edited: ReadonlySet<TidyField>,
): AppliedTidy {
  const next: ScanDraft = { ...draft };
  let aiCategory = false;

  const shop = proposal.shop?.replace(/\s+/g, ' ').trim();
  if (shop && !edited.has('shop')) next.description = shop;

  if (!edited.has('category')) {
    const match = matchCategory(proposal.category, 'expense', [...ctx.categories]);
    if (match.item && (match.kind === 'exact' || match.kind === 'alias' || match.kind === 'fuzzy')) {
      next.categoryId = match.item.id;
      aiCategory = true;
    }
  }

  if (!edited.has('account')) {
    const match = matchAccount(proposal.account, [...ctx.accounts]);
    if (match.item && match.kind === 'exact') next.accountId = match.item.id;
  }

  const changed = next.description !== draft.description || next.categoryId !== draft.categoryId || next.accountId !== draft.accountId;
  return { draft: next, aiCategory, changed };
}

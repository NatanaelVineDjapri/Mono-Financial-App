// Shared by the AI chat tests: the sample dataset's accounts and a few categories.
import type { FormAccount, FormCategory, ValidationContext } from '../../../core/tx/validate';
import type { AiResponse, AiTransaction } from '../schema';

export const TODAY = '2026-10-28';

export const ACCOUNTS: FormAccount[] = [
  { id: 1, name: 'BCA Tabungan', type: 'bank', icon: null, balance: 6842500, openingDate: '2026-01-01' },
  { id: 2, name: 'Cash wallet', type: 'cash', icon: null, balance: 450000, openingDate: '2026-01-01' },
  { id: 3, name: 'GoPay', type: 'ewallet', icon: null, balance: 312500, openingDate: '2026-01-01' },
  { id: 4, name: 'Jago Pocket', type: 'savings', icon: null, balance: 1275000, openingDate: '2026-01-01' },
];

export const CATEGORIES: FormCategory[] = [
  { id: 10, name: 'Food & drink', kind: 'expense' },
  { id: 11, name: 'Transport', kind: 'expense' },
  { id: 12, name: 'Shopping', kind: 'expense' },
  { id: 13, name: 'Bills', kind: 'expense' },
  { id: 20, name: 'Salary', kind: 'income' },
  { id: 21, name: 'Other income', kind: 'income' },
];

export const CTX: ValidationContext = { today: TODAY, accounts: ACCOUNTS, categories: CATEGORIES };

export function tx(overrides: Partial<AiTransaction> = {}): AiTransaction {
  return {
    type: 'expense',
    amount: null,
    amount_text: null,
    description: '',
    category: null,
    account: null,
    to_account: null,
    date: null,
    relative_date: null,
    note: null,
    ...overrides,
  };
}

export function response(intent: AiResponse['intent'], transactions: AiTransaction[] = [], extra: Partial<AiResponse> = {}): AiResponse {
  return { intent, transactions, missing: [], reason: null, ...extra };
}

// A model reply as the JSON text Gemini would send in a part.
export function replyText(intent: AiResponse['intent'], transactions: Partial<AiTransaction>[] = [], extra: Partial<AiResponse> = {}): string {
  return JSON.stringify({ ...response(intent, transactions.map(t => tx(t))), ...extra });
}

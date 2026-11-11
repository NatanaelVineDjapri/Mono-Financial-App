// Every sentence the chat shows, assembled by the app from fixed text in src/i18n/id.ts
// (CLAUDE.md rule 9). The model supplies codes and fields, never words: nothing in this file
// takes a string from the model's reply except a name the person typed themself.
import { rp } from '../../core/money';
import {
  aiMsgBlockedLead,
  aiMsgBlockedReason,
  aiMsgBlockedShortfall,
  aiMsgCheckAmount,
  aiMsgDataLookup,
  aiMsgDraftsReady,
  aiMsgError,
  aiMsgErrorManualAction,
  aiMsgErrorSettingsAction,
  aiMsgExamples,
  aiMsgOpenAccounts,
  aiMsgOutOfScope,
  aiMsgSaved,
  aiMsgSavedMany,
} from '../../i18n/id';
import type { AiErrorCode } from './client';
import type { Draft } from './draft';
import type { OutOfScopeReason } from './schema';

export type ErrorAction = 'manual' | 'open_ai_settings';

export interface ErrorMessage {
  title: string;
  detail: string;
  text: string; // title and detail as one sentence group
  action: ErrorAction | null;
  actionLabel: string | null;
}

export function errorMessage(code: AiErrorCode): ErrorMessage {
  if (code === 'aborted') return { title: '', detail: '', text: '', action: null, actionLabel: null };
  const { title, detail } = aiMsgError(code);
  const action: ErrorAction | null = code === 'key_rejected' ? 'open_ai_settings' : code === 'empty' || code === 'too_long' || code === 'busy' ? null : 'manual';
  const actionLabel = action === 'open_ai_settings' ? aiMsgErrorSettingsAction() : action === 'manual' ? aiMsgErrorManualAction() : null;
  return { title, detail, text: `${title} ${detail}`, action, actionLabel };
}

export interface OutOfScopeMessage {
  text: string;
  action: 'open_accounts' | null;
  actionLabel: string | null;
  examples: string[]; // example messages as chips (they only fill the input)
}

export function outOfScopeMessage(reason: OutOfScopeReason | null): OutOfScopeMessage {
  if (reason === 'data_lookup') {
    return { text: aiMsgDataLookup(), action: 'open_accounts', actionLabel: aiMsgOpenAccounts(), examples: [] };
  }
  return { text: aiMsgOutOfScope(), action: null, actionLabel: null, examples: aiMsgExamples() };
}

export function draftsReadyText(count: number): string {
  return aiMsgDraftsReady(count);
}

// "Nominal perlu dicek. Kamu mengetik “40rb” (Rp40.000), drafnya Rp4.000."
// `format` is rp() unless hidden-amounts mode masks the figures (CLAUDE.md rule 12).
export function checkAmountText(draft: Draft, format: (n: number) => string = rp): string | null {
  const check = draft.amountCheck;
  if (!check) return null;
  const typed = check.choices.find(c => c !== check.aiAmount);
  const typedFormatted = check.typedText != null && typed != null ? format(typed) : null;
  return aiMsgCheckAmount(check.typedText, typedFormatted, format(check.aiAmount));
}

export interface BlockedMessage {
  lead: string; // "Draf dibuat, tapi tidak bisa disimpan."
  reason: string; // "Kurang Rp1.050.000. Ganti akun, kecilkan jumlah, atau pindahkan uang dulu."
}

export function blockedText(draft: Draft, format: (n: number) => string = rp): BlockedMessage | null {
  const status = draft.status;
  if (status.kind !== 'blocked') return null;
  const reason = status.code === 'insufficient_balance' && status.shortfall != null ? aiMsgBlockedShortfall(format(status.shortfall)) : aiMsgBlockedReason(status.code);
  return { lead: aiMsgBlockedLead(), reason };
}

// The snackbar after Simpan. `balances` are read from the views after the commit.
export function savedText(
  kind: 'income' | 'expense' | 'transfer',
  accountName: string,
  balance: number,
  toAccountName?: string,
  toBalance?: number | null,
  format: (n: number) => string = rp,
): string {
  return aiMsgSaved(kind, accountName, format(balance), toAccountName, toBalance != null ? format(toBalance) : undefined);
}

export function savedManyText(count: number): string {
  return aiMsgSavedMany(count);
}

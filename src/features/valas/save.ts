// Saving the Valas account and its pockets. Each call is one domain call (the schema's guards are the
// real authority); a failure comes back as a message in the person's language, never a technical string.
import type { Db } from '../../data/db/types';
import { updateAccount } from '../../domain/accounts';
import { DomainError } from '../../domain/errors';
import { accountDbErrorMessage, setRateFirst, valasForexError, valasPocketArchiveBlocked, guardMessage } from '../../i18n';
import { addForexPocket, archiveForexPocket, createForexAccount, ForexError, type CreateForexAccountInput, type PocketInput } from './forexAccount';

export type ValasSaveResult<T> = { ok: true; value: T } | { ok: false; message: string };

export function mapValasError(error: unknown, ctx: { currency?: string } = {}): string {
  if (error instanceof ForexError) return valasForexError(error.code);
  if (error instanceof DomainError) {
    if (error.code === 'missing_fx_rate') return setRateFirst(ctx.currency ?? '');
    if (error.code === 'pocket_not_empty') return valasPocketArchiveBlocked(ctx.currency ?? '');
    if (error.code === 'future_date' || error.code === 'forex_account_exists') return guardMessage(error.code, {});
    return accountDbErrorMessage(error.code);
  }
  const text = error instanceof Error ? `${error.message} ${error.cause instanceof Error ? error.cause.message : ''}` : String(error);
  if (/unique/i.test(text) && /accounts\.name/i.test(text)) return accountDbErrorMessage('name_taken');
  return valasForexError('unknown');
}

async function run<T>(action: () => Promise<T>, ctx: { currency?: string } = {}): Promise<ValasSaveResult<T>> {
  try {
    return { ok: true, value: await action() };
  } catch (error) {
    return { ok: false, message: mapValasError(error, ctx) };
  }
}

export function saveNewValasAccount(db: Db, input: CreateForexAccountInput, now: string): Promise<ValasSaveResult<number>> {
  return run(() => createForexAccount(db, input, now));
}

export function saveValasName(db: Db, accountId: number, name: string): Promise<ValasSaveResult<null>> {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 40) return Promise.resolve({ ok: false, message: valasForexError('name_invalid') });
  return run(async () => {
    await updateAccount(db, accountId, { name: trimmed });
    return null;
  });
}

export function saveNewPocket(db: Db, accountId: number, pocket: PocketInput, openingDate: string, now: string): Promise<ValasSaveResult<null>> {
  return run(async () => {
    await addForexPocket(db, accountId, pocket, openingDate, now);
    return null;
  }, { currency: pocket.currency });
}

export function savePocketArchived(db: Db, accountId: number, currency: string): Promise<ValasSaveResult<null>> {
  return run(async () => {
    await archiveForexPocket(db, accountId, currency);
    return null;
  }, { currency });
}

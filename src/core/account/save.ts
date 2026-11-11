// Saving an account from the form: a new one, or the changes to an existing one. Each is one
// domain call (which maps the schema's guards); the form's own checks (validate.ts) come first,
// so what reaches here is a backstop. Nothing here stores a balance.
import { DomainError } from '../../domain/errors';
import { createAccount, updateAccount } from '../../domain/accounts';
import type { Db } from '../../data/db/types';
import { accountDbErrorMessage } from '../../i18n/id';
import { formatShortDate } from '../date';
import type { AccountFormValues } from './validate';

export type AccountSaveOutcome<T> = { ok: true; value: T } | { ok: false; message: string };

// The database's error as a message. A code it recognises says what to fix; the unique-name
// constraint (it has no code of ours) says the name is taken; anything else is the plain
// "couldn't save" and never a technical string.
export function mapAccountDbError(error: unknown, ctx: { firstRecordOn?: string } = {}): string {
  if (error instanceof DomainError) {
    return accountDbErrorMessage(error.code, { firstRecordOn: ctx.firstRecordOn ? formatShortDate(ctx.firstRecordOn) : undefined });
  }
  const text = error instanceof Error ? `${error.message} ${error.cause instanceof Error ? error.cause.message : ''}` : String(error);
  if (/unique/i.test(text) && /accounts\.name/i.test(text)) return accountDbErrorMessage('name_taken');
  return accountDbErrorMessage(undefined);
}

export async function saveNewAccount(db: Db, values: AccountFormValues, now: string): Promise<AccountSaveOutcome<{ id: number }>> {
  try {
    const id = await createAccount(
      db,
      { name: values.name.trim(), type: values.type, openingBalance: values.openingBalance, openingDate: values.openingDate, icon: values.icon },
      now,
    );
    return { ok: true, value: { id } };
  } catch (error) {
    return { ok: false, message: mapAccountDbError(error) };
  }
}

export async function saveAccountChanges(
  db: Db,
  id: number,
  values: AccountFormValues,
  ctx: { firstRecordOn?: string } = {},
): Promise<AccountSaveOutcome<null>> {
  try {
    await updateAccount(db, id, {
      name: values.name.trim(),
      type: values.type,
      openingBalance: values.openingBalance,
      openingDate: values.openingDate,
      icon: values.icon,
    });
    return { ok: true, value: null };
  } catch (error) {
    return { ok: false, message: mapAccountDbError(error, ctx) };
  }
}

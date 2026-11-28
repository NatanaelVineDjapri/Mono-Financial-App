// Migration 13 -> 14: debts (utang-piutang). A debt is a hidden account of its own (accounts.archived = 1, so no list or
// picker offers it) with one row here saying whose it is. Lending and paying back are ordinary transfers between that
// account and a real one, so balances move, income, expense and budgets do not, and net worth stays right: money lent
// is a positive balance (still yours), money borrowed a negative one (owed).
//
// So the balance guards change for these accounts only: a `borrowed` account lives at or below zero, and may not go
// above it (paying back more than was borrowed: debt_overpaid); every other account, a `lent` one included, may not go
// below zero (insufficient_balance). Guards are skipped while a restore runs (meta.guards_off = '1').
import type { Db } from '../types';

const BORROWED = "b.account_id in (select account_id from debts where direction = 'borrowed')";

const guard = (name: string, event: string, rows: string) => `
DROP TRIGGER ${name};
CREATE TRIGGER ${name} AFTER ${event} ON transactions
WHEN NOT EXISTS (SELECT 1 FROM meta WHERE key = 'guards_off' AND value = '1')
BEGIN
  SELECT RAISE(ABORT, 'insufficient_balance')
  WHERE EXISTS (SELECT 1 FROM v_pocket_balance b WHERE b.balance < 0 AND NOT ${BORROWED} AND (${rows}));
  SELECT RAISE(ABORT, 'debt_overpaid')
  WHERE EXISTS (SELECT 1 FROM v_pocket_balance b WHERE b.balance > 0 AND ${BORROWED} AND (${rows}));
END;`;

const NEW = '(b.account_id = NEW.account_id AND b.currency = NEW.currency) OR (b.account_id = NEW.to_account_id AND b.currency = NEW.to_currency)';
const OLD = '(b.account_id = OLD.account_id AND b.currency = OLD.currency) OR (b.account_id = OLD.to_account_id AND b.currency = OLD.to_currency)';

export async function addDebts(db: Db): Promise<void> {
  await db.execAsync(`
CREATE TABLE debts (
  account_id INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  direction  TEXT NOT NULL CHECK (direction IN ('lent', 'borrowed')),
  person     TEXT NOT NULL CHECK (length(trim(person)) BETWEEN 1 AND 30),
  due_on     TEXT CHECK (due_on IS NULL OR date(due_on) = due_on),
  note       TEXT,
  created_at TEXT NOT NULL
);
${guard('trg_tx_balance_ins', 'INSERT', NEW)}
${guard('trg_tx_balance_upd', 'UPDATE', `${NEW} OR ${OLD}`)}
${guard('trg_tx_balance_del', 'DELETE', OLD)}

DROP VIEW v_integrity_issues;
CREATE VIEW v_integrity_issues AS
SELECT 'negative_balance'     AS issue, b.account_id || '/' || b.currency AS ref FROM v_pocket_balance b WHERE b.balance < 0 AND NOT ${BORROWED}
UNION ALL
SELECT 'debt_overpaid',        b.account_id || '/' || b.currency FROM v_pocket_balance b WHERE b.balance > 0 AND ${BORROWED}
UNION ALL
SELECT 'future_date',          CAST(id AS TEXT) FROM transactions WHERE occurred_on > date('now', 'localtime')
UNION ALL
SELECT 'before_opening_date',  CAST(t.id AS TEXT) FROM transactions t
  JOIN v_pocket p ON p.account_id = t.account_id AND p.currency = t.currency WHERE t.occurred_on < p.opening_date
UNION ALL
SELECT 'category_kind_mismatch', CAST(t.id AS TEXT) FROM transactions t
  JOIN categories c ON c.id = t.category_id WHERE t.kind <> 'transfer' AND c.kind <> t.kind
UNION ALL
SELECT 'currency_not_in_account', CAST(t.id AS TEXT) FROM transactions t
  WHERE NOT EXISTS (SELECT 1 FROM v_pocket p WHERE p.account_id = t.account_id AND p.currency = t.currency)
     OR (t.to_account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM v_pocket p WHERE p.account_id = t.to_account_id AND p.currency = t.to_currency))
UNION ALL
SELECT 'missing_fx_rate', p.currency FROM v_pocket p
  WHERE p.currency <> 'IDR' AND NOT EXISTS (SELECT 1 FROM fx_rates f WHERE f.currency = p.currency) GROUP BY p.currency
UNION ALL
SELECT 'over_monthly_limit',   b.month FROM budgets b GROUP BY b.month
  HAVING SUM(b.limit_amount) > COALESCE((SELECT amount FROM monthly_limits m WHERE m.month = b.month), 0);
`);
}

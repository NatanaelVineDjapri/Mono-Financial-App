-- MONO Finance: SQLite schema v1
-- Money: INTEGER whole rupiah (no REAL anywhere). Dates: TEXT 'YYYY-MM-DD'. Months: TEXT 'YYYY-MM'.
-- Timestamps: TEXT ISO 8601 with offset, e.g. '2026-10-28T09:12:00+07:00'.
-- Open every connection with: PRAGMA foreign_keys = ON;
-- Balances, net worth, budget spent and goal progress are NEVER stored. See the views at the bottom.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------- meta and settings
CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
) WITHOUT ROWID;

-- Key/value app settings. The Gemini API key is NOT here: it lives in secure storage.
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
) WITHOUT ROWID;

-- ---------------------------------------------------------------- accounts
CREATE TABLE accounts (
  id              INTEGER PRIMARY KEY,
  name            TEXT    NOT NULL COLLATE NOCASE UNIQUE
                  CHECK (length(trim(name)) BETWEEN 1 AND 40),
  type            TEXT    NOT NULL CHECK (type IN ('bank','cash','ewallet','savings')),
  opening_balance INTEGER NOT NULL DEFAULT 0 CHECK (opening_balance >= 0),
  opening_date    TEXT    NOT NULL CHECK (date(opening_date) = opening_date),
  icon            TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  archived        INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
  created_at      TEXT    NOT NULL
);

-- ---------------------------------------------------------------- categories
-- 10 expense + 4 income. "Transfer" is a virtual system row in the UI, not a table row.
CREATE TABLE categories (
  id         INTEGER PRIMARY KEY,
  name       TEXT    NOT NULL COLLATE NOCASE CHECK (length(trim(name)) BETWEEN 1 AND 40),
  kind       TEXT    NOT NULL CHECK (kind IN ('income','expense')),
  icon       TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived   INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
  UNIQUE (name, kind)
);

-- ---------------------------------------------------------------- transactions
-- A transfer is ONE row: account_id = from, to_account_id = to, no category.
CREATE TABLE transactions (
  id            INTEGER PRIMARY KEY,
  kind          TEXT    NOT NULL CHECK (kind IN ('income','expense','transfer')),
  account_id    INTEGER NOT NULL REFERENCES accounts(id)   ON DELETE RESTRICT,
  to_account_id INTEGER          REFERENCES accounts(id)   ON DELETE RESTRICT,
  category_id   INTEGER          REFERENCES categories(id) ON DELETE RESTRICT,
  amount        INTEGER NOT NULL CHECK (amount > 0),
  occurred_on   TEXT    NOT NULL CHECK (date(occurred_on) = occurred_on),
  description   TEXT    NOT NULL DEFAULT '',
  note          TEXT,
  source        TEXT    NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','ai','recurring')),
  created_at    TEXT    NOT NULL,
  updated_at    TEXT    NOT NULL,
  CHECK ((kind = 'transfer') = (to_account_id IS NOT NULL)),
  CHECK ((kind = 'transfer') = (category_id IS NULL)),
  CHECK (to_account_id IS NULL OR to_account_id <> account_id)
);
CREATE INDEX ix_tx_date          ON transactions (occurred_on);
CREATE INDEX ix_tx_account_date  ON transactions (account_id, occurred_on);
CREATE INDEX ix_tx_to_account    ON transactions (to_account_id) WHERE to_account_id IS NOT NULL;
CREATE INDEX ix_tx_category_date ON transactions (category_id, occurred_on) WHERE category_id IS NOT NULL;

-- ---------------------------------------------------------------- budgets
-- One row per category per month. "Repeat every month" is realised by copying the row
-- forward when a month is first opened (ensure_month in the domain layer).
CREATE TABLE monthly_limits (
  month  TEXT    PRIMARY KEY CHECK (date(month || '-01') = month || '-01'),
  amount INTEGER NOT NULL CHECK (amount > 0),
  repeat INTEGER NOT NULL DEFAULT 1 CHECK (repeat IN (0,1))
) WITHOUT ROWID;

CREATE TABLE budgets (
  id           INTEGER PRIMARY KEY,
  category_id  INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  month        TEXT    NOT NULL CHECK (date(month || '-01') = month || '-01'),
  limit_amount INTEGER NOT NULL CHECK (limit_amount > 0),
  repeat       INTEGER NOT NULL DEFAULT 1 CHECK (repeat IN (0,1)),
  UNIQUE (category_id, month)
);
CREATE INDEX ix_budgets_month ON budgets (month);

-- ---------------------------------------------------------------- goals
-- Progress is computed: mode 'account' reads that account's balance, 'total_assets' reads net worth.
CREATE TABLE goals (
  id            INTEGER PRIMARY KEY,
  name          TEXT    NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 40),
  mode          TEXT    NOT NULL CHECK (mode IN ('account','total_assets')),
  account_id    INTEGER REFERENCES accounts(id) ON DELETE RESTRICT,
  target_amount INTEGER NOT NULL CHECK (target_amount > 0),
  target_date   TEXT    CHECK (target_date IS NULL OR date(target_date) = target_date),
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT    NOT NULL,
  CHECK ((mode = 'account') = (account_id IS NOT NULL))
);

-- ---------------------------------------------------------------- fixed expenses
-- A template, not a transaction. Changes nothing until the user confirms a due date.
CREATE TABLE recurring (
  id            INTEGER PRIMARY KEY,
  name          TEXT    NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 40),
  amount        INTEGER NOT NULL CHECK (amount > 0),          -- usual amount, or estimate
  amount_varies INTEGER NOT NULL DEFAULT 0 CHECK (amount_varies IN (0,1)),
  account_id    INTEGER NOT NULL REFERENCES accounts(id)   ON DELETE RESTRICT,
  category_id   INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  day_of_month  INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  first_due_on  TEXT    NOT NULL CHECK (date(first_due_on) = first_due_on),
  end_on        TEXT    CHECK (end_on IS NULL OR date(end_on) = end_on),
  remind        INTEGER NOT NULL DEFAULT 1 CHECK (remind IN (0,1)),
  archived      INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
  created_at    TEXT    NOT NULL
);

-- What happened to each due date. No row = still due.
-- Deleting the recorded transaction deletes its event, so that month becomes due again.
CREATE TABLE recurring_events (
  recurring_id   INTEGER NOT NULL REFERENCES recurring(id)    ON DELETE CASCADE,
  due_on         TEXT    NOT NULL CHECK (date(due_on) = due_on),
  status         TEXT    NOT NULL CHECK (status IN ('recorded','skipped')),
  transaction_id INTEGER REFERENCES transactions(id) ON DELETE CASCADE,
  decided_at     TEXT    NOT NULL,
  PRIMARY KEY (recurring_id, due_on),
  CHECK ((status = 'recorded') = (transaction_id IS NOT NULL))
) WITHOUT ROWID;
CREATE UNIQUE INDEX ux_event_tx ON recurring_events (transaction_id) WHERE transaction_id IS NOT NULL;

-- ---------------------------------------------------------------- device-local backup history
-- Files created on this device. Not part of a backup file and untouched by a restore.
CREATE TABLE backup_log (
  id         INTEGER PRIMARY KEY,
  created_at TEXT    NOT NULL,
  file_name  TEXT    NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  tx_count   INTEGER NOT NULL CHECK (tx_count >= 0),
  kind       TEXT    NOT NULL DEFAULT 'manual' CHECK (kind IN ('manual','safety'))
);

-- ================================================================ derived data (views)
-- Month buckets honour settings.month_start_day: period 'YYYY-MM' runs from that day of the month
-- to the day before it in the next month. With start day 1 it is the calendar month.
CREATE VIEW v_tx AS
SELECT t.*,
       strftime('%Y-%m', date(t.occurred_on,
         '-' || ((SELECT CAST(value AS INTEGER) FROM settings WHERE key = 'month_start_day') - 1) || ' days')) AS period
FROM transactions t;

CREATE VIEW v_account_balance AS
SELECT a.id, a.name, a.type, a.archived,
       a.opening_balance
       + COALESCE((SELECT SUM(amount) FROM transactions t WHERE t.account_id    = a.id AND t.kind = 'income'), 0)
       - COALESCE((SELECT SUM(amount) FROM transactions t WHERE t.account_id    = a.id AND t.kind IN ('expense','transfer')), 0)
       + COALESCE((SELECT SUM(amount) FROM transactions t WHERE t.to_account_id = a.id), 0) AS balance
FROM accounts a;

CREATE VIEW v_net_worth AS
SELECT COALESCE(SUM(balance), 0) AS net_worth FROM v_account_balance;

-- Income and expense per period. Transfers are excluded by construction.
CREATE VIEW v_period_flow AS
SELECT period,
       COALESCE(SUM(CASE WHEN kind = 'income'  THEN amount END), 0) AS income,
       COALESCE(SUM(CASE WHEN kind = 'expense' THEN amount END), 0) AS expense,
       COALESCE(SUM(CASE WHEN kind = 'income'  THEN amount WHEN kind = 'expense' THEN -amount END), 0) AS net,
       SUM(kind = 'transfer') AS transfer_count,
       COALESCE(SUM(CASE WHEN kind = 'transfer' THEN amount END), 0) AS transfer_total
FROM v_tx
GROUP BY period;

-- Savings rate in basis points, half away from zero, integers only.
CREATE VIEW v_savings_rate AS
SELECT period, income, expense, net,
       CASE WHEN income > 0
            THEN (net * 20000 + CASE WHEN net >= 0 THEN income ELSE -income END) / (2 * income)
       END AS savings_rate_bp
FROM v_period_flow;

CREATE VIEW v_category_spend AS
SELECT period, category_id, SUM(amount) AS spent
FROM v_tx
WHERE kind = 'expense'
GROUP BY period, category_id;

CREATE VIEW v_budget_status AS
SELECT b.month, b.category_id, c.name AS category, b.limit_amount,
       COALESCE(s.spent, 0)                          AS spent,
       b.limit_amount - COALESCE(s.spent, 0)         AS remaining,       -- negative when over
       (COALESCE(s.spent, 0) * 20000 + b.limit_amount) / (2 * b.limit_amount) AS used_bp,
       COALESCE(s.spent, 0) > b.limit_amount         AS is_over
FROM budgets b
JOIN categories c ON c.id = b.category_id
LEFT JOIN v_category_spend s ON s.period = b.month AND s.category_id = b.category_id;

CREATE VIEW v_month_budget AS
SELECT m.month, m.amount AS monthly_limit,
       COALESCE((SELECT SUM(spent) FROM v_budget_status WHERE month = m.month), 0)       AS category_spent,
       COALESCE((SELECT SUM(limit_amount) FROM budgets WHERE month = m.month), 0)        AS allocated,
       COALESCE((SELECT SUM(amount) FROM v_tx WHERE period = m.month AND kind = 'expense'), 0) AS total_spent,
       m.amount - COALESCE((SELECT SUM(amount) FROM v_tx WHERE period = m.month AND kind = 'expense'), 0) AS remaining
FROM monthly_limits m;

CREATE VIEW v_goal_progress AS
SELECT g.id, g.name, g.mode, g.account_id, g.target_amount, g.target_date,
       CASE g.mode WHEN 'account' THEN (SELECT balance FROM v_account_balance WHERE id = g.account_id)
                   ELSE (SELECT net_worth FROM v_net_worth) END AS current_amount,
       MAX(g.target_amount - CASE g.mode WHEN 'account' THEN (SELECT balance FROM v_account_balance WHERE id = g.account_id)
                                         ELSE (SELECT net_worth FROM v_net_worth) END, 0) AS remaining,
       (CASE g.mode WHEN 'account' THEN (SELECT balance FROM v_account_balance WHERE id = g.account_id)
                    ELSE (SELECT net_worth FROM v_net_worth) END * 20000 + g.target_amount)
         / (2 * g.target_amount) AS progress_bp
FROM goals g;

-- Statement-style activity with running balance per account (Account detail screen).
CREATE VIEW v_account_activity AS
WITH moves AS (
  SELECT id AS tx_id, account_id AS acct, occurred_on, created_at, kind,
         CASE kind WHEN 'income' THEN amount ELSE -amount END AS delta
  FROM transactions
  UNION ALL
  SELECT id, to_account_id, occurred_on, created_at, 'transfer_in', amount
  FROM transactions WHERE kind = 'transfer'
)
SELECT m.acct AS account_id, m.tx_id, m.occurred_on, m.kind, m.delta,
       a.opening_balance + SUM(m.delta) OVER (
         PARTITION BY m.acct ORDER BY m.occurred_on, m.created_at, m.tx_id
         ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS balance_after
FROM moves m JOIN accounts a ON a.id = m.acct;

-- Net worth at the end of each calendar month from the first opening date to this month.
-- (Transfers net to zero, so only income and expense matter.)
CREATE VIEW v_net_worth_by_month AS
WITH RECURSIVE months(ms) AS (
  SELECT date(MIN(opening_date), 'start of month') FROM accounts
  UNION ALL
  SELECT date(ms, '+1 month') FROM months
  WHERE ms < date('now', 'localtime', 'start of month')
)
SELECT strftime('%Y-%m', ms) AS month,
       (SELECT COALESCE(SUM(opening_balance), 0) FROM accounts WHERE opening_date <= date(ms, '+1 month', '-1 day'))
     + (SELECT COALESCE(SUM(CASE kind WHEN 'income' THEN amount WHEN 'expense' THEN -amount ELSE 0 END), 0)
        FROM transactions WHERE occurred_on <= date(ms, '+1 month', '-1 day')) AS net_worth
FROM months WHERE ms IS NOT NULL;

-- Fixed expenses that are due and undecided. Day 29..31 clamps to the last day of shorter months.
CREATE VIEW v_recurring_due AS
WITH RECURSIVE months(recurring_id, ms) AS (
  SELECT id, date(first_due_on, 'start of month') FROM recurring WHERE archived = 0
  UNION ALL
  SELECT recurring_id, date(ms, '+1 month') FROM months
  WHERE ms < date('now', 'localtime', 'start of month')
),
due AS (
  SELECT r.id AS recurring_id, r.name, r.amount, r.amount_varies, r.account_id, r.category_id,
         date(m.ms, '+' || (MIN(r.day_of_month,
              CAST(strftime('%d', date(m.ms, '+1 month', '-1 day')) AS INTEGER)) - 1) || ' days') AS due_on,
         r.first_due_on, r.end_on
  FROM months m JOIN recurring r ON r.id = m.recurring_id
)
SELECT d.recurring_id, d.name, d.amount, d.amount_varies, d.account_id, d.category_id, d.due_on
FROM due d
WHERE d.due_on >= d.first_due_on
  AND d.due_on <= date('now', 'localtime')
  AND (d.end_on IS NULL OR d.due_on <= d.end_on)
  AND NOT EXISTS (SELECT 1 FROM recurring_events e WHERE e.recurring_id = d.recurring_id AND e.due_on = d.due_on)
ORDER BY d.due_on, d.recurring_id;

-- ================================================================ guards (triggers)
-- Domain code checks first and shows friendly messages. These triggers are the safety net.
-- A restore sets meta.guards_off = '1' inside its transaction, bulk-loads, then runs
-- SELECT * FROM v_integrity_issues and rolls back if anything is returned.
CREATE TRIGGER trg_tx_future_ins BEFORE INSERT ON transactions
WHEN NOT EXISTS (SELECT 1 FROM meta WHERE key = 'guards_off' AND value = '1')
BEGIN
  SELECT RAISE(ABORT, 'future_date') WHERE NEW.occurred_on > date('now', 'localtime');
END;
CREATE TRIGGER trg_tx_future_upd BEFORE UPDATE OF occurred_on ON transactions
WHEN NOT EXISTS (SELECT 1 FROM meta WHERE key = 'guards_off' AND value = '1')
BEGIN
  SELECT RAISE(ABORT, 'future_date') WHERE NEW.occurred_on > date('now', 'localtime');
END;

CREATE TRIGGER trg_tx_opening_ins BEFORE INSERT ON transactions
WHEN NOT EXISTS (SELECT 1 FROM meta WHERE key = 'guards_off' AND value = '1')
BEGIN
  SELECT RAISE(ABORT, 'before_opening_date')
  WHERE NEW.occurred_on < (SELECT opening_date FROM accounts WHERE id = NEW.account_id)
     OR NEW.occurred_on < COALESCE((SELECT opening_date FROM accounts WHERE id = NEW.to_account_id), '0000-01-01');
END;
CREATE TRIGGER trg_tx_opening_upd BEFORE UPDATE ON transactions
WHEN NOT EXISTS (SELECT 1 FROM meta WHERE key = 'guards_off' AND value = '1')
BEGIN
  SELECT RAISE(ABORT, 'before_opening_date')
  WHERE NEW.occurred_on < (SELECT opening_date FROM accounts WHERE id = NEW.account_id)
     OR NEW.occurred_on < COALESCE((SELECT opening_date FROM accounts WHERE id = NEW.to_account_id), '0000-01-01');
END;

CREATE TRIGGER trg_tx_category_kind_ins BEFORE INSERT ON transactions
WHEN NEW.kind <> 'transfer' AND NOT EXISTS (SELECT 1 FROM meta WHERE key = 'guards_off' AND value = '1')
BEGIN
  SELECT RAISE(ABORT, 'category_kind_mismatch')
  WHERE (SELECT kind FROM categories WHERE id = NEW.category_id) <> NEW.kind;
END;
CREATE TRIGGER trg_tx_category_kind_upd BEFORE UPDATE ON transactions
WHEN NEW.kind <> 'transfer' AND NOT EXISTS (SELECT 1 FROM meta WHERE key = 'guards_off' AND value = '1')
BEGIN
  SELECT RAISE(ABORT, 'category_kind_mismatch')
  WHERE (SELECT kind FROM categories WHERE id = NEW.category_id) <> NEW.kind;
END;

-- No account may end below zero (current balance, not every past day).
CREATE TRIGGER trg_tx_balance_ins AFTER INSERT ON transactions
WHEN NOT EXISTS (SELECT 1 FROM meta WHERE key = 'guards_off' AND value = '1')
BEGIN
  SELECT RAISE(ABORT, 'insufficient_balance')
  WHERE EXISTS (SELECT 1 FROM v_account_balance WHERE balance < 0 AND id IN (NEW.account_id, NEW.to_account_id));
END;
CREATE TRIGGER trg_tx_balance_upd AFTER UPDATE ON transactions
WHEN NOT EXISTS (SELECT 1 FROM meta WHERE key = 'guards_off' AND value = '1')
BEGIN
  SELECT RAISE(ABORT, 'insufficient_balance')
  WHERE EXISTS (SELECT 1 FROM v_account_balance WHERE balance < 0
                AND id IN (NEW.account_id, NEW.to_account_id, OLD.account_id, OLD.to_account_id));
END;
CREATE TRIGGER trg_tx_balance_del AFTER DELETE ON transactions
WHEN NOT EXISTS (SELECT 1 FROM meta WHERE key = 'guards_off' AND value = '1')
BEGIN
  SELECT RAISE(ABORT, 'insufficient_balance')
  WHERE EXISTS (SELECT 1 FROM v_account_balance WHERE balance < 0 AND id IN (OLD.account_id, OLD.to_account_id));
END;

-- Changing an account's opening balance or date must not strand records or go negative.
CREATE TRIGGER trg_account_opening_upd AFTER UPDATE OF opening_balance, opening_date ON accounts
WHEN NOT EXISTS (SELECT 1 FROM meta WHERE key = 'guards_off' AND value = '1')
BEGIN
  SELECT RAISE(ABORT, 'insufficient_balance')
  WHERE EXISTS (SELECT 1 FROM v_account_balance WHERE id = NEW.id AND balance < 0);
  SELECT RAISE(ABORT, 'before_opening_date')
  WHERE EXISTS (SELECT 1 FROM transactions t
                WHERE (t.account_id = NEW.id OR t.to_account_id = NEW.id) AND t.occurred_on < NEW.opening_date);
END;

-- Budgets: expense categories only, and the sum must fit the monthly limit.
CREATE TRIGGER trg_budget_kind_ins BEFORE INSERT ON budgets
WHEN NOT EXISTS (SELECT 1 FROM meta WHERE key = 'guards_off' AND value = '1')
BEGIN
  SELECT RAISE(ABORT, 'budget_needs_expense_category')
  WHERE (SELECT kind FROM categories WHERE id = NEW.category_id) <> 'expense';
END;
CREATE TRIGGER trg_budget_sum_ins AFTER INSERT ON budgets
WHEN NOT EXISTS (SELECT 1 FROM meta WHERE key = 'guards_off' AND value = '1')
BEGIN
  SELECT RAISE(ABORT, 'over_monthly_limit')
  WHERE (SELECT SUM(limit_amount) FROM budgets WHERE month = NEW.month)
        > COALESCE((SELECT amount FROM monthly_limits WHERE month = NEW.month), 0);
END;
CREATE TRIGGER trg_budget_sum_upd AFTER UPDATE OF limit_amount, month ON budgets
WHEN NOT EXISTS (SELECT 1 FROM meta WHERE key = 'guards_off' AND value = '1')
BEGIN
  SELECT RAISE(ABORT, 'over_monthly_limit')
  WHERE (SELECT SUM(limit_amount) FROM budgets WHERE month = NEW.month)
        > COALESCE((SELECT amount FROM monthly_limits WHERE month = NEW.month), 0);
END;
CREATE TRIGGER trg_limit_upd AFTER UPDATE OF amount ON monthly_limits
WHEN NOT EXISTS (SELECT 1 FROM meta WHERE key = 'guards_off' AND value = '1')
BEGIN
  SELECT RAISE(ABORT, 'over_monthly_limit')
  WHERE (SELECT COALESCE(SUM(limit_amount), 0) FROM budgets WHERE month = NEW.month) > NEW.amount;
END;
CREATE TRIGGER trg_limit_del BEFORE DELETE ON monthly_limits
WHEN NOT EXISTS (SELECT 1 FROM meta WHERE key = 'guards_off' AND value = '1')
BEGIN
  SELECT RAISE(ABORT, 'budgets_exist_for_month') WHERE EXISTS (SELECT 1 FROM budgets WHERE month = OLD.month);
END;

-- Final audit, used after a restore and by tests. Empty result = healthy database.
CREATE VIEW v_integrity_issues AS
SELECT 'negative_balance'     AS issue, CAST(id AS TEXT) AS ref FROM v_account_balance WHERE balance < 0
UNION ALL
SELECT 'future_date',          CAST(id AS TEXT) FROM transactions WHERE occurred_on > date('now', 'localtime')
UNION ALL
SELECT 'before_opening_date',  CAST(t.id AS TEXT) FROM transactions t
  JOIN accounts a ON a.id = t.account_id WHERE t.occurred_on < a.opening_date
UNION ALL
SELECT 'category_kind_mismatch', CAST(t.id AS TEXT) FROM transactions t
  JOIN categories c ON c.id = t.category_id WHERE t.kind <> 'transfer' AND c.kind <> t.kind
UNION ALL
SELECT 'over_monthly_limit',   b.month FROM budgets b GROUP BY b.month
  HAVING SUM(b.limit_amount) > COALESCE((SELECT amount FROM monthly_limits m WHERE m.month = b.month), 0);

-- ================================================================ seed
INSERT INTO meta (key, value) VALUES ('schema_version', '1'), ('guards_off', '0');

INSERT INTO settings (key, value) VALUES
  ('app_lock', '1'), ('hide_on_launch', '0'), ('block_screenshots', '1'),
  ('number_format', 'id_ID'), ('month_start_day', '1'), ('timezone', 'Asia/Jakarta'),
  ('backup_reminder', '1'), ('recurring_reminders', '1'),
  ('ai_enabled', '0'), ('display_name', '');

INSERT INTO categories (name, kind, sort_order) VALUES
  ('Food & drink','expense',1), ('Transport','expense',2), ('Shopping','expense',3), ('Bills','expense',4),
  ('Health','expense',5), ('Leisure','expense',6), ('Housing','expense',7), ('Education','expense',8),
  ('Gifts','expense',9), ('Other','expense',10),
  ('Salary','income',1), ('Freelance','income',2), ('Interest and dividends','income',3), ('Other income','income',4);

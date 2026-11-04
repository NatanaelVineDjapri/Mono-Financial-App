-- MONO Finance: SQLite schema v1
-- Money: INTEGER only (no REAL anywhere), in the minor unit of the pocket's currency:
--   IDR = whole rupiah, USD = cents, JPY = yen. Dates: TEXT 'YYYY-MM-DD'. Months: TEXT 'YYYY-MM'.
-- Timestamps: TEXT ISO 8601 with offset, e.g. '2026-10-28T09:12:00+07:00'.
-- Open every connection with: PRAGMA foreign_keys = ON;
-- Balances, net worth, budget spent and goal progress are NEVER stored. See the views at the bottom.
-- Foreign currency: ONE 'forex' account (a.k.a. Valas) holds one POCKET per currency (account_currencies).
-- Every other account is IDR. A rate is IDR per 1 major unit x 10.000 (fx_rates.rate_e4).
-- Each transaction also stores amount_idr, the rupiah value at the time it was recorded, so budgets
-- and reports do not drift when rates change.

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


-- ---------------------------------------------------------------- currencies and rates
-- Static reference list (seeded below, not part of a backup). minor_factor: 1 for IDR/JPY/KRW, 100 for cents.
CREATE TABLE currencies (
  code         TEXT    PRIMARY KEY CHECK (code GLOB '[A-Z][A-Z][A-Z]'),
  name         TEXT    NOT NULL,
  minor_factor INTEGER NOT NULL CHECK (minor_factor IN (1,10,100,1000))
) WITHOUT ROWID;

-- Exchange rates to rupiah. History is kept; the newest row per currency wins (see v_latest_fx).
-- rate_e4 = rupiah per 1 major unit x 10.000, e.g. USD 16.250 -> 162500000. IDR never has a row (always 1).
CREATE TABLE fx_rates (
  id         INTEGER PRIMARY KEY,
  currency   TEXT    NOT NULL REFERENCES currencies(code) CHECK (currency <> 'IDR'),
  rate_e4    INTEGER NOT NULL CHECK (rate_e4 > 0),
  fetched_at TEXT    NOT NULL,
  source     TEXT    NOT NULL CHECK (source IN ('api','manual'))
);
CREATE INDEX ix_fx_currency_time ON fx_rates (currency, fetched_at);

-- ---------------------------------------------------------------- accounts
CREATE TABLE accounts (
  id              INTEGER PRIMARY KEY,
  name            TEXT    NOT NULL COLLATE NOCASE UNIQUE
                  CHECK (length(trim(name)) BETWEEN 1 AND 40),
  type            TEXT    NOT NULL CHECK (type IN ('bank','cash','ewallet','savings','forex')),
  opening_balance INTEGER NOT NULL DEFAULT 0 CHECK (opening_balance >= 0),   -- IDR accounts only
  opening_date    TEXT    NOT NULL CHECK (date(opening_date) = opening_date),
  icon            TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  archived        INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
  created_at      TEXT    NOT NULL,
  CHECK (type <> 'forex' OR opening_balance = 0)   -- a forex account's money lives in its pockets
);

-- One pocket per foreign currency inside a 'forex' account. Non-forex accounts have no rows here:
-- they implicitly hold a single IDR pocket (see v_pocket). Pockets are archived, never deleted.
CREATE TABLE account_currencies (
  account_id      INTEGER NOT NULL REFERENCES accounts(id)   ON DELETE RESTRICT,
  currency        TEXT    NOT NULL REFERENCES currencies(code) CHECK (currency <> 'IDR'),
  opening_balance INTEGER NOT NULL DEFAULT 0 CHECK (opening_balance >= 0),   -- minor units
  opening_date    TEXT    NOT NULL CHECK (date(opening_date) = opening_date),
  sort_order      INTEGER NOT NULL DEFAULT 0,
  archived        INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
  PRIMARY KEY (account_id, currency)
) WITHOUT ROWID;

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
-- A transfer is ONE row. Source side = (account_id, currency, amount). Destination side =
-- (to_account_id, to_currency, amount_to). For same-currency transfers amount_to = amount.
-- A cross-currency transfer (IDR -> USD pocket, or USD pocket -> SGD pocket) stores both amounts;
-- the effective rate is derived. Moving money between pockets of the same account is allowed
-- only when the currencies differ.
CREATE TABLE transactions (
  id            INTEGER PRIMARY KEY,
  kind          TEXT    NOT NULL CHECK (kind IN ('income','expense','transfer')),
  account_id    INTEGER NOT NULL REFERENCES accounts(id)   ON DELETE RESTRICT,
  currency      TEXT    NOT NULL DEFAULT 'IDR' REFERENCES currencies(code),
  to_account_id INTEGER          REFERENCES accounts(id)   ON DELETE RESTRICT,
  to_currency   TEXT             REFERENCES currencies(code),
  category_id   INTEGER          REFERENCES categories(id) ON DELETE RESTRICT,
  amount        INTEGER NOT NULL CHECK (amount > 0),                -- minor units of `currency`
  amount_to     INTEGER          CHECK (amount_to > 0),             -- minor units of `to_currency`
  amount_idr    INTEGER NOT NULL CHECK (amount_idr >= 0),           -- rupiah value when recorded
  occurred_on   TEXT    NOT NULL CHECK (date(occurred_on) = occurred_on),
  description   TEXT    NOT NULL DEFAULT '',
  note          TEXT,
  source        TEXT    NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','ai','recurring')),
  created_at    TEXT    NOT NULL,
  updated_at    TEXT    NOT NULL,
  CHECK ((kind = 'transfer') = (to_account_id IS NOT NULL)),
  CHECK ((kind = 'transfer') = (to_currency IS NOT NULL)),
  CHECK ((kind = 'transfer') = (amount_to IS NOT NULL)),
  CHECK ((kind = 'transfer') = (category_id IS NULL)),
  CHECK (to_account_id IS NULL OR to_account_id <> account_id OR to_currency <> currency),
  CHECK (to_currency IS NULL OR to_currency <> currency OR amount_to = amount),
  CHECK (currency <> 'IDR' OR amount_idr = amount)
);
CREATE INDEX ix_tx_date          ON transactions (occurred_on);
CREATE INDEX ix_tx_account_date  ON transactions (account_id, currency, occurred_on);
CREATE INDEX ix_tx_to_account    ON transactions (to_account_id, to_currency) WHERE to_account_id IS NOT NULL;
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
-- ================================================================ derived data (views)
-- Month buckets honour settings.month_start_day: period 'YYYY-MM' runs from that day of the month
-- to the day before it in the next month. With start day 1 it is the calendar month.
CREATE VIEW v_tx AS
SELECT t.*,
       strftime('%Y-%m', date(t.occurred_on,
         '-' || ((SELECT CAST(value AS INTEGER) FROM settings WHERE key = 'month_start_day') - 1) || ' days')) AS period
FROM transactions t;

-- Newest rate per currency.
CREATE VIEW v_latest_fx AS
SELECT f.currency, f.rate_e4, f.fetched_at, f.source
FROM fx_rates f
WHERE f.id = (SELECT g.id FROM fx_rates g WHERE g.currency = f.currency ORDER BY g.fetched_at DESC, g.id DESC LIMIT 1);

-- Every (account, currency) pair that can hold money: one IDR pocket per non-forex account,
-- plus the pockets of forex accounts. Forex pockets can be archived; IDR pockets cannot.
CREATE VIEW v_pocket AS
SELECT a.id AS account_id, 'IDR' AS currency, a.opening_balance, a.opening_date, 0 AS archived
FROM accounts a WHERE a.type <> 'forex'
UNION ALL
SELECT p.account_id, p.currency, p.opening_balance, p.opening_date, p.archived
FROM account_currencies p;

-- Balance of each pocket in its own minor unit.
CREATE VIEW v_pocket_balance AS
SELECT p.account_id, p.currency, c.minor_factor, p.archived,
       p.opening_balance
       + COALESCE((SELECT SUM(amount)    FROM transactions t WHERE t.account_id    = p.account_id AND t.currency    = p.currency AND t.kind = 'income'), 0)
       - COALESCE((SELECT SUM(amount)    FROM transactions t WHERE t.account_id    = p.account_id AND t.currency    = p.currency AND t.kind IN ('expense','transfer')), 0)
       + COALESCE((SELECT SUM(amount_to) FROM transactions t WHERE t.to_account_id = p.account_id AND t.to_currency = p.currency), 0) AS balance
FROM v_pocket p JOIN currencies c ON c.code = p.currency;

-- Pocket balance valued in rupiah at the newest rate (half away from zero). value_idr is NULL
-- when a foreign pocket has no rate yet: never silently counted as zero.
CREATE VIEW v_pocket_value AS
SELECT b.account_id, b.currency, b.balance, x.rate_e4, x.fetched_at AS rate_at,
       CASE WHEN b.currency = 'IDR' THEN b.balance
            WHEN x.rate_e4 IS NULL  THEN NULL
            ELSE (2 * b.balance * x.rate_e4 + CASE WHEN b.balance >= 0 THEN 1 ELSE -1 END * b.minor_factor * 10000)
                 / (2 * b.minor_factor * 10000) END AS value_idr
FROM v_pocket_balance b LEFT JOIN v_latest_fx x ON x.currency = b.currency;

-- `balance` is the account's value in rupiah. For a forex account it is the sum of its pockets.
CREATE VIEW v_account_balance AS
SELECT a.id, a.name, a.type, a.archived,
       COALESCE((SELECT SUM(value_idr)         FROM v_pocket_value v WHERE v.account_id = a.id), 0) AS balance,
       COALESCE((SELECT SUM(value_idr IS NULL) FROM v_pocket_value v WHERE v.account_id = a.id), 0) AS missing_rates
FROM accounts a;

CREATE VIEW v_net_worth AS
SELECT COALESCE(SUM(balance), 0) AS net_worth,
       COALESCE(SUM(missing_rates), 0) > 0 AS incomplete          -- 1 when a pocket has no rate
FROM v_account_balance;

-- Income and expense per period, in rupiah (amount_idr). Transfers are excluded by construction.
CREATE VIEW v_period_flow AS
SELECT period,
       COALESCE(SUM(CASE WHEN kind = 'income'  THEN amount_idr END), 0) AS income,
       COALESCE(SUM(CASE WHEN kind = 'expense' THEN amount_idr END), 0) AS expense,
       COALESCE(SUM(CASE WHEN kind = 'income'  THEN amount_idr WHEN kind = 'expense' THEN -amount_idr END), 0) AS net,
       SUM(kind = 'transfer') AS transfer_count,
       COALESCE(SUM(CASE WHEN kind = 'transfer' THEN amount_idr END), 0) AS transfer_total
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
SELECT period, category_id, SUM(amount_idr) AS spent
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
       COALESCE((SELECT SUM(amount_idr) FROM v_tx WHERE period = m.month AND kind = 'expense'), 0) AS total_spent,
       m.amount - COALESCE((SELECT SUM(amount_idr) FROM v_tx WHERE period = m.month AND kind = 'expense'), 0) AS remaining
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

-- Statement-style activity with running balance per pocket (Account detail screen). A forex account
-- shows one running balance per currency; filter by currency to get one statement.
CREATE VIEW v_account_activity AS
WITH moves AS (
  SELECT id AS tx_id, account_id AS acct, currency AS cur, occurred_on, created_at, kind,
         CASE kind WHEN 'income' THEN amount ELSE -amount END AS delta
  FROM transactions
  UNION ALL
  SELECT id, to_account_id, to_currency, occurred_on, created_at, 'transfer_in', amount_to
  FROM transactions WHERE kind = 'transfer'
)
SELECT m.acct AS account_id, m.cur AS currency, m.tx_id, m.occurred_on, m.kind, m.delta,
       p.opening_balance + SUM(m.delta) OVER (
         PARTITION BY m.acct, m.cur ORDER BY m.occurred_on, m.created_at, m.tx_id
         ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS balance_after
FROM moves m JOIN v_pocket p ON p.account_id = m.acct AND p.currency = m.cur;

-- Net worth in rupiah at the end of each calendar month, from the first opening date to this month.
-- Foreign pockets use the newest rate recorded on or before that month end, or the oldest rate if
-- none is that old. With a single stored rate, history is therefore valued at that rate.
CREATE VIEW v_net_worth_by_month AS
WITH RECURSIVE months(ms) AS (
  SELECT date(MIN(opening_date), 'start of month') FROM v_pocket
  UNION ALL
  SELECT date(ms, '+1 month') FROM months
  WHERE ms < date('now', 'localtime', 'start of month')
),
pm AS (SELECT strftime('%Y-%m', ms) AS month, date(ms, '+1 month', '-1 day') AS me FROM months WHERE ms IS NOT NULL),
bal AS (
  SELECT pm.month, pm.me, p.currency, c.minor_factor,
         CASE WHEN p.opening_date <= pm.me THEN p.opening_balance ELSE 0 END
         + COALESCE((SELECT SUM(CASE kind WHEN 'income' THEN amount ELSE -amount END) FROM transactions t
                     WHERE t.account_id = p.account_id AND t.currency = p.currency AND t.occurred_on <= pm.me), 0)
         + COALESCE((SELECT SUM(amount_to) FROM transactions t
                     WHERE t.to_account_id = p.account_id AND t.to_currency = p.currency AND t.occurred_on <= pm.me), 0) AS balance
  FROM pm CROSS JOIN v_pocket p JOIN currencies c ON c.code = p.currency
),
priced AS (
  SELECT bal.*,
         COALESCE((SELECT f.rate_e4 FROM fx_rates f WHERE f.currency = bal.currency AND substr(f.fetched_at, 1, 10) <= bal.me
                   ORDER BY f.fetched_at DESC, f.id DESC LIMIT 1),
                  (SELECT f.rate_e4 FROM fx_rates f WHERE f.currency = bal.currency ORDER BY f.fetched_at, f.id LIMIT 1)) AS rate_e4
  FROM bal
)
SELECT month,
       COALESCE(SUM(CASE WHEN currency = 'IDR' THEN balance
                         WHEN rate_e4 IS NULL  THEN 0
                         ELSE (2 * balance * rate_e4 + CASE WHEN balance >= 0 THEN 1 ELSE -1 END * minor_factor * 10000)
                              / (2 * minor_factor * 10000) END), 0) AS net_worth
FROM priced GROUP BY month;

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
  WHERE NEW.occurred_on < COALESCE((SELECT opening_date FROM v_pocket WHERE account_id = NEW.account_id AND currency = NEW.currency), '0000-01-01')
     OR NEW.occurred_on < COALESCE((SELECT opening_date FROM v_pocket WHERE account_id = NEW.to_account_id AND currency = NEW.to_currency), '0000-01-01');
END;
CREATE TRIGGER trg_tx_opening_upd BEFORE UPDATE ON transactions
WHEN NOT EXISTS (SELECT 1 FROM meta WHERE key = 'guards_off' AND value = '1')
BEGIN
  SELECT RAISE(ABORT, 'before_opening_date')
  WHERE NEW.occurred_on < COALESCE((SELECT opening_date FROM v_pocket WHERE account_id = NEW.account_id AND currency = NEW.currency), '0000-01-01')
     OR NEW.occurred_on < COALESCE((SELECT opening_date FROM v_pocket WHERE account_id = NEW.to_account_id AND currency = NEW.to_currency), '0000-01-01');
END;

-- Money may only move in a pocket that exists (and is not archived when adding), and a foreign
-- currency needs at least one stored rate so the rupiah value can be shown.
CREATE TRIGGER trg_tx_currency_ins BEFORE INSERT ON transactions
WHEN NOT EXISTS (SELECT 1 FROM meta WHERE key = 'guards_off' AND value = '1')
BEGIN
  SELECT RAISE(ABORT, 'currency_not_in_account')
  WHERE NOT EXISTS (SELECT 1 FROM v_pocket p WHERE p.account_id = NEW.account_id AND p.currency = NEW.currency AND p.archived = 0)
     OR (NEW.to_account_id IS NOT NULL AND NOT EXISTS
         (SELECT 1 FROM v_pocket p WHERE p.account_id = NEW.to_account_id AND p.currency = NEW.to_currency AND p.archived = 0));
  SELECT RAISE(ABORT, 'missing_fx_rate')
  WHERE (NEW.currency <> 'IDR' AND NOT EXISTS (SELECT 1 FROM fx_rates WHERE currency = NEW.currency))
     OR (COALESCE(NEW.to_currency, 'IDR') <> 'IDR' AND NOT EXISTS (SELECT 1 FROM fx_rates WHERE currency = NEW.to_currency));
END;
CREATE TRIGGER trg_tx_currency_upd BEFORE UPDATE OF account_id, currency, to_account_id, to_currency ON transactions
WHEN NOT EXISTS (SELECT 1 FROM meta WHERE key = 'guards_off' AND value = '1')
BEGIN
  SELECT RAISE(ABORT, 'currency_not_in_account')
  WHERE NOT EXISTS (SELECT 1 FROM v_pocket p WHERE p.account_id = NEW.account_id AND p.currency = NEW.currency)
     OR (NEW.to_account_id IS NOT NULL AND NOT EXISTS
         (SELECT 1 FROM v_pocket p WHERE p.account_id = NEW.to_account_id AND p.currency = NEW.to_currency));
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

-- No pocket may end below zero (current balance, not every past day). Each currency is checked on its own.
CREATE TRIGGER trg_tx_balance_ins AFTER INSERT ON transactions
WHEN NOT EXISTS (SELECT 1 FROM meta WHERE key = 'guards_off' AND value = '1')
BEGIN
  SELECT RAISE(ABORT, 'insufficient_balance')
  WHERE EXISTS (SELECT 1 FROM v_pocket_balance b WHERE b.balance < 0
    AND ((b.account_id = NEW.account_id AND b.currency = NEW.currency)
      OR (b.account_id = NEW.to_account_id AND b.currency = NEW.to_currency)));
END;
CREATE TRIGGER trg_tx_balance_upd AFTER UPDATE ON transactions
WHEN NOT EXISTS (SELECT 1 FROM meta WHERE key = 'guards_off' AND value = '1')
BEGIN
  SELECT RAISE(ABORT, 'insufficient_balance')
  WHERE EXISTS (SELECT 1 FROM v_pocket_balance b WHERE b.balance < 0
    AND ((b.account_id = NEW.account_id AND b.currency = NEW.currency)
      OR (b.account_id = NEW.to_account_id AND b.currency = NEW.to_currency)
      OR (b.account_id = OLD.account_id AND b.currency = OLD.currency)
      OR (b.account_id = OLD.to_account_id AND b.currency = OLD.to_currency)));
END;
CREATE TRIGGER trg_tx_balance_del AFTER DELETE ON transactions
WHEN NOT EXISTS (SELECT 1 FROM meta WHERE key = 'guards_off' AND value = '1')
BEGIN
  SELECT RAISE(ABORT, 'insufficient_balance')
  WHERE EXISTS (SELECT 1 FROM v_pocket_balance b WHERE b.balance < 0
    AND ((b.account_id = OLD.account_id AND b.currency = OLD.currency)
      OR (b.account_id = OLD.to_account_id AND b.currency = OLD.to_currency)));
END;

-- Changing an account's opening balance or date must not strand records or go negative.
-- (A forex account's opening values live in its pockets, see the next two triggers.)
CREATE TRIGGER trg_account_opening_upd AFTER UPDATE OF opening_balance, opening_date ON accounts
WHEN NEW.type <> 'forex' AND NOT EXISTS (SELECT 1 FROM meta WHERE key = 'guards_off' AND value = '1')
BEGIN
  SELECT RAISE(ABORT, 'insufficient_balance')
  WHERE EXISTS (SELECT 1 FROM v_pocket_balance WHERE account_id = NEW.id AND balance < 0);
  SELECT RAISE(ABORT, 'before_opening_date')
  WHERE EXISTS (SELECT 1 FROM transactions t
                WHERE (t.account_id = NEW.id OR t.to_account_id = NEW.id) AND t.occurred_on < NEW.opening_date);
END;
CREATE TRIGGER trg_pocket_opening_upd AFTER UPDATE OF opening_balance, opening_date ON account_currencies
WHEN NOT EXISTS (SELECT 1 FROM meta WHERE key = 'guards_off' AND value = '1')
BEGIN
  SELECT RAISE(ABORT, 'insufficient_balance')
  WHERE EXISTS (SELECT 1 FROM v_pocket_balance WHERE account_id = NEW.account_id AND currency = NEW.currency AND balance < 0);
  SELECT RAISE(ABORT, 'before_opening_date')
  WHERE EXISTS (SELECT 1 FROM transactions t
                WHERE ((t.account_id = NEW.account_id AND t.currency = NEW.currency)
                    OR (t.to_account_id = NEW.account_id AND t.to_currency = NEW.currency))
                  AND t.occurred_on < NEW.opening_date);
END;

-- Pockets live only inside a forex account and can be archived only when empty.
CREATE TRIGGER trg_pocket_ins BEFORE INSERT ON account_currencies
WHEN NOT EXISTS (SELECT 1 FROM meta WHERE key = 'guards_off' AND value = '1')
BEGIN
  SELECT RAISE(ABORT, 'pocket_needs_forex_account')
  WHERE (SELECT type FROM accounts WHERE id = NEW.account_id) <> 'forex';
END;
CREATE TRIGGER trg_pocket_archive BEFORE UPDATE OF archived ON account_currencies
WHEN NEW.archived = 1 AND NOT EXISTS (SELECT 1 FROM meta WHERE key = 'guards_off' AND value = '1')
BEGIN
  SELECT RAISE(ABORT, 'pocket_not_empty')
  WHERE (SELECT balance FROM v_pocket_balance WHERE account_id = NEW.account_id AND currency = NEW.currency) <> 0;
END;

-- An account cannot switch between forex and a normal type once it has pockets or records.
CREATE TRIGGER trg_account_type_upd BEFORE UPDATE OF type ON accounts
WHEN (OLD.type = 'forex') <> (NEW.type = 'forex') AND NOT EXISTS (SELECT 1 FROM meta WHERE key = 'guards_off' AND value = '1')
BEGIN
  SELECT RAISE(ABORT, 'account_type_locked')
  WHERE EXISTS (SELECT 1 FROM transactions t WHERE t.account_id = NEW.id OR t.to_account_id = NEW.id)
     OR EXISTS (SELECT 1 FROM account_currencies WHERE account_id = NEW.id);
END;

-- Fixed expenses are IDR only for now, so they cannot point at a forex account.
CREATE TRIGGER trg_recurring_ins BEFORE INSERT ON recurring
WHEN NOT EXISTS (SELECT 1 FROM meta WHERE key = 'guards_off' AND value = '1')
BEGIN
  SELECT RAISE(ABORT, 'recurring_needs_idr_account') WHERE (SELECT type FROM accounts WHERE id = NEW.account_id) = 'forex';
END;
CREATE TRIGGER trg_recurring_upd BEFORE UPDATE OF account_id ON recurring
WHEN NOT EXISTS (SELECT 1 FROM meta WHERE key = 'guards_off' AND value = '1')
BEGIN
  SELECT RAISE(ABORT, 'recurring_needs_idr_account') WHERE (SELECT type FROM accounts WHERE id = NEW.account_id) = 'forex';
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
SELECT 'negative_balance'     AS issue, account_id || '/' || currency AS ref FROM v_pocket_balance WHERE balance < 0
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

-- ================================================================ seed
INSERT INTO meta (key, value) VALUES ('schema_version', '1'), ('guards_off', '0');

INSERT INTO currencies (code, name, minor_factor) VALUES
  ('IDR','Indonesian rupiah',1), ('USD','US dollar',100), ('SGD','Singapore dollar',100),
  ('EUR','Euro',100), ('MYR','Malaysian ringgit',100), ('AUD','Australian dollar',100),
  ('GBP','Pound sterling',100), ('JPY','Japanese yen',1), ('CNY','Chinese yuan',100),
  ('HKD','Hong Kong dollar',100), ('KRW','South Korean won',1), ('THB','Thai baht',100),
  ('SAR','Saudi riyal',100);

INSERT INTO settings (key, value) VALUES
  ('app_lock', '1'), ('hide_on_launch', '0'), ('block_screenshots', '1'),
  ('number_format', 'id_ID'), ('month_start_day', '1'), ('timezone', 'Asia/Jakarta'),
  ('backup_reminder', '1'), ('recurring_reminders', '1'),
  ('ai_enabled', '0'), ('display_name', ''), ('fx_auto_update', '0');

INSERT INTO categories (name, kind, sort_order) VALUES
  ('Food & drink','expense',1), ('Transport','expense',2), ('Shopping','expense',3), ('Bills','expense',4),
  ('Health','expense',5), ('Leisure','expense',6), ('Housing','expense',7), ('Education','expense',8),
  ('Gifts','expense',9), ('Other','expense',10),
  ('Salary','income',1), ('Freelance','income',2), ('Interest and dividends','income',3), ('Other income','income',4);

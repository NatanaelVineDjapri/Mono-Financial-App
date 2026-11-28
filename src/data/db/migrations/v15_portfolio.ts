// Migration 14 -> 15: stock portfolios (asked for by the owner). A portfolio holds positions (symbol, quantity, average
// buy price, in the stock's own currency); prices fetched from outside are kept in stock_quotes. All integers: quantity
// and prices times 10.000. Values are derived in views, never stored.
//
//   v_position_value      each position in rupiah: market_idr (NULL without a price or a rate) and cost_idr (NULL
//                         without a rate for its currency).
//   v_portfolio_counted   what portfolios add to net worth, by settings.portfolio_net_worth: 'off' (default) nothing,
//                         'market' today's prices (cost where there is no price yet), 'cost' what was paid.
//   v_net_worth and v_net_worth_by_month add that amount. The monthly history adds today's value to every month: past
//   prices are not kept, and adding it only to the current month would draw a rise that never happened.
//
// The sums are split into whole shares and the rest, and whole currency units and the rest, so no product overflows.
import type { Db } from '../types';

const VALUE_E4 = (price: string) => `((p.qty_e4 / 10000) * ${price} + (p.qty_e4 % 10000) * ${price} / 10000)`;
const TO_IDR = (valueE4: string) =>
  `CASE WHEN p.currency = 'IDR' THEN (${valueE4} + 5000) / 10000
        WHEN x.rate_e4 IS NULL THEN NULL
        ELSE ((${valueE4} / 10000) * x.rate_e4 + (${valueE4} % 10000) * x.rate_e4 / 10000 + 5000) / 10000 END`;

export async function addPortfolio(db: Db): Promise<void> {
  await db.execAsync(`
CREATE TABLE portfolios (
  id              INTEGER PRIMARY KEY,
  name            TEXT    NOT NULL COLLATE NOCASE UNIQUE CHECK (length(trim(name)) BETWEEN 1 AND 30),
  cash_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  in_total        INTEGER NOT NULL DEFAULT 1 CHECK (in_total IN (0, 1)),
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT    NOT NULL
);

CREATE TABLE positions (
  id            INTEGER PRIMARY KEY,
  portfolio_id  INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  symbol        TEXT    NOT NULL CHECK (length(symbol) BETWEEN 1 AND 20),
  name          TEXT    NOT NULL DEFAULT '',
  exchange      TEXT    NOT NULL DEFAULT '',
  currency      TEXT    NOT NULL REFERENCES currencies(code),
  qty_e4        INTEGER NOT NULL CHECK (qty_e4 > 0),
  avg_price_e4  INTEGER NOT NULL CHECK (avg_price_e4 > 0),
  created_at    TEXT    NOT NULL,
  updated_at    TEXT    NOT NULL,
  UNIQUE (portfolio_id, symbol)
);

CREATE TABLE stock_quotes (
  symbol        TEXT    PRIMARY KEY,
  currency      TEXT    NOT NULL,
  price_e4      INTEGER NOT NULL CHECK (price_e4 > 0),
  prev_close_e4 INTEGER,
  as_of         TEXT    NOT NULL,
  fetched_at    TEXT    NOT NULL
) WITHOUT ROWID;

CREATE VIEW v_position_value AS
SELECT p.id, p.portfolio_id, p.symbol, p.name, p.exchange, p.currency, p.qty_e4, p.avg_price_e4,
       q.price_e4, q.prev_close_e4, q.as_of,
       CASE WHEN q.price_e4 IS NULL THEN NULL ELSE ${TO_IDR(VALUE_E4('q.price_e4'))} END AS market_idr,
       ${TO_IDR(VALUE_E4('p.avg_price_e4'))} AS cost_idr
FROM positions p
LEFT JOIN stock_quotes q ON q.symbol = p.symbol AND q.currency = p.currency
LEFT JOIN v_latest_fx x ON x.currency = p.currency;

CREATE VIEW v_portfolio_counted AS
WITH mode AS (SELECT COALESCE((SELECT value FROM settings WHERE key = 'portfolio_net_worth'), 'off') AS m)
SELECT COALESCE(SUM(CASE mode.m WHEN 'market' THEN COALESCE(v.market_idr, v.cost_idr) WHEN 'cost' THEN v.cost_idr END), 0) AS value,
       COALESCE(SUM(mode.m <> 'off' AND v.cost_idr IS NULL), 0) AS missing
FROM v_position_value v, mode;

DROP VIEW v_net_worth;
CREATE VIEW v_net_worth AS
SELECT COALESCE(SUM(balance), 0) + (SELECT value FROM v_portfolio_counted) AS net_worth,
       (COALESCE(SUM(missing_rates), 0) > 0 OR (SELECT missing FROM v_portfolio_counted) > 0) AS incomplete
FROM v_account_balance;
`);

  // the monthly history keeps its own body: only the last line learns about portfolios
  const row = await db.getFirstAsync<{ sql: string }>("select sql from sqlite_master where type = 'view' and name = 'v_net_worth_by_month'");
  const sql = row!.sql.replace('AS net_worth\nFROM priced GROUP BY month', 'AS net_worth_accounts\nFROM priced GROUP BY month').replace('AS net_worth\r\nFROM priced GROUP BY month', 'AS net_worth_accounts\r\nFROM priced GROUP BY month');
  if (sql === row!.sql) throw new Error('v15 migration: v_net_worth_by_month has an unexpected shape.');
  await db.execAsync(`
DROP VIEW v_net_worth_by_month;
${sql.replace('CREATE VIEW v_net_worth_by_month', 'CREATE VIEW v_net_worth_by_month_accounts')};
CREATE VIEW v_net_worth_by_month AS
SELECT month, net_worth_accounts + (SELECT value FROM v_portfolio_counted) AS net_worth FROM v_net_worth_by_month_accounts;
`);
}

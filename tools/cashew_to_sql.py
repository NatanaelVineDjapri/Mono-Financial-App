#!/usr/bin/env python3
"""Turns a Cashew CSV export into a MONO Finance SQL script (loaded in a development build, see src/dev/importSqlFile.ts).

    python tools/cashew_to_sql.py <cashew.csv> <out.sql> [--rates CNY=27353928,BND=141773797 --rates-at 2026-11-23T07:02:32+07:00]

What it does, and why (the rules are CLAUDE.md's):
  - Money is a whole number: a Cashew amount like 48655.549999 is rounded half away from zero.
  - One MONO account per Cashew account. Zero rows are left out and listed in the report.
  - Foreign-currency rows (a Cashew account in USD, CNY, ...) become POCKETS of one MONO "Valas" account. Only balance corrections
    are supported there (the balance the person set), and they become the pocket's opening balance; anything else stops the script.
    A pocket needs a rate (rupiah per 1 unit x 10,000, as the rate service gives it): pass them with --rates.
  - A Cashew transfer is TWO rows (Out and In, the same note, one second apart). MONO keeps ONE transfer row, so the pairs are
    found and merged. A transfer row that finds no partner is kept as an adjustment and reported.
  - "Koreksi Saldo" (a balance correction: the person told Cashew what the balance was) that is not a transfer is NOT income or
    expense. By default the corrections are folded into the account's OPENING balance, so every balance today is the same but the
    reports only hold real activity. With --keep-corrections they become records in the system category "Penyesuaian saldo".
  - A category is per kind in MONO (income / expense), so "Inside" used for both becomes two categories. A Cashew subcategory
    ("Makanan / Pacaran") becomes the description of the record.
  - Nothing here writes a balance. Each account gets an OPENING balance chosen so that the balance after the last correction
    note ("Updated Total Balance ...: Rp647.100,55") comes out exactly as Cashew said; with no note, just enough to never go below 0.
  - The script runs with meta.guards_off = 1 (like a restore) and the app checks v_integrity_issues afterwards.
The output holds real personal data: it goes in private/ (ignored by git), never in a commit.
"""
import argparse
import csv
import re
import sys
from datetime import datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal

ADJUSTMENT = 'Penyesuaian saldo'  # the system category (src/core/cardAdjustment.ts)

# MONO account type and brand mark per Cashew account name. Anything not listed becomes a plain bank account.
ACCOUNTS = {
    'Bank BCA': ('bank', 'bca'),
    'Cash': ('cash', 'cash'),
    'Rupiah': ('cash', None),
    'Mini Tabungan (Receh)': ('savings', None),
    'Stockbit': ('ewallet', 'stockbit'),  # the app lists the Stockbit mark with the e-wallet brands
    'Bank KROM': ('bank', None),
    'Gopay Coin': ('ewallet', 'gopay'),
}

# The category icon keys of src/features/categories/icons.ts
ICONS = {
    'Makanan': 'food', 'Minuman': 'coffee', 'Membership': 'tag', 'Skincare Dll': 'heart', 'Transit': 'car', 'Hadiah': 'gift',
    'Bekerja': 'briefcase', 'Pendidikan': 'education', 'Bepergian': 'plane', 'Belanja': 'bag', 'Fitness': 'heart',
    'Tagihan & Biaya': 'bolt', 'Game': 'film', 'Portofolio Growth': 'wallet', 'Inside': 'wallet', 'Gaji': 'briefcase',
}

SYSTEM_NOTES = ('Updated Total Balance', 'Saldo total diperbarui', 'Transferred Balance', 'Saldo yang ditransfer')
OUT_WORDS = ('Transfer Out', 'Transfer Ke')
IN_WORDS = ('Transfer In', 'Transfer Dari')


def whole(amount: str) -> int:
    """Whole rupiah, half away from zero."""
    d = Decimal(amount)
    q = abs(d).quantize(Decimal('1'), rounding=ROUND_HALF_UP)
    return int(q) if d >= 0 else -int(q)


def rp_amount(text: str) -> int:
    """'Rp1.270.445,00' -> 1270445 (Indonesian thousands dots and decimal comma), rounded."""
    m = re.search(r'Rp\s*([\d.]+)(?:,(\d+))?', text)
    if not m:
        raise ValueError(text)
    whole_part = m.group(1).replace('.', '')
    return whole(f"{whole_part}.{m.group(2) or '0'}")


def q(text: str) -> str:
    return "'" + text.replace("'", "''") + "'"


def read_rows(path: str):
    with open(path, encoding='utf-8-sig', newline='') as f:
        rows = list(csv.DictReader(f))
    out = []
    # The export is newest first; a stable sort by time then keeps the file's reverse order for equal timestamps.
    for index, r in enumerate(reversed(rows)):
        out.append({
            'i': index,
            'account': r['account'].strip(),
            'amount': r['amount'],
            'currency': r['currency'].strip(),
            'title': r['title'].strip(),
            'note': r['note'].strip(),
            'dt': datetime.strptime(r['date'].strip(), '%Y-%m-%d %H:%M:%S.%f'),
            'category': r['category name'].strip(),
            'sub': r['subcategory name'].strip(),
        })
    out.sort(key=lambda r: (r['dt'], r['i']))
    return out


def main(csv_path: str, out_path: str, rates: dict, rates_at: str, keep_corrections: bool = False) -> None:
    rows = read_rows(csv_path)
    report = []

    foreign = [r for r in rows if r['currency'] != 'IDR']
    rows = [r for r in rows if r['currency'] == 'IDR']
    pockets = {}  # currency -> {'opening': minor units, 'since': date}
    for r in foreign:
        if r['category'] != 'Koreksi Saldo':
            sys.exit(f"A {r['currency']} record that is not a balance correction ({r['dt']:%Y-%m-%d}): only corrections are supported for Valas pockets.")
        minor = whole(str(Decimal(r['amount']) * 100))  # every currency here has 100 minor units; see src/core/currencyList.ts
        pocket = pockets.setdefault(r['currency'], {'opening': 0, 'since': r['dt'].date()})
        pocket['opening'] += minor
        pocket['since'] = min(pocket['since'], r['dt'].date())
    for code, pocket in pockets.items():
        if pocket['opening'] < 0:
            sys.exit(f'The {code} pocket would start below zero.')
        if code not in rates:
            sys.exit(f'No rate for {code}: pass --rates {code}=<rupiah per 1 {code} x 10000>.')
    skipped_zero = [r for r in rows if whole(r['amount']) == 0]
    rows = [r for r in rows if whole(r['amount']) != 0]
    for r in rows:
        r['value'] = whole(r['amount'])

    # ---- transfers: pair an Out with an In (same note, same amount, the nearest within 2 minutes)
    def is_transfer(r, words):
        return r['category'] == 'Koreksi Saldo' and any(w in r['title'] for w in words) and r['note'].split('\n')[0] in ('Transferred Balance', 'Saldo yang ditransfer')

    outs = [r for r in rows if r['value'] < 0 and is_transfer(r, OUT_WORDS)]
    ins = [r for r in rows if r['value'] > 0 and is_transfer(r, IN_WORDS)]
    used = set()
    transfers = []
    for o in outs:
        # the nearest In with the same note and amount, within two minutes (the app wrote the two rows a second or a minute apart)
        near = [x for x in ins if x['i'] not in used and x['note'] == o['note'] and x['value'] == -o['value'] and abs((x['dt'] - o['dt']).total_seconds()) <= 120 and x['account'] != o['account']]
        match = min(near, key=lambda x: abs((x['dt'] - o['dt']).total_seconds())) if near else None
        if match:
            used.add(match['i'])
            used.add(o['i'])
            transfers.append({'from': o['account'], 'to': match['account'], 'amount': -o['value'], 'dt': o['dt'], 'i': o['i']})
    unpaired = [r for r in outs + ins if r['i'] not in used]
    transfer_ids = used
    for r in unpaired:
        report.append(f"  transfer row without a partner, kept as an adjustment: {r['dt']:%Y-%m-%d %H:%M:%S} {r['account']} {r['value']:,}")

    # ---- the other records
    records = []
    corrections = []  # (account, when, value): folded into the opening balance unless kept as records
    for r in rows:
        if r['i'] in transfer_ids:
            continue
        if r['category'] == 'Koreksi Saldo' and not keep_corrections:
            corrections.append((r['account'], r['dt'], r['value']))
            continue
        kind = 'expense' if r['value'] < 0 else 'income'
        if r['category'] == 'Koreksi Saldo':
            category = ADJUSTMENT
            description = r['title'] if r['title'] and 'Transfer' not in r['title'] else 'Koreksi saldo'
        else:
            category = r['category']
            description = r['title'] or r['sub']
        note = None if (not r['note'] or r['note'].startswith(SYSTEM_NOTES)) else r['note']
        records.append({'kind': kind, 'account': r['account'], 'amount': abs(r['value']), 'dt': r['dt'], 'i': r['i'], 'category': category, 'description': description, 'note': note})

    # ---- one chronological list of balance movements: (when, order, account, delta)
    events = []
    for t in transfers:
        events.append((t['dt'], t['i'], t['from'], -t['amount']))
        events.append((t['dt'], t['i'], t['to'], t['amount']))
    for rec in records:
        events.append((rec['dt'], rec['i'], rec['account'], rec['amount'] if rec['kind'] == 'income' else -rec['amount']))
    events.sort(key=lambda e: (e[0], e[1]))

    # ---- correction notes: the balance AFTER that row is what the note says
    checkpoints = {}  # account -> [(dt, i, balance)]
    for r in rows:
        if r['category'] == 'Koreksi Saldo' and r['note'].startswith(('Updated Total Balance', 'Saldo total diperbarui')):
            checkpoints.setdefault(r['account'], []).append((r['dt'], r['i'], rp_amount(r['note'].split('\n', 1)[1])))

    seen = {e[2] for e in events} | {c[0] for c in corrections}
    names = [n for n in ACCOUNTS if n in seen] + sorted(seen - set(ACCOUNTS))
    first_day, opening, last_balance, lowest, folded_total = {}, {}, {}, {}, {}
    for name in names:
        mine = [e for e in events if e[2] == name]
        folded = sum(c[2] for c in corrections if c[0] == name)
        first_day[name] = min([e[0] for e in mine] + [c[1] for c in corrections if c[0] == name]).date()
        # running balance with opening 0, at every checkpoint
        running, at_check = 0, []
        marks = sorted(checkpoints.get(name, []), key=lambda c: (c[0], c[1]))
        mi = 0
        low = 0
        for e in mine:
            running += e[3]
            low = min(low, running)
            while mi < len(marks) and (marks[mi][0], marks[mi][1]) <= (e[0], e[1]):
                at_check.append((marks[mi], running))
                mi += 1
        implied = [(m[2] - run) for m, run in at_check] if keep_corrections else []
        if keep_corrections and implied:
            chosen = implied[-1]  # the latest note is the truth for today
            spread = sorted(set(implied))
            if len(spread) > 1:
                report.append(f'  {name}: the {len(implied)} correction notes imply openings from {spread[0]:,} to {spread[-1]:,}; the latest ({chosen:,}) is used')
        else:
            chosen = folded if not keep_corrections else -low
        if chosen < 0:
            report.append(f'  {name}: the latest note implies a NEGATIVE opening ({chosen:,}); opening set to 0 (the balance will differ from the note)')
            chosen = 0
        opening[name] = chosen
        final = chosen + sum(e[3] for e in mine)
        last_balance[name] = final
        lowest[name] = chosen + low
        folded_total[name] = folded

    # ---- the SQL
    out = []
    w = out.append
    w('-- MONO Finance: personal data converted from a Cashew export by tools/cashew_to_sql.py. NOT for git.')
    w('-- Runs with the guards off (like a restore); the app then checks v_integrity_issues.')
    w("UPDATE meta SET value = '1' WHERE key = 'guards_off';")
    w('')
    w('-- accounts: the opening balance is the one that makes the last correction note come out exact')
    for order, name in enumerate(names):
        kind, icon = ACCOUNTS.get(name, ('bank', None))
        w(f"INSERT INTO accounts (name, type, opening_balance, opening_date, icon, sort_order, archived, created_at) VALUES ({q(name)}, {q(kind)}, {opening[name]}, {q(first_day[name].isoformat())}, {q(icon) if icon else 'NULL'}, {order}, 0, {q(first_day[name].isoformat() + 'T00:00:00+07:00')});")
    if pockets:
        since = min(p['since'] for p in pockets.values())
        w('-- the Valas account: one pocket per currency, the opening balance is the balance Cashew was told')
        w(f"INSERT INTO accounts (name, type, opening_balance, opening_date, icon, sort_order, archived, created_at) VALUES ('Valas', 'forex', 0, {q(since.isoformat())}, 'valas', {len(names)}, 0, {q(since.isoformat() + 'T00:00:00+07:00')});")
        for order, (code, p) in enumerate(sorted(pockets.items())):
            w(f"INSERT INTO account_currencies (account_id, currency, opening_balance, opening_date, sort_order, archived) VALUES ((SELECT id FROM accounts WHERE name = 'Valas'), {q(code)}, {p['opening']}, {q(p['since'].isoformat())}, {order}, 0);")
        w('-- the rates of the day (a pocket without one would be flagged by the integrity check)')
        for code in sorted(pockets):
            w(f"INSERT INTO fx_rates (currency, rate_e4, fetched_at, source) VALUES ({q(code)}, {rates[code]}, {q(rates_at)}, 'api');")
    w('')
    w('-- categories (one per kind; "Penyesuaian saldo" is the app\'s own system category)')
    used_cats = {(r['category'], r['kind']) for r in records}
    for i, (cat, kind) in enumerate(sorted(used_cats)):
        icon = 'wallet' if cat == ADJUSTMENT else ICONS.get(cat, 'tag')
        w(f"INSERT OR IGNORE INTO categories (name, kind, icon, sort_order, archived) VALUES ({q(cat)}, {q(kind)}, {q(icon)}, {100 + i}, 0);")
    w('')
    w('-- records, oldest first')
    acc = lambda n: f'(SELECT id FROM accounts WHERE name = {q(n)})'
    cat = lambda c, k: f'(SELECT id FROM categories WHERE name = {q(c)} AND kind = {q(k)})'
    stamp = lambda dt: dt.strftime('%Y-%m-%dT%H:%M:%S') + '+07:00'
    items = [('t', t['dt'], t['i'], t) for t in transfers] + [('r', r['dt'], r['i'], r) for r in records]
    items.sort(key=lambda x: (x[1], x[2]))
    cols = 'kind, account_id, currency, to_account_id, to_currency, category_id, amount, amount_to, amount_idr, occurred_on, description, note, source, created_at, updated_at'
    for typ, dt, _, x in items:
        if typ == 't':
            w(f"INSERT INTO transactions ({cols}) VALUES ('transfer', {acc(x['from'])}, 'IDR', {acc(x['to'])}, 'IDR', NULL, {x['amount']}, {x['amount']}, {x['amount']}, {q(dt.date().isoformat())}, '', NULL, 'manual', {q(stamp(dt))}, {q(stamp(dt))});")
        else:
            w(f"INSERT INTO transactions ({cols}) VALUES ({q(x['kind'])}, {acc(x['account'])}, 'IDR', NULL, NULL, {cat(x['category'], x['kind'])}, {x['amount']}, NULL, {x['amount']}, {q(dt.date().isoformat())}, {q(x['description'])}, {q(x['note']) if x['note'] else 'NULL'}, 'manual', {q(stamp(dt))}, {q(stamp(dt))});")
    w('')
    w("UPDATE meta SET value = '0' WHERE key = 'guards_off';")
    with open(out_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(out) + '\n')

    # ---- the report (numbers only, nothing to commit)
    print(f'records: {len(records)}  transfers: {len(transfers)}  accounts: {len(names)}')
    print(f'left out: {len(skipped_zero)} zero rows; transfer rows without a partner: {len(unpaired)}')
    for code, p in sorted(pockets.items()):
        print(f'  Valas / {code}: {p["opening"]:,} minor units from {p["since"]} at rate_e4 {rates[code]:,}')
    for name in names:
        print(f'  {name:24s} opening {opening[name]:>12,}  now {last_balance[name]:>12,}  lowest {lowest[name]:>12,}  from {first_day[name]}')
    if corrections and not keep_corrections:
        print(f'{len(corrections)} balance corrections folded into the opening balances (not records)')
    print(f'total now: {sum(last_balance.values()):,}')
    if report:
        print('notes:')
        print('\n'.join(report))
    print('expected balances (for the check):')
    print('EXPECTED=' + repr({n: last_balance[n] for n in names}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Cashew CSV -> MONO SQL')
    parser.add_argument('csv')
    parser.add_argument('out')
    parser.add_argument('--rates', default='', help='CODE=rate_e4,... for every foreign currency in the file')
    parser.add_argument('--keep-corrections', action='store_true', help='keep balance corrections as records (Penyesuaian saldo) instead of folding them into the opening balance')
    parser.add_argument('--rates-at', default='', help='when the rates were fetched, ISO with offset')
    args = parser.parse_args()
    rate_map = {k: int(v) for k, v in (kv.split('=') for kv in args.rates.split(',') if kv)}
    main(args.csv, args.out, rate_map, args.rates_at or datetime.now().strftime('%Y-%m-%dT%H:%M:%S') + '+07:00', args.keep_corrections)

import sqlite3, sys
SQL=open(sys.argv[1]).read()
db=sqlite3.connect(':memory:'); db.execute('PRAGMA foreign_keys=ON')
db.executescript(SQL)
NOW='2026-11-03T10:00:00+07:00'
def ex(q,*a): return db.execute(q,a)
cat={r[1]+'/'+r[2]:r[0] for r in db.execute('select id,name,kind from categories')}
def C(n,k='expense'): return cat[f'{n}/{k}']
for n,t,ob in [('BCA Tabungan','bank',1200000),('Cash wallet','cash',450000),('GoPay','ewallet',312500),('Jago Pocket','savings',275000)]:
    ex("insert into accounts(name,type,opening_balance,opening_date,created_at) values(?,?,?,?,?)",n,t,ob,'2026-01-01',NOW)
A={r[1]:r[0] for r in db.execute('select id,name from accounts')}
def tx(kind,acct,amt,d,cat_=None,to=None,desc=''):
    ex("insert into transactions(kind,account_id,to_account_id,to_currency,amount_to,category_id,amount,amount_idr,occurred_on,description,created_at,updated_at) values(?,?,?,?,?,?,?,?,?,?,?,?)",
       kind,A[acct],A[to] if to else None,'IDR' if to else None,amt if to else None,cat_,amt,amt,d,desc,NOW,NOW)
# earlier months: income 7.500.000 and expenses 4.100.500 on BCA
tx('income','BCA Tabungan',7500000,'2026-06-25',C('Salary','income'))
tx('expense','BCA Tabungan',4100500,'2026-08-10',C('Bills'))
# October
tx('income','BCA Tabungan',7000000,'2026-10-25',C('Salary','income'))
tx('income','BCA Tabungan',500000,'2026-10-26',C('Freelance','income'))
for n,a in [('Shopping',812000),('Bills',1150000),('Transport',540000),('Food & drink',1425000),('Leisure',210000),('Health',120000)]:
    tx('expense','BCA Tabungan',a,'2026-10-20',C(n))
tx('transfer','BCA Tabungan',1000000,'2026-10-27',None,'Jago Pocket')
ex("insert into monthly_limits(month,amount) values('2026-10',5000000)")
for n,l in [('Shopping',700000),('Bills',1200000),('Transport',600000),('Food & drink',1800000),('Leisure',400000),('Health',300000)]:
    ex("insert into budgets(category_id,month,limit_amount) values(?,?,?)",C(n),'2026-10',l)
ex("insert into goals(name,mode,account_id,target_amount,target_date,created_at) values('Total assets','total_assets',NULL,30000000,'2027-06-30',?)",NOW)
ex("insert into goals(name,mode,account_id,target_amount,target_date,created_at) values('Emergency fund','account',?,15000000,'2027-12-31',?)",A['BCA Tabungan'],NOW)
ex("insert into goals(name,mode,account_id,target_amount,created_at) values('Travel fund','account',?,8000000,?)",A['Jago Pocket'] if False else A['Cash wallet'],NOW)
ex("insert into recurring(name,amount,account_id,category_id,day_of_month,first_due_on,created_at) values('Gym membership',200000,?,?,28,'2026-10-28',?)",A['BCA Tabungan'],C('Health'),NOW)
ex("insert into recurring(name,amount,amount_varies,account_id,category_id,day_of_month,first_due_on,created_at) values('Electricity token',562000,1,?,?,31,'2026-08-31',?)",A['BCA Tabungan'],C('Bills'),NOW)
db.commit()
def show(t,q):
    print('--',t); 
    for r in db.execute(q): print('  ',r)
show('balances','select name,balance from v_account_balance')
show('net worth','select * from v_net_worth')
show('Oct flow','select * from v_period_flow where period="2026-10"')
show('savings rate bp (expect 4324)','select period,savings_rate_bp from v_savings_rate where period="2026-10"')
show('budget status','select category,limit_amount,spent,remaining,used_bp,is_over from v_budget_status order by used_bp desc')
show('month budget','select * from v_month_budget')
show('goals bp (expect 2960, 4562)','select name,current_amount,remaining,progress_bp from v_goal_progress')
show('account activity BCA last 4','select occurred_on,kind,delta,balance_after from v_account_activity where account_id=1 order by occurred_on desc, tx_id desc limit 4')
show('nw by month','select * from v_net_worth_by_month')
show('due (Gym Oct 28; Electricity Aug31..Oct31 clamp)','select name,due_on from v_recurring_due')
print('-- integrity (expect none)'); print('  ',list(db.execute('select * from v_integrity_issues')))
def expect_fail(label,q,*a):
    try:
        db.execute(q,a); db.commit(); print('  !! NOT BLOCKED:',label)
    except sqlite3.Error as e: print('  blocked:',label,'->',e)
    db.rollback()
print('-- guards')
ins="insert into transactions(kind,account_id,to_account_id,to_currency,amount_to,category_id,amount,amount_idr,occurred_on,description,created_at,updated_at) values(?,?,?,?,?,?,?,?,?,?,?,?)"
def I(kind,a,to,cat_,amt,d,desc=''):   # IDR helper for the guard tests below
    return (kind,a,to,'IDR' if to else None,amt if to else None,cat_,amt,amt,d,desc,NOW,NOW)
expect_fail('expense > balance (Cash 450.000, spend 1.500.000)',ins,*I('expense',A['Cash wallet'],None,C('Shopping'),1500000,'2026-11-01'))
expect_fail('future date',ins,*I('expense',A['BCA Tabungan'],None,C('Bills'),1000,'2099-01-01'))
expect_fail('before opening date',ins,*I('expense',A['BCA Tabungan'],None,C('Bills'),1000,'2025-12-31'))
expect_fail('income with expense category',ins,*I('income',A['BCA Tabungan'],None,C('Bills'),1000,'2026-11-01'))
expect_fail('transfer to same account',ins,*I('transfer',A['BCA Tabungan'],A['BCA Tabungan'],None,1000,'2026-11-01'))
expect_fail('transfer with category',ins,*I('transfer',A['BCA Tabungan'],A['GoPay'],C('Bills'),1000,'2026-11-01'))
expect_fail('zero amount',ins,*I('expense',A['BCA Tabungan'],None,C('Bills'),0,'2026-11-01'))
expect_fail('delete income that funds balance',"delete from transactions where description='' and kind='income' and amount=7000000")
expect_fail('budget over monthly limit (Housing 500.000)',"insert into budgets(category_id,month,limit_amount) values(?,?,?)",C('Housing'),'2026-10',500000)
expect_fail('budget on income category',"insert into budgets(category_id,month,limit_amount) values(?,?,?)",C('Salary','income'),'2026-10',1)
expect_fail('lower monthly limit below allocated',"update monthly_limits set amount=4000000 where month='2026-10'")
expect_fail('duplicate account name (case-insens)',"insert into accounts(name,type,opening_date,created_at) values('gopay','cash','2026-01-01',?)",NOW)
expect_fail('bad date text',"insert into accounts(name,type,opening_date,created_at) values('X','cash','2026-02-30',?)",NOW)
print('-- allowed')
db.execute("update monthly_limits set amount=5500000 where month='2026-10'")
ex("insert into budgets(category_id,month,limit_amount) values(?,?,?)",C('Housing'),'2026-10',500000)
print('   raise limit then add Housing 500.000: ok; allocated=',db.execute("select allocated from v_month_budget").fetchone())
# confirm recurring: record Gym for 2026-10-28 and see it vanish from due; delete tx -> due again
db.execute(ins,I('expense',A['BCA Tabungan'],None,C('Health'),200000,'2026-10-28','Gym membership'))
tid=db.execute('select max(id) from transactions').fetchone()[0]
db.execute("update transactions set source='recurring' where id=?",(tid,))
db.execute("insert into recurring_events values(1,'2026-10-28','recorded',?,?)",(tid,NOW))
print('   due after confirm:',[r[:2] for r in db.execute('select name,due_on from v_recurring_due')])
db.execute('delete from transactions where id=?',(tid,))
print('   events after deleting the tx (cascade):',db.execute('select count(*) from recurring_events').fetchone()[0],'| due again:',[r[1] for r in db.execute('select name,due_on from v_recurring_due where name="Gym membership"')])
# restore simulation: guards off, load out-of-order, audit
db.execute("update meta set value='1' where key='guards_off'")
db.execute(ins,I('expense',A['Cash wallet'],None,C('Shopping'),9999999,'2026-11-01','bad'))
print('   guards_off bulk-load of a bad row accepted; audit finds:',list(db.execute('select * from v_integrity_issues')))
db.rollback()
print('-- plan check: tx by date uses index?'); print('  ',list(db.execute("explain query plan select * from transactions where occurred_on between '2026-10-01' and '2026-10-31'"))[0][3])

# =====================================================================  Valas (forex account with pockets)
print('=== Valas')
def eq(label,got,want):
    assert got==want,(label,got,want); print('  ok:',label,'=',got)
def blocked(label,q,*a,code=None):
    try:
        db.execute(q,a); db.commit(); raise AssertionError('NOT BLOCKED: '+label)
    except sqlite3.Error as e:
        if code: assert code in str(e),(label,str(e))
        print('  blocked:',label,'->',e)
    db.rollback()
ex("insert into accounts(name,type,opening_balance,opening_date,created_at) values('Valas','forex',0,'2026-10-01',?)",NOW)
V=db.execute("select id from accounts where name='Valas'").fetchone()[0]
ex("insert into account_currencies(account_id,currency,opening_balance,opening_date) values(?,'USD',25000,'2026-10-01')",V)
ex("insert into account_currencies(account_id,currency,opening_balance,opening_date) values(?,'SGD',20000,'2026-10-01')",V)
db.commit()
# a pocket may exist before any rate does: value is NULL, net worth is flagged incomplete (never counted as 0)
eq('net worth incomplete without rates',db.execute('select incomplete from v_net_worth').fetchone()[0],1)
eq('missing_fx_rate audit',sorted(r[1] for r in db.execute("select * from v_integrity_issues where issue='missing_fx_rate'")),['SGD','USD'])
blocked('expense in SGD with no rate',"insert into transactions(kind,account_id,currency,category_id,amount,amount_idr,occurred_on,created_at,updated_at) values('expense',?,'SGD',?,2000,250000,'2026-10-15',?,?)",V,C('Food & drink'),NOW,NOW,code='missing_fx_rate')
ex("insert into fx_rates(currency,rate_e4,fetched_at,source) values('USD',162500000,'2026-10-28T09:00:00+07:00','api')")
ex("insert into fx_rates(currency,rate_e4,fetched_at,source) values('SGD',125000000,'2026-10-28T09:00:00+07:00','api')")
db.commit()
eq('net worth complete with rates',db.execute('select net_worth,incomplete from v_net_worth').fetchone(),(8880000+4062500+2500000,0))
eq('USD pocket value (US$250,00 x 16.250)',db.execute("select balance,value_idr from v_pocket_value where account_id=? and currency='USD'",(V,)).fetchone(),(25000,4062500))
eq('SGD pocket value (S$200,00 x 12.500)',db.execute("select balance,value_idr from v_pocket_value where account_id=? and currency='SGD'",(V,)).fetchone(),(20000,2500000))
# expense inside a SGD pocket: S$20,00, rupiah snapshot 250.000
ex("insert into transactions(kind,account_id,currency,category_id,amount,amount_idr,occurred_on,description,created_at,updated_at) values('expense',?,'SGD',?,2000,250000,'2026-10-15','Dinner, Singapore',?,?)",V,C('Food & drink'),NOW,NOW)
db.commit()
eq('Valas account value',db.execute('select balance,missing_rates from v_account_balance where id=?',(V,)).fetchone(),(4062500+2250000,0))
eq('October flow counts the SGD expense in rupiah',db.execute("select expense from v_period_flow where period='2026-10'").fetchone()[0],4257000+250000)
eq('Food & drink spend includes it',db.execute("select spent from v_category_spend where period='2026-10' and category_id=?",(C('Food & drink'),)).fetchone()[0],1425000+250000)
# IDR -> USD pocket: Rp1.625.000 becomes US$100,00. One row, two amounts, net worth unchanged.
nw0=db.execute('select net_worth from v_net_worth').fetchone()[0]
ex("insert into transactions(kind,account_id,currency,to_account_id,to_currency,amount,amount_to,amount_idr,occurred_on,description,created_at,updated_at) values('transfer',?,'IDR',?,'USD',1625000,10000,1625000,'2026-10-29','Buy USD',?,?)",A['BCA Tabungan'],V,NOW,NOW)
# USD pocket -> SGD pocket in the SAME account (exchange): US$50,00 becomes S$65,00
ex("insert into transactions(kind,account_id,currency,to_account_id,to_currency,amount,amount_to,amount_idr,occurred_on,description,created_at,updated_at) values('transfer',?,'USD',?,'SGD',5000,6500,812500,'2026-10-30','USD to SGD',?,?)",V,V,NOW,NOW)
db.commit()
eq('net worth unchanged by exchanges at the same rates',db.execute('select net_worth from v_net_worth').fetchone()[0],nw0)
eq('USD pocket after both transfers',db.execute("select balance from v_pocket_balance where account_id=? and currency='USD'",(V,)).fetchone()[0],25000+10000-5000)
eq('SGD pocket after both transfers',db.execute("select balance from v_pocket_balance where account_id=? and currency='SGD'",(V,)).fetchone()[0],18000+6500)
eq('BCA after buying USD',db.execute("select balance from v_account_balance where id=?",(A['BCA Tabungan'],)).fetchone()[0],6842500-1625000)
eq('transfers are not income or expense',db.execute("select income,expense from v_period_flow where period='2026-10'").fetchone(),(7500000,4257000+250000))
eq('statement: USD pocket running balance',[r for r in db.execute("select kind,delta,balance_after from v_account_activity where account_id=? and currency='USD' order by occurred_on,tx_id",(V,))],[('transfer_in',10000,35000),('transfer',-5000,30000)])
# guards
bca=A['BCA Tabungan']
blocked('USD expense on a normal (IDR) account',"insert into transactions(kind,account_id,currency,category_id,amount,amount_idr,occurred_on,created_at,updated_at) values('expense',?,'USD',?,100,16250,'2026-10-30',?,?)",bca,C('Bills'),NOW,NOW,code='currency_not_in_account')
blocked('JPY expense, no JPY pocket',"insert into transactions(kind,account_id,currency,category_id,amount,amount_idr,occurred_on,created_at,updated_at) values('expense',?,'JPY',?,100,100,'2026-10-30',?,?)",V,C('Bills'),NOW,NOW,code='currency_not_in_account')
blocked('SGD expense above the SGD pocket (S$300 > S$245)',"insert into transactions(kind,account_id,currency,category_id,amount,amount_idr,occurred_on,created_at,updated_at) values('expense',?,'SGD',?,30000,3750000,'2026-10-30',?,?)",V,C('Bills'),NOW,NOW,code='insufficient_balance')
blocked('same account, same currency transfer',"insert into transactions(kind,account_id,currency,to_account_id,to_currency,amount,amount_to,amount_idr,occurred_on,created_at,updated_at) values('transfer',?,'USD',?,'USD',100,100,16250,'2026-10-30',?,?)",V,V,NOW,NOW)
blocked('same-currency transfer with different amounts',"insert into transactions(kind,account_id,currency,to_account_id,to_currency,amount,amount_to,amount_idr,occurred_on,created_at,updated_at) values('transfer',?,'IDR',?,'IDR',1000,900,1000,'2026-10-30',?,?)",bca,A['GoPay'],NOW,NOW)
blocked('IDR row whose amount_idr differs from amount',"insert into transactions(kind,account_id,currency,category_id,amount,amount_idr,occurred_on,created_at,updated_at) values('expense',?,'IDR',?,1000,999,'2026-10-30',?,?)",bca,C('Bills'),NOW,NOW)
blocked('pocket on a normal account',"insert into account_currencies(account_id,currency,opening_date) values(?,'USD','2026-10-01')",bca,code='pocket_needs_forex_account')
blocked('IDR pocket',"insert into account_currencies(account_id,currency,opening_date) values(?,'IDR','2026-10-01')",V)
blocked('forex account with an opening balance',"insert into accounts(name,type,opening_balance,opening_date,created_at) values('V2','forex',5,'2026-10-01',?)",NOW)
blocked('archive a pocket that still has money',"update account_currencies set archived=1 where account_id=? and currency='USD'",V,code='pocket_not_empty')
blocked('turn a used bank account into forex',"update accounts set type='forex' where id=?",bca,code='account_type_locked')
blocked('fixed expense on a forex account',"insert into recurring(name,amount,account_id,category_id,day_of_month,first_due_on,created_at) values('X',1000,?,?,1,'2026-10-01',?)",V,C('Bills'),NOW,code='recurring_needs_idr_account')
blocked('unknown currency code',"insert into fx_rates(currency,rate_e4,fetched_at,source) values('XXX',1,'2026-10-30T00:00:00+07:00','api')")
blocked('rate for IDR',"insert into fx_rates(currency,rate_e4,fetched_at,source) values('IDR',10000,'2026-10-30T00:00:00+07:00','api')")
# an empty pocket CAN be archived
ex("insert into account_currencies(account_id,currency,opening_date) values(?,'EUR','2026-10-30')",V)
ex("update account_currencies set archived=1 where account_id=? and currency='EUR'",V)
blocked('new transaction in an archived pocket',"insert into transactions(kind,account_id,currency,category_id,amount,amount_idr,occurred_on,created_at,updated_at) values('income',?,'EUR',?,100,1,'2026-10-31',?,?)",V,C('Salary','income'),NOW,NOW,code='currency_not_in_account')
db.rollback()
# rate history: a newer rate re-values the present, but the October month-end keeps the October rate
ex("insert into fx_rates(currency,rate_e4,fetched_at,source) values('USD',163000000,'2026-11-02T08:00:00+07:00','manual')")
db.commit()
eq('latest rate wins',db.execute("select rate_e4,source from v_latest_fx where currency='USD'").fetchone(),(163000000,'manual'))
eq('net worth now uses 16.300 for USD (US$300,00)',db.execute('select net_worth from v_net_worth').fetchone()[0],nw0+300*(16300-16250))
nwm=dict(db.execute('select month,net_worth from v_net_worth_by_month').fetchall())
eq('Sep month-end excludes Valas (opened 1 Oct)',nwm['2026-09'],5637000)
eq('Oct month-end uses the Oct rate',nwm['2026-10'],nw0)
eq('Nov month-end uses the newer rate',nwm['2026-11'],nw0+300*(16300-16250))
# half-away-from-zero: Rp108,50 per yen, so 1 yen = Rp108,5 -> 109 and 3 yen = Rp325,5 -> 326
ex("insert into fx_rates(currency,rate_e4,fetched_at,source) values('JPY',1085000,'2026-11-02T08:00:00+07:00','manual')")
ex("insert into accounts(name,type,opening_date,created_at) values('Tiny','forex','2026-10-01',?)",NOW)
T=db.execute("select id from accounts where name='Tiny'").fetchone()[0]
ex("insert into account_currencies(account_id,currency,opening_balance,opening_date) values(?,'JPY',1,'2026-10-01')",T)
eq('1 yen x 108,5 rounds half away from zero to 109',db.execute("select value_idr from v_pocket_value where account_id=? and currency='JPY'",(T,)).fetchone()[0],109)
ex("update account_currencies set opening_balance=3 where account_id=? and currency='JPY'",T)
eq('3 yen x 108,5 = 325,5 rounds to 326',db.execute("select value_idr from v_pocket_value where account_id=? and currency='JPY'",(T,)).fetchone()[0],326)
db.rollback()
# restore simulation with guards off: a row in a missing pocket loads, the audit finds it
db.execute("update meta set value='1' where key='guards_off'")
db.execute("insert into transactions(kind,account_id,currency,category_id,amount,amount_idr,occurred_on,created_at,updated_at) values('expense',?,'JPY',?,100,100,'2026-10-30',?,?)",(V,C('Bills'),NOW,NOW))
print('   guards_off bulk-load accepted; audit finds:',[r for r in db.execute('select * from v_integrity_issues')])
assert [r[0] for r in db.execute('select * from v_integrity_issues')]==['currency_not_in_account']
db.rollback()
print('VALAS TESTS PASSED')

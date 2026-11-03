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
    ex("insert into transactions(kind,account_id,to_account_id,category_id,amount,occurred_on,description,created_at,updated_at) values(?,?,?,?,?,?,?,?,?)",
       kind,A[acct],A[to] if to else None,cat_,amt,d,desc,NOW,NOW)
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
ins="insert into transactions(kind,account_id,to_account_id,category_id,amount,occurred_on,description,created_at,updated_at) values(?,?,?,?,?,?,?,?,?)"
expect_fail('expense > balance (Cash 450.000, spend 1.500.000)',ins,'expense',A['Cash wallet'],None,C('Shopping'),1500000,'2026-11-01','',NOW,NOW)
expect_fail('future date',ins,'expense',A['BCA Tabungan'],None,C('Bills'),1000,'2026-11-04','',NOW,NOW)
expect_fail('before opening date',ins,'expense',A['BCA Tabungan'],None,C('Bills'),1000,'2025-12-31','',NOW,NOW)
expect_fail('income with expense category',ins,'income',A['BCA Tabungan'],None,C('Bills'),1000,'2026-11-01','',NOW,NOW)
expect_fail('transfer to same account',ins,'transfer',A['BCA Tabungan'],A['BCA Tabungan'],None,1000,'2026-11-01','',NOW,NOW)
expect_fail('transfer with category',ins,'transfer',A['BCA Tabungan'],A['GoPay'],C('Bills'),1000,'2026-11-01','',NOW,NOW)
expect_fail('zero amount',ins,'expense',A['BCA Tabungan'],None,C('Bills'),0,'2026-11-01','',NOW,NOW)
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
db.execute(ins,('expense',A['BCA Tabungan'],None,C('Health'),200000,'2026-10-28','Gym membership',NOW,NOW))
tid=db.execute('select max(id) from transactions').fetchone()[0]
db.execute("update transactions set source='recurring' where id=?",(tid,))
db.execute("insert into recurring_events values(1,'2026-10-28','recorded',?,?)",(tid,NOW))
print('   due after confirm:',[r[:2] for r in db.execute('select name,due_on from v_recurring_due')])
db.execute('delete from transactions where id=?',(tid,))
print('   events after deleting the tx (cascade):',db.execute('select count(*) from recurring_events').fetchone()[0],'| due again:',[r[1] for r in db.execute('select name,due_on from v_recurring_due where name="Gym membership"')])
# restore simulation: guards off, load out-of-order, audit
db.execute("update meta set value='1' where key='guards_off'")
db.execute(ins,('expense',A['Cash wallet'],None,C('Shopping'),9999999,'2026-11-01','bad',NOW,NOW))
print('   guards_off bulk-load of a bad row accepted; audit finds:',list(db.execute('select * from v_integrity_issues')))
db.rollback()
print('-- plan check: tx by date uses index?'); print('  ',list(db.execute("explain query plan select * from transactions where occurred_on between '2026-10-01' and '2026-10-31'"))[0][3])

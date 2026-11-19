/**
 * QA end-to-end: simulasi skenario nyata tanpa device.
 * Covers: schedule generation, alert evaluation, materialization, rendering.
 */
import { planSchedule } from '../planSchedule';
import { evaluateAlerts } from '../evaluateAlerts';
import { materializeDue } from '../materializeDue';
import { renderNotification } from '../../../features/notifications/copy';
import type { AlertState, NotifPrefs, PlanState, ScheduleItem } from '../types';

const PREFS: NotifPrefs = {
  notif_enabled: '1',
  quiet_start: '22:00',
  quiet_end: '06:00',
  notif_daily: '1',
  notif_daily_time: '20:00',
  notif_bill_h1: '1',
  notif_bill_overdue: '1',
  notif_budget_near: '1',
  notif_budget_over: '1',
  notif_goal: '1',
  notif_backup: '1',
  timezone: 'Asia/Jakarta',
  month_start_day: '1',
};

function wib(dateStr: string, time = '10:00'): Date {
  const [h, m] = time.split(':').map(Number);
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d) - 7 * 3600000 + h * 3600000 + m * 60000);
}

const TODAY = '2026-11-20';
const NOW = wib(TODAY, '10:00');

// ─── Skenario 1: Jadwal harian normal ───────────────────────────────────────
describe('QA: planSchedule — skenario nyata', () => {
  test('S1: pengguna belum catat → 14 daily + H-1 tagihan + backup masuk jadwal', () => {
    const state: PlanState = {
      hasTransactionToday: false,
      activeRecurring: [
        {
          id: 1, name: 'Listrik PLN', amount: 500000, amount_varies: 0,
          account_id: 1, account_name: 'BCA', remind: 1, archived: 0, end_on: null,
          dueDates: ['2026-11-25', '2026-12-25'],
          confirmedDates: new Set(),
        },
        {
          id: 2, name: 'Netflix', amount: 54000, amount_varies: 0,
          account_id: 1, account_name: 'BCA', remind: 1, archived: 0, end_on: null,
          dueDates: ['2026-11-22'],
          confirmedDates: new Set(),
        },
      ],
      lastBackupAt: wib('2026-11-13').toISOString(), // 7 hari lalu
      txCount: 50,
    };

    const items = planSchedule(NOW, PREFS, state);
    const kinds = items.map(i => i.kind);

    // 14 daily
    expect(kinds.filter(k => k === 'daily').length).toBe(14);

    // H-1 Listrik = 24 Nov, H-1 Netflix = 21 Nov (dalam window)
    const billDue = items.filter(i => i.kind === 'bill_due');
    expect(billDue.map(i => i.key)).toContain('bill_due:1:2026-11-25');
    expect(billDue.map(i => i.key)).toContain('bill_due:2:2026-11-22');

    // bill_overdue: sehari setelah due
    expect(items.some(i => i.key === 'bill_overdue:2:2026-11-22')).toBe(true);

    // backup: 7 hari sejak 13 Nov → jadwal besok (21 Nov)
    const backup = items.find(i => i.kind === 'backup');
    expect(backup).toBeDefined();
    expect(backup!.key).toBe('backup:2026-11-21');

    console.log(`✓ S1: ${items.length} item dijadwalkan`);
    console.log('  Kinds:', [...new Set(kinds)].join(', '));
  });

  test('S2: pengguna sudah catat hari ini → daily hari ini dilewati', () => {
    const state: PlanState = {
      hasTransactionToday: true,
      activeRecurring: [],
      lastBackupAt: null,
      txCount: 2,
    };
    const items = planSchedule(NOW, PREFS, state);
    expect(items.find(i => i.key === `daily:${TODAY}`)).toBeUndefined();
    expect(items.find(i => i.key === 'daily:2026-11-21')).toBeDefined();
    console.log('✓ S2: daily hari ini dilewati, besok tetap ada');
  });

  test('S3: jam tenang — 23:00 digeser ke 06:00 keesokan harinya', () => {
    const prefs = { ...PREFS, notif_daily_time: '23:00' };
    const items = planSchedule(NOW, prefs, { hasTransactionToday: false, activeRecurring: [], lastBackupAt: null, txCount: 0 });
    const todayDaily = items.find(i => i.key === `daily:${TODAY}`);
    expect(todayDaily).toBeDefined();
    // Harus digeser ke 2026-11-21 06:00 WIB
    const expected = wib('2026-11-21', '06:00');
    expect(todayDaily!.at.getTime()).toBe(expected.getTime());
    console.log('✓ S3: 23:00 → geser ke 06:00 esok (jam tenang)');
  });

  test('S4: tagihan terkonfirmasi → tidak masuk jadwal', () => {
    const state: PlanState = {
      hasTransactionToday: false,
      activeRecurring: [{
        id: 3, name: 'Air PDAM', amount: 80000, amount_varies: 0,
        account_id: 1, account_name: 'BCA', remind: 1, archived: 0, end_on: null,
        dueDates: ['2026-11-25'],
        confirmedDates: new Set(['2026-11-25']), // sudah dikonfirmasi
      }],
      lastBackupAt: null,
      txCount: 0,
    };
    const items = planSchedule(NOW, PREFS, state);
    expect(items.find(i => i.kind === 'bill_due')).toBeUndefined();
    expect(items.find(i => i.kind === 'bill_overdue')).toBeUndefined();
    console.log('✓ S4: tagihan terkonfirmasi tidak dijadwalkan');
  });

  test('S5: notif_enabled=0 → jadwal kosong', () => {
    const items = planSchedule(NOW, { ...PREFS, notif_enabled: '0' }, {
      hasTransactionToday: false, activeRecurring: [], lastBackupAt: null, txCount: 10,
    });
    expect(items).toHaveLength(0);
    console.log('✓ S5: notif_enabled=0 → jadwal kosong');
  });
});

// ─── Skenario 2: evaluateAlerts ──────────────────────────────────────────────
describe('QA: evaluateAlerts — skenario nyata', () => {
  const PERIOD = '2026-11-01';

  test('S6: belanja Rp830rb dari limit Rp1jt (83%) → budget_near', () => {
    const prev: AlertState = {
      budgets: [{ budget_id: 1, category_id: 1, categoryName: 'Makan', usedBp: 7900, spentAmount: 790000, limitAmount: 1000000, daysLeft: 10, periodStart: PERIOD }],
      goals: [], periodStart: PERIOD,
    };
    const next: AlertState = {
      budgets: [{ budget_id: 1, category_id: 1, categoryName: 'Makan', usedBp: 8300, spentAmount: 830000, limitAmount: 1000000, daysLeft: 10, periodStart: PERIOD }],
      goals: [], periodStart: PERIOD,
    };
    const items = evaluateAlerts(prev, next, PREFS, new Set());
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('budget_near');

    // Render
    const rendered = renderNotification(items[0].payload as never, { hideAmounts: false });
    console.log(`✓ S6: budget_near → "${rendered.title}" / "${rendered.body}"`);
  });

  test('S7: belanja Rp790rb → Rp1.15jt (79%→115%) → hanya budget_over', () => {
    const prev: AlertState = {
      budgets: [{ budget_id: 1, category_id: 1, categoryName: 'Makan', usedBp: 7900, spentAmount: 790000, limitAmount: 1000000, daysLeft: 10, periodStart: PERIOD }],
      goals: [], periodStart: PERIOD,
    };
    const next: AlertState = {
      budgets: [{ budget_id: 1, category_id: 1, categoryName: 'Makan', usedBp: 11500, spentAmount: 1150000, limitAmount: 1000000, daysLeft: 10, periodStart: PERIOD }],
      goals: [], periodStart: PERIOD,
    };
    const items = evaluateAlerts(prev, next, PREFS, new Set());
    expect(items.map(i => i.kind)).toEqual(['budget_over']); // hanya over, bukan near+over
    const rendered = renderNotification(items[0].payload as never, { hideAmounts: false });
    console.log(`✓ S7: budget_over → "${rendered.title}" / "${rendered.body}"`);
  });

  test('S8: tabungan capai 75% → goal_milestone', () => {
    const prev: AlertState = {
      budgets: [],
      goals: [{ goal_id: 1, goalName: 'Dana Darurat', progressBp: 6000, targetAmount: 50000000, currentAmount: 30000000 }],
      periodStart: PERIOD,
    };
    const next: AlertState = {
      budgets: [],
      goals: [{ goal_id: 1, goalName: 'Dana Darurat', progressBp: 7600, targetAmount: 50000000, currentAmount: 38000000 }],
      periodStart: PERIOD,
    };
    const items = evaluateAlerts(prev, next, PREFS, new Set());
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('goal_milestone');
    const p = items[0].payload as { milestone: number };
    expect(p.milestone).toBe(7500); // 75%

    const rendered = renderNotification(items[0].payload as never, { hideAmounts: false });
    console.log(`✓ S8: goal 75% → "${rendered.title}" / "${rendered.body}"`);
  });

  test('S9: dedupe — alert yang sama tidak muncul dua kali', () => {
    const prev: AlertState = {
      budgets: [{ budget_id: 1, category_id: 1, categoryName: 'Makan', usedBp: 8300, spentAmount: 830000, limitAmount: 1000000, daysLeft: 10, periodStart: PERIOD }],
      goals: [], periodStart: PERIOD,
    };
    const next = { ...prev };
    const existing = new Set([`budget_near:1:${PERIOD}`]);
    const items = evaluateAlerts(prev, next, PREFS, existing);
    expect(items).toHaveLength(0);
    console.log('✓ S9: dedupe — alert yang sama tidak muncul ulang');
  });
});

// ─── Skenario 3: materializeDue ──────────────────────────────────────────────
describe('QA: materializeDue — skenario nyata', () => {
  test('S10: app tutup 8 jam, daily reminder lewat → masuk inbox', () => {
    const firedAt = wib(TODAY, '20:00');
    const scheduled: ScheduleItem[] = [{
      key: `daily:${TODAY}`,
      at: firedAt,
      kind: 'daily',
      payload: { kind: 'daily' },
    }];
    const now = wib(TODAY, '21:00');
    const lastOpen = wib(TODAY, '12:00'); // terakhir buka siang

    const items = materializeDue(now, lastOpen, scheduled, {
      hasTransactionToday: false,
      activeRecurring: [],
      lastBackupAt: null,
      txCount: 10,
    }, new Set());

    expect(items).toHaveLength(1);
    expect(items[0].dedupe_key).toBe(`daily:${TODAY}`);
    console.log('✓ S10: daily reminder yang terlewat masuk inbox saat app dibuka');
  });

  test('S11: tagihan sudah dikonfirmasi sebelum app dibuka → tidak masuk inbox', () => {
    const firedAt = wib(TODAY, '09:00');
    const dueDate = '2026-11-21';
    const scheduled: ScheduleItem[] = [{
      key: `bill_due:5:${dueDate}`,
      at: firedAt,
      kind: 'bill_due',
      payload: { kind: 'bill_due', recurringId: 5, name: 'Gym', accountName: 'BCA', amount: 200000, amountVaries: 0, dueDate },
    }];
    const now = wib(TODAY, '15:00');
    const lastOpen = wib(TODAY, '07:00');

    const items = materializeDue(now, lastOpen, scheduled, {
      hasTransactionToday: false,
      activeRecurring: [{
        id: 5, name: 'Gym', amount: 200000, amount_varies: 0,
        account_id: 1, account_name: 'BCA', remind: 1, archived: 0, end_on: null,
        dueDates: [dueDate],
        confirmedDates: new Set([dueDate]), // sudah dikonfirmasi!
      }],
      lastBackupAt: null,
      txCount: 10,
    }, new Set());

    expect(items).toHaveLength(0);
    console.log('✓ S11: tagihan terkonfirmasi → tidak masuk inbox');
  });
});

// ─── Skenario 4: renderNotification semua kind ───────────────────────────────
describe('QA: renderNotification — semua jenis', () => {
  const cases = [
    { payload: { kind: 'daily' as const }, label: 'daily' },
    { payload: { kind: 'bill_due' as const, recurringId: 1, name: 'Listrik', accountName: 'BCA', amount: 500000, amountVaries: 0 as const, dueDate: '2026-11-25' }, label: 'bill_due' },
    { payload: { kind: 'bill_due' as const, recurringId: 1, name: 'Air', accountName: 'BCA', amount: 80000, amountVaries: 1 as const, dueDate: '2026-11-25' }, label: 'bill_due varies' },
    { payload: { kind: 'bill_overdue' as const, recurringId: 1, name: 'Internet', accountName: 'BCA', dueDate: '2026-11-15' }, label: 'bill_overdue' },
    { payload: { kind: 'budget_near' as const, budgetId: 1, categoryName: 'Makan', usedBp: 8300, spentAmount: 830000, limitAmount: 1000000, daysLeft: 8, periodStart: '2026-11-01' }, label: 'budget_near' },
    { payload: { kind: 'budget_over' as const, budgetId: 1, categoryName: 'Makan', usedBp: 11500, spentAmount: 1150000, limitAmount: 1000000, periodStart: '2026-11-01' }, label: 'budget_over' },
    { payload: { kind: 'goal_milestone' as const, goalId: 1, goalName: 'Dana Darurat', milestone: 5000 as const, targetAmount: 50000000, currentAmount: 25000000 }, label: 'goal 50%' },
    { payload: { kind: 'goal_milestone' as const, goalId: 1, goalName: 'Dana Darurat', milestone: 10000 as const, targetAmount: 50000000, currentAmount: 50500000 }, label: 'goal 100%' },
    { payload: { kind: 'backup' as const, daysSinceLast: null }, label: 'backup (never)' },
    { payload: { kind: 'backup' as const, daysSinceLast: 9 }, label: 'backup (9 hari)' },
  ];

  for (const { payload, label } of cases) {
    test(`render ${label}`, () => {
      const r = renderNotification(payload as never, { hideAmounts: false });
      expect(r.title.length).toBeGreaterThan(0);
      expect(r.body.length).toBeGreaterThan(0);
      console.log(`  [${label}] "${r.title}" / "${r.body}"`);
    });

    test(`render ${label} hideAmounts`, () => {
      const r = renderNotification(payload as never, { hideAmounts: true });
      // Pastikan tidak ada angka Rp
      if ('amount' in payload || 'spentAmount' in payload || 'currentAmount' in payload) {
        expect(r.body).not.toMatch(/Rp[\d.]+/);
      }
    });
  }
});

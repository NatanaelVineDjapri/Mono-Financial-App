import { planSchedule } from '../planSchedule';
import type { NotifPrefs, PlanState } from '../types';

const BASE_PREFS: NotifPrefs = {
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
  timezone: 'Asia/Jakarta',   // WIB +7
  month_start_day: '1',
};

const BASE_STATE: PlanState = {
  hasTransactionToday: false,
  activeRecurring: [],
  lastBackupAt: null,
  txCount: 0,
};

/** Builds a Date at a known WIB wall-clock time (HH:MM) on a date string. */
function wib(dateStr: string, time = '10:00'): Date {
  const [h, m] = time.split(':').map(Number);
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d) - 7 * 3600000 + h * 3600000 + m * 60000);
}

describe('planSchedule', () => {
  test('returns empty list when notif_enabled = 0', () => {
    const items = planSchedule(wib('2026-11-20'), { ...BASE_PREFS, notif_enabled: '0' }, BASE_STATE);
    expect(items).toHaveLength(0);
  });

  test('skips today daily when has transaction today', () => {
    const now = wib('2026-11-20', '15:00');
    const items = planSchedule(now, BASE_PREFS, { ...BASE_STATE, hasTransactionToday: true });
    const dailyKeys = items.filter(i => i.kind === 'daily').map(i => i.key);
    expect(dailyKeys).not.toContain('daily:2026-11-20');
    // Tomorrow should still be there
    expect(dailyKeys).toContain('daily:2026-11-21');
  });

  test('schedules 14 daily reminders when no transaction today', () => {
    const now = wib('2026-11-20', '10:00'); // before 20:00
    const items = planSchedule(now, BASE_PREFS, BASE_STATE);
    const daily = items.filter(i => i.kind === 'daily');
    expect(daily.length).toBe(14);
    expect(daily[0].key).toBe('daily:2026-11-20');
  });

  test('quiet hours shift a 20:00 reminder into 22:00 quiet -> next day 06:00', () => {
    // notif_daily_time = 23:00, quiet 22:00-06:00
    const now = wib('2026-11-20', '10:00');
    const prefs = { ...BASE_PREFS, notif_daily_time: '23:00' };
    const items = planSchedule(now, prefs, BASE_STATE);
    const today = items.find(i => i.key === 'daily:2026-11-20');
    expect(today).toBeDefined();
    // Should be shifted to 2026-11-21 06:00 WIB
    const expected = wib('2026-11-21', '06:00');
    expect(today!.at.getTime()).toBe(expected.getTime());
  });

  test('WIT timezone (+9) produces different dates than WIB for same UTC now', () => {
    // 2026-11-20 00:30 UTC = 2026-11-20 07:30 WIB but 2026-11-20 09:30 WIT
    const now = new Date(Date.UTC(2026, 10, 20, 0, 30, 0));
    const prefsWIT = { ...BASE_PREFS, timezone: 'Asia/Jayapura' };
    const itemsWIT = planSchedule(now, prefsWIT, BASE_STATE).filter(i => i.kind === 'daily');
    // The first daily key should reference 2026-11-20 (WIT today)
    expect(itemsWIT[0].key).toBe('daily:2026-11-20');
  });

  test('bill_due: paused/archived recurring not scheduled', () => {
    const now = wib('2026-11-20', '10:00');
    const state: PlanState = {
      ...BASE_STATE,
      activeRecurring: [{
        id: 1, name: 'Listrik', amount: 500000, amount_varies: 0,
        account_id: 1, account_name: 'BCA', remind: 1,
        archived: 1, // archived!
        end_on: null,
        dueDates: ['2026-11-25'],
        confirmedDates: new Set(),
      }],
    };
    const items = planSchedule(now, BASE_PREFS, state);
    expect(items.filter(i => i.kind === 'bill_due')).toHaveLength(0);
  });

  test('bill_due: remind=0 not scheduled', () => {
    const now = wib('2026-11-20', '10:00');
    const state: PlanState = {
      ...BASE_STATE,
      activeRecurring: [{
        id: 2, name: 'Internet', amount: 300000, amount_varies: 0,
        account_id: 1, account_name: 'BCA', remind: 0, // remind off
        archived: 0, end_on: null,
        dueDates: ['2026-11-25'],
        confirmedDates: new Set(),
      }],
    };
    const items = planSchedule(now, BASE_PREFS, state);
    expect(items.filter(i => i.kind === 'bill_due')).toHaveLength(0);
  });

  test('bill_due: confirmed date not scheduled', () => {
    const now = wib('2026-11-20', '10:00');
    const state: PlanState = {
      ...BASE_STATE,
      activeRecurring: [{
        id: 3, name: 'Air', amount: 150000, amount_varies: 0,
        account_id: 1, account_name: 'BCA', remind: 1,
        archived: 0, end_on: null,
        dueDates: ['2026-11-25'],
        confirmedDates: new Set(['2026-11-25']), // already confirmed
      }],
    };
    const items = planSchedule(now, BASE_PREFS, state);
    expect(items.filter(i => i.kind === 'bill_due')).toHaveLength(0);
    expect(items.filter(i => i.kind === 'bill_overdue')).toHaveLength(0);
  });

  test('bill_due key is deterministic', () => {
    const now = wib('2026-11-20', '10:00');
    const state: PlanState = {
      ...BASE_STATE,
      activeRecurring: [{
        id: 7, name: 'Gym', amount: 200000, amount_varies: 0,
        account_id: 1, account_name: 'BCA', remind: 1,
        archived: 0, end_on: null,
        dueDates: ['2026-11-25'],
        confirmedDates: new Set(),
      }],
    };
    const items = planSchedule(now, BASE_PREFS, state);
    const due = items.find(i => i.kind === 'bill_due');
    expect(due?.key).toBe('bill_due:7:2026-11-25');
  });

  test('backup: never backed up with < 10 txns → no backup item', () => {
    const now = wib('2026-11-20', '10:00');
    const items = planSchedule(now, BASE_PREFS, { ...BASE_STATE, txCount: 5 });
    expect(items.filter(i => i.kind === 'backup')).toHaveLength(0);
  });

  test('backup: never backed up with >= 10 txns → tomorrow 09:00', () => {
    const now = wib('2026-11-20', '10:00');
    const items = planSchedule(now, BASE_PREFS, { ...BASE_STATE, txCount: 10 });
    const backup = items.find(i => i.kind === 'backup');
    expect(backup).toBeDefined();
    expect(backup!.key).toBe('backup:never:2026-11-21');
    const expected = wib('2026-11-21', '09:00');
    expect(backup!.at.getTime()).toBe(expected.getTime());
  });

  test('backup: last backup 7 days ago → schedule today 09:00 or next possible', () => {
    const now = wib('2026-11-20', '10:00'); // already past 09:00
    const lastBackupAt = wib('2026-11-13', '14:00').toISOString();
    const items = planSchedule(now, BASE_PREFS, { ...BASE_STATE, lastBackupAt, txCount: 20 });
    const backups = items.filter(i => i.kind === 'backup');
    expect(backups.length).toBeGreaterThan(0);
    // The key should reference tomorrow since today 09:00 is in the past
    expect(backups[0].key).toBe('backup:2026-11-21');
  });

  test('window is 14 days maximum', () => {
    const now = wib('2026-11-20', '10:00');
    const items = planSchedule(now, BASE_PREFS, BASE_STATE);
    const maxAt = new Date(now.getTime() + 14 * 86400000);
    for (const item of items) {
      expect(item.at.getTime()).toBeLessThanOrEqual(maxAt.getTime());
    }
  });

  test('cap at 60 items (furthest dropped)', () => {
    const now = wib('2026-11-20', '10:00');
    const recs = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1, name: `Tag${i}`, amount: 100000, amount_varies: 0 as 0 | 1,
      account_id: 1, account_name: 'BCA', remind: 1 as 1,
      archived: 0 as 0, end_on: null,
      dueDates: [`2026-11-${String(21 + (i % 7)).padStart(2, '0')}`],
      confirmedDates: new Set<string>(),
    }));
    const items = planSchedule(now, BASE_PREFS, { ...BASE_STATE, activeRecurring: recs });
    expect(items.length).toBeLessThanOrEqual(60);
  });
});

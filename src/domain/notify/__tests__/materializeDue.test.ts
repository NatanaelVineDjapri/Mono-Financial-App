import { materializeDue } from '../materializeDue';
import type { PlanState, ScheduleItem } from '../types';

function wib(dateStr: string, time = '09:00'): Date {
  const [h, m] = time.split(':').map(Number);
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d) - 7 * 3600000 + h * 3600000 + m * 60000);
}

const BASE_STATE: PlanState = {
  hasTransactionToday: false,
  activeRecurring: [],
  lastBackupAt: null,
  txCount: 5,
};

const DAILY_ITEM: ScheduleItem = {
  key: 'daily:2026-11-20',
  at: wib('2026-11-20', '20:00'),
  kind: 'daily',
  payload: { kind: 'daily' },
};

describe('materializeDue', () => {
  test('emits inbox item for fired daily notification', () => {
    const now = wib('2026-11-20', '21:00');
    const lastOpen = wib('2026-11-19', '10:00');
    const items = materializeDue(now, lastOpen, [DAILY_ITEM], BASE_STATE, new Set());
    expect(items).toHaveLength(1);
    expect(items[0].dedupe_key).toBe('daily:2026-11-20');
    expect(items[0].created_at).toBe(DAILY_ITEM.at.toISOString());
  });

  test('skips item not yet fired', () => {
    const now = wib('2026-11-20', '19:00'); // before 20:00
    const lastOpen = wib('2026-11-19', '10:00');
    const items = materializeDue(now, lastOpen, [DAILY_ITEM], BASE_STATE, new Set());
    expect(items).toHaveLength(0);
  });

  test('skips item already seen on prior open (at <= lastOpenedAt)', () => {
    const now = wib('2026-11-21', '10:00');
    const lastOpen = wib('2026-11-20', '21:00'); // already past the fire time
    const items = materializeDue(now, lastOpen, [DAILY_ITEM], BASE_STATE, new Set());
    expect(items).toHaveLength(0);
  });

  test('skips if dedupe_key already in existingKeys', () => {
    const now = wib('2026-11-20', '21:00');
    const lastOpen = wib('2026-11-19', '10:00');
    const items = materializeDue(now, lastOpen, [DAILY_ITEM], BASE_STATE, new Set(['daily:2026-11-20']));
    expect(items).toHaveLength(0);
  });

  test('skips daily if has transaction today', () => {
    const now = wib('2026-11-20', '21:00');
    const lastOpen = wib('2026-11-19', '10:00');
    const items = materializeDue(now, lastOpen, [DAILY_ITEM], { ...BASE_STATE, hasTransactionToday: true }, new Set());
    expect(items).toHaveLength(0);
  });

  test('skips bill_due if already confirmed', () => {
    const dueDate = '2026-11-21';
    const item: ScheduleItem = {
      key: `bill_due:5:${dueDate}`,
      at: wib('2026-11-20', '09:00'),
      kind: 'bill_due',
      payload: { kind: 'bill_due', recurringId: 5, name: 'Air', accountName: 'BCA', amount: 100000, amountVaries: 0, dueDate },
    };
    const state: PlanState = {
      ...BASE_STATE,
      activeRecurring: [{
        id: 5, name: 'Air', amount: 100000, amount_varies: 0,
        account_id: 1, account_name: 'BCA', remind: 1, archived: 0, end_on: null,
        dueDates: [dueDate],
        confirmedDates: new Set([dueDate]),
      }],
    };
    const now = wib('2026-11-20', '10:00');
    const lastOpen = wib('2026-11-19');
    const items = materializeDue(now, lastOpen, [item], state, new Set());
    expect(items).toHaveLength(0);
  });

  test('skips backup if a backup was made after the reminder fired', () => {
    const firedAt = wib('2026-11-20', '09:00');
    const backupAt = wib('2026-11-20', '11:00').toISOString(); // backup after the reminder
    const item: ScheduleItem = {
      key: 'backup:2026-11-20',
      at: firedAt,
      kind: 'backup',
      payload: { kind: 'backup', daysSinceLast: 7 },
    };
    const now = wib('2026-11-20', '15:00');
    const lastOpen = wib('2026-11-19');
    const items = materializeDue(now, lastOpen, [item], { ...BASE_STATE, lastBackupAt: backupAt }, new Set());
    expect(items).toHaveLength(0);
  });
});

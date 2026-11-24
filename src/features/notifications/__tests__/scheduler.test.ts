// The schedule is written into the system with the Hide amounts mode in force at that moment (CLAUDE.md rule 10), and a
// reminder written under the other mode is written again. Before this, the scheduler read a setting nothing ever wrote, so a
// bill reminder carried its amount even with Hide amounts on.
import * as Notifications from 'expo-notifications';

import { useHideAmounts } from '@/components/hide-amounts-store';
import { setSetting } from '@/data/repo/settings';
import { openMigratedTestDb } from '@/data/db/openTestDb';
import type { ScheduleItem } from '@/domain/notify/types';

import { notificationsHideAmounts, syncNotifications } from '../scheduler';

const mockPlan = jest.fn<ScheduleItem[], []>();
jest.mock('@/domain/notify/planSchedule', () => ({ planSchedule: () => mockPlan() }));
jest.mock('../../../domain/notify/planSchedule', () => ({ planSchedule: () => mockPlan() }));

type Scheduled = { identifier: string; content: { title?: string; body?: string; data: Record<string, unknown> } };
let mockScheduled: Scheduled[] = [];

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  AndroidNotificationVisibility: { PRIVATE: 0 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => {}),
  getAllScheduledNotificationsAsync: jest.fn(async () => mockScheduled),
  cancelScheduledNotificationAsync: jest.fn(async (id: string) => {
    mockScheduled = mockScheduled.filter(n => n.identifier !== id);
  }),
  scheduleNotificationAsync: jest.fn(async (request: Scheduled) => {
    mockScheduled.push(request);
    return request.identifier;
  }),
}));

const BILL: ScheduleItem = {
  key: 'bill_due:1:2026-11-25',
  at: new Date('2026-11-24T02:00:00Z'),
  kind: 'bill_due',
  payload: { kind: 'bill_due', recurringId: 1, name: 'Internet', accountName: 'BCA Tabungan', amount: 385_000, amountVaries: 0, dueDate: '2026-11-25' },
};

async function setup(extra: Record<string, string> = {}) {
  const db = await openMigratedTestDb();
  await setSetting(db, 'notif_enabled', '1');
  for (const [key, value] of Object.entries(extra)) await setSetting(db, key, value);
  return db;
}

beforeEach(() => {
  mockScheduled = [];
  mockPlan.mockReset();
  mockPlan.mockReturnValue([BILL]);
  useHideAmounts.getState().setHidden(false);
  jest.clearAllMocks();
});

describe('notificationsHideAmounts', () => {
  test('on while the mode is on, and also when "hide on launch" will switch it on at the next open', () => {
    expect(notificationsHideAmounts({}, false)).toBe(false);
    expect(notificationsHideAmounts({}, true)).toBe(true);
    expect(notificationsHideAmounts({ hide_on_launch: '1' }, false)).toBe(true);
    expect(notificationsHideAmounts({ hide_on_launch: '0' }, false)).toBe(false);
  });
});

describe('syncNotifications', () => {
  test('with Hide amounts off the reminder carries the amount', async () => {
    await syncNotifications(await setup());
    expect(mockScheduled).toHaveLength(1);
    expect(mockScheduled[0].content.body).toContain('385.000');
    expect(mockScheduled[0].content.data.hide).toBe(false);
  });

  test('with Hide amounts on the reminder has no amount', async () => {
    useHideAmounts.getState().setHidden(true);
    await syncNotifications(await setup());
    expect(mockScheduled[0].content.body).not.toMatch(/385/);
    expect(mockScheduled[0].content.body).toContain('BCA Tabungan');
    expect(mockScheduled[0].content.data.hide).toBe(true);
  });

  test('"hide on launch" hides the amount in the reminder even while the mode is still off', async () => {
    await syncNotifications(await setup({ hide_on_launch: '1' }));
    expect(mockScheduled[0].content.body).not.toMatch(/385/);
  });

  test('turning the mode on writes an already scheduled reminder again, without the amount', async () => {
    const db = await setup();
    await syncNotifications(db);
    expect(mockScheduled[0].content.body).toContain('385.000');
    useHideAmounts.getState().setHidden(true);
    await syncNotifications(db);
    expect(mockScheduled).toHaveLength(1); // replaced, not doubled
    expect(mockScheduled[0].content.body).not.toMatch(/385/);
    useHideAmounts.getState().setHidden(false);
    await syncNotifications(db);
    expect(mockScheduled).toHaveLength(1);
    expect(mockScheduled[0].content.body).toContain('385.000');
  });

  test('a reminder that is already right is left alone', async () => {
    const db = await setup();
    await syncNotifications(db);
    (Notifications.scheduleNotificationAsync as jest.Mock).mockClear();
    await syncNotifications(db);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  test('switched off, or without the system permission, everything scheduled is cancelled', async () => {
    const db = await setup();
    await syncNotifications(db);
    await setSetting(db, 'notif_enabled', '0');
    await syncNotifications(db);
    expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
  });
});

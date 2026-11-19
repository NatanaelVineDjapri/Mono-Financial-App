// All notification text in one place, assembled from the templates in src/i18n (English and Indonesian). No
// sentences are stored in the database: this is called at render time, so Hide amounts applies to old inbox items
// too, and the language is the one the person has now. With Hide amounts on, no amount is passed to a template.
import { rp } from '../../core/money';
import type { NotifPayload } from '../../domain/notify/types';
import {
  notifBackupBody,
  notifBackupTitle,
  notifBillDueBody,
  notifBillDueTitle,
  notifBudgetNearBody,
  notifBudgetNearTitle,
  notifBudgetOverBody,
  notifBudgetOverTitle,
  notifDailyBody,
  notifDailyTitle,
  notifGoalMilestoneBody,
  notifGoalMilestoneTitle,
  notifGoalReachedBody,
  notifGoalReachedTitle,
  notifOverdueBody,
  notifOverdueTitle,
  notifRecordNow,
  notifShortDate,
} from '../../i18n';

export interface RenderedNotif {
  title: string;
  body: string;
  /** Present on bill_due and bill_overdue — the action button label. */
  actionLabel?: string;
}

function bpToPercent(bp: number): string {
  return Math.round(bp / 100).toString();
}

/** 'YYYY-MM-DD' as "29 Okt" / "29 Oct". */
function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return notifShortDate(d, m);
}

export function renderNotification(payload: NotifPayload, opts: { hideAmounts: boolean }): RenderedNotif {
  const h = opts.hideAmounts;
  const money = (amount: number): string | null => (h ? null : rp(amount));

  switch (payload.kind) {
    case 'daily':
      return { title: notifDailyTitle(), body: notifDailyBody() };

    case 'bill_due':
      return {
        title: notifBillDueTitle(payload.name),
        body: notifBillDueBody(money(payload.amount), !!payload.amountVaries, payload.accountName),
        actionLabel: notifRecordNow(),
      };

    case 'bill_overdue':
      return {
        title: notifOverdueTitle(payload.name),
        body: notifOverdueBody(shortDate(payload.dueDate)),
        actionLabel: notifRecordNow(),
      };

    case 'budget_near':
      return {
        title: notifBudgetNearTitle(payload.categoryName),
        body: notifBudgetNearBody(bpToPercent(payload.usedBp), money(payload.spentAmount), money(payload.limitAmount), payload.daysLeft),
      };

    case 'budget_over':
      return {
        title: notifBudgetOverTitle(payload.categoryName),
        body: notifBudgetOverBody(bpToPercent(payload.usedBp), money(payload.spentAmount), money(payload.limitAmount)),
      };

    case 'goal_milestone': {
      const m = payload.milestone;
      if (m === 10000) {
        return { title: notifGoalReachedTitle(payload.goalName), body: notifGoalReachedBody(money(payload.currentAmount), money(payload.targetAmount)) };
      }
      const pct = bpToPercent(m);
      return { title: notifGoalMilestoneTitle(payload.goalName, pct), body: notifGoalMilestoneBody(pct, money(payload.currentAmount), money(payload.targetAmount)) };
    }

    case 'backup':
      return { title: notifBackupTitle(), body: notifBackupBody(payload.daysSinceLast) };

    default: {
      // exhaustive: a new kind of notification must be given its text above
      const _never: never = payload;
      void _never;
      return { title: '', body: '' };
    }
  }
}

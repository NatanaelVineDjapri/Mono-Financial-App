import { renderNotification } from '../../../features/notifications/copy';

describe('renderNotification', () => {
  test('daily', () => {
    const r = renderNotification({ kind: 'daily' }, { hideAmounts: false });
    expect(r.title).toBe('Belum ada transaksi hari ini');
    expect(r.body).toContain('lupa');
  });

  test('bill_due with amounts shown', () => {
    const r = renderNotification({
      kind: 'bill_due', recurringId: 1, name: 'Listrik', accountName: 'BCA',
      amount: 500000, amountVaries: 0, dueDate: '2026-11-25',
    }, { hideAmounts: false });
    expect(r.title).toBe('Listrik jatuh tempo besok');
    expect(r.body).toContain('500.000');
    expect(r.actionLabel).toBe('Catat sekarang');
  });

  test('bill_due hideAmounts: no amount in body', () => {
    const r = renderNotification({
      kind: 'bill_due', recurringId: 1, name: 'Listrik', accountName: 'BCA',
      amount: 500000, amountVaries: 0, dueDate: '2026-11-25',
    }, { hideAmounts: true });
    expect(r.body).not.toContain('500');
    expect(r.body).toContain('BCA');
  });

  test('bill_due varies: "sekitar" prefix', () => {
    const r = renderNotification({
      kind: 'bill_due', recurringId: 1, name: 'Air', accountName: 'BCA',
      amount: 150000, amountVaries: 1, dueDate: '2026-11-25',
    }, { hideAmounts: false });
    expect(r.body).toContain('sekitar');
  });

  test('bill_overdue', () => {
    const r = renderNotification({
      kind: 'bill_overdue', recurringId: 1, name: 'Internet', accountName: 'BCA',
      dueDate: '2026-11-15',
    }, { hideAmounts: false });
    expect(r.title).toContain('terlewat');
    expect(r.body).toContain('15 Nov');
    expect(r.actionLabel).toBe('Catat sekarang');
  });

  test('budget_near with amounts', () => {
    const r = renderNotification({
      kind: 'budget_near', budgetId: 1, categoryName: 'Makan',
      usedBp: 8300, spentAmount: 830000, limitAmount: 1000000, daysLeft: 8, periodStart: '2026-11-01',
    }, { hideAmounts: false });
    expect(r.title).toContain('hampir habis');
    expect(r.body).toContain('830.000');
    expect(r.body).toContain('8 hari');
  });

  test('budget_near hideAmounts: no amounts', () => {
    const r = renderNotification({
      kind: 'budget_near', budgetId: 1, categoryName: 'Makan',
      usedBp: 8300, spentAmount: 830000, limitAmount: 1000000, daysLeft: 8, periodStart: '2026-11-01',
    }, { hideAmounts: true });
    expect(r.body).not.toContain('830');
    expect(r.body).toContain('83%');
  });

  test('budget_over', () => {
    const r = renderNotification({
      kind: 'budget_over', budgetId: 1, categoryName: 'Makan',
      usedBp: 11500, spentAmount: 1150000, limitAmount: 1000000, periodStart: '2026-11-01',
    }, { hideAmounts: false });
    expect(r.title).toContain('terlampaui');
    expect(r.body).toContain('1.150.000');
  });

  test('goal_milestone 75%', () => {
    const r = renderNotification({
      kind: 'goal_milestone', goalId: 1, goalName: 'Liburan',
      milestone: 7500, targetAmount: 10000000, currentAmount: 7600000,
    }, { hideAmounts: false });
    expect(r.title).toContain('75%');
    expect(r.body).toContain('7.600.000');
  });

  test('goal_milestone 100%', () => {
    const r = renderNotification({
      kind: 'goal_milestone', goalId: 1, goalName: 'Tabungan',
      milestone: 10000, targetAmount: 5000000, currentAmount: 5000000,
    }, { hideAmounts: false });
    expect(r.title).toContain('tercapai');
    expect(r.title).not.toContain('%');
  });

  test('backup never', () => {
    const r = renderNotification({ kind: 'backup', daysSinceLast: null }, { hideAmounts: false });
    expect(r.body).toContain('belum pernah');
  });

  test('backup N days ago', () => {
    const r = renderNotification({ kind: 'backup', daysSinceLast: 9 }, { hideAmounts: false });
    expect(r.body).toContain('9 hari');
  });
});

// Comparing the balance on the card with the balance of the linked account in MONO. The difference is recorded as an
// ordinary income or expense (a "balance adjustment"); a card balance never changes a MONO balance by itself.
export type ReconcileAction = 'none' | 'expense' | 'income';

export interface Reconciliation {
  diff: number; // card minus MONO, whole rupiah (negative: the card holds less)
  action: ReconcileAction;
  amount: number; // |diff|, what a record would be for (0 for 'none')
}

function checkMoney(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${name} must be a whole, non-negative amount`);
}

// Less on the card than in MONO means money left that MONO does not know about: an expense. More means an income.
export function reconcile(cardBalance: number, appBalance: number): Reconciliation {
  checkMoney('cardBalance', cardBalance);
  checkMoney('appBalance', appBalance);
  const diff = cardBalance - appBalance;
  if (diff === 0) return { diff: 0, action: 'none', amount: 0 };
  return { diff, action: diff < 0 ? 'expense' : 'income', amount: Math.abs(diff) };
}

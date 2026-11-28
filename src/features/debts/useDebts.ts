// Reads of the debt screens. Writes go through src/domain/debts.ts and then refresh everything.
import { useQuery } from '@tanstack/react-query';

import { useDb } from '@/data/db/DbProvider';
import { queryKeys } from '@/data/queryKeys';
import { getDebt, listDebtAccounts, listDebtMoves, listDebts } from '@/domain/debts';

export function useDebts() {
  const db = useDb();
  return useQuery({ queryKey: [...queryKeys.accounts, 'debts'], queryFn: () => listDebts(db) });
}

export function useDebt(id: number) {
  const db = useDb();
  return useQuery({
    queryKey: [...queryKeys.accounts, 'debt', id],
    queryFn: async () => ({ debt: await getDebt(db, id), moves: await listDebtMoves(db, id) }),
  });
}

export function useDebtAccounts() {
  const db = useDb();
  return useQuery({ queryKey: [...queryKeys.accounts, 'debt-accounts'], queryFn: () => listDebtAccounts(db) });
}

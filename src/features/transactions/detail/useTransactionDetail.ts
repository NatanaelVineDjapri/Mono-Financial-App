// Transaction detail reads. The screen only reads through these hooks; every figure comes from src/domain/transactionDetail.ts (views underneath).
import { useQuery } from '@tanstack/react-query';

import { useDb } from '@/data/db/DbProvider';
import { queryKeys } from '@/data/queryKeys';
import { getDeletePreview, getTransactionDetail, type TxDetail } from '@/domain/transactionDetail';

export function useTransactionDetail(id: number) {
  const db = useDb();
  return useQuery({
    queryKey: [...queryKeys.transactions, 'detail', id],
    queryFn: () => getTransactionDetail(db, id),
  });
}

// What the delete dialog states. Loaded once the record is, so the dialog opens ready.
export function useDeletePreview(detail: TxDetail | null | undefined) {
  const db = useDb();
  return useQuery({
    queryKey: [...queryKeys.transactions, 'delete-preview', detail?.id ?? null, detail?.account.balanceAfter ?? null],
    queryFn: () => getDeletePreview(db, detail as TxDetail),
    enabled: !!detail,
  });
}

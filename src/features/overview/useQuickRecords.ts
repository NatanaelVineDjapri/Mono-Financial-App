// Overview read for "Catat cepat": the notes recorded most often. It is a plain read, so the
// existing invalidate-after-write rule refreshes it with every other aggregate.
import { useQuery } from '@tanstack/react-query';

import { useDb } from '@/data/db/DbProvider';
import { queryKeys } from '@/data/queryKeys';
import { getQuickRecords } from '@/domain/quickRecords';

export function useQuickRecords() {
  const db = useDb();
  return useQuery({
    queryKey: [...queryKeys.transactions, 'quick-records'],
    queryFn: () => getQuickRecords(db),
  });
}

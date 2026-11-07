// Local-only account/category choices for Tx-Filters. These read existing repositories
// through React Query and intentionally make no network request.
import { useQuery } from '@tanstack/react-query';

import { useDb } from '@/data/db/DbProvider';
import { queryKeys } from '@/data/queryKeys';
import { listAccounts } from '@/data/repo/accounts';
import { listCategories } from '@/data/repo/categories';

export function useTransactionFilterOptions() {
  const db = useDb();
  const accounts = useQuery({
    queryKey: [...queryKeys.accounts, 'transaction-filter-options'],
    queryFn: () => listAccounts(db),
  });
  const categories = useQuery({
    queryKey: [...queryKeys.categories, 'transaction-filter-options'],
    queryFn: () => listCategories(db),
  });

  return {
    accounts: accounts.data ?? [],
    categories: categories.data ?? [],
    isLoading: accounts.isLoading || categories.isLoading,
  };
}

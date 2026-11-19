// true: the first launch, show Welcome. false: already seen. undefined: still reading.
import { useQuery } from '@tanstack/react-query';

import { useDb } from '@/data/db/DbProvider';
import { queryKeys } from '@/data/queryKeys';

import { needsWelcome } from './welcomeState';

export function useNeedsWelcome(): boolean | undefined {
  const db = useDb();
  const { data } = useQuery({ queryKey: [...queryKeys.settings, 'welcome'], queryFn: () => needsWelcome(db), staleTime: 0 });
  return data;
}

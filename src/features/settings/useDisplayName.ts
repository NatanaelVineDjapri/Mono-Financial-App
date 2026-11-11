// The name the person set in Settings (empty until they do): the AI chat greets by it and the
// avatar on Overview shows its first letter.
import { useQuery } from '@tanstack/react-query';

import { useDb } from '@/data/db/DbProvider';
import { queryKeys } from '@/data/queryKeys';
import { getSetting } from '@/data/repo/settings';

export function useDisplayName(): string {
  const db = useDb();
  const { data } = useQuery({ queryKey: [...queryKeys.settings, 'display-name'], queryFn: () => getSetting(db, 'display_name'), staleTime: 0 });
  return data ?? '';
}

// "Nael" -> "N"; nothing set -> "M" (for MONO).
export function avatarInitial(displayName: string): string {
  return displayName.trim().charAt(0).toUpperCase() || 'M';
}

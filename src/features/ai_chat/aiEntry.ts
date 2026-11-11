// Where the tab bar's centre "+" goes: the chat when the AI is usable, the setup flow when it
// is not (CLAUDE.md rule 9). "Usable" is a saved key AND the Settings switch on; see
// aiSettings.ts. No network here: this file only picks a path.
import { useQuery } from '@tanstack/react-query';

import { useDb } from '../../data/db/DbProvider';
import { queryKeys } from '../../data/queryKeys';
import { isAiConfigured } from './aiSettings';

export type AiEntryRoute = '/ai-chat' | '/ai-setup';

export function aiEntryRoute(isConfigured: boolean): AiEntryRoute {
  return isConfigured ? '/ai-chat' : '/ai-setup';
}

export const aiConfiguredKey = [...queryKeys.settings, 'ai-configured'] as const;

// True only when a key is saved and the Settings switch is on. Until the first read finishes
// it is false, so an early tap opens the setup screen, which forwards to the chat if all is set.
// Every write that changes the key or the switch calls invalidateAfterWrite, which refreshes this.
export function useAiConfigured(): boolean {
  const db = useDb();
  const { data } = useQuery({ queryKey: aiConfiguredKey, queryFn: () => isAiConfigured(db), staleTime: 0 });
  return data === true;
}

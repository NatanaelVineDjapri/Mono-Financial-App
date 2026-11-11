// The language choice (More → Language): the in-memory language changes at once, and the choice is
// kept in `settings.language` so the next start opens in it. Reading it at start is the language
// gate in src/app/_layout.tsx.
import { useCallback } from 'react';

import { useDb } from '@/data/db/DbProvider';
import { setSetting } from '@/data/repo/settings';
import { useChatStore } from '@/features/ai_chat/chatStore';
import { useLanguage, type Language } from '@/i18n/lang';

export const LANGUAGE_SETTING = 'language';

export function useLanguageSetting(): { language: Language; change: (language: Language) => void } {
  const db = useDb();
  const language = useLanguage(s => s.language);
  const change = useCallback(
    (next: Language) => {
      useLanguage.getState().setLanguage(next);
      // The chat's sentences were written in the old language and cannot be translated afterwards.
      useChatStore.getState().reset();
      void setSetting(db, LANGUAGE_SETTING, next).catch(() => {});
    },
    [db],
  );
  return { language, change };
}

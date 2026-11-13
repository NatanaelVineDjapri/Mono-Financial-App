// The UI language. English for now; Indonesian is the other choice (More → Language). The choice
// is kept in `settings.language` and read once at start (src/app/_layout.tsx); this store is only
// the in-memory copy that the text wrappers in index.ts read on every call.
import { create } from 'zustand';

export type Language = 'en' | 'id';

export function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'id';
}

export const DEFAULT_LANGUAGE: Language = 'en';

// The language choice (More → Language) is switched off for now: the app starts in DEFAULT_LANGUAGE. The
// Indonesian dictionary, the selector and the saved choice are all still in place; set this to
// true to bring the choice back. While it is false, a language saved earlier is ignored.
export const LANGUAGE_CHOICE_ENABLED = false;

// Read through a function so a test can turn the choice on without editing this file.
export function languageChoiceEnabled(): boolean {
  return LANGUAGE_CHOICE_ENABLED;
}

// The language to start in, given what was saved: the saved one when the choice is on, else DEFAULT_LANGUAGE.
export function initialLanguage(saved: unknown): Language {
  return LANGUAGE_CHOICE_ENABLED && isLanguage(saved) ? saved : DEFAULT_LANGUAGE;
}

interface LanguageState {
  language: Language;
  setLanguage: (language: Language) => void;
}

export const useLanguage = create<LanguageState>(set => ({
  language: DEFAULT_LANGUAGE,
  setLanguage: language => set({ language }),
}));

export function getLanguage(): Language {
  return useLanguage.getState().language;
}

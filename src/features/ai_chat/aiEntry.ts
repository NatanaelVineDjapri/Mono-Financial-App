// Where the tab bar's centre "+" goes: the chat when the user's Gemini key is set up, the
// setup flow when it is not (CLAUDE.md rule 9 — the key lives in expo-secure-store).
//
// Phase 9 (AI chat) owns the real check. expo-secure-store is not installed yet, so for now
// the app behaves as if setup were done and always opens the chat stub; `/ai-setup` is the
// route that screen will own. No network here — this file only picks a path.
export type AiEntryRoute = '/ai-chat' | '/ai-setup';

export function aiEntryRoute(isConfigured: boolean): AiEntryRoute {
  return isConfigured ? '/ai-chat' : '/ai-setup';
}

export function useAiConfigured(): boolean {
  return true;
}

// The AI chat's constants (CLAUDE.md rule 9). The model name is ONE constant, here.
//
// Chosen from the official Gemini API docs (aistudio.google.com/docs/models, checked
// 2026-11-11): `gemini-3.5-flash-lite` is the cheap Flash-Lite model with the "Stable" badge and
// no announced shutdown date, and its thinking defaults to "minimal", which matters because
// thinking tokens count toward maxOutputTokens. `gemini-3.8-flash` is the newer Flash, but its
// thinking cannot go below "low".
export const GEMINI_MODEL = 'gemini-3.5-flash-lite';

export const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Where the person creates their own key. Opened in the browser; the app itself makes no request to it.
export const API_KEY_URL = 'https://aistudio.google.com/api-keys';

export const MAX_CHARS = 500; // one message, typed by the person
export const TIMEOUT_MS = 20000;
export const MAX_TRANSACTIONS = 10;
export const MAX_OUTPUT_TOKENS = 1024; // thinking tokens share this budget
export const PING_MAX_OUTPUT_TOKENS = 16;
export const SERVER_RETRY_DELAY_MS = 1000;

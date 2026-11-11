// The chat's session state, in memory only (never in the database, never on disk). It lives in
// a store rather than in the screen so that the edit-one-by-one screen (/ai-draft-edit) and the
// chat share it, and so leaving the chat for a moment does not lose the conversation. It is
// gone when the app process ends. Unsaved drafts exist only here.
import { create } from 'zustand';

import type { Draft } from './draft';
import type { InterpretResult } from './interpret';

export type DraftsResult = Extract<InterpretResult, { kind: 'drafts' }>;
export type ClarifyResult = Extract<InterpretResult, { kind: 'clarify' }>;
export type OutOfScopeResult = Extract<InterpretResult, { kind: 'out_of_scope' }>;
export type ErrorResult = Extract<InterpretResult, { kind: 'error' }>;

// Rows saved from a card. `draftIds` says which drafts of the card they were (the rest were
// skipped); `ids` are the transaction rows, for Urungkan.
export interface SavedBatchInfo {
  ids: number[];
  draftIds: string[];
}

export type AssistantContent =
  | { type: 'text'; text: string }
  | {
      type: 'drafts';
      drafts: Draft[];
      text: string;
      selected: string[]; // draft ids ticked (only `ready` ones can be)
      sourceMessage: string; // what the person typed, shown in "Dari pesanmu"
      saved: SavedBatchInfo | null;
      saving: boolean;
      saveError: string | null;
    }
  | { type: 'clarify'; result: ClarifyResult; sourceMessage: string }
  | { type: 'out_of_scope'; result: OutOfScopeResult }
  | { type: 'error'; result: ErrorResult };

export type ChatMessage = { id: string; role: 'user'; text: string } | { id: string; role: 'assistant'; content: AssistantContent };

export type NewChatMessage = { role: 'user'; text: string; id?: string } | { role: 'assistant'; content: AssistantContent; id?: string };

// The hand-over to /ai-draft-edit.
export interface EditSession {
  messageId: string;
  drafts: Draft[]; // the ones to walk through, in order
  sourceMessage: string;
  savedIds: number[];
  savedDraftIds: string[];
}

interface ChatState {
  messages: ChatMessage[];
  pending: string | null; // the message a clarification question is about
  processing: boolean;
  edit: EditSession | null;
  nextId: number;
  newId: () => string;
  addMessage: (message: NewChatMessage) => string;
  updateContent: (id: string, update: (content: AssistantContent) => AssistantContent) => void;
  replaceContent: (id: string, content: AssistantContent) => void;
  removeMessage: (id: string) => void;
  setPending: (pending: string | null) => void;
  setProcessing: (processing: boolean) => void;
  startEdit: (session: EditSession) => void;
  recordEditSave: (draftId: string, ids: number[]) => void;
  endEdit: () => EditSession | null;
  reset: () => void;
}

const initial = { messages: [] as ChatMessage[], pending: null, processing: false, edit: null, nextId: 1 };

export const useChatStore = create<ChatState>((set, get) => ({
  ...initial,
  newId: () => {
    const id = `m${get().nextId}`;
    set({ nextId: get().nextId + 1 });
    return id;
  },
  addMessage: message => {
    const id = message.id ?? get().newId();
    set(s => ({ messages: [...s.messages, { ...message, id } as ChatMessage] }));
    return id;
  },
  updateContent: (id, update) =>
    set(s => ({
      messages: s.messages.map(m => (m.id === id && m.role === 'assistant' ? { ...m, content: update(m.content) } : m)),
    })),
  replaceContent: (id, content) =>
    set(s => ({ messages: s.messages.map(m => (m.id === id && m.role === 'assistant' ? { ...m, content } : m)) })),
  removeMessage: id => set(s => ({ messages: s.messages.filter(m => m.id !== id) })),
  setPending: pending => set({ pending }),
  setProcessing: processing => set({ processing }),
  startEdit: session => set({ edit: session }),
  recordEditSave: (draftId, ids) =>
    set(s => (s.edit ? { edit: { ...s.edit, savedIds: [...s.edit.savedIds, ...ids], savedDraftIds: [...s.edit.savedDraftIds, draftId] } } : s)),
  endEdit: () => {
    const edit = get().edit;
    set({ edit: null });
    return edit;
  },
  reset: () => set({ ...initial }),
}));

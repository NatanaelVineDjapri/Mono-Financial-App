// Imperative trigger for the shared confirm sheet (same pattern as toast-store.ts).
// Any screen calls openConfirmSheet(due); RecurringConfirmHost mounted in _layout renders it.
import { create } from 'zustand';

import type { RecurringDueRow } from '@/data/repo/recurring';

interface ConfirmSheetState {
  due: RecurringDueRow | null;
  open: (due: RecurringDueRow) => void;
  close: () => void;
}

export const useConfirmSheet = create<ConfirmSheetState>(set => ({
  due: null,
  open: (due) => set({ due }),
  close: () => set({ due: null }),
}));

export function openConfirmSheet(due: RecurringDueRow): void {
  useConfirmSheet.getState().open(due);
}

export function closeConfirmSheet(): void {
  useConfirmSheet.getState().close();
}

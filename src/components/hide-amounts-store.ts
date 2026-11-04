// The single UI-state source for hidden-amounts mode (CLAUDE.md rule 12). <Amount> reads
// this and passes every formatted figure through shown() in src/core/money.ts — that
// function is the actual gate; this store is just where the on/off state lives.
import { create } from 'zustand';

interface HideAmountsState {
  hidden: boolean;
  toggle: () => void;
  setHidden: (hidden: boolean) => void;
}

export const useHideAmounts = create<HideAmountsState>(set => ({
  hidden: false,
  toggle: () => set(state => ({ hidden: !state.hidden })),
  setHidden: hidden => set({ hidden }),
}));

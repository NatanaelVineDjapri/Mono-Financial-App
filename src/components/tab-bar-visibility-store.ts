// The single UI-state source for whether the floating bottom tab bar is shown. A screen
// that needs the full screen height for its own bottom-pinned UI (e.g. Transactions with
// an active filter) sets this; TabBar's own host (src/app/(tabs)/_layout.tsx) reads it.
import { create } from 'zustand';

interface TabBarVisibilityState {
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
}

export const useTabBarVisibility = create<TabBarVisibilityState>(set => ({
  hidden: false,
  setHidden: hidden => set({ hidden }),
}));

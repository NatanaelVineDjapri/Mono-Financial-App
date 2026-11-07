// Transactions tab's statistics area (Fase 4.3c step 3): whether it's collapsed.
// UI-only state (CLAUDE.md: zustand is for UI-only state) — default open, per the brief.
import { create } from 'zustand';

interface StatsCollapsedState {
  collapsed: boolean;
  toggle: () => void;
}

export const useStatsCollapsed = create<StatsCollapsedState>(set => ({
  collapsed: false,
  toggle: () => set(s => ({ collapsed: !s.collapsed })),
}));

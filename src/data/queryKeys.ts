// One query-key namespace per aggregate (src/data/repo/*), so every screen reads through
// react-query with a consistent, typo-proof key. invalidateAfterWrite is deliberately
// blunt (CLAUDE.md: "reads, invalidate after writes") — every write calls it rather than
// each caller tracking which keys its own write actually touched.
import type { QueryClient } from '@tanstack/react-query';

export const queryKeys = {
  accounts: ['accounts'] as const,
  transactions: ['transactions'] as const,
  categories: ['categories'] as const,
  budgets: ['budgets'] as const,
  goals: ['goals'] as const,
  recurring: ['recurring'] as const,
  settings: ['settings'] as const,
  fx: ['fx'] as const,
  netWorth: ['net-worth'] as const,
  reports: ['reports'] as const,
} as const;

export function invalidateAfterWrite(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries();
}

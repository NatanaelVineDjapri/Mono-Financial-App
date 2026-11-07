// Transactions-only UI state. Statistics collapse state and the applied/draft filter state
// intentionally share this store: neither belongs in persisted data, and closing the
// sheet can discard the draft without changing the list or its SQL-backed statistics.
import { create } from 'zustand';

import {
    cloneTransactionFilters,
    defaultTransactionFilters,
    type TransactionFilters,
    type TxTypeFilter,
} from '@/domain/transactionFilters';

function normaliseIds(ids: number[]): number[] {
  return [...new Set(ids.filter(id => Number.isInteger(id) && id > 0))];
}

function normaliseFilters(filters: TransactionFilters): TransactionFilters {
  const minAmount = filters.minAmount != null && filters.minAmount > 0 ? Math.trunc(filters.minAmount) : undefined;
  const maxAmount = filters.maxAmount != null && filters.maxAmount > 0 ? Math.trunc(filters.maxAmount) : undefined;
  return {
    ...filters,
    accountIds: normaliseIds(filters.accountIds),
    categoryIds: normaliseIds(filters.categoryIds),
    minAmount,
    maxAmount,
  };
}

interface TransactionsUiState {
  collapsed: boolean;
  filters: TransactionFilters;
  draftFilters: TransactionFilters;
  toggle: () => void;
  startFilterEdit: () => void;
  updateDraftFilters: (patch: Partial<TransactionFilters>) => void;
  resetDraftFilters: () => void;
  applyDraftFilters: () => void;
  discardDraftFilters: () => void;
  resetFilters: () => void;
  updateFilters: (patch: Partial<TransactionFilters>) => void;
  toggleCategoryFilter: (categoryId: number) => void;
  removeAccountFilter: (accountId: number) => void;
  removeCategoryFilter: (categoryId: number) => void;
  removeMinAmountFilter: () => void;
  removeMaxAmountFilter: () => void;
}

function patchFilters(current: TransactionFilters, patch: Partial<TransactionFilters>): TransactionFilters {
  return normaliseFilters({ ...current, ...patch });
}

export const useStatsCollapsed = create<TransactionsUiState>((set, get) => ({
  collapsed: false,
  filters: defaultTransactionFilters(),
  draftFilters: defaultTransactionFilters(),
  toggle: () => set(state => ({ collapsed: !state.collapsed })),
  startFilterEdit: () => set(state => ({ draftFilters: cloneTransactionFilters(state.filters) })),
  updateDraftFilters: patch => set(state => ({ draftFilters: patchFilters(state.draftFilters, patch) })),
  resetDraftFilters: () => set({ draftFilters: defaultTransactionFilters() }),
  applyDraftFilters: () => set(state => ({ filters: cloneTransactionFilters(normaliseFilters(state.draftFilters)) })),
  discardDraftFilters: () => set(state => ({ draftFilters: cloneTransactionFilters(state.filters) })),
  resetFilters: () => set({ filters: defaultTransactionFilters(), draftFilters: defaultTransactionFilters() }),
  updateFilters: patch => set(state => ({ filters: patchFilters(state.filters, patch) })),
  toggleCategoryFilter: categoryId => {
    if (!Number.isInteger(categoryId) || categoryId < 1) return;
    const categoryIds = get().filters.categoryIds;
    set({
      filters: patchFilters(get().filters, {
        categoryIds: categoryIds.includes(categoryId) ? categoryIds.filter(id => id !== categoryId) : [...categoryIds, categoryId],
      }),
    });
  },
  removeAccountFilter: accountId => set(state => ({
    filters: patchFilters(state.filters, { accountIds: state.filters.accountIds.filter(id => id !== accountId) }),
  })),
  removeCategoryFilter: categoryId => set(state => ({
    filters: patchFilters(state.filters, { categoryIds: state.filters.categoryIds.filter(id => id !== categoryId) }),
  })),
  removeMinAmountFilter: () => set(state => ({ filters: patchFilters(state.filters, { minAmount: undefined }) })),
  removeMaxAmountFilter: () => set(state => ({ filters: patchFilters(state.filters, { maxAmount: undefined }) })),
}));

export type { TransactionFilters, TxTypeFilter };

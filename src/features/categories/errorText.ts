// The sentence for a refused category change (CategoryError). Every word the person reads lives in
// src/i18n; this only picks the sentence and its numbers.
import {
  catErrorKindLocked,
  catErrorLastActive,
  catErrorNameEmpty,
  catErrorNameTaken,
  catErrorNameTakenArchived,
  catErrorNameTooLong,
  catErrorNotFound,
  catErrorUsedByRecurring,
  catFormKindExpense,
  catFormKindIncome,
  catKindWordExpense,
  catKindWordIncome,
} from '@/i18n';

import { CATEGORY_NAME_MAX, type CategoryError } from './rules';

export function categoryErrorText(error: CategoryError): string {
  switch (error.code) {
    case 'name_empty':
      return catErrorNameEmpty();
    case 'name_too_long':
      return catErrorNameTooLong(CATEGORY_NAME_MAX);
    case 'name_taken':
      return catErrorNameTaken(error.kind === 'expense' ? catFormKindExpense() : catFormKindIncome());
    case 'name_taken_archived':
      return catErrorNameTakenArchived();
    case 'last_active':
      return catErrorLastActive(error.kind === 'expense' ? catKindWordExpense() : catKindWordIncome());
    case 'used_by_recurring':
      return catErrorUsedByRecurring(error.recurringName);
    case 'kind_locked':
      return catErrorKindLocked();
    case 'not_found':
      return catErrorNotFound();
  }
}

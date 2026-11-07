// Tx-Filters board: a draft-only bottom sheet. Its caller owns the Zustand draft and
// commits it only from Apply, so scrim taps and swipe dismissal never change SQL results.
import { useState, type ReactNode } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { SheetHeader } from '@/components/SheetHeader';
import { type TransactionDateRange, type TransactionFilters, type TxDatePreset } from '@/domain/transactionFilters';
import {
    cancelLabel,
    closeLabel,
    filtersAccountsLabel,
    filtersApplyLabel,
    filtersCategoriesLabel,
    filtersCustomEndLabel,
    filtersCustomStartLabel,
    filtersDateFormatHint,
    filtersDateRangeLabel,
    filtersSheetSubtitle,
    filtersSheetTitle,
    filtersTypeLabel,
    resetAllFiltersLabel,
    txDatePresetLabel,
    txTypeChipLabel,
} from '@/i18n/id';
import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export interface FilterSheetOption {
  id: number;
  name: string;
}

export interface FilterSheetProps {
  visible: boolean;
  filters: TransactionFilters;
  range: TransactionDateRange;
  accounts: FilterSheetOption[];
  categories: FilterSheetOption[];
  resultCount: number;
  resultCountLoading?: boolean;
  onChange: (patch: Partial<TransactionFilters>) => void;
  onReset: () => void;
  onClose: () => void;
  onApply: () => void;
}

const DATE_PRESETS: TxDatePreset[] = ['this-month', 'last-month', 'three-months', 'this-year', 'custom'];
const TYPE_OPTIONS: Exclude<TransactionFilters['type'], 'all'>[] = ['income', 'expense', 'transfer'];
// Sheet.tsx's panel is content-sized (bottom:0 with no top/height), so a percentage
// maxHeight on this sheet would resolve against an indeterminate parent height — an
// absolute value against the real window instead leaves the screen's own "Transactions"
// header visible above the sheet (Tx-Filters board) and gives the inner ScrollView a
// real bound to shrink into.
const SHEET_MAX_HEIGHT = Dimensions.get('window').height * 0.75;

function toggleId(ids: number[], id: number): number[] {
  return ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id];
}

// Only ever rendered for the Custom preset now (the sheet hides this section entirely
// otherwise), so always editable — no read-only branch to keep in sync.
function DateField({
  label,
  value,
  onChangeText,
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  testID: string;
}) {
  return (
    <View style={styles.customDateField}>
      <Text style={styles.customDateLabel}>{label}</Text>
      <View style={styles.dateInputWrap}>
        <Icon name="calendar" size={16} color={MonoColors.textSecond} />
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          keyboardType="numbers-and-punctuation"
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={`${label}, ${filtersDateFormatHint()}`}
          placeholder={filtersDateFormatHint()}
          placeholderTextColor={MonoColors.textDisabled}
          style={styles.dateInput}
        />
      </View>
    </View>
  );
}

export function FilterSheet({
  visible,
  filters,
  range,
  accounts,
  categories,
  resultCount,
  resultCountLoading = false,
  onChange,
  onReset,
  onClose,
  onApply,
}: FilterSheetProps) {
  // Each preset chip's own x offset, so the horizontal scroll always comes to rest with
  // one fully in view (never half-cut mid-label, e.g. "This year" stopping at "This").
  const [datePresetOffsets, setDatePresetOffsets] = useState<number[]>([]);
  const recordDatePresetOffset = (index: number, x: number) => {
    setDatePresetOffsets(previous => {
      if (previous[index] === x) return previous;
      const next = [...previous];
      next[index] = x;
      return next;
    });
  };
  const customStart = filters.customStart ?? range.startDate;
  const customEnd = filters.customEnd ?? range.endDate;
  const isCustom = filters.datePreset === 'custom';

  return (
    <Sheet visible={visible} onClose={onClose} closeLabel={closeLabel()} testID="transaction-filters-sheet">
      <View style={styles.sheet}>
        <SheetHeader
          visible={visible}
          icon="filter"
          title={filtersSheetTitle()}
          subtitle={filtersSheetSubtitle()}
          onClose={onClose}
          closeTestID="transaction-filters-close"
          action={
            <Pressable
              onPress={onReset}
              accessibilityRole="button"
              accessibilityLabel={resetAllFiltersLabel()}
              style={styles.resetButton}
            >
              <Text style={styles.resetText}>{resetAllFiltersLabel()}</Text>
            </Pressable>
          }
        />

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <FilterSection label={filtersTypeLabel()}>
            <View style={styles.chips}>
              {TYPE_OPTIONS.map(type => (
                <Chip
                  key={type}
                  label={txTypeChipLabel(type)}
                  selected={filters.type === type}
                  onPress={() => onChange({ type: filters.type === type ? 'all' : type })}
                />
              ))}
            </View>
          </FilterSection>

          <FilterSection label={filtersDateRangeLabel()}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.datePresetChips}
              snapToOffsets={datePresetOffsets}
              decelerationRate="fast"
            >
              {DATE_PRESETS.map((preset, index) => (
                <View key={preset} onLayout={e => recordDatePresetOffset(index, e.nativeEvent.layout.x)}>
                  <Chip
                    label={txDatePresetLabel(preset)}
                    selected={filters.datePreset === preset}
                    onPress={() => onChange({
                      datePreset: preset,
                      ...(preset === 'custom' ? { customStart, customEnd } : {}),
                    })}
                  />
                </View>
              ))}
            </ScrollView>
            {isCustom && (
            <View style={styles.dateFields}>
              <DateField
                label={filtersCustomStartLabel()}
                value={customStart}
                onChangeText={customStart => onChange({ customStart })}
                testID="filter-start-date"
              />
              <DateField
                label={filtersCustomEndLabel()}
                value={customEnd}
                onChangeText={customEnd => onChange({ customEnd })}
                testID="filter-end-date"
              />
            </View>
            )}
          </FilterSection>

          <FilterSection label={filtersCategoriesLabel()}>
            <View style={styles.chips}>
              {categories.map(category => (
                <Chip
                  key={category.id}
                  label={category.name}
                  selected={filters.categoryIds.includes(category.id)}
                  onPress={() => onChange({ categoryIds: toggleId(filters.categoryIds, category.id) })}
                />
              ))}
            </View>
          </FilterSection>

          <FilterSection label={filtersAccountsLabel()}>
            <View style={styles.chips}>
              {accounts.map(account => (
                <Chip
                  key={account.id}
                  label={account.name}
                  selected={filters.accountIds.includes(account.id)}
                  onPress={() => onChange({ accountIds: toggleId(filters.accountIds, account.id) })}
                />
              ))}
            </View>
          </FilterSection>
        </ScrollView>

        <View style={styles.footer}>
          <Button label={cancelLabel()} variant="secondary" onPress={onClose} style={styles.cancelButton} />
          <Button
            label={filtersApplyLabel(resultCount)}
            disabled={resultCountLoading}
            onPress={onApply}
            style={styles.applyButton}
          />
        </View>
      </View>
    </Sheet>
  );
}

function FilterSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // Extra inset on top of Sheet.tsx's own 16px panel padding (Tx-Filters board: the
  // sheet's content sits narrower than the panel itself, not edge-to-edge) — scoped to
  // this sheet only, not Sheet.tsx itself, which other sheets still use at full width.
  sheet: { maxHeight: SHEET_MAX_HEIGHT, paddingHorizontal: 20 },
  resetButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  resetText: { ...MonoText.bodyS, color: MonoColors.textSecond },
  // flexShrink only (not flexGrow): the sheet should still hug short content (leaving
  // "Transactions" visible above it) and only grow to its maxHeight cap, with this
  // scrolling internally, once the real content is tall enough to need it. flexGrow:1
  // here forced the sheet to always render at its full maxHeight even for short content.
  // minHeight: 0 is required alongside flexShrink — a flex-shrink child's default
  // min-height is "auto" (its own content size), which blocks it from ever shrinking
  // below that and silently overflows past the parent's maxHeight instead of scrolling.
  scroll: { flexShrink: 1, minHeight: 0 },
  content: { gap: 16, paddingTop: 12, paddingBottom: 16 },
  section: { gap: 8 },
  sectionLabel: { ...MonoText.label, color: MonoColors.textMeta, textTransform: 'uppercase' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 6 },
  // Horizontal scroll, not wrap: a compact single row (3ish presets visible), swiping
  // for the rest is fine — this keeps the sheet's own vertical rhythm tight.
  datePresetChips: { columnGap: 10, paddingRight: 16 },
  dateFields: { flexDirection: 'row', gap: 8 },
  customDateField: { flex: 1, gap: 4 },
  customDateLabel: { ...MonoText.caption, color: MonoColors.textMeta },
  dateInputWrap: {
    minHeight: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: MonoColors.border,
    backgroundColor: MonoColors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  dateInput: {
    flex: 1,
    ...MonoText.bodyS,
    color: MonoColors.text,
  },
  footer: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: MonoColors.border, paddingTop: 12 },
  // Button's shared "secondary" variant is transparent by design (its own spec comment:
  // "secondary (outlined)") — used as-is elsewhere in the app, so overridden here only,
  // not in Button.tsx itself, to give this one a real fill instead of reading as a hole.
  cancelButton: { flex: 1, backgroundColor: MonoColors.card },
  applyButton: { flex: 2 },
});

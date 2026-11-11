// The three pickers of the transaction form, as bottom sheets (Sheet + SheetHeader, like the
// Filters and month sheets): which account, which category, which day. Each shows what it needs
// to choose well and nothing it must not write: choosing only calls back; the form owns the state.
//
// The date sheet is a small month calendar built here (core/tx/calendar.ts has the grid): the
// app has no native date-picker dependency. Days after today cannot be picked.
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BankTile } from '@/components/BankCard';
import { HeaderButton } from '@/components/HeaderButton';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { SheetHeader } from '@/components/SheetHeader';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { formatShortDate, monthLabel } from '@/core/date';
import { rp, shown } from '@/core/money';
import { monthGrid, monthOf, shiftMonth } from '@/core/tx/calendar';
import type { FormAccount, FormCategory } from '@/core/tx/validate';
import {
  allCategoriesSubtitle,
  allCategoriesTitle,
  balanceNowLabel,
  closeLabel,
  nextMonthLabel,
  pickAccountSubtitle,
  pickAccountTitle,
  pickDateSubtitle,
  pickDateTitle,
  pickFromTitle,
  pickToTitle,
  previousMonthLabel,
  txKindLabel,
  valasComingLater,
  weekdayInitials,
} from '@/i18n/id';
import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

const SHEET_MAX_HEIGHT = 560;

// ---------------------------------------------------------------- account

export type AccountSheetRole = 'account' | 'from' | 'to';

export interface AccountSheetProps {
  visible: boolean;
  role: AccountSheetRole;
  accounts: FormAccount[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onClose: () => void;
}

export function AccountSheet({ visible, role, accounts, selectedId, onSelect, onClose }: AccountSheetProps) {
  const hidden = useHideAmounts(s => s.hidden);
  const title = role === 'from' ? pickFromTitle() : role === 'to' ? pickToTitle() : pickAccountTitle();
  return (
    <Sheet visible={visible} onClose={onClose} closeLabel={closeLabel()} testID="tx-account-sheet">
      <View style={styles.sheet}>
        <SheetHeader visible={visible} icon="bank" title={title} subtitle={pickAccountSubtitle()} onClose={onClose} closeTestID="tx-account-sheet-close" />
        <ScrollView style={styles.scroll} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {accounts.map(account => {
            const forex = account.type === 'forex';
            const selected = account.id === selectedId;
            return (
              <Pressable
                key={account.id}
                onPress={forex ? undefined : () => onSelect(account.id)}
                disabled={forex}
                accessibilityRole="button"
                accessibilityLabel={forex ? `${account.name}, ${valasComingLater()}` : `${account.name}, ${balanceNowLabel(shown(rp(account.balance), hidden))}`}
                accessibilityState={{ selected, disabled: forex }}
                android_ripple={undefined}
                style={({ pressed }) => [styles.row, selected && styles.rowSelected, forex && styles.rowDisabled, pressed && !forex && styles.rowPressed]}
                testID={`tx-account-option-${account.id}`}
              >
                <BankTile icon={account.icon} type={account.type} size={36} />
                <View style={styles.rowText}>
                  <Text style={styles.rowName}>{account.name}</Text>
                  <Text style={styles.rowMeta}>{forex ? valasComingLater() : balanceNowLabel(shown(rp(account.balance), hidden))}</Text>
                </View>
                {selected && <Icon name="check" size={20} color={MonoColors.text} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Sheet>
  );
}

// ---------------------------------------------------------------- category

export interface CategorySheetProps {
  visible: boolean;
  kind: 'income' | 'expense';
  categories: FormCategory[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onClose: () => void;
}

export function CategorySheet({ visible, kind, categories, selectedId, onSelect, onClose }: CategorySheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} closeLabel={closeLabel()} testID="tx-category-sheet">
      <View style={styles.sheet}>
        <SheetHeader visible={visible} icon="receipt" title={allCategoriesTitle()} subtitle={allCategoriesSubtitle(txKindLabel(kind))} onClose={onClose} closeTestID="tx-category-sheet-close" />
        <ScrollView style={styles.scroll} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {categories.map(category => {
            const selected = category.id === selectedId;
            return (
              <Pressable
                key={category.id}
                onPress={() => onSelect(category.id)}
                accessibilityRole="button"
                accessibilityLabel={category.name}
                accessibilityState={{ selected }}
                android_ripple={undefined}
                style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.rowPressed]}
                testID={`tx-category-option-${category.id}`}
              >
                <View style={styles.rowText}>
                  <Text style={styles.rowName}>{category.name}</Text>
                </View>
                {selected && <Icon name="check" size={20} color={MonoColors.text} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Sheet>
  );
}

// ---------------------------------------------------------------- date

export interface DateSheetProps {
  visible: boolean;
  selected: string; // 'YYYY-MM-DD'
  today: string;
  onSelect: (date: string) => void;
  onClose: () => void;
}

export function DateSheet({ visible, selected, today, onSelect, onClose }: DateSheetProps) {
  // The month on show restarts at the chosen date's month each time the sheet opens (React's
  // "adjusting state when a prop changes" recipe).
  const [month, setMonth] = useState(monthOf(selected));
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) setMonth(monthOf(selected));
  }

  const weeks = monthGrid(month);
  const isCurrentMonth = month >= monthOf(today);

  return (
    <Sheet visible={visible} onClose={onClose} closeLabel={closeLabel()} testID="tx-date-sheet">
      <View style={styles.sheet}>
        <SheetHeader visible={visible} icon="calendar" title={pickDateTitle()} subtitle={pickDateSubtitle()} onClose={onClose} closeTestID="tx-date-sheet-close" />

        <View style={styles.monthRow}>
          <HeaderButton icon="chevron-left" label={previousMonthLabel()} onPress={() => setMonth(shiftMonth(month, -1))} testID="tx-date-prev" />
          <Text style={styles.monthTitle} accessibilityLiveRegion="polite" testID="tx-date-month">
            {monthLabel(month)}
          </Text>
          <HeaderButton icon="chevron-right" label={nextMonthLabel()} disabled={isCurrentMonth} onPress={() => setMonth(shiftMonth(month, 1))} testID="tx-date-next" />
        </View>

        <View style={styles.weekRow}>
          {weekdayInitials().map((initial, i) => (
            <Text key={i} style={styles.weekday} accessibilityElementsHidden importantForAccessibility="no">
              {initial}
            </Text>
          ))}
        </View>
        {weeks.map((week, w) => (
          <View key={w} style={styles.weekRow}>
            {week.map((day, i) => {
              if (!day) return <View key={i} style={styles.dayCell} />;
              const future = day > today;
              const isSelected = day === selected;
              return (
                <Pressable
                  key={day}
                  onPress={future ? undefined : () => onSelect(day)}
                  disabled={future}
                  accessibilityRole="button"
                  accessibilityLabel={formatShortDate(day)}
                  accessibilityState={{ selected: isSelected, disabled: future }}
                  android_ripple={undefined}
                  style={({ pressed }) => [styles.dayCell, styles.day, isSelected && styles.daySelected, future && styles.dayDisabled, pressed && !future && !isSelected && styles.dayPressed]}
                  testID={`tx-date-day-${day}`}
                >
                  <Text style={isSelected ? styles.daySelectedText : styles.dayText}>{Number(day.slice(8))}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  // Extra inset on top of Sheet.tsx's own 16px panel padding, like the Filters and month sheets.
  sheet: { maxHeight: SHEET_MAX_HEIGHT, paddingHorizontal: 20 },
  scroll: { flexShrink: 1, minHeight: 0 },
  list: { gap: 8, paddingVertical: 16 },
  row: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: MonoColors.border, backgroundColor: MonoColors.card },
  rowSelected: { borderColor: MonoColors.text },
  rowPressed: { backgroundColor: MonoColors.surface },
  rowDisabled: { opacity: 0.45 },
  rowText: { flex: 1 },
  rowName: { ...MonoText.bodyStrong, color: MonoColors.text },
  rowMeta: { ...MonoText.caption, color: MonoColors.textMeta },

  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 12 },
  monthTitle: { ...MonoText.titleM, color: MonoColors.text, textAlign: 'center', flexShrink: 1 },
  weekRow: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', ...MonoText.caption, color: MonoColors.textMeta, paddingBottom: 4 },
  dayCell: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  day: { borderRadius: 22 },
  daySelected: { backgroundColor: MonoColors.text },
  dayPressed: { backgroundColor: MonoColors.surface },
  dayDisabled: { opacity: 0.3 },
  dayText: { ...MonoText.body, color: MonoColors.text },
  daySelectedText: { ...MonoText.bodyStrong, color: MonoColors.bg },
});

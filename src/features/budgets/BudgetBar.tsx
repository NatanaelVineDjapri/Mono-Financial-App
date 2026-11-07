// One budget bar with its footer line (DESIGN.md section 3 rule 3, section 6 "Over
// budget"): the 8px ProgressBar, then either what is left (neutral) or the alert icon
// plus "Over by Rp…" (red), and the share used. Over the limit the bar is full: the amber
// fill reaches the limit and only the overflow segment is striped red — never a fully
// red bar. Red marks only the amount over; every other figure stays neutral.
// Every nominal passes shown() (CLAUDE.md rule 12); the bar's accessibility label always
// carries the exact spent, limit, share and remaining/over figures.
import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { ProgressBar } from '@/components/ProgressBar';
import { pct, rp, shown } from '@/core/money';
import { budgetBarAccessibilityLabel, budgetLeftLabel, budgetRemainingLabel, overBy, usedPctLabel } from '@/i18n/id';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export interface BudgetFigures {
  spent: number;
  limit: number;
  remaining: number; // negative when over (straight from the view)
  overBy: number; // 0 unless over
  usedBp: number;
}

// 'month' = the monthly limit card ("85,14% used" strong on the left, "Rp… remaining"
// on the right); 'category' = a category row ("Rp… left" on the left, "…% used" right).
export type BudgetBarLayout = 'month' | 'category';

export function budgetBarLabel(subject: string, figures: BudgetFigures, layout: BudgetBarLayout, hidden: boolean): string {
  const money = (v: number) => shown(rp(v), hidden);
  const state =
    figures.overBy > 0
      ? ({ kind: 'over', amountFormatted: money(figures.overBy) } as const)
      : ({ kind: layout === 'month' ? 'remaining' : 'left', amountFormatted: money(Math.max(figures.remaining, 0)) } as const);
  return budgetBarAccessibilityLabel(subject, money(figures.spent), money(figures.limit), pct(figures.usedBp), state);
}

export interface BudgetBarProps {
  subject: string;
  figures: BudgetFigures;
  layout: BudgetBarLayout;
  hidden: boolean;
  testID?: string;
}

export function BudgetBar({ subject, figures, layout, hidden, testID }: BudgetBarProps) {
  const isOver = figures.overBy > 0;
  const usedText = usedPctLabel(pct(figures.usedBp));
  const remainingText = shown(rp(Math.max(figures.remaining, 0)), hidden);

  return (
    <View testID={testID}>
      <ProgressBar
        valueBp={figures.usedBp}
        label={subject}
        accessibilityLabel={budgetBarLabel(subject, figures, layout, hidden)}
        testID={testID ? `${testID}-bar` : undefined}
      />
      <View style={styles.footer}>
        {isOver ? (
          <View style={styles.overWrap}>
            <Icon name="alert" size={16} color={MonoColors.negative} />
            <Text style={styles.overText}>{overBy(shown(rp(figures.overBy), hidden))}</Text>
          </View>
        ) : layout === 'month' ? (
          <Text style={styles.usedStrong}>{usedText}</Text>
        ) : (
          <Text style={styles.meta}>{budgetLeftLabel(remainingText)}</Text>
        )}
        {isOver || layout === 'category' ? (
          <Text style={styles.meta}>{usedText}</Text>
        ) : (
          <Text style={styles.meta}>{budgetRemainingLabel(remainingText)}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Wraps instead of truncating at 200% text: the right-hand figure drops to its own line.
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', columnGap: 12, rowGap: 2, marginTop: 8 },
  overWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  overText: { ...MonoText.bodyS, fontFamily: MonoText.bodyStrong.fontFamily, color: MonoColors.negative, flexShrink: 1 },
  usedStrong: { ...MonoText.bodyS, fontFamily: MonoText.bodyStrong.fontFamily, color: MonoColors.text },
  meta: { ...MonoText.bodyS, color: MonoColors.textSecond },
});

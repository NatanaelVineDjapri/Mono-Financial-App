// The savings budget on the Budgets tab: one monthly target, and how much of the shown month's
// income is left after its expenses (src/domain/savings.ts). Going past 100% is good news, so the
// bar stops at full with no striped overflow. Red marks only a month that spent more than it earned.
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { Button } from '@/components/Button';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { ProgressBar } from '@/components/ProgressBar';
import { pct, rp, shown } from '@/core/money';
import { useSavingsStatus } from '@/features/budgets/useSavings';
import {
  savingsA11y,
  savingsEditLabel,
  savingsOfTarget,
  savingsPrompt,
  savingsReached,
  savingsSetButton,
  savingsShort,
  savingsTitle,
  savingsToGo,
} from '@/i18n';
import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export function SavingsCard({ month }: { month: string }) {
  const router = useRouter();
  const hidden = useHideAmounts(state => state.hidden);
  const { data } = useSavingsStatus(month);
  if (!data) return null;

  const openTarget = () => router.push('/budget/savings' as never);
  const { target, saved, remaining, progressBp } = data;
  const money = (value: number) => shown(rp(value), hidden);

  if (target === null) {
    return (
      <View style={[styles.card, styles.prompt]} testID="savings-card">
        <Text style={styles.capLabel} accessibilityRole="header">
          {savingsTitle()}
        </Text>
        <Text style={styles.body}>{savingsPrompt()}</Text>
        <Button label={savingsSetButton()} variant="secondary" onPress={openTarget} testID="savings-set" />
      </View>
    );
  }

  const short = saved < 0;
  return (
    <View style={styles.card} testID="savings-card">
      <View style={styles.top}>
        <Text style={[styles.capLabel, styles.title]} accessibilityRole="header">
          {savingsTitle()}
        </Text>
        <IconButton label={savingsEditLabel()} onPress={openTarget} testID="savings-edit">
          <Icon name="pencil" size={20} color={MonoColors.text} />
        </IconButton>
      </View>
      <View style={styles.figures}>
        <Amount value={saved} sign kind={saved > 0 ? 'income' : short ? 'expense' : undefined} variant="figureL" testID="savings-saved" />
        <Text style={styles.meta}>{savingsOfTarget(money(target))}</Text>
      </View>
      <ProgressBar
        valueBp={progressBp}
        label={savingsTitle()}
        accessibilityLabel={savingsA11y(money(saved), money(target), pct(progressBp))}
        thick
        capAtFull
        testID="savings-bar"
      />
      <View style={styles.status} testID="savings-status">
        {short && <Icon name="alert" size={16} color={MonoColors.negative} />}
        <Text style={[styles.statusText, short && styles.statusShort]}>
          {short ? savingsShort(money(-saved)) : remaining > 0 ? savingsToGo(money(remaining)) : savingsReached()}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: MonoColors.card, borderRadius: radius.md, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  prompt: { paddingTop: 16, gap: 12 },
  // The edit button's own 44 box sits flush with the card's edge, its icon in line with the content.
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, marginRight: -12 },
  title: { flex: 1 },
  capLabel: { ...MonoText.label, color: MonoColors.textMeta, textTransform: 'uppercase' },
  body: { ...MonoText.body, color: MonoColors.textSecond },
  figures: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 8, marginBottom: 12 },
  meta: { ...MonoText.bodyS, color: MonoColors.textSecond },
  status: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8 },
  statusText: { ...MonoText.bodyS, color: MonoColors.textSecond, flexShrink: 1 },
  statusShort: { color: MonoColors.negative },
});

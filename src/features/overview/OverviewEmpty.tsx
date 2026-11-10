// Overview-Empty (PAGES.md A2): same header, the wave hero with Rp0, the four setup steps
// (each a link to its screen) and the private-by-design note. No charts and no cards.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { Icon, type IconName } from '@/components/Icon';
import {
  addAccountStepLabel,
  addTransactionStepLabel,
  createBackupStepLabel,
  overviewEmptyMessage,
  privacyByDesignNote,
  setBudgetStepLabel,
  setUpInFourStepsLabel,
  stepsDoneLabel,
} from '@/i18n/id';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { HeroSection } from './HeroSection';

export interface OverviewEmptyProps {
  nickname: string;
  onAddAccount: () => void;
  onAddTransaction: () => void;
  onSetBudget: () => void;
  onBackup: () => void;
}

function Step({ icon, label, onPress, testID }: { icon: IconName; label: string; onPress: () => void; testID: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.step} testID={testID}>
      <Icon name={icon} size={20} color={MonoColors.textSecond} />
      <Text style={styles.stepText}>{label}</Text>
      <Icon name="chevron-right" size={16} color={MonoColors.textSecond} />
    </Pressable>
  );
}

export function OverviewEmpty({ nickname, onAddAccount, onAddTransaction, onSetBudget, onBackup }: OverviewEmptyProps) {
  return (
    <>
      <HeroSection nickname={nickname} netWorth={0} note={overviewEmptyMessage()} />
      <Card style={styles.card} testID="overview-setup">
        <Text style={styles.title} accessibilityRole="header">
          {setUpInFourStepsLabel()}
        </Text>
        <Text style={styles.done}>{stepsDoneLabel(0, 4)}</Text>
        <View style={styles.steps}>
          <Step icon="bank" label={addAccountStepLabel()} onPress={onAddAccount} testID="overview-step-account" />
          <Step icon="receipt" label={addTransactionStepLabel()} onPress={onAddTransaction} testID="overview-step-transaction" />
          <Step icon="pie" label={setBudgetStepLabel()} onPress={onSetBudget} testID="overview-step-budget" />
          <Step icon="lock" label={createBackupStepLabel()} onPress={onBackup} testID="overview-step-backup" />
        </View>
      </Card>
      <View style={styles.footer}>
        <Icon name="lock" size={16} color={MonoColors.textMeta} />
        <Text style={styles.footerNote}>{privacyByDesignNote()}</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, gap: 8 },
  title: { ...MonoText.titleM, color: MonoColors.text },
  done: { ...MonoText.bodyS, color: MonoColors.textSecond },
  steps: { gap: 4 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 48 },
  stepText: { ...MonoText.body, color: MonoColors.text, flex: 1 },
  footer: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 16 },
  footerNote: { ...MonoText.caption, color: MonoColors.textMeta, flex: 1 },
});

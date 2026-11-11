// Overview-Empty (PAGES.md A2): below the same header and hero (Rp0, drawn by the screen),
// the four setup steps (each a link to its screen), the charts-appear note, and the
// private-by-design footer. No charts.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import {
  addAccountStepHint,
  addAccountStepLabel,
  addTransactionStepHint,
  addTransactionStepLabel,
  chartsAppearBody,
  chartsAppearTitle,
  createBackupStepHint,
  createBackupStepLabel,
  privacyByDesignNote,
  setBudgetStepHint,
  setBudgetStepLabel,
  setUpInFourStepsLabel,
  stepsDoneLabel,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export interface OverviewEmptyProps {
  onAddAccount: () => void;
  onAddTransaction: () => void;
  onSetBudget: () => void;
  onBackup: () => void;
}

function Step({
  number,
  label,
  hint,
  onPress,
  testID,
}: {
  number: number;
  label: string;
  hint: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${hint}`}
      style={styles.step}
      testID={testID}
    >
      <View style={styles.stepNumber}>
        <Text style={styles.stepNumberText}>{number}</Text>
      </View>
      <View style={styles.stepContent}>
        <Text style={styles.stepLabel}>{label}</Text>
        <Text style={styles.stepHint}>{hint}</Text>
      </View>
      <Icon name="chevron-right" size={16} color={MonoColors.textSecond} />
    </Pressable>
  );
}

export function OverviewEmpty({ onAddAccount, onAddTransaction, onSetBudget, onBackup }: OverviewEmptyProps) {
  return (
    <>
      <Card style={styles.card} testID="overview-setup">
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            {setUpInFourStepsLabel()}
          </Text>
          <Text style={styles.done}>{stepsDoneLabel(0, 4)}</Text>
        </View>
        <View style={styles.steps}>
          <Step
            number={1}
            label={addAccountStepLabel()}
            hint={addAccountStepHint()}
            onPress={onAddAccount}
            testID="overview-step-account"
          />
          <Step
            number={2}
            label={addTransactionStepLabel()}
            hint={addTransactionStepHint()}
            onPress={onAddTransaction}
            testID="overview-step-transaction"
          />
          <Step
            number={3}
            label={setBudgetStepLabel()}
            hint={setBudgetStepHint()}
            onPress={onSetBudget}
            testID="overview-step-budget"
          />
          <Step
            number={4}
            label={createBackupStepLabel()}
            hint={createBackupStepHint()}
            onPress={onBackup}
            testID="overview-step-backup"
          />
        </View>
      </Card>

      <Card style={styles.chartsCard} testID="overview-charts-note">
        <Text style={styles.chartsTitle}>{chartsAppearTitle()}</Text>
        <Text style={styles.chartsBody}>{chartsAppearBody()}</Text>
      </Card>

      <View style={styles.footer}>
        <Icon name="lock" size={16} color={MonoColors.textMeta} />
        <Text style={styles.footerNote}>{privacyByDesignNote()}</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...MonoText.titleM, color: MonoColors.text },
  done: { ...MonoText.bodyS, color: MonoColors.textSecond },
  steps: { gap: 0 },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    minHeight: 72,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: MonoColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    ...MonoText.body,
    fontWeight: '500',
    color: MonoColors.textSecond,
  },
  stepContent: { flex: 1, gap: 4 },
  stepLabel: { ...MonoText.body, fontWeight: '600', color: MonoColors.text },
  stepHint: { ...MonoText.bodyS, color: MonoColors.textSecond },
  chartsCard: {
    marginHorizontal: 16,
    gap: 12,
    backgroundColor: MonoColors.surface, // dark surface like other cards
    borderWidth: 1,
    borderColor: MonoColors.border,
  },
  chartsTitle: { ...MonoText.body, fontWeight: '600', color: MonoColors.text },
  chartsBody: { ...MonoText.bodyS, color: MonoColors.textSecond, lineHeight: 18 },
  footer: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 16 },
  footerNote: { ...MonoText.caption, color: MonoColors.textMeta, flex: 1 },
});

// "Export CSV": the two files the Reports screen makes. Both are written to the app's cache
// and handed to the system share sheet; nothing leaves the device on its own.
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import {
  reportsCsvButtonLabel,
  reportsExportBalancesAccessibility,
  reportsExportBalancesLabel,
  reportsExportBalancesSub,
  reportsExportCaption,
  reportsExportTitle,
  reportsExportTransactionsAccessibility,
  reportsExportTransactionsLabel,
  reportsExportTransactionsSub,
} from '@/i18n';
import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export type ExportKind = 'transactions' | 'balances';

export interface ExportCsvCardProps {
  busy: ExportKind | null;
  onExportTransactions: () => void;
  onExportBalances: () => void;
}

function CsvButton({
  label,
  busy,
  onPress,
  testID,
}: {
  label: string;
  busy: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={busy ? undefined : onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: busy, busy }}
      android_ripple={undefined}
      style={({ pressed }) => [styles.button, pressed && !busy && styles.buttonPressed, busy && styles.buttonBusy]}
      testID={testID}
    >
      {busy ? (
        <ActivityIndicator size="small" color={MonoColors.textSecond} />
      ) : (
        <>
          <Icon name="download" size={16} color={MonoColors.text} />
          <Text style={styles.buttonText}>{reportsCsvButtonLabel()}</Text>
        </>
      )}
    </Pressable>
  );
}

export function ExportCsvCard({ busy, onExportTransactions, onExportBalances }: ExportCsvCardProps) {
  return (
    <Card style={styles.card} testID="reports-export">
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">{reportsExportTitle()}</Text>
        <Text style={styles.caption}>{reportsExportCaption()}</Text>
      </View>

      <View style={styles.rows}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.name}>{reportsExportTransactionsLabel()}</Text>
            <Text style={styles.sub}>{reportsExportTransactionsSub()}</Text>
          </View>
          <CsvButton
            label={reportsExportTransactionsAccessibility()}
            busy={busy === 'transactions'}
            onPress={onExportTransactions}
            testID="reports-export-transactions"
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.name}>{reportsExportBalancesLabel()}</Text>
            <Text style={styles.sub}>{reportsExportBalancesSub()}</Text>
          </View>
          <CsvButton
            label={reportsExportBalancesAccessibility()}
            busy={busy === 'balances'}
            onPress={onExportBalances}
            testID="reports-export-balances"
          />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  header: { gap: 2 },
  title: { ...MonoText.titleM, color: MonoColors.text },
  caption: { ...MonoText.caption, color: MonoColors.textMeta },
  rows: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  rowText: { flex: 1, gap: 1 },
  name: { ...MonoText.bodyStrong, color: MonoColors.text },
  sub: { ...MonoText.caption, color: MonoColors.textMeta },
  divider: { height: 1, backgroundColor: MonoColors.border },
  button: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: MonoColors.border,
    backgroundColor: '#151516',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  buttonPressed: { backgroundColor: MonoColors.raised },
  buttonBusy: { opacity: 0.6 },
  buttonText: { ...MonoText.bodyStrong, fontSize: 13, color: MonoColors.text },
});

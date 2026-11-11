// The Backup status card at the top of More: where the data lives and when it was last copied.
// Three states (none, older than 30 days, recent). The warning states carry an icon AND a
// sentence; colour is never the signal, and no colour is added.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { moreBackupActionLabel, moreBackupDaysAgo, moreBackupLast, moreBackupNone, moreBackupPrivate } from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import type { BackupState } from './backupStatus';
import { IconTile } from './IconTile';

export function backupLine(state: BackupState): string {
  switch (state.kind) {
    case 'none':
      return moreBackupNone();
    case 'old':
      return moreBackupDaysAgo(state.days);
    case 'recent':
      return moreBackupLast(state.whenText);
  }
}

export interface BackupStatusCardProps {
  state: BackupState;
  onBackup: () => void;
}

export function BackupStatusCard({ state, onBackup }: BackupStatusCardProps) {
  const warn = state.kind !== 'recent';
  return (
    <Card style={styles.card} testID="backup-card">
      <IconTile icon="lock" testID="backup-lock-tile" />
      <View style={styles.text}>
        <Text style={styles.title}>{moreBackupPrivate()}</Text>
        <View style={styles.line}>
          {warn && <Icon name="alert" size={18} color={MonoColors.text} testID="backup-warning-icon" />}
          <Text style={styles.sub} testID="backup-line">
            {backupLine(state)}
          </Text>
        </View>
      </View>
      <Pressable onPress={onBackup} accessibilityRole="button" accessibilityLabel={moreBackupActionLabel()} style={styles.action} hitSlop={4} testID="backup-action">
        <Icon name="download" size={20} color={MonoColors.text} />
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  // The sides and the gap are the rows' own (16 and 14), so the text starts where the rows' text
  // does and the download icon sits where their chevrons are.
  card: { paddingVertical: 14, paddingHorizontal: 16, minHeight: 64, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 14 },
  text: { flex: 1, gap: 2 },
  title: { ...MonoText.bodyStrong, fontSize: 14, lineHeight: 20, color: MonoColors.text },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sub: { ...MonoText.caption, color: MonoColors.textMeta, flexShrink: 1 },
  action: { minHeight: 44, minWidth: 44, marginRight: -12, justifyContent: 'center', alignItems: 'center' },
});

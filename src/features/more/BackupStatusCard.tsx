// The backup status strip at the top of More (DESIGN.md section I): where the data lives and how
// old its last copy is. Three states, worked out from backup_log (backupStatus.ts):
//   none    "Belum ada cadangan", with a warning icon and a 1.5 px emphasis frame
//   recent  "Cadangan terakhir 3 hari lalu" and, when there are any, "N transaksi berubah sejak itu"
//   stale   "Cadangan terakhir 9 hari lalu", with a warning icon and the same emphasis frame
// The emphasis is a frame, an icon and words, never a colour (and not red: this is not a loss). The
// strip has two touch targets: the whole left side opens /backup, and the download button on the
// right makes a backup right now. Surface #151516, radius 20, 1 px #272728; both targets are 48 high.
// There are no amounts here, so hidden-amounts mode has nothing to hide.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { backupChangedLine, backupLastLine, backupNoneLine, backupNowLabel, backupStripLabel, backupStripTitle } from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { relativeParts, type BackupState } from './backupStatus';
import { IconTile } from './IconTile';

const FIELD_FILL = '#151516';
const BORDER = '#272728';

export interface BackupStrip {
  title: string;
  line: string;
  changed: string; // empty when there is nothing to say
  warn: boolean;
}

// The words of the strip for a state: one place, so the screen and its accessibility label agree.
export function backupStrip(state: BackupState): BackupStrip {
  const title = backupStripTitle();
  if (state.kind === 'none') return { title, line: backupNoneLine(), changed: '', warn: true };
  const { unit, n } = relativeParts(state.days);
  return {
    title,
    line: backupLastLine(unit, n),
    changed: state.kind === 'recent' && state.changed > 0 ? backupChangedLine(state.changed) : '',
    warn: state.kind === 'stale',
  };
}

export interface BackupStatusCardProps {
  state: BackupState;
  onOpen: () => void; // the strip itself: opens /backup
  onDownload: () => void; // right-side button: creates a backup immediately
  downloadBusy?: boolean;
}

export function BackupStatusCard({ state, onOpen, onDownload, downloadBusy = false }: BackupStatusCardProps) {
  const strip = backupStrip(state);
  const emphasised = state.kind !== 'recent';
  return (
    <View style={[styles.card, emphasised && styles.emphasis]} testID="backup-card">
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={backupStripLabel(strip.title, strip.line, strip.changed)}
        android_ripple={undefined}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
        testID="backup-open"
      >
        <IconTile icon="lock" testID="backup-lock-tile" />
        <View style={styles.text}>
          <Text style={styles.title}>{strip.title}</Text>
          <View style={styles.line}>
            {strip.warn && <Icon name="alert" size={18} color={MonoColors.text} testID="backup-warning-icon" />}
            <Text style={styles.sub} testID="backup-line">
              {strip.line}
            </Text>
          </View>
          {!!strip.changed && (
            <Text style={styles.sub} testID="backup-changed">
              {strip.changed}
            </Text>
          )}
        </View>
      </Pressable>

      <Pressable
        onPress={downloadBusy ? undefined : onDownload}
        disabled={downloadBusy}
        accessibilityRole="button"
        accessibilityLabel={backupNowLabel()}
        accessibilityState={{ disabled: downloadBusy, busy: downloadBusy }}
        android_ripple={undefined}
        hitSlop={4}
        style={({ pressed }) => [styles.download, pressed && styles.pressed]}
        testID="backup-download"
      >
        <Icon name="download" size={20} color={MonoColors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: FIELD_FILL, borderColor: BORDER, borderWidth: 1, borderRadius: 20, minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 8 },
  // A 1.5 px #737373 frame, 0.5 px thicker than the resting one: the card's inside does not move.
  emphasis: { borderColor: MonoColors.textDisabled, borderWidth: 1.5 },
  main: { flex: 1, minHeight: 48, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 14 },
  pressed: { opacity: 0.85 },
  text: { flex: 1, gap: 2 },
  title: { ...MonoText.bodyStrong, fontSize: 14, lineHeight: 20, color: MonoColors.text },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sub: { ...MonoText.caption, color: MonoColors.textMeta, flexShrink: 1 },
  download: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});

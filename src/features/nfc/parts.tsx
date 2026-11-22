// The pieces the three card-scan boards share (Nfc-Tap, Nfc-Emoney-Result, Nfc-New-Account, Nfc-States): the screen header,
// the card header with the contactless mark, the centred balance, the rounded box of rows, the note with the info icon,
// and the bar of buttons at the bottom. Plain props; money passes through Amount, so Hide amounts applies everywhere.
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Amount } from '@/components/Amount';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { ISSUER_NAMES, type CardIssuer } from '@/domain/cards/types';
import { closeLabel, nfcBalanceOnCard, nfcCardKind } from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export const FIELD_BORDER = '#272728';

export function NfcHeader({ title, onClose, testID }: { title: string; onClose: () => void; testID: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <IconButton label={closeLabel()} onPress={onClose} testID={testID}>
        <Icon name="close" color={MonoColors.text} />
      </IconButton>
      <Text style={styles.headerTitle} accessibilityRole="header">
        {title}
      </Text>
    </View>
  );
}

// "Kartu e-money" over the issuer's name, the contactless mark at the right.
export function CardHeader({ issuer }: { issuer: CardIssuer }) {
  return (
    <View style={styles.cardHeader} accessible accessibilityLabel={`${nfcCardKind()}, ${ISSUER_NAMES[issuer]}`}>
      <View style={styles.cardHeaderText}>
        <Text style={styles.caption}>{nfcCardKind()}</Text>
        <Text style={styles.issuer}>{ISSUER_NAMES[issuer]}</Text>
      </View>
      <Icon name="nfc" size={22} color={MonoColors.textSecond} />
    </View>
  );
}

// "SALDO DI KARTU" and the amount, centred, with an optional line under it (when the card was read).
export function BalanceBlock({ value, caption, testID, captionTestID }: { value: number; caption?: string; testID: string; captionTestID?: string }) {
  return (
    <View style={styles.balanceBlock}>
      <Text style={styles.balanceLabel}>{nfcBalanceOnCard()}</Text>
      <Amount value={value} variant="heroBalance" style={styles.balance} testID={testID} />
      {!!caption && (
        <Text style={styles.caption} testID={captionTestID}>
          {caption}
        </Text>
      )}
    </View>
  );
}

export function RowsBox({ children }: { children: ReactNode }) {
  return <View style={styles.rowsBox}>{children}</View>;
}

// A label at the left, the value at the right (bold), an optional small line under the value.
export function Row({ label, caption, children, last = false }: { label: string; caption?: string; children: ReactNode; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowDivider]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowValue}>
        {children}
        {!!caption && <Text style={[styles.caption, styles.rowCaption]}>{caption}</Text>}
      </View>
    </View>
  );
}

export function InfoNote({ text, testID }: { text: string; testID?: string }) {
  return (
    <View style={styles.note} testID={testID}>
      <Icon name="info" size={16} color={MonoColors.textSecond} />
      <Text style={styles.noteText}>{text}</Text>
    </View>
  );
}

// The buttons at the bottom of the screen, with an error line above them when there is one.
export function BottomBar({ error, errorTestID, children }: { error?: string | null; errorTestID?: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: 16 + insets.bottom }]}>
      {!!error && (
        <Text style={styles.error} accessibilityLiveRegion="polite" testID={errorTestID}>
          {error}
        </Text>
      )}
      {children}
    </View>
  );
}

export const nfcStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16, gap: 14 },
});

const styles = StyleSheet.create({
  header: { paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 56 },
  headerTitle: { ...MonoText.titleM, color: MonoColors.text, flex: 1 },
  caption: { ...MonoText.caption, color: MonoColors.textMeta },

  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: MonoColors.card, borderRadius: 16, padding: 16 },
  cardHeaderText: { flex: 1, gap: 2 },
  issuer: { ...MonoText.bodyStrong, color: MonoColors.text },

  balanceBlock: { alignItems: 'center', gap: 6, paddingVertical: 8 },
  balanceLabel: { ...MonoText.label, color: MonoColors.textMeta, textTransform: 'uppercase', textAlign: 'center' },
  balance: { color: MonoColors.text, textAlign: 'center' },

  rowsBox: { backgroundColor: MonoColors.card, borderRadius: 16, paddingHorizontal: 16 },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: FIELD_BORDER },
  rowLabel: { ...MonoText.bodyS, color: MonoColors.textMeta, width: 96 },
  rowValue: { flex: 1, alignItems: 'flex-end' },
  rowCaption: { textAlign: 'right' },

  note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderWidth: 1, borderColor: FIELD_BORDER, borderRadius: 12, padding: 12 },
  noteText: { ...MonoText.bodyS, color: MonoColors.textSecond, flex: 1 },

  bar: { paddingTop: 12, paddingHorizontal: 16, gap: 8, borderTopWidth: 1, borderTopColor: FIELD_BORDER, backgroundColor: MonoColors.bg },
  error: { ...MonoText.bodyS, color: MonoColors.negative },
});

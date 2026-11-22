// Saldo kartu terbaca (board Nfc-Emoney-Result): the card balance against the balance of the linked account, the
// difference, and the one button that records it as a normal transaction. Nothing is recorded until that button is
// tapped, and a balance is never changed directly. Plain props in, callbacks out.
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { Button } from '@/components/Button';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { ADJUSTMENT_CATEGORY_NAME } from '@/core/cardAdjustment';
import { formatShortDate, formatTimeWib } from '@/core/date';
import { rp, shown } from '@/core/money';
import type { AdjustmentPreview } from '@/domain/cards/adjustment';
import { ISSUER_STATUS, type CardInfo } from '@/domain/cards/types';
import { getLanguage } from '@/i18n/lang';
import {
  importAccountLabel,
  importCategoryLabel,
  nfcAccountLine,
  nfcBalanceInApp,
  nfcDifference,
  nfcDone,
  nfcEstimatedNote,
  nfcExperimentalNote,
  nfcExplain,
  nfcReadAt,
  nfcRecordButton,
  nfcResultTitle,
  nfcSameBalance,
  nfcSkip,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { BalanceBlock, BottomBar, CardHeader, InfoNote, NfcHeader, Row, RowsBox, nfcStyles } from './parts';

export interface ResultViewProps {
  card: CardInfo;
  accountName: string;
  preview: AdjustmentPreview;
  busy: boolean;
  error: string | null;
  onRecord: () => void;
  onSkip: () => void; // the Skip button, and Done when the balances are equal
  onClose: () => void;
}

// 14.49 in Indonesian, 14:49 in English.
function readTime(iso: string): string {
  const time = formatTimeWib(iso);
  return getLanguage() === 'id' ? time.replace(':', '.') : time;
}

export function ResultView({ card, accountName, preview, busy, error, onRecord, onSkip, onClose }: ResultViewProps) {
  const hidden = useHideAmounts(s => s.hidden);
  const same = preview.action === 'none';
  const kind = preview.action === 'income' ? 'income' : 'expense';

  return (
    <View style={nfcStyles.screen} testID="nfc-result">
      <NfcHeader title={nfcResultTitle()} onClose={onClose} testID="nfc-result-close" />

      <ScrollView contentContainerStyle={nfcStyles.content}>
        <CardHeader issuer={card.issuer} />
        <BalanceBlock
          value={card.balance}
          caption={nfcReadAt(formatShortDate(card.readAt.slice(0, 10)), readTime(card.readAt))}
          testID="nfc-card-balance"
          captionTestID="nfc-read-at"
        />

        {ISSUER_STATUS[card.issuer] === 'experimental' && <InfoNote text={nfcExperimentalNote()} testID="nfc-experimental-note" />}
        {card.estimated && <InfoNote text={nfcEstimatedNote()} testID="nfc-estimated-note" />}

        <RowsBox>
          <Row label={nfcBalanceInApp()}>
            <Amount value={preview.appBalance} variant="bodyStrong" style={styles.value} testID="nfc-app-balance" />
          </Row>
          <Row label={nfcDifference()}>
            {same ? (
              <Amount value={0} variant="bodyStrong" style={styles.value} testID="nfc-diff" />
            ) : (
              <Amount value={preview.diff} sign kind={kind} variant="bodyStrong" testID="nfc-diff" />
            )}
          </Row>
          <Row label={importAccountLabel()} last={same}>
            <Text style={styles.value} testID="nfc-account">
              {nfcAccountLine(accountName, card.last4)}
            </Text>
          </Row>
          {!same && (
            <Row label={importCategoryLabel()} last>
              <Text style={styles.value} testID="nfc-category">
                {ADJUSTMENT_CATEGORY_NAME}
              </Text>
            </Row>
          )}
        </RowsBox>

        {same ? <InfoNote text={nfcSameBalance()} testID="nfc-same" /> : <InfoNote text={nfcExplain(kind, ADJUSTMENT_CATEGORY_NAME)} testID="nfc-explain" />}
      </ScrollView>

      <BottomBar error={error} errorTestID="nfc-result-error">
        {same ? (
          <Button label={nfcDone()} onPress={onSkip} testID="nfc-done" />
        ) : (
          <>
            <Button label={nfcRecordButton(shown(rp(preview.diff, true), hidden))} onPress={onRecord} disabled={busy} testID="nfc-record" />
            <Button label={nfcSkip()} variant="secondary" onPress={onSkip} disabled={busy} testID="nfc-skip" />
          </>
        )}
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  value: { ...MonoText.bodyStrong, color: MonoColors.text, textAlign: 'right' },
});

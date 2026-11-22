// Kartu baru (board Nfc-New-Account): a card that no account has yet. It can start a new e-money account (named, with
// the balance of the card as its opening balance, which may be changed) or be linked to an e-wallet account that
// already exists. Only the last 4 digits and a fingerprint of the number are kept, and the screen says so. Plain props in,
// callbacks out; nothing is made until a button is tapped.
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import { SheetHeader } from '@/components/SheetHeader';
import { rp } from '@/core/money';
import type { LinkableAccount } from '@/data/repo/cardLinks';
import { ISSUER_NAMES, type CardInfo } from '@/domain/cards/types';
import { parseDigits } from '@/features/transactions/form/formParts';
import {
  closeLabel,
  nfcAccountName,
  nfcCardNumber,
  nfcCardNumberMasked,
  nfcCardNumberNote,
  nfcCreateAccount,
  nfcLinkExisting,
  nfcNewExplain,
  nfcNewTitle,
  nfcOpeningBalance,
  nfcOpeningBalanceNote,
  nfcPickerEmpty,
  nfcPickerTitle,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { BalanceBlock, BottomBar, CardHeader, FIELD_BORDER, InfoNote, NfcHeader, Row, RowsBox, nfcStyles } from './parts';

export interface NewCardViewProps {
  card: CardInfo;
  defaultName: string;
  linkable: LinkableAccount[];
  busy: boolean;
  error: string | null;
  onCreate: (name: string, openingBalance: number) => void;
  onLink: (accountId: number) => void;
  onClose: () => void;
}

export function NewCardView({ card, defaultName, linkable, busy, error, onCreate, onLink, onClose }: NewCardViewProps) {
  const [name, setName] = useState(defaultName);
  const [balance, setBalance] = useState(card.balance);
  const [picker, setPicker] = useState(false);

  return (
    <KeyboardAvoidingView style={nfcStyles.screen} behavior="padding" testID="nfc-new">
      <NfcHeader title={nfcNewTitle()} onClose={onClose} testID="nfc-new-close" />

      <ScrollView contentContainerStyle={nfcStyles.content} keyboardShouldPersistTaps="handled">
        <CardHeader issuer={card.issuer} />
        <BalanceBlock value={card.balance} testID="nfc-new-card-balance" />

        <RowsBox>
          <Row label={nfcAccountName()}>
            <TextInput
              value={name}
              onChangeText={setName}
              maxLength={40}
              placeholderTextColor={MonoColors.textDisabled}
              selectionColor={MonoColors.text}
              accessibilityLabel={nfcAccountName()}
              style={styles.nameInput}
              testID="nfc-new-name"
            />
          </Row>
          <Row label={nfcCardNumber()} caption={nfcCardNumberNote()}>
            <Text style={styles.value} accessibilityLabel={`${nfcCardNumber()} ${nfcCardNumberMasked(card.last4)}`} testID="nfc-new-last4">
              {nfcCardNumberMasked(card.last4)}
            </Text>
          </Row>
          <Row label={nfcOpeningBalance()} caption={nfcOpeningBalanceNote()} last>
            <View style={styles.amountRow}>
              <Text style={styles.rp}>Rp</Text>
              <TextInput
                value={balance ? String(balance) : ''}
                onChangeText={text => setBalance(parseDigits(text))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={MonoColors.textDisabled}
                selectionColor={MonoColors.text}
                accessibilityLabel={nfcOpeningBalance()}
                style={styles.amountInput}
                testID="nfc-new-balance"
              />
            </View>
          </Row>
        </RowsBox>

        <InfoNote text={nfcNewExplain()} />
      </ScrollView>

      <BottomBar error={error} errorTestID="nfc-new-error">
        <Button label={nfcCreateAccount()} onPress={() => onCreate(name, balance)} disabled={busy} testID="nfc-new-create" />
        <Button label={nfcLinkExisting()} variant="secondary" onPress={() => setPicker(true)} disabled={busy} testID="nfc-new-link" />
      </BottomBar>

      <Sheet visible={picker} onClose={() => setPicker(false)} closeLabel={closeLabel()} testID="nfc-picker">
        <SheetHeader visible={picker} icon="wallet" title={nfcPickerTitle()} subtitle={`${ISSUER_NAMES[card.issuer]} •••• ${card.last4}`} onClose={() => setPicker(false)} />
        {linkable.length === 0 ? (
          <Text style={styles.empty} testID="nfc-picker-empty">
            {nfcPickerEmpty()}
          </Text>
        ) : (
          <View style={styles.list}>
            {linkable.map(account => (
              <Pressable
                key={account.id}
                onPress={() => {
                  setPicker(false);
                  onLink(account.id);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${account.name} ${rp(account.balance)}`}
                style={({ pressed }) => [styles.pickRow, pressed && styles.pressed]}
                testID={`nfc-pick-${account.id}`}
              >
                <Text style={styles.pickName}>{account.name}</Text>
                <Amount value={account.balance} variant="figureRow" />
              </Pressable>
            ))}
          </View>
        )}
      </Sheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  value: { ...MonoText.bodyStrong, color: MonoColors.text, textAlign: 'right' },
  nameInput: { ...MonoText.bodyStrong, color: MonoColors.text, textAlign: 'right', alignSelf: 'stretch', padding: 0, minHeight: 32 },
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, alignSelf: 'stretch' },
  rp: { ...MonoText.bodyStrong, color: MonoColors.textSecond },
  amountInput: { ...MonoText.bodyStrong, color: MonoColors.text, textAlign: 'right', padding: 0, minHeight: 32, minWidth: 80, flexShrink: 1 },
  list: { paddingHorizontal: 16, paddingBottom: 16 },
  pickRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: FIELD_BORDER },
  pickName: { ...MonoText.body, color: MonoColors.text, flex: 1 },
  pressed: { opacity: 0.85 },
  empty: { ...MonoText.body, color: MonoColors.textSecond, paddingHorizontal: 16, paddingBottom: 24 },
});

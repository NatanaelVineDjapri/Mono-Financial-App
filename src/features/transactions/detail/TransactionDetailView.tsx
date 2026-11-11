// The body of Transaction detail (Tx-Detail, Tx-Detail-Transfer, Tx-Detail-Valas): the hero
// card, the details card(s) and the budget card. Pure presentation of a TxDetail from
// src/domain/transactionDetail.ts: every figure arrives read from the views, and every
// currency figure passes <Amount> or shown() (hidden-amounts mode, CLAUDE.md rule 12).
//
// Colour follows the sign: an expense is red with a true minus, income uses `positive` with
// a plus, a transfer is neutral with no sign (DESIGN.md section 6). The bank tiles keep the
// bank's own colour; amounts next to them never turn green or red except the From / To
// nominals the board colours (the From side red, the To side neutral).
import type { ReactNode } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { BANK_TILE_SIZE, BankTile } from '@/components/BankCard';
import { Card } from '@/components/Card';
import { CategoryTile } from '@/components/CategoryTile';
import { Icon, type IconName } from '@/components/Icon';
import { ProgressBar } from '@/components/ProgressBar';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { formatShortDate, formatTimeWib, monthShortLabel } from '@/core/date';
import { currencySymbol, money, pct, rateRp, rp, shown, shownPct } from '@/core/money';
import type { TxDetail, TxDetailAccount } from '@/domain/transactionDetail';
import {
  afterLabel,
  balanceAfterLabel,
  categoryLabel,
  noNoteLabel,
  pocketAfterLabel,
  rateEquals,
  rateFixedNote,
  rupiahAtTheTime,
  transferExplainer,
  txBudgetCardTitle,
  txBudgetOfLimit,
  txBudgetPartNote,
  txCategoryDateLine,
  txDateTimeLine,
  txDetailAccountLabel,
  txDetailCurrencyLabel,
  txDetailDateLabel,
  txDetailFromLabel,
  txDetailHeroAccessibilityLabel,
  txDetailNotesLabel,
  txDetailRateUsedLabel,
  txDetailRupiahValueLabel,
  txDetailSourceLabel,
  txDetailToLabel,
  txKindLabel,
  txSourceName,
} from '@/i18n/id';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

const DIVIDER = '#272728';
const LABEL_WIDTH = 92;

// The tile's icon: the seeded Food & drink category has its own (fork and knife); every other
// category falls back to its kind's generic one until per-category icons exist.
function kindIcon(detail: TxDetail): IconName {
  if (detail.kind === 'transfer') return 'transfer';
  if (detail.category?.name === 'Food & drink') return 'food';
  return detail.kind === 'income' ? 'wallet' : 'receipt';
}

// The record's own title: its description, else its category, else the kind.
export function detailTitle(detail: TxDetail): string {
  return detail.description.trim() || detail.category?.name || txKindLabel(detail.kind);
}

function format(value: number, currency: string, minorFactor: number, sign = false): string {
  return currency === 'IDR' ? rp(value, sign) : money(value, currency, minorFactor, sign);
}

// "Cash flow" of the amount as the hero shows it: expense negative, income positive.
function signedHeroAmount(detail: TxDetail): { value: number; sign: boolean } {
  if (detail.kind === 'expense') return { value: -detail.amount, sign: true };
  if (detail.kind === 'income') return { value: detail.amount, sign: true };
  return { value: detail.amount, sign: false };
}

// ---------------------------------------------------------------- hero

export function HeroCard({ detail }: { detail: TxDetail }) {
  const hidden = useHideAmounts(s => s.hidden);
  const title = detailTitle(detail);
  const dateText = formatShortDate(detail.occurredOn);
  const subtitle = txCategoryDateLine(detail.category?.name ?? txKindLabel(detail.kind), dateText);
  const { value, sign } = signedHeroAmount(detail);
  const foreign = detail.currency !== 'IDR' && detail.kind !== 'transfer';
  const rateText = detail.rateE4 != null ? rateEquals(currencySymbol(detail.currency), rateRp(detail.rateE4)) : null;
  const amountFormatted = shown(format(value, detail.currency, detail.minorFactor, sign), hidden);

  return (
    <Card
      style={styles.hero}
      accessible
      accessibilityLabel={txDetailHeroAccessibilityLabel(title, txKindLabel(detail.kind), subtitle, amountFormatted)}
      testID="tx-detail-hero"
    >
      <View style={styles.heroHead}>
        <CategoryTile icon={kindIcon(detail)} testID="tx-detail-tile" />
        <View style={styles.heroTitles}>
          <Text style={styles.heroTitle}>{title}</Text>
          <Text style={styles.heroSubtitle}>{subtitle}</Text>
        </View>
        <View style={styles.tag}>
          <Text style={styles.tagText}>{txKindLabel(detail.kind)}</Text>
        </View>
      </View>

      <Amount
        value={value}
        currency={detail.currency}
        minorFactor={detail.minorFactor}
        sign={sign}
        kind={detail.kind === 'transfer' ? undefined : detail.kind}
        variant="heroBalance"
        style={styles.heroAmount}
        testID="tx-detail-amount"
      />

      {detail.kind === 'transfer' && <Text style={styles.heroNote}>{transferExplainer()}</Text>}
      {foreign && rateText && (
        <Text style={styles.heroNote} testID="tx-detail-rupiah-line">
          {rupiahAtTheTime(shown(rp(detail.amountIdr), hidden), rateText)}
        </Text>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- details rows

function DetailRow({ label, children, last = false, testID }: { label: string; children: ReactNode; last?: boolean; testID?: string }) {
  return (
    <View style={[styles.row, !last && styles.rowDivider]} testID={testID}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowValue}>{children}</View>
    </View>
  );
}

function ValueText({ children, muted = false }: { children: string; muted?: boolean }) {
  return <Text style={[styles.valueText, muted && styles.valueMuted]}>{children}</Text>;
}

// The Account row: the name and the balance after, right-aligned, with no icon beside them.
function AccountValue({ account, balanceText }: { account: TxDetailAccount; balanceText: string }) {
  return (
    <View style={styles.accountText}>
      <Text style={[styles.valueText, styles.accountName]}>{account.name}</Text>
      <Text style={styles.valueCaption}>{balanceText}</Text>
    </View>
  );
}

function dateTimeText(detail: TxDetail): string {
  return txDateTimeLine(formatShortDate(detail.occurredOn), formatTimeWib(detail.recordedAt));
}

function NotesValue({ note }: { note: string | null }) {
  const has = !!note && note.trim() !== '';
  return has ? <Text style={[styles.valueText, styles.notesText]}>{note}</Text> : <ValueText muted>{noNoteLabel()}</ValueText>;
}

export function DetailsCard({ detail }: { detail: TxDetail }) {
  const hidden = useHideAmounts(s => s.hidden);
  const foreign = detail.currency !== 'IDR';
  const { account } = detail;
  const balanceText = foreign
    ? pocketAfterLabel(currencySymbol(account.currency), shown(format(account.balanceAfter, account.currency, account.minorFactor), hidden))
    : balanceAfterLabel(shown(rp(account.balanceAfter), hidden));

  return (
    <Card style={styles.rows} testID="tx-detail-rows">
      <DetailRow label={txDetailAccountLabel()} testID="tx-detail-account">
        <AccountValue account={account} balanceText={balanceText} />
      </DetailRow>

      {foreign && (
        <>
          <DetailRow label={txDetailCurrencyLabel()}>
            <ValueText>{detail.currency}</ValueText>
          </DetailRow>
          <DetailRow label={txDetailRupiahValueLabel()}>
            <ValueText>{shown(rp(detail.amountIdr), hidden)}</ValueText>
          </DetailRow>
          {detail.rateE4 != null && (
            <DetailRow label={txDetailRateUsedLabel()}>
              <ValueText>{`${rateEquals(currencySymbol(detail.currency), rateRp(detail.rateE4))} · ${formatShortDate(detail.occurredOn)}`}</ValueText>
            </DetailRow>
          )}
        </>
      )}

      <DetailRow label={txDetailDateLabel()}>
        <ValueText>{dateTimeText(detail)}</ValueText>
      </DetailRow>
      <DetailRow label={categoryLabel()}>
        <ValueText>{detail.category?.name ?? ''}</ValueText>
      </DetailRow>
      <DetailRow label={txDetailSourceLabel()}>
        <ValueText>{txSourceName(detail.source)}</ValueText>
      </DetailRow>
      <DetailRow label={txDetailNotesLabel()} last>
        <NotesValue note={detail.note} />
      </DetailRow>
    </Card>
  );
}

// Tx-Detail-Valas: the rupiah value is fixed at recording, so a later rate never rewrites it.
export function RateFixedNote() {
  return (
    <View style={styles.infoBox} testID="tx-detail-rate-note">
      <Icon name="lock" size={16} color={MonoColors.textMeta} />
      <Text style={styles.infoText}>{rateFixedNote()}</Text>
    </View>
  );
}

// ---------------------------------------------------------------- transfer

function TransferSide({
  label,
  account,
  amount,
  sign,
  afterText,
  tone,
}: {
  label: string;
  account: TxDetailAccount;
  amount: number;
  sign: boolean;
  afterText: string;
  tone: 'negative' | 'neutral';
}) {
  return (
    <View style={styles.sideRow} accessible accessibilityLabel={`${label} ${account.name}, ${afterText}`}>
      <BankTile icon={account.icon} type={account.type} testID="tx-detail-bank-tile" />
      <View style={styles.sideText}>
        <Text style={styles.sideLabel}>{label}</Text>
        <Text style={styles.sideName}>{account.name}</Text>
      </View>
      <View style={styles.sideAmount}>
        <Amount
          value={sign ? -amount : amount}
          currency={account.currency}
          minorFactor={account.minorFactor}
          sign
          kind={tone === 'negative' ? 'expense' : undefined}
          variant="figureRow"
        />
        <Text style={styles.valueCaption}>{afterText}</Text>
      </View>
    </View>
  );
}

export function TransferCard({ detail }: { detail: TxDetail }) {
  const hidden = useHideAmounts(s => s.hidden);
  const { account, toAccount } = detail;
  if (!toAccount || detail.amountTo == null) return null;
  const after = (a: TxDetailAccount) => afterLabel(shown(format(a.balanceAfter, a.currency, a.minorFactor), hidden));

  return (
    <Card style={styles.transfer} testID="tx-detail-transfer">
      <TransferSide label={txDetailFromLabel()} account={account} amount={detail.amount} sign tone="negative" afterText={after(account)} />
      <View style={styles.arrowRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Icon name="arrow-down" size={16} color={MonoColors.textMeta} />
      </View>
      <TransferSide label={txDetailToLabel()} account={toAccount} amount={detail.amountTo} sign={false} tone="neutral" afterText={after(toAccount)} />
    </Card>
  );
}

export function TransferRowsCard({ detail }: { detail: TxDetail }) {
  return (
    <Card style={styles.rows} testID="tx-detail-rows">
      <DetailRow label={txDetailDateLabel()}>
        <ValueText>{dateTimeText(detail)}</ValueText>
      </DetailRow>
      <DetailRow label={txDetailSourceLabel()}>
        <ValueText>{txSourceName(detail.source)}</ValueText>
      </DetailRow>
      <DetailRow label={txDetailNotesLabel()} last>
        <NotesValue note={detail.note} />
      </DetailRow>
    </Card>
  );
}

// ---------------------------------------------------------------- budget

export function BudgetCard({ detail }: { detail: TxDetail }) {
  const hidden = useHideAmounts(s => s.hidden);
  const { width } = useWindowDimensions();
  const budget = detail.budget;
  if (!budget) return null;
  const title = txBudgetCardTitle(budget.categoryName);
  const of = txBudgetOfLimit(shown(rp(budget.limit), hidden), shownPct(pct(budget.usedBp), hidden));
  // The month label is a short caption on the right; on a narrow screen it wraps below.
  const wrap = width < 340;

  return (
    <Card style={styles.budget} testID="tx-detail-budget">
      <View style={[styles.budgetHead, wrap && styles.budgetHeadWrap]}>
        <Text style={styles.budgetTitle} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.budgetMonth}>{monthShortLabel(budget.month)}</Text>
      </View>
      <ProgressBar
        valueBp={budget.usedBp}
        label={title}
        overAmount={budget.isOver ? budget.overBy : undefined}
        accessibilityLabel={`${title}, ${shown(rp(budget.spent), hidden)} ${of}`}
      />
      <View style={styles.budgetFigures}>
        <Amount value={budget.spent} variant="figureS" />
        <Text style={styles.budgetOf}>{of}</Text>
      </View>
      <Text style={styles.budgetNote}>{txBudgetPartNote()}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  hero: { padding: 20, gap: 12 },
  heroHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroTitles: { flex: 1, gap: 2 },
  heroTitle: { fontFamily: MonoText.titleM.fontFamily, fontSize: 18, lineHeight: 24, color: MonoColors.text },
  heroSubtitle: { ...MonoText.caption, color: MonoColors.textMeta },
  tag: { minHeight: 28, borderRadius: 14, borderWidth: 1, borderColor: DIVIDER, paddingHorizontal: 10, justifyContent: 'center', alignSelf: 'flex-start' },
  tagText: { ...MonoText.caption, color: MonoColors.textSecond },
  heroAmount: { letterSpacing: -0.8 },
  heroNote: { ...MonoText.caption, color: MonoColors.textMeta },

  rows: { padding: 0, overflow: 'hidden' },
  row: { minHeight: 56, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: DIVIDER },
  rowLabel: { ...MonoText.bodyS, color: MonoColors.textMeta, width: LABEL_WIDTH },
  rowValue: { flex: 1, alignItems: 'flex-end' },
  valueText: { fontFamily: MonoText.figureRow.fontFamily, fontSize: 14, lineHeight: 20, color: MonoColors.text, textAlign: 'right' },
  valueMuted: { color: MonoColors.textMeta },
  notesText: { color: MonoColors.textSecond },
  valueCaption: { ...MonoText.caption, color: MonoColors.textMeta, textAlign: 'right' },
  accountText: { alignItems: 'flex-end' },
  accountName: { fontFamily: MonoText.bodyStrong.fontFamily },

  infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 16, borderRadius: 16, backgroundColor: MonoColors.surface },
  infoText: { ...MonoText.bodyS, color: MonoColors.textSecond, flex: 1 },

  transfer: { gap: 4 },
  sideRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12 },
  sideText: { flex: 1 },
  sideLabel: { ...MonoText.label, color: MonoColors.textMeta },
  sideName: { fontFamily: MonoText.bodyStrong.fontFamily, fontSize: 14, lineHeight: 20, color: MonoColors.text },
  sideAmount: { alignItems: 'flex-end' },
  arrowRow: { width: BANK_TILE_SIZE, alignItems: 'center' },

  budget: { gap: 12 },
  budgetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  budgetHeadWrap: { flexWrap: 'wrap' },
  budgetTitle: { ...MonoText.label, color: MonoColors.textMeta, textTransform: 'uppercase', flexShrink: 1 },
  budgetMonth: { ...MonoText.caption, color: MonoColors.textMeta },
  budgetFigures: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 8 },
  budgetOf: { ...MonoText.bodyS, color: MonoColors.textSecond },
  budgetNote: { ...MonoText.caption, color: MonoColors.textMeta },
});

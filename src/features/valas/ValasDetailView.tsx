// The body of the Valas detail (board Valas-Detail): the value of everything in rupiah (an estimate,
// marked ≈), one row per currency pocket with the rate used, its own amount and its rupiah value, the
// Add and Exchange buttons, the month's activity with a chip per currency, and the link to the rates.
// Pure presentation of a ValasDetail from valasDetail.ts: every figure passes <Amount> (hidden-amounts
// mode, CLAUDE.md rule 12). A pocket with no rate shows its own amount and "Belum ada kurs": its
// rupiah value is unknown, never 0, and the total says it is incomplete.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CategoryTile } from '@/components/CategoryTile';
import { Chip } from '@/components/Chip';
import { CurrencyFlag } from '@/components/CurrencyFlag';
import { Icon, type IconName } from '@/components/Icon';
import { formatDateTime, formatDayMonth, monthName } from '@/core/date';
import { currencySymbol, money, rateRp, rp, shown } from '@/core/money';
import { useHideAmounts } from '@/components/hide-amounts-store';
import {
  activityKindLabel,
  currencyName,
  newestFirstLabel,
  ratesRowNoRate,
  ratesRowPer,
  setRateButton,
  valasActivityEmpty,
  valasActivityFilterEmpty,
  valasActivityRowLabel,
  valasActivityTitle,
  valasActivityValue,
  valasAddCurrency,
  valasButtonAdd,
  valasButtonExchange,
  valasDetailApproxNote,
  valasDetailCaption,
  valasDetailIncomplete,
  valasFilterAll,
  valasFrozenNote,
  valasPocketLabel,
  valasPocketsEmpty,
  valasPocketsHeader,
  valasRatesLink,
  valasViewAll,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import type { ValasActivityItem, ValasDetail, ValasPocket } from './valasDetail';

const DIVIDER = '#272728';

// ---------------------------------------------------------------- hero

export function ValasHero({ detail }: { detail: ValasDetail }) {
  const known = detail.pockets.filter(p => p.valueIdr != null).length;
  const noneKnown = detail.pockets.length > 0 && known === 0;
  return (
    <View style={styles.hero} testID="valas-hero">
      <Text style={styles.caption}>{valasDetailCaption()}</Text>
      {noneKnown ? (
        <Text style={styles.heroNoRate} testID="valas-total-norate">
          {ratesRowNoRate()}
        </Text>
      ) : (
        <View style={styles.heroRow}>
          <Text style={styles.heroApprox}>{'≈ '}</Text>
          <Amount value={detail.totalIdr} variant="displayS" testID="valas-total" />
        </View>
      )}
      {detail.missingRates > 0 ? (
        <View style={styles.warnRow} testID="valas-incomplete">
          <Icon name="alert" size={16} color={MonoColors.negative} />
          <Text style={styles.warnText}>{valasDetailIncomplete()}</Text>
        </View>
      ) : (
        !!detail.latestRateAt && <Text style={styles.note}>{valasDetailApproxNote(formatDateTime(detail.latestRateAt))}</Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------- pockets

function PocketRow({ pocket, last, onSetRate }: { pocket: ValasPocket; last: boolean; onSetRate: () => void }) {
  const hidden = useHideAmounts(s => s.hidden);
  const name = currencyName(pocket.currency);
  const rateText = pocket.rateE4 != null ? ratesRowPer(rateRp(pocket.rateE4), currencySymbol(pocket.currency)) : ratesRowNoRate();
  const native = money(pocket.balance, pocket.currency, pocket.minorFactor);
  return (
    <View style={[styles.pocketRow, !last && styles.divider]} accessible accessibilityLabel={valasPocketLabel(pocket.currency, name, shown(native, hidden), rateText)} testID={`valas-pocket-${pocket.currency}`}>
      <CurrencyFlag code={pocket.currency} />
      <View style={styles.flex}>
        <Text style={styles.pocketName}>{name}</Text>
        {pocket.rateE4 != null ? (
          <Text style={styles.caption2}>{rateText}</Text>
        ) : (
          <Pressable onPress={onSetRate} accessibilityRole="button" accessibilityLabel={setRateButton()} style={styles.setRate} testID={`valas-set-rate-${pocket.currency}`}>
            <Text style={styles.setRateText}>{`${rateText} · ${setRateButton()}`}</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.pocketAmounts}>
        <Amount value={pocket.balance} currency={pocket.currency} minorFactor={pocket.minorFactor} variant="figureRow" testID={`valas-native-${pocket.currency}`} />
        {pocket.valueIdr != null && (
          <View style={styles.valueRow}>
            <Text style={styles.caption2}>{'≈ '}</Text>
            <Amount value={pocket.valueIdr} variant="caption" style={{ color: MonoColors.textMeta }} testID={`valas-value-${pocket.currency}`} />
          </View>
        )}
      </View>
    </View>
  );
}

export function PocketsCard({ detail, onSetRate, onAddCurrency }: { detail: ValasDetail; onSetRate: () => void; onAddCurrency: () => void }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel} accessibilityRole="header">
        {valasPocketsHeader()}
      </Text>
      {detail.pockets.length === 0 ? (
        <Text style={styles.empty}>{valasPocketsEmpty()}</Text>
      ) : (
        <Card style={styles.list} testID="valas-pockets">
          {detail.pockets.map((pocket, index) => (
            <PocketRow key={pocket.currency} pocket={pocket} last={index === detail.pockets.length - 1} onSetRate={onSetRate} />
          ))}
        </Card>
      )}
      <Button label={valasAddCurrency()} icon="plus" variant="secondary" onPress={onAddCurrency} testID="valas-add-currency" />
    </View>
  );
}

export function ValasActions({ onAdd, onExchange, canExchange }: { onAdd: () => void; onExchange: () => void; canExchange: boolean }) {
  return (
    <View style={styles.actions}>
      <Button label={valasButtonAdd()} icon="plus" onPress={onAdd} style={styles.action} testID="valas-add" />
      <Button label={valasButtonExchange()} icon="transfer" variant="secondary" onPress={onExchange} disabled={!canExchange} style={styles.action} testID="valas-exchange" />
    </View>
  );
}

// ---------------------------------------------------------------- activity

function tileIcon(kind: ValasActivityItem['kind']): IconName {
  if (kind === 'income') return 'wallet';
  if (kind === 'expense') return 'receipt';
  return 'transfer';
}

function ActivityRow({ item, last, onPress }: { item: ValasActivityItem; last: boolean; onPress: () => void }) {
  const hidden = useHideAmounts(s => s.hidden);
  const isTransfer = item.kind === 'transfer_out' || item.kind === 'transfer_in';
  const kindLabel = activityKindLabel(item.kind);
  // A transfer (an exchange) is never signed or coloured; income is +green, an expense −red.
  const value = isTransfer ? Math.abs(item.delta) : item.delta;
  const formatted = money(value, item.currency, item.minorFactor, !isTransfer);
  const worth = item.valueIdr != null ? valasActivityValue(shown(rp(item.valueIdr), hidden)) : '';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={valasActivityRowLabel(item.title, kindLabel, formatDayMonth(item.date), shown(formatted, hidden), worth)}
      android_ripple={undefined}
      style={({ pressed }) => [styles.activityRow, !last && styles.divider, pressed && styles.pressed]}
      testID={`valas-activity-${item.id}-${item.currency}`}
    >
      <CategoryTile icon={tileIcon(item.kind)} size={40} radius={12} iconSize={20} />
      <View style={styles.flex}>
        <Text style={styles.activityTitle}>{item.title}</Text>
        <Text style={styles.caption2}>{`${kindLabel} · ${formatDayMonth(item.date)}`}</Text>
      </View>
      <View style={styles.pocketAmounts}>
        <Amount
          value={value}
          currency={item.currency}
          minorFactor={item.minorFactor}
          sign={!isTransfer}
          kind={item.kind === 'income' ? 'income' : item.kind === 'expense' ? 'expense' : undefined}
          variant="figureRow"
        />
        {item.valueIdr != null && (
          <View style={styles.valueRow}>
            <Text style={styles.caption2}>{'≈ '}</Text>
            <Amount value={item.valueIdr} variant="caption" style={{ color: MonoColors.textMeta }} />
          </View>
        )}
      </View>
    </Pressable>
  );
}

export interface ValasActivityProps {
  period: string;
  currencies: readonly string[];
  filter: string | 'all';
  onFilter: (filter: string | 'all') => void;
  items: ValasActivityItem[] | undefined;
  onOpenTx: (id: number) => void;
  onViewAll: () => void;
}

export function ValasActivity({ period, currencies, filter, onFilter, items, onOpenTx, onViewAll }: ValasActivityProps) {
  const month = monthName(period);
  return (
    <View style={styles.section} testID="valas-activity">
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {valasActivityTitle(month)}
        </Text>
        <Text style={styles.caption2}>{newestFirstLabel()}</Text>
      </View>

      <View style={styles.filters} accessibilityRole="radiogroup">
        <Chip label={valasFilterAll()} selected={filter === 'all'} onPress={() => onFilter('all')} testID="valas-filter-all" />
        {currencies.map(code => (
          <Chip key={code} label={code} selected={filter === code} onPress={() => onFilter(code)} testID={`valas-filter-${code}`} />
        ))}
      </View>

      {items && items.length > 0 ? (
        <Card style={styles.list}>
          {items.map((item, i) => (
            <ActivityRow key={`${item.id}-${item.currency}`} item={item} last={i === items.length - 1} onPress={() => onOpenTx(item.id)} />
          ))}
        </Card>
      ) : (
        items && <Text style={styles.empty}>{filter === 'all' ? valasActivityEmpty() : valasActivityFilterEmpty(filter)}</Text>
      )}

      <Pressable onPress={onViewAll} accessibilityRole="button" accessibilityLabel={valasViewAll()} android_ripple={undefined} style={({ pressed }) => [styles.link, pressed && styles.pressed]} testID="valas-view-all">
        <Text style={styles.linkText}>{valasViewAll()}</Text>
        <Icon name="chevron-right" size={20} color={MonoColors.textSecond} />
      </Pressable>
    </View>
  );
}

export function RatesLink({ latestRateAt, onPress }: { latestRateAt: string | null; onPress: () => void }) {
  const label = valasRatesLink(latestRateAt ? formatDateTime(latestRateAt) : null);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} android_ripple={undefined} style={({ pressed }) => [styles.link, pressed && styles.pressed]} testID="valas-rates-link">
      <Icon name="refresh" size={16} color={MonoColors.textSecond} />
      <Text style={styles.linkText}>{label}</Text>
      <Icon name="chevron-right" size={20} color={MonoColors.textSecond} />
    </Pressable>
  );
}

export function FrozenNote() {
  return (
    <View style={styles.frozen} testID="valas-frozen-note">
      <Icon name="info" size={16} color={MonoColors.textMeta} />
      <Text style={styles.note}>{valasFrozenNote()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { gap: 4 },
  heroRow: { flexDirection: 'row', alignItems: 'baseline' },
  heroApprox: { ...MonoText.displayS, color: MonoColors.text },
  heroNoRate: { ...MonoText.titleM, color: MonoColors.textSecond },
  caption: { ...MonoText.label, color: MonoColors.textMeta, textTransform: 'uppercase' },
  caption2: { ...MonoText.caption, color: MonoColors.textMeta },
  note: { ...MonoText.caption, color: MonoColors.textMeta, flex: 1 },
  warnRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  warnText: { ...MonoText.bodyS, color: MonoColors.text, flex: 1 },

  section: { gap: 12 },
  sectionLabel: { ...MonoText.label, color: MonoColors.textMeta, textTransform: 'uppercase' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { ...MonoText.titleM, color: MonoColors.text, flexShrink: 1 },
  list: { padding: 0, overflow: 'hidden' },
  empty: { ...MonoText.bodyS, color: MonoColors.textSecond },
  divider: { borderBottomWidth: 1, borderBottomColor: DIVIDER },
  pressed: { opacity: 0.85 },

  pocketRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  pocketName: { ...MonoText.bodyStrong, color: MonoColors.text },
  pocketAmounts: { alignItems: 'flex-end', gap: 2, flexShrink: 1 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline' },
  setRate: { minHeight: 44, justifyContent: 'center' },
  setRateText: { ...MonoText.caption, color: MonoColors.text, textDecorationLine: 'underline' },

  actions: { flexDirection: 'row', gap: 12 },
  action: { flex: 1 },

  filters: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  activityRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  activityTitle: { ...MonoText.bodyStrong, color: MonoColors.text },

  link: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: DIVIDER, backgroundColor: MonoColors.card },
  linkText: { ...MonoText.bodyS, fontFamily: MonoText.bodyStrong.fontFamily, color: MonoColors.text, flex: 1 },
  frozen: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
});

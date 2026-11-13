// Rates (board V7), the screen at /settings/rates, drawn from plain props so it can be tested
// without the database or the network.
//
// The switch "Perbarui otomatis" (on by default), the button "Perbarui kurs sekarang", one row per
// held currency with the rate in use and its source and time (tap to type your own), a red box when an
// update failed (the stored rates are kept), and the notes: how rates are used, what is sent, and the
// service's attribution. A currency with no rate says so; it is never shown as 0.
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { CurrencyFlag } from '@/components/CurrencyFlag';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { MonoSwitch } from '@/components/MonoSwitch';
import { formatDateTime } from '@/core/date';
import { currencySymbol, rateRp } from '@/core/money';
import {
  backLabel,
  currencyName,
  ratesAttribution,
  ratesAutoHelp,
  ratesAutoSwitchLabel,
  ratesAutoTitle,
  ratesFailInvalid,
  ratesFailLimited,
  ratesFailOffline,
  ratesFailTitle,
  ratesHowBody,
  ratesHowHeader,
  ratesInUseHeader,
  ratesLastUpdated,
  ratesNeverUpdated,
  ratesNoCurrencies,
  ratesPrivacy,
  ratesRowLabel,
  ratesRowNoRate,
  ratesRowPer,
  ratesRowSetRate,
  ratesRowSub,
  ratesSourceApi,
  ratesSourceManual,
  ratesTitle,
  ratesUpdateNow,
  ratesUpdating,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import type { FxFailureKind } from './fetchRates';
import type { RateRow } from './ratesOverview';

export interface RatesFailure {
  kind: FxFailureKind;
  minutesLeft?: number; // for rate_limited
}

export interface RatesViewProps {
  rows: readonly RateRow[];
  autoUpdate: boolean;
  lastSuccessAt: string | null;
  updating: boolean;
  failure: RatesFailure | null;
  // True while the button is locked (after a 429) so a tap does nothing.
  updateLocked?: boolean;
  onBack: () => void;
  onToggleAuto: (on: boolean) => void;
  onUpdateNow: () => void;
  onEditRate: (currency: string) => void;
}

// The newest time among the stored rates: the "old rates" the failure box says are kept.
function newestFetched(rows: readonly RateRow[]): string | null {
  return rows.reduce<string | null>((newest, r) => (r.fetchedAt && (!newest || r.fetchedAt > newest) ? r.fetchedAt : newest), null);
}

export function RatesView(props: RatesViewProps) {
  const insets = useSafeAreaInsets();
  const { rows, failure } = props;
  const keptSince = newestFetched(rows);

  return (
    <View style={styles.screen} testID="rates-screen">
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <IconButton label={backLabel()} onPress={props.onBack} testID="rates-back">
          <Icon name="chevron-left" size={24} color={MonoColors.text} />
        </IconButton>
        <Text style={styles.title} accessibilityRole="header">
          {ratesTitle()}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}>
        <View style={styles.card}>
          <View style={styles.row} testID="rates-auto-row">
            <View style={styles.flex}>
              <Text style={styles.rowTitle}>{ratesAutoTitle()}</Text>
              <Text style={styles.caption}>{ratesAutoHelp()}</Text>
            </View>
            <MonoSwitch value={props.autoUpdate} onValueChange={props.onToggleAuto} label={ratesAutoSwitchLabel(props.autoUpdate)} testID="rates-auto-switch" />
          </View>
          <View style={[styles.row, styles.separator]}>
            <View style={styles.flex}>
              <Text style={styles.caption} testID="rates-last-updated">
                {props.lastSuccessAt ? ratesLastUpdated(formatDateTime(props.lastSuccessAt)) : ratesNeverUpdated()}
              </Text>
            </View>
          </View>
          <View style={styles.buttonPad}>
            <Button
              label={props.updating ? ratesUpdating() : ratesUpdateNow()}
              icon="refresh"
              loading={props.updating}
              disabled={props.updateLocked}
              onPress={props.onUpdateNow}
              testID="rates-update-now"
            />
          </View>
        </View>

        {failure && (
          <View style={styles.bad} testID="rates-failure">
            <Icon name="alert" size={18} color={MonoColors.negative} />
            <View style={styles.flex}>
              <Text style={styles.badText}>
                <Text style={styles.badTitle}>{ratesFailTitle()}</Text>{' '}
                {failure.kind === 'offline'
                  ? ratesFailOffline(keptSince ? formatDateTime(keptSince) : null)
                  : failure.kind === 'rate_limited'
                    ? ratesFailLimited(failure.minutesLeft ?? 20)
                    : ratesFailInvalid()}
              </Text>
            </View>
          </View>
        )}

        <Text style={styles.groupLabel} accessibilityRole="header">
          {ratesInUseHeader()}
        </Text>
        {rows.length === 0 ? (
          <Text style={styles.empty} testID="rates-empty">
            {ratesNoCurrencies()}
          </Text>
        ) : (
          <View style={styles.card} testID="rates-list">
            {rows.map((row, index) => (
              <RateLine key={row.currency} row={row} first={index === 0} onPress={() => props.onEditRate(row.currency)} />
            ))}
          </View>
        )}

        <Text style={styles.groupLabel} accessibilityRole="header">
          {ratesHowHeader()}
        </Text>
        <Text style={styles.note}>{ratesHowBody()}</Text>
        <View style={styles.privacy}>
          <Icon name="lock" size={16} color={MonoColors.textMeta} />
          <Text style={styles.noteSmall}>{ratesPrivacy()}</Text>
        </View>
        <Text style={styles.attribution} testID="rates-attribution">
          {ratesAttribution()}
        </Text>
      </ScrollView>
    </View>
  );
}

function RateLine({ row, first, onPress }: { row: RateRow; first: boolean; onPress: () => void }) {
  const name = currencyName(row.currency);
  const detail =
    row.rateE4 != null && row.fetchedAt
      ? ratesRowSub(row.source === 'manual' ? ratesSourceManual() : ratesSourceApi(), formatDateTime(row.fetchedAt))
      : ratesRowNoRate();
  const rate = row.rateE4 != null ? ratesRowPer(rateRp(row.rateE4), currencySymbol(row.currency)) : ratesRowSetRate();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={ratesRowLabel(row.currency, name, `${rate}. ${detail}`)}
      style={[styles.row, !first && styles.separator]}
      testID={`rates-row-${row.currency}`}
    >
      <CurrencyFlag code={row.currency} />
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{name}</Text>
        <Text style={styles.caption}>{detail}</Text>
      </View>
      <Text style={[styles.rate, row.rateE4 == null && styles.rateMissing]} testID={`rates-value-${row.currency}`}>
        {rate}
      </Text>
      <Icon name="chevron-right" size={16} color={MonoColors.textMeta} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  header: { paddingHorizontal: 8, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 4 },
  title: { ...MonoText.titleM, color: MonoColors.text, flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 4 },
  flex: { flex: 1 },
  card: { marginTop: 12, backgroundColor: MonoColors.card, borderWidth: 1, borderColor: MonoColors.border, borderRadius: 20 },
  row: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  separator: { borderTopWidth: 1, borderTopColor: MonoColors.border },
  buttonPad: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 4 },
  rowTitle: { ...MonoText.h2, color: MonoColors.text },
  caption: { ...MonoText.caption, color: MonoColors.textMeta },
  rate: { ...MonoText.bodyStrong, color: MonoColors.text, textAlign: 'right', maxWidth: '40%' },
  rateMissing: { color: MonoColors.textSecond, fontFamily: MonoText.bodyS.fontFamily },
  groupLabel: { ...MonoText.label, color: MonoColors.textMeta, textTransform: 'uppercase', paddingTop: 22, paddingBottom: 2, paddingHorizontal: 4 },
  empty: { ...MonoText.bodyS, color: MonoColors.textMeta, paddingHorizontal: 4, paddingTop: 6 },
  bad: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderWidth: 1.5, borderColor: MonoColors.negative, backgroundColor: MonoColors.surface, borderRadius: 16, padding: 14, marginTop: 12 },
  badText: { ...MonoText.bodyS, color: MonoColors.text },
  badTitle: { fontFamily: MonoText.bodyStrong.fontFamily, color: MonoColors.negative },
  note: { ...MonoText.bodyS, color: MonoColors.textSecond, paddingHorizontal: 4, paddingTop: 6, lineHeight: 20 },
  noteSmall: { ...MonoText.caption, color: MonoColors.textMeta, flex: 1, lineHeight: 17 },
  privacy: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingHorizontal: 4, paddingTop: 14 },
  attribution: { ...MonoText.caption, color: MonoColors.textMeta, paddingHorizontal: 4, paddingTop: 14 },
});

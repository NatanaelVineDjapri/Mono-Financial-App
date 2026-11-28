// Portfolio (/portfolio, from More): the total of the chosen portfolios (cash accounts included), profit and loss, how
// portfolios count in net worth, and the portfolios. Prices update on opening and with the button.
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Amount } from '@/components/Amount';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { Segmented } from '@/components/Segmented';
import { nowIso } from '@/core/clock';
import { formatDateTime } from '@/core/date';
import { useDb } from '@/data/db/DbProvider';
import { invalidateAfterWrite } from '@/data/queryKeys';
import { createPortfolio, setInTotal, setNetWorthMode, totalsOf, type NetWorthMode, type PortfolioRow } from '@/domain/portfolio';
import { NameSheet, ProfitText } from '@/features/portfolio/parts';
import { useCashAccounts, usePortfolios, usePriceUpdate } from '@/features/portfolio/usePortfolio';
import { AccountSheet } from '@/features/transactions/form/formSheets';
import {
  backLabel,
  portfolioAsOf,
  portfolioEmptyBody,
  portfolioEmptyTitle,
  portfolioErrorText,
  portfolioIncomplete,
  portfolioInTotal,
  portfolioModeCost,
  portfolioModeHelp,
  portfolioModeMarket,
  portfolioModeOff,
  portfolioNetWorthLabel,
  portfolioNew,
  portfolioNoPrices,
  portfolioProfit,
  portfolioRefresh,
  portfolioRefreshing,
  portfolioStocks,
  portfolioTitle,
  portfolioTotal,
  portfolioTotalNote,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

function Row({ portfolio, onOpen, onToggle }: { portfolio: PortfolioRow; onOpen: () => void; onToggle: () => void }) {
  const totals = totalsOf([portfolio]);
  const counted = portfolio.in_total === 1;
  return (
    <View style={styles.row} testID={`portfolio-row-${portfolio.id}`}>
      <Pressable onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked: counted }} accessibilityLabel={portfolioInTotal(portfolio.name)} style={styles.check} testID={`portfolio-count-${portfolio.id}`}>
        <View style={[styles.box, counted && styles.boxOn]}>{counted && <Icon name="check" size={16} color={MonoColors.bg} />}</View>
      </Pressable>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={portfolio.name} style={styles.rowMain} testID={`portfolio-open-${portfolio.id}`}>
        <View style={styles.rowText}>
          <Text style={styles.name}>{portfolio.name}</Text>
          <Text style={styles.sub}>{portfolioStocks(portfolio.positions)}</Text>
        </View>
        <View style={styles.rowValues}>
          <Amount value={totals.value} variant="figureRow" />
          {totals.profit != null && <ProfitText profit={totals.profit} bp={totals.profitBp} />}
        </View>
        <Icon name="chevron-right" size={16} color={MonoColors.textMeta} />
      </Pressable>
    </View>
  );
}

export default function PortfolioScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const db = useDb();
  const queryClient = useQueryClient();
  const { data } = usePortfolios();
  const { data: accounts = [] } = useCashAccounts();
  const { update, updating, error } = usePriceUpdate(true);
  const [naming, setNaming] = useState(false);
  const [cashId, setCashId] = useState<number | null>(null);
  const [pickingCash, setPickingCash] = useState(false);

  const portfolios = data?.portfolios ?? [];
  const counted = portfolios.filter(p => p.in_total === 1);
  const totals = totalsOf(counted);
  const refresh = () => invalidateAfterWrite(queryClient);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <IconButton label={backLabel()} onPress={() => router.back()} testID="portfolio-back">
          <Icon name="chevron-left" color={MonoColors.text} />
        </IconButton>
        <Text style={styles.title} accessibilityRole="header">
          {portfolioTitle()}
        </Text>
        <IconButton label={portfolioRefresh()} onPress={() => void update()} testID="portfolio-refresh">
          <Icon name="refresh" color={updating ? MonoColors.textDisabled : MonoColors.text} />
        </IconButton>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}>
        {data && portfolios.length === 0 ? (
          <View style={styles.empty} testID="portfolio-empty">
            <Icon name="pulse" size={26} color={MonoColors.textSecond} />
            <Text style={styles.emptyTitle}>{portfolioEmptyTitle()}</Text>
            <Text style={styles.emptyBody}>{portfolioEmptyBody()}</Text>
          </View>
        ) : (
          data && (
            <>
              <View style={styles.card} testID="portfolio-total">
                <Text style={styles.label}>{portfolioTotal()}</Text>
                <Amount value={totals.value} variant="figureCard" />
                <Text style={styles.sub}>{portfolioProfit()}</Text>
                {totals.profit != null ? <ProfitText profit={totals.profit} bp={totals.profitBp} size="large" /> : <Text style={styles.sub}>{portfolioNoPrices()}</Text>}
                <Text style={styles.sub}>{portfolioTotalNote(counted.length)}</Text>
                {updating && <Text style={styles.sub}>{portfolioRefreshing()}</Text>}
                {!updating && data.fetchedAt && <Text style={styles.sub}>{portfolioAsOf(formatDateTime(data.fetchedAt))}</Text>}
                {error && <Text style={styles.warn}>{portfolioErrorText(error)}</Text>}
                {totals.incomplete && <Text style={styles.warn}>{portfolioIncomplete()}</Text>}
              </View>

              <View style={styles.card}>{portfolios.map(p => (
                <Row
                  key={p.id}
                  portfolio={p}
                  onOpen={() => router.push(`/portfolio/${p.id}` as never)}
                  onToggle={() => void setInTotal(db, p.id, p.in_total !== 1).then(refresh)}
                />
              ))}</View>

              <View style={styles.modeBlock}>
                <Text style={styles.label}>{portfolioNetWorthLabel()}</Text>
                <Segmented
                  options={[
                    { value: 'off', label: portfolioModeOff() },
                    { value: 'market', label: portfolioModeMarket() },
                    { value: 'cost', label: portfolioModeCost() },
                  ]}
                  value={data.mode}
                  onChange={value => void setNetWorthMode(db, value as NetWorthMode).then(refresh)}
                  testID="portfolio-mode"
                />
                <Text style={styles.sub}>{portfolioModeHelp()}</Text>
              </View>
            </>
          )
        )}
        <Button label={portfolioNew()} icon="plus" onPress={() => setNaming(true)} testID="portfolio-new" />
      </ScrollView>

      <NameSheet
        visible={naming}
        title={portfolioNew()}
        initialName=""
        cashName={accounts.find(a => a.id === cashId)?.name ?? null}
        onPickCash={() => setPickingCash(true)}
        onSave={async name => {
          const result = await createPortfolio(db, name, cashId, nowIso());
          if (!result.ok) return result.error;
          setCashId(null);
          await refresh();
          return null;
        }}
        onClose={() => setNaming(false)}
      />
      <AccountSheet
        visible={pickingCash}
        role="account"
        accounts={accounts}
        selectedId={cashId}
        onSelect={id => {
          setCashId(id);
          setPickingCash(false);
        }}
        onClose={() => setPickingCash(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  header: { paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 56 },
  title: { ...MonoText.titleM, color: MonoColors.text, flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 4, gap: 16 },
  card: { backgroundColor: MonoColors.surface, borderRadius: 20, borderWidth: 1, borderColor: MonoColors.border, padding: 14, gap: 4 },
  label: { ...MonoText.label, color: MonoColors.textMeta, textTransform: 'uppercase' },
  sub: { ...MonoText.caption, color: MonoColors.textMeta },
  warn: { ...MonoText.caption, color: MonoColors.textSecond },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 60 },
  check: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: MonoColors.textDisabled, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: MonoColors.text, borderColor: MonoColors.text },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56 },
  rowText: { flex: 1, gap: 2 },
  rowValues: { alignItems: 'flex-end', gap: 2 },
  name: { ...MonoText.bodyStrong, color: MonoColors.text },
  modeBlock: { gap: 8 },
  empty: { alignItems: 'center', gap: 12, padding: 32 },
  emptyTitle: { ...MonoText.bodyStrong, color: MonoColors.text, textAlign: 'center' },
  emptyBody: { ...MonoText.body, color: MonoColors.textSecond, textAlign: 'center' },
});

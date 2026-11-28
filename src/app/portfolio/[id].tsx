// One portfolio (/portfolio/[id]): its value and profit, the cash account, the stocks; rename and delete.
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Amount } from '@/components/Amount';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { rp, shown } from '@/core/money';
import { formatE4, lotSize, priceText } from '@/core/price';
import { useDb } from '@/data/db/DbProvider';
import { invalidateAfterWrite } from '@/data/queryKeys';
import { deletePortfolio, positionProfit, renamePortfolio, setCashAccount, totalsOf, type PositionRow } from '@/domain/portfolio';
import { NameSheet, ProfitText } from '@/features/portfolio/parts';
import { useCashAccounts, usePortfolios, usePositions, usePriceUpdate } from '@/features/portfolio/usePortfolio';
import { AccountSheet } from '@/features/transactions/form/formSheets';
import {
  backLabel,
  cancelLabel,
  portfolioAddStock,
  portfolioCash,
  portfolioCashNone,
  portfolioDelete,
  portfolioDeleteBody,
  portfolioDeleteTitle,
  portfolioErrorText,
  portfolioInvested,
  portfolioNoPrices,
  portfolioNoStocks,
  portfolioRefresh,
  portfolioRename,
  portfolioTitle,
  positionHolding,
  positionLast,
  removeConfirmLabel,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

function Stock({ position, onPress }: { position: PositionRow; onPress: () => void }) {
  const hidden = useHideAmounts(s => s.hidden);
  const lot = lotSize(position.symbol);
  // whole lots where the exchange trades in lots; a leftover shows as a fraction
  const quantity = formatE4(Math.round(position.qty_e4 / lot));
  const profit = positionProfit(position);
  const holding = positionHolding(shown(quantity, hidden), lot > 1, shown(priceText(position.avg_price_e4, position.currency), hidden));
  const value = position.market_idr ?? position.cost_idr;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${position.symbol}, ${position.name}, ${holding}`} style={({ pressed }) => [styles.stock, pressed && styles.pressed]} testID={`stock-${position.symbol}`}>
      <View style={styles.stockText}>
        <Text style={styles.symbol}>{position.symbol}</Text>
        <Text style={styles.sub} numberOfLines={1}>
          {position.name}
        </Text>
        <Text style={styles.sub}>{holding}</Text>
        <Text style={styles.sub}>{position.price_e4 ? positionLast(priceText(position.price_e4, position.currency)) : portfolioNoPrices()}</Text>
      </View>
      <View style={styles.stockValues}>
        {value != null && <Amount value={value} variant="figureRow" />}
        {profit && <ProfitText profit={profit.profit} bp={profit.profitBp} />}
      </View>
    </Pressable>
  );
}

export default function PortfolioDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const db = useDb();
  const queryClient = useQueryClient();
  const hidden = useHideAmounts(s => s.hidden);
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const { data } = usePortfolios();
  const { data: positions = [] } = usePositions(id);
  const { data: accounts = [] } = useCashAccounts();
  const { update, updating, error } = usePriceUpdate(true);
  const [renaming, setRenaming] = useState(false);
  const [pickingCash, setPickingCash] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const portfolio = data?.portfolios.find(p => p.id === id);
  const totals = totalsOf(portfolio ? [portfolio] : []);
  const refresh = () => invalidateAfterWrite(queryClient);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <IconButton label={backLabel()} onPress={() => router.back()} testID="portfolio-back">
          <Icon name="chevron-left" color={MonoColors.text} />
        </IconButton>
        <Text style={styles.title} accessibilityRole="header">
          {portfolio?.name ?? portfolioTitle()}
        </Text>
        <IconButton label={portfolioRefresh()} onPress={() => void update()} testID="portfolio-refresh">
          <Icon name="refresh" color={updating ? MonoColors.textDisabled : MonoColors.text} />
        </IconButton>
      </View>

      {portfolio && (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}>
          <View style={styles.card}>
            <Amount value={totals.value} variant="figureCard" />
            {totals.profit != null ? <ProfitText profit={totals.profit} bp={totals.profitBp} size="large" /> : <Text style={styles.sub}>{portfolioNoPrices()}</Text>}
            <Text style={styles.sub}>
              {portfolioInvested()} {shown(rp(portfolio.cost_idr), hidden)}
            </Text>
            {error && <Text style={styles.sub}>{portfolioErrorText(error)}</Text>}
            <Pressable onPress={() => setPickingCash(true)} accessibilityRole="button" accessibilityLabel={`${portfolioCash()}: ${portfolio.cash_name ?? portfolioCashNone()}`} style={styles.cashRow} testID="portfolio-cash">
              <Text style={styles.sub}>{portfolioCash()}</Text>
              <Text style={styles.cashValue}>{portfolio.cash_name ? `${portfolio.cash_name} · ${shown(rp(portfolio.cash_balance ?? 0), hidden)}` : portfolioCashNone()}</Text>
            </Pressable>
          </View>

          <Button label={portfolioAddStock()} icon="plus" onPress={() => router.push({ pathname: '/portfolio/position', params: { portfolio: String(id) } } as never)} testID="stock-add" />

          {positions.length === 0 ? (
            <Text style={styles.none}>{portfolioNoStocks()}</Text>
          ) : (
            <View style={styles.card}>
              {positions.map(p => (
                <Stock key={p.id} position={p} onPress={() => router.push({ pathname: '/portfolio/position', params: { portfolio: String(id), id: String(p.id) } } as never)} />
              ))}
            </View>
          )}

          <View style={styles.actions}>
            <Button label={portfolioRename()} variant="secondary" onPress={() => setRenaming(true)} style={styles.action} testID="portfolio-rename" />
            <Button label={portfolioDelete()} variant="secondary" onPress={() => setDeleting(true)} style={styles.action} testID="portfolio-delete" />
          </View>
        </ScrollView>
      )}

      <NameSheet
        visible={renaming}
        title={portfolioRename()}
        initialName={portfolio?.name ?? ''}
        onSave={async name => {
          const result = await renamePortfolio(db, id, name);
          if (!result.ok) return result.error;
          await refresh();
          return null;
        }}
        onClose={() => setRenaming(false)}
      />
      <AccountSheet
        visible={pickingCash}
        role="account"
        accounts={accounts}
        selectedId={portfolio?.cash_account_id ?? null}
        onSelect={accountId => {
          setPickingCash(false);
          // picking the chosen one again takes it off
          void setCashAccount(db, id, accountId === portfolio?.cash_account_id ? null : accountId).then(refresh);
        }}
        onClose={() => setPickingCash(false)}
      />
      <ConfirmDialog
        visible={deleting}
        icon="trash"
        title={portfolioDeleteTitle(portfolio?.name ?? '')}
        message={[{ text: portfolioDeleteBody() }]}
        cancelLabel={cancelLabel()}
        confirmLabel={removeConfirmLabel()}
        onCancel={() => setDeleting(false)}
        onConfirm={() => {
          setDeleting(false);
          void deletePortfolio(db, id).then(async () => {
            router.back();
            await refresh();
          });
        }}
        testID="portfolio-delete-dialog"
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
  sub: { ...MonoText.caption, color: MonoColors.textMeta },
  cashRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cashValue: { ...MonoText.bodyS, color: MonoColors.text, flexShrink: 1, textAlign: 'right' },
  none: { ...MonoText.body, color: MonoColors.textSecond, textAlign: 'center', padding: 16 },
  stock: { flexDirection: 'row', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: MonoColors.border },
  pressed: { opacity: 0.8 },
  stockText: { flex: 1, gap: 1 },
  stockValues: { alignItems: 'flex-end', gap: 2 },
  symbol: { ...MonoText.bodyStrong, color: MonoColors.text },
  actions: { flexDirection: 'row', gap: 12 },
  action: { flex: 1 },
});

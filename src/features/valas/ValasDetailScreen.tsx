// Valas detail (board Valas-Detail), the forex branch of /account/[id]. Wires the data, the
// Add-currency sheet and the navigation; the body is ValasDetailView.tsx. Add and Exchange open the
// transaction form with the Valas account chosen; Exchange needs two currencies to swap between.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { showToast } from '@/components/toast-store';
import { today as todayLocal } from '@/core/clock';
import { useStatsCollapsed } from '@/features/transactions/statsStore';
import { accountDetailLoadError, accountNotFoundMessage, backLabel, retryLabel, valasPocketAddedToast } from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { AddCurrencySheet } from './AddCurrencySheet';
import { FrozenNote, PocketsCard, RatesLink, ValasActions, ValasActivity, ValasHero } from './ValasDetailView';
import { useValasActions, useValasActivity, useValasDetail } from './useValas';

export function ValasDetailScreen({ accountId }: { accountId: number }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<string | 'all'>('all');
  const [sheet, setSheet] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: detail, isLoading, isError, refetch } = useValasDetail(accountId);
  const { data: activity } = useValasActivity(accountId, detail?.period, filter);
  const actions = useValasActions();

  const header = (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <IconButton label={backLabel()} onPress={() => router.back()} testID="valas-back">
          <Icon name="chevron-left" color={MonoColors.text} />
        </IconButton>
        <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
          {detail?.name ?? ''}
        </Text>
      </View>
    </View>
  );

  if (isLoading) return <View style={styles.screen}>{header}</View>;
  if (isError || !detail) {
    return (
      <View style={styles.screen}>
        {header}
        <View style={styles.centerFill}>
          <Text style={styles.message}>{isError ? accountDetailLoadError() : accountNotFoundMessage()}</Text>
          {isError ? <Button label={retryLabel()} onPress={() => void refetch()} /> : <Button label={backLabel()} variant="secondary" onPress={() => router.back()} />}
        </View>
      </View>
    );
  }

  const codes = detail.pockets.map(p => p.currency);
  const openRates = () => router.push('/settings/rates' as never);

  const viewAll = () => {
    useStatsCollapsed.getState().updateFilters({
      datePreset: 'custom',
      customStart: detail.openingDate,
      customEnd: todayLocal(),
      type: 'all',
      accountIds: [accountId],
      categoryIds: [],
      minAmount: undefined,
      maxAmount: undefined,
    });
    router.push('/(tabs)/transactions');
  };

  const onPick = async (code: string) => {
    setSheet(false);
    const result = await actions.addPocket(accountId, code);
    if (result.ok) {
      setError(null);
      showToast(valasPocketAddedToast(code));
    } else {
      setError(result.message);
    }
  };

  return (
    <View style={styles.screen}>
      {header}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]} testID="valas-scroll">
        <ValasHero detail={detail} />
        {!!error && (
          <Text style={styles.error} accessibilityLiveRegion="polite" testID="valas-error">
            {error}
          </Text>
        )}
        <PocketsCard detail={detail} onSetRate={openRates} onAddCurrency={() => setSheet(true)} />
        <ValasActions
          onAdd={() => router.push({ pathname: '/tx/add', params: { account: String(accountId) } })}
          onExchange={() => router.push({ pathname: '/tx/add', params: { type: 'transfer', account: String(accountId) } })}
          canExchange={codes.length >= 1}
        />
        <ValasActivity
          period={detail.period}
          currencies={codes}
          filter={filter}
          onFilter={setFilter}
          items={activity}
          onOpenTx={txId => router.push({ pathname: '/tx/[id]', params: { id: String(txId) } })}
          onViewAll={viewAll}
        />
        <RatesLink latestRateAt={detail.latestRateAt} onPress={openRates} />
        <FrozenNote />
      </ScrollView>
      <AddCurrencySheet visible={sheet} onClose={() => setSheet(false)} added={codes} onPick={code => void onPick(code)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  header: { paddingHorizontal: 12 },
  headerRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { ...MonoText.titleM, color: MonoColors.text, flex: 1 },
  content: { padding: 16, gap: 20 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  message: { ...MonoText.body, color: MonoColors.textSecond, textAlign: 'center' },
  error: { ...MonoText.bodyS, color: MonoColors.negative },
});

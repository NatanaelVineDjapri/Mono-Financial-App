// Account detail (Account-Detail): where an account's balance comes from, and a statement of the
// month. A pushed screen at /account/[id] (no tab bar), reached from the Accounts cards and the
// Overview carousel. Edit (the pencil) opens /account/edit?id=; Add and Transfer open the
// transaction form with this account already chosen; "View all transactions" opens the
// Transactions tab filtered to this account. A Valas account has its own detail, built later.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { HeaderButton } from '@/components/HeaderButton';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { today as todayLocal } from '@/core/clock';
import type { ActivityFilter } from '@/domain/accountDetail';
import { ActionButtons, ActivitySection, BalanceHero, ReconCard } from '@/features/accounts/detail/AccountDetailView';
import { useAccountActivity, useAccountDetail } from '@/features/accounts/detail/useAccountDetail';
import { useStatsCollapsed } from '@/features/transactions/statsStore';
import { accountDetailLoadError, accountNotFoundMessage, backLabel, editAccountLabel, retryLabel, valasDetailComingLater } from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export default function AccountDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const accountId = Number(id);
  const [filter, setFilter] = useState<ActivityFilter>('all');

  const { data: detail, isLoading, isError, refetch } = useAccountDetail(accountId);
  const { data: activity } = useAccountActivity(accountId, detail?.period, filter);

  const header = (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <IconButton label={backLabel()} onPress={() => router.back()} testID="account-back">
          <Icon name="chevron-left" color={MonoColors.text} />
        </IconButton>
        <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
          {detail?.name ?? ''}
        </Text>
        {detail && detail.type !== 'forex' && (
          <HeaderButton icon="pencil" label={editAccountLabel()} onPress={() => router.push({ pathname: '/account/edit', params: { id: String(accountId) } } as never)} testID="account-edit" />
        )}
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

  if (detail.type === 'forex') {
    return (
      <View style={styles.screen}>
        {header}
        <View style={styles.centerFill}>
          <Text style={styles.message}>{valasDetailComingLater()}</Text>
        </View>
      </View>
    );
  }

  // The Transactions tab, narrowed to this account over its whole life (opening date to today).
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

  return (
    <View style={styles.screen}>
      {header}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]} testID="account-scroll">
        <BalanceHero detail={detail} />
        <ReconCard detail={detail} />
        <ActionButtons
          onAdd={() => router.push({ pathname: '/tx/add', params: { account: String(accountId) } })}
          onTransfer={() => router.push({ pathname: '/tx/add', params: { type: 'transfer', account: String(accountId) } })}
        />
        <ActivitySection
          period={detail.period}
          filter={filter}
          onFilter={setFilter}
          items={activity}
          onOpenTx={txId => router.push({ pathname: '/tx/[id]', params: { id: String(txId) } })}
          onViewAll={viewAll}
        />
      </ScrollView>
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
});

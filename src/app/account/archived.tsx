// Archived accounts (/account/archived, from the bottom of the Accounts tab): restore one, or delete it for good. What an
// account being deleted has recorded moves to another rupiah account first, with its balance, so net worth does not change.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BankTile } from '@/components/BankCard/BankTile';
import { HeaderRow } from '@/components/HeaderRow';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { Icon } from '@/components/Icon';
import { RemovalFlow, type RemovalTarget } from '@/components/RemovalFlow';
import { nowIso } from '@/core/clock';
import { rp, shown } from '@/core/money';
import { useDb } from '@/data/db/DbProvider';
import { invalidateAfterWrite, queryKeys } from '@/data/queryKeys';
import { countTransfersBetween, listArchivedAccountRows, type ArchivedAccountRow } from '@/data/repo/accounts';
import { deleteArchivedAccount, getAccountRemoval, restoreAccount } from '@/domain/accounts';
import {
  accArchivedIntro,
  accArchivedTitle,
  accRemoveEmptyBody,
  accRemoveMoveBody,
  accRemoveNoReplacement,
  accRestore,
  accRestoreLabel,
  backLabel,
  removeRowLabel,
  tabLabel,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

type Pending = RemovalTarget & { id: number; records: number; openingBalance: number; between: Record<number, number> };

export default function ArchivedAccountsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const db = useDb();
  const queryClient = useQueryClient();
  const hidden = useHideAmounts(s => s.hidden);
  const { data } = useQuery({ queryKey: [...queryKeys.accounts, 'archived'], queryFn: () => listArchivedAccountRows(db) });
  const [pending, setPending] = useState<Pending | null>(null);

  // Nothing left here: back to the accounts.
  useEffect(() => {
    if (data && data.length === 0) router.back();
  }, [data, router]);

  const restore = async (id: number) => {
    await restoreAccount(db, id);
    await invalidateAfterWrite(queryClient);
  };

  const startDelete = async (row: ArchivedAccountRow) => {
    const removal = await getAccountRemoval(db, row.id);
    if (!removal) return;
    const between: Record<number, number> = {};
    for (const other of removal.replacements) between[other.id] = await countTransfersBetween(db, row.id, other.id);
    setPending({
      id: row.id,
      name: row.name,
      needsReplacement: removal.needsReplacement,
      replacements: removal.replacements,
      records: removal.links.records,
      openingBalance: removal.links.openingBalance,
      between,
    });
  };

  const onDelete = async (replacementId: number | null) => {
    if (!pending) return false;
    const result = await deleteArchivedAccount(db, pending.id, replacementId, nowIso());
    if (result.ok) await invalidateAfterWrite(queryClient);
    return result.ok;
  };

  const money = (value: number) => shown(rp(value), hidden);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={backLabel()} hitSlop={4} style={styles.back} testID="archived-accounts-back">
          <Icon name="chevron-left" size={20} color={MonoColors.textSecond} />
          <Text style={styles.backText}>{tabLabel('accounts')}</Text>
        </Pressable>
      </View>
      <HeaderRow title={accArchivedTitle()} withTopInset={false} />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.intro}>{accArchivedIntro()}</Text>
        {!!data?.length && (
          <View style={styles.card}>
            {data.map((row, i) => (
              <View key={row.id} style={[styles.row, i > 0 && styles.rowDivider]} testID={`archived-account-${row.id}`}>
                <View style={styles.top}>
                  <BankTile icon={row.icon} type={row.type} size={40} />
                  <View style={styles.text}>
                    <Text style={styles.name}>{row.name}</Text>
                    <Text style={styles.balance}>{money(row.balance)}</Text>
                  </View>
                </View>
                <View style={styles.actions}>
                  <Pressable onPress={() => void restore(row.id)} accessibilityRole="button" accessibilityLabel={accRestoreLabel(row.name)} style={styles.action} testID={`archived-account-restore-${row.id}`}>
                    <Icon name="undo" size={16} color={MonoColors.text} />
                    <Text style={styles.actionText}>{accRestore()}</Text>
                  </Pressable>
                  {/* the Valas account is never archived by the app, and cannot be deleted */}
                  {row.type !== 'forex' && (
                    <Pressable onPress={() => void startDelete(row)} accessibilityRole="button" accessibilityLabel={removeRowLabel(row.name)} style={styles.action} testID={`archived-account-delete-${row.id}`}>
                      <Icon name="trash" size={16} color={MonoColors.negative} />
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <RemovalFlow
        target={pending}
        message={to =>
          to ? accRemoveMoveBody(pending?.records ?? 0, pending?.between[to.id] ?? 0, to.name) : accRemoveEmptyBody(money(pending?.openingBalance ?? 0))
        }
        noReplacement={accRemoveNoReplacement()}
        onDelete={onDelete}
        onClose={() => setPending(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  header: { paddingHorizontal: 8 },
  back: { minHeight: 44, minWidth: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 8 },
  backText: { ...MonoText.bodyS, color: MonoColors.textSecond },
  content: { paddingHorizontal: 16, gap: 16 },
  intro: { ...MonoText.bodyS, color: MonoColors.textSecond, paddingHorizontal: 4 },
  card: { backgroundColor: MonoColors.surface, borderRadius: 20, borderWidth: 1, borderColor: MonoColors.border, overflow: 'hidden' },
  row: { paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  rowDivider: { borderTopWidth: 1, borderTopColor: MonoColors.border },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { flex: 1, gap: 2 },
  name: { ...MonoText.bodyStrong, color: MonoColors.text },
  balance: { ...MonoText.figureS, color: MonoColors.textSecond },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  action: { minHeight: 44, minWidth: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: MonoColors.border, backgroundColor: MonoColors.card },
  actionText: { ...MonoText.bodyS, color: MonoColors.text },
});

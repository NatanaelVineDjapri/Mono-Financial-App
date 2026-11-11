// Transaction detail (Tx-Detail, Tx-Detail-Transfer, Tx-Detail-Valas, Tx-Delete): a pushed,
// read-only view of one record at /tx/[id], reached by tapping a transaction row. No tab bar.
// The bottom bar's Edit opens /tx/[id]/edit (the header has no pencil); Delete asks first, then goes back and shows a snackbar with Undo.
// The route stays thin: reads come from src/features/transactions/detail, every figure from
// the views behind them.
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState, type ComponentRef } from 'react';
import { AccessibilityInfo, findNodeHandle, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { showToast } from '@/components/toast-store';
import { money, rp, shown } from '@/core/money';
import { useDb } from '@/data/db/DbProvider';
import { deleteTransactionWithUndo } from '@/features/transactions/detail/deleteFlow';
import {
  BudgetCard,
  DetailsCard,
  HeroCard,
  RateFixedNote,
  TransferCard,
  TransferRowsCard,
  detailTitle,
} from '@/features/transactions/detail/TransactionDetailView';
import { useDeletePreview, useTransactionDetail } from '@/features/transactions/detail/useTransactionDetail';
import {
  backLabel,
  cancelLabel,
  deleteDialogParts,
  deleteDialogTitle,
  deleteLabel,
  editLabel,
  retryLabel,
  transactionDetailTitle,
  txDetailLoadError,
  txNotFoundMessage,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

const DIVIDER = '#272728';

function formatAmount(value: number, currency: string, minorFactor: number, sign = false): string {
  return currency === 'IDR' ? rp(value, sign) : money(value, currency, minorFactor, sign);
}

export default function TransactionDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const db = useDb();
  const queryClient = useQueryClient();
  const hidden = useHideAmounts(s => s.hidden);
  const { id } = useLocalSearchParams<{ id: string }>();
  const txId = Number(id);

  const { data: detail, isLoading, isError, refetch } = useTransactionDetail(txId);
  const { data: preview } = useDeletePreview(detail);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const deleteButtonRef = useRef<ComponentRef<typeof View>>(null);

  const goBack = useCallback(() => router.back(), [router]);
  const goEdit = useCallback(() => router.push({ pathname: '/tx/[id]/edit', params: { id: String(txId) } }), [router, txId]);

  // Focus goes to the dialog when it opens (ConfirmDialog does that) and back to the Delete
  // button when it closes without deleting.
  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    const handle = deleteButtonRef.current ? findNodeHandle(deleteButtonRef.current) : null;
    if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle);
  }, []);

  const confirmDelete = useCallback(async () => {
    setBusy(true);
    const result = await deleteTransactionWithUndo(db, queryClient, txId, () => {
      setDialogOpen(false);
      router.back();
    });
    setBusy(false);
    if (!result.ok) {
      closeDialog();
      showToast(result.message);
    }
  }, [db, queryClient, txId, router, closeDialog]);

  const header = (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <IconButton label={backLabel()} onPress={goBack} testID="tx-detail-back">
          <Icon name="chevron-left" color={MonoColors.text} />
        </IconButton>
        <Text style={styles.headerTitle} accessibilityRole="header">
          {transactionDetailTitle()}
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
          <Text style={styles.message}>{isError ? txDetailLoadError() : txNotFoundMessage()}</Text>
          {isError ? <Button label={retryLabel()} onPress={() => void refetch()} /> : <Button label={backLabel()} variant="secondary" onPress={goBack} />}
        </View>
      </View>
    );
  }

  const foreign = detail.currency !== 'IDR' && detail.kind !== 'transfer';
  const heroAmount = detail.kind === 'expense' ? -detail.amount : detail.amount;
  const amountText = shown(formatAmount(heroAmount, detail.currency, detail.minorFactor, detail.kind !== 'transfer'), hidden);
  const afterText = (value: number, currency: string, factor: number) => shown(formatAmount(value, currency, factor), hidden);
  const dialogParts = preview
    ? deleteDialogParts({
        title: detailTitle(detail),
        amount: amountText,
        accountName: detail.account.name,
        accountAfter: afterText(preview.accountAfter, detail.account.currency, detail.account.minorFactor),
        toAccountName: detail.toAccount?.name,
        toAccountAfter:
          detail.toAccount && preview.toAccountAfter != null
            ? afterText(preview.toAccountAfter, detail.toAccount.currency, detail.toAccount.minorFactor)
            : undefined,
        budgetCategory: detail.budget && preview.budgetSpentAfter != null ? detail.budget.categoryName : undefined,
        budgetAfter: detail.budget && preview.budgetSpentAfter != null ? shown(rp(preview.budgetSpentAfter), hidden) : undefined,
      })
    : [];

  return (
    <View style={styles.screen}>
      {header}
      <ScrollView contentContainerStyle={styles.content} testID="tx-detail-scroll">
        <HeroCard detail={detail} />
        {detail.kind === 'transfer' ? (
          <>
            <TransferCard detail={detail} />
            <TransferRowsCard detail={detail} />
          </>
        ) : (
          <DetailsCard detail={detail} />
        )}
        {foreign && <RateFixedNote />}
        {detail.budget && <BudgetCard detail={detail} />}
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: 16 + insets.bottom }]}>
        <Pressable
          ref={deleteButtonRef}
          onPress={() => setDialogOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={deleteLabel()}
          android_ripple={undefined}
          style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
          testID="tx-detail-delete"
        >
          <Icon name="trash" size={16} color={MonoColors.negative} />
          <Text style={styles.deleteText}>{deleteLabel()}</Text>
        </Pressable>
        <Button label={editLabel()} icon="pencil" onPress={goEdit} style={styles.editButton} testID="tx-detail-edit" />
      </View>

      <ConfirmDialog
        visible={dialogOpen}
        icon="trash"
        title={deleteDialogTitle()}
        message={dialogParts}
        cancelLabel={cancelLabel()}
        confirmLabel={deleteLabel()}
        busy={busy || !preview}
        onCancel={closeDialog}
        onConfirm={() => void confirmDelete()}
        testID="tx-delete-dialog"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  header: { paddingHorizontal: 12 },
  headerRow: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { ...MonoText.titleM, color: MonoColors.text, flex: 1 },
  content: { padding: 16, gap: 12 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  message: { ...MonoText.body, color: MonoColors.textSecond, textAlign: 'center' },
  bar: { flexDirection: 'row', gap: 12, paddingTop: 12, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: DIVIDER, backgroundColor: MonoColors.bg },
  deleteButton: {
    width: 120,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#151516',
    borderWidth: 1,
    borderColor: DIVIDER,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pressed: { opacity: 0.8 },
  deleteText: { ...MonoText.bodyStrong, color: MonoColors.negative },
  editButton: { flex: 1 },
});

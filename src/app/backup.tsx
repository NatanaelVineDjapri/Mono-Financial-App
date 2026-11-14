// Backup and restore screen (board I, PAGES.md I1/I2/I3).
// Matches the Claude Design / Figma board I1 layout and typography.
// ONE create-backup path: useCreateBackup. ONE restore path: restoreBackup from data/backup/restore.
// File picker: File.pickFileAsync() from expo-file-system (no extra dependency).
// Restore confirm flow is an inline sheet (not a route): safety-backup switch + required tick.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { File } from 'expo-file-system';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { HeaderRow } from '@/components/HeaderRow';
import { Icon } from '@/components/Icon';
import { MonoSwitch } from '@/components/MonoSwitch';
import { showToast } from '@/components/toast-store';
import { now } from '@/core/clock';
import { sha256Hex } from '@/core/sha256';
import { useDb } from '@/data/db/DbProvider';
import { restoreBackup } from '@/data/backup/restore';
import type { ValidationFailure } from '@/data/backup/validate';
import type { BackupFile } from '@/data/backup/export';
import { invalidateAfterWrite } from '@/data/queryKeys';
import { countTransactionsChangedSince, getLastBackupAt } from '@/data/repo/backupLog';
import { getSetting } from '@/data/repo/settings';
import { useCreateBackup } from '@/features/backup/useCreateBackup';
import { withLockSuspended } from '@/features/lock/useLock';
import { formatBackupTime } from '@/features/more/backupStatus';
import {
  backupAccountsLabel,
  backupBannerText,
  backupBannerTitle,
  backupBudgetsGoalsCatsLabel,
  backupChangesCount,
  backupChangesLabel,
  backupChooseFile,
  backupContentsTitle,
  backupCreateHelp,
  backupCreateNow,
  backupShareNow,
  backupCreating,
  backupFileLabel,
  backupFixedExpensesLabel,
  backupFormatNote,
  backupLastCardTitle,
  backupNever,
  backupRecentCaption,
  backupRecentEmpty,
  backupRecentTitle,
  backupRestoreSubtitle,
  backupRestoreTitle,
  backupSampleNote,
  backupSavedLabel,
  backupScreenTitle,
  backupSeeInvalidLink,
  backupSettingsIncluded,
  backupSettingsLabel,
  backupSizeLabel,
  backupTransactionsLabel,
  cancelLabel,
  moreBackLabel,
  moreBackText,
  restoreCheckChecksum,
  restoreCheckCounts,
  restoreCheckJson,
  restoreCheckMarker,
  restoreCheckRefs,
  restoreCheckVersion,
  restoreChooseAnother,
  restoreCompareAccounts,
  restoreCompareBudgets,
  restoreCompareCategories,
  restoreCompareGoals,
  restoreCompareHeader,
  restoreCompareRecurring,
  restoreCompareTransactions,
  restoreConfirmTick,
  restoreConfirmTitle,
  restoreFailedToast,
  restoreFileInfo,
  restoreFileSchemaV,
  restoreInvalidLead,
  restoreInvalidTitle,
  restorePickError,
  restoreReplaceButton,
  restoreReplacing,
  restoreSafetyBackupLabel,
  restoreSuccessToast,
  restoreWarning,
} from '@/i18n';
import { useLanguage } from '@/i18n/lang';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

// ---- Types ----

interface BackupLogRow {
  id: number;
  created_at: string;
  file_name: string;
  size_bytes: number;
  tx_count: number;
  kind: string;
}

interface CountsRow {
  n: number;
}

interface ScreenData {
  lastBackupAt: string | null;
  changedSince: number;
  timezone: string | null;
  recentLogs: BackupLogRow[];
  accountCount: number;
  txCount: number;
  budgetCount: number;
  goalCount: number;
  categoryCount: number;
  recurringCount: number;
}

interface PendingFile {
  uri: string;
  name: string;
  sizeBytes: number;
  raw: string;
}

interface ValidPending {
  pending: PendingFile;
  file: BackupFile;
  changedAfter: number;
}

function kb(bytes: number): string {
  return Math.round(bytes / 1024).toString();
}

// ---- Sub-components ----

function InfoRow({ label, pass }: { label: string; pass: boolean | null }) {
  const icon = pass === null ? 'minus' : pass ? 'check' : 'close';
  const color = pass === null ? MonoColors.textDisabled : pass ? MonoColors.text : MonoColors.negative;
  return (
    <View style={s.checkRow}>
      <Icon name={icon} size={16} color={color} />
      <Text style={[s.checkLabel, !pass && pass !== null && s.checkFail]}>{label}</Text>
    </View>
  );
}

// ---- Restore: invalid file panel (PAGES.md I3) ----

function InvalidPanel({
  pending,
  failure,
  onChooseAnother,
  onBack,
}: {
  pending: PendingFile;
  failure: ValidationFailure;
  onChooseAnother: () => void;
  onBack: () => void;
}) {
  const isJson = failure.reason !== 'not_json';
  const isMarked = isJson && failure.reason !== 'wrong_app';
  const isVersion = isMarked && failure.reason !== 'newer_schema_version';
  const isCounts = isVersion && failure.reason !== 'missing_table' && failure.reason !== 'count_mismatch';
  const isChecksum = isCounts && failure.reason !== 'checksum_mismatch';
  const isRefs = isChecksum && failure.reason !== 'broken_reference';

  const fileVersion = failure.reason === 'newer_schema_version' ? failure.fileVersion : 0;
  const supportedVersion = failure.reason === 'newer_schema_version' ? failure.supportedVersion : 8;

  return (
    <Animated.View entering={FadeIn} exiting={FadeOut} style={StyleSheet.absoluteFill}>
      <Pressable style={[StyleSheet.absoluteFill, s.sheetBackdrop]} onPress={onBack} accessible={false} />
      <View style={s.sheetWrap}>
        <View style={s.sheetCard}>
          <View style={s.sheetTitleRow}>
            <Icon name="alert-circle" size={20} color={MonoColors.negative} />
            <Text style={s.sheetTitle}>{restoreInvalidTitle()}</Text>
          </View>
          <Text style={s.sheetBody}>{restoreInvalidLead(pending.name)}</Text>

          <View style={s.checkList}>
            <InfoRow label={restoreCheckJson()} pass={isJson} />
            <InfoRow label={restoreCheckMarker()} pass={isMarked} />
            <InfoRow label={restoreCheckVersion(fileVersion, supportedVersion)} pass={isVersion} />
            <InfoRow label={restoreCheckCounts()} pass={isCounts ? true : isCounts === false ? false : null} />
            <InfoRow label={restoreCheckChecksum()} pass={isChecksum ? true : isChecksum === false ? false : null} />
            <InfoRow label={restoreCheckRefs()} pass={isRefs ? true : isRefs === false ? false : null} />
          </View>

          <View style={s.sheetButtons}>
            <Button
              label={cancelLabel()}
              variant="secondary"
              onPress={onBack}
              style={s.flex1}
              testID="restore-invalid-cancel"
            />
            <Button
              label={restoreChooseAnother()}
              onPress={onChooseAnother}
              style={s.flex1}
              testID="restore-invalid-choose-another"
            />
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

// ---- Restore: confirm panel (PAGES.md I2) ----

function ConfirmPanel({
  valid,
  deviceCounts,
  timezone,
  onCancel,
  onConfirm,
  restoring,
}: {
  valid: ValidPending;
  deviceCounts: { accounts: number; transactions: number; budgets: number; goals: number; categories: number; recurring: number };
  timezone: string | null;
  onCancel: () => void;
  onConfirm: (safetyFirst: boolean) => void;
  restoring: boolean;
}) {
  const [safety, setSafety] = useState(true);
  const [ticked, setTicked] = useState(false);
  const language = useLanguage(st => st.language);

  const { file, pending } = valid;
  const exportedAt = file.exported_at;
  const dateTime = formatBackupTime(exportedAt, timezone, language);
  const warn = restoreWarning(valid.changedAfter, dateTime);

  return (
    <Animated.View entering={FadeIn} exiting={FadeOut} style={StyleSheet.absoluteFill}>
      <Pressable style={[StyleSheet.absoluteFill, s.sheetBackdrop]} onPress={restoring ? undefined : onCancel} accessible={false} />
      <View style={s.sheetWrap}>
        <View style={s.sheetCard}>
          <View style={s.sheetTitleRow}>
            <Icon name="database" size={20} color={MonoColors.text} />
            <Text style={s.sheetTitle}>{restoreConfirmTitle()}</Text>
          </View>

          <Text style={s.sheetMeta}>{restoreFileInfo(pending.name, dateTime, kb(pending.sizeBytes))}</Text>
          <Text style={s.sheetMeta}>{restoreFileSchemaV(file.schema_version)}</Text>

          <Text style={s.compareHeader}>{restoreCompareHeader()}</Text>
          <Text style={s.compareRow}>{restoreCompareAccounts(deviceCounts.accounts, file.counts.accounts)}</Text>
          <Text style={s.compareRow}>{restoreCompareTransactions(deviceCounts.transactions, file.counts.transactions)}</Text>
          <Text style={s.compareRow}>{restoreCompareBudgets(deviceCounts.budgets, file.counts.budgets)}</Text>
          <Text style={s.compareRow}>{restoreCompareGoals(deviceCounts.goals, file.counts.goals)}</Text>
          <Text style={s.compareRow}>{restoreCompareCategories(deviceCounts.categories, file.counts.categories)}</Text>
          <Text style={s.compareRow}>{restoreCompareRecurring(deviceCounts.recurring, file.counts.recurring)}</Text>

          <View style={s.warnBox}>
            <Icon name="alert" size={16} color={MonoColors.text} />
            <Text style={s.warnText}>{warn}</Text>
          </View>

          <View style={s.switchRow}>
            <Text style={s.switchLabel}>{restoreSafetyBackupLabel()}</Text>
            <MonoSwitch value={safety} onValueChange={setSafety} label={restoreSafetyBackupLabel()} disabled={restoring} />
          </View>

          <Pressable
            onPress={() => setTicked(t => !t)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: ticked }}
            accessibilityLabel={restoreConfirmTick()}
            android_ripple={undefined}
            style={s.tickRow}
            disabled={restoring}
          >
            <View style={[s.tickBox, ticked && s.tickBoxChecked]}>
              {ticked && <Icon name="check" size={16} color={MonoColors.bg} />}
            </View>
            <Text style={s.tickLabel}>{restoreConfirmTick()}</Text>
          </Pressable>

          <View style={s.sheetButtons}>
            <Button
              label={cancelLabel()}
              variant="secondary"
              disabled={restoring}
              onPress={onCancel}
              style={s.flex1}
              testID="restore-confirm-cancel"
            />
            <Button
              label={restoring ? restoreReplacing() : restoreReplaceButton()}
              disabled={!ticked || restoring}
              loading={restoring}
              onPress={() => onConfirm(safety)}
              style={s.flex1}
              testID="restore-confirm-replace"
            />
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

// ---- Main screen (PAGES.md I1) ----

export default function BackupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const db = useDb();
  const queryClient = useQueryClient();
  const language = useLanguage(st => st.language);
  const { create: createBackup, busy: backupBusy } = useCreateBackup();

  // Overlay state
  const [pending, setPending] = useState<PendingFile | null>(null);
  const [validPending, setValidPending] = useState<ValidPending | null>(null);
  const [invalidFailure, setInvalidFailure] = useState<ValidationFailure | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [picking, setPicking] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ['backup-screen'],
    queryFn: async (): Promise<ScreenData> => {
      const [lastBackupAt, timezone, accounts, transactions, budgets, goals, categories, recurring, logs] = await Promise.all([
        getLastBackupAt(db),
        getSetting(db, 'timezone'),
        db.getFirstAsync<CountsRow>('select count(*) as n from accounts where archived = 0'),
        db.getFirstAsync<CountsRow>('select count(*) as n from transactions'),
        db.getFirstAsync<CountsRow>('select count(*) as n from budgets'),
        db.getFirstAsync<CountsRow>('select count(*) as n from goals'),
        db.getFirstAsync<CountsRow>('select count(*) as n from categories where archived = 0'),
        db.getFirstAsync<CountsRow>('select count(*) as n from recurring where archived = 0'),
        db.getAllAsync<BackupLogRow>('select * from backup_log order by created_at desc limit 10'),
      ]);
      const changedSince = lastBackupAt ? await countTransactionsChangedSince(db, lastBackupAt) : 0;
      return {
        lastBackupAt,
        changedSince,
        timezone: timezone ?? null,
        recentLogs: logs,
        accountCount: accounts?.n ?? 0,
        txCount: transactions?.n ?? 0,
        budgetCount: budgets?.n ?? 0,
        goalCount: goals?.n ?? 0,
        categoryCount: categories?.n ?? 0,
        recurringCount: recurring?.n ?? 0,
      };
    },
  });

  useFocusEffect(useCallback(() => { void refetch(); }, [refetch]));

  const handlePick = async () => {
    if (picking) return;
    setPicking(true);
    try {
      const result = await withLockSuspended(() =>
        File.pickFileAsync({ mimeTypes: ['application/json', '*/*'] }),
      );
      if (result.canceled) return;
      const picked = result.result;
      const raw = await picked.text();
      const p: PendingFile = {
        uri: picked.uri,
        name: picked.name,
        sizeBytes: picked.size ?? raw.length,
        raw,
      };
      setPending(p);

      const { validateBackup } = await import('@/data/backup/validate');
      const vr = await validateBackup(raw, sha256Hex);
      if (!vr.ok) {
        setInvalidFailure(vr);
        setValidPending(null);
      } else {
        const changedAfter = await countTransactionsChangedSince(db, vr.file.exported_at);
        setValidPending({ pending: p, file: vr.file, changedAfter });
        setInvalidFailure(null);
      }
    } catch {
      showToast(restorePickError());
    } finally {
      setPicking(false);
    }
  };

  const handleDemoInvalid = () => {
    setPending({
      uri: 'demo://invalid',
      name: 'mono-backup-future.json',
      sizeBytes: 41984,
      raw: '',
    });
    setInvalidFailure({
      ok: false,
      reason: 'newer_schema_version',
      fileVersion: 9,
      supportedVersion: 8,
    });
    setValidPending(null);
  };

  const dismissSheet = () => {
    setPending(null);
    setValidPending(null);
    setInvalidFailure(null);
  };

  const handleRestore = async (safetyFirst: boolean) => {
    if (!validPending || restoring) return;
    setRestoring(true);
    try {
      const result = await restoreBackup(db, validPending.pending.raw, now().toISOString(), sha256Hex, { takeSafetyBackup: safetyFirst });
      if (!result.ok) {
        showToast(restoreFailedToast());
        return;
      }
      await invalidateAfterWrite(queryClient);
      dismissSheet();
      showToast(restoreSuccessToast());
      void refetch();
    } catch {
      showToast(restoreFailedToast());
    } finally {
      setRestoring(false);
    }
  };

  const deviceCounts = data ? {
    accounts: data.accountCount,
    transactions: data.txCount,
    budgets: data.budgetCount,
    goals: data.goalCount,
    categories: data.categoryCount,
    recurring: data.recurringCount,
  } : { accounts: 0, transactions: 0, budgets: 0, goals: 0, categories: 0, recurring: 0 };

  const tz = data?.timezone;
  const lastAt = data?.lastBackupAt ?? null;
  const lastLog = data?.recentLogs[0] ?? null;

  const lastDisplayDate = lastAt
    ? formatBackupTime(lastAt, tz, language)
    : backupNever();
  const lastFileName = lastLog?.file_name ?? '—';
  const lastFileSize = lastLog ? `${kb(lastLog.size_bytes)} KB` : '—';

  return (
    <View style={s.screen} testID="backup-screen">
      {/* Top back button: "< More" */}
      <View style={[s.backRow, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={moreBackLabel()}
          hitSlop={8}
          android_ripple={undefined}
          style={({ pressed }) => [s.backBtn, pressed && s.pressed]}
          testID="backup-back"
        >
          <Icon name="chevron-left" size={20} color={MonoColors.textSecond} />
          <Text style={s.backText}>{moreBackText()}</Text>
        </Pressable>
      </View>

      {/* Screen Title: serif "Backup & restore" */}
      <HeaderRow title={backupScreenTitle()} withTopInset={false} />

      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: 28 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        testID="backup-scroll"
      >
        {/* 1. Banner: Your data lives only on this device */}
        <View style={s.bannerCard}>
          <Icon name="lock" size={20} color={MonoColors.text} />
          <View style={s.bannerTextWrap}>
            <Text style={s.bannerTitle}>{backupBannerTitle()}</Text>
            <Text style={s.bannerSub}>{backupBannerText()}</Text>
          </View>
        </View>

        {/* 2. Last backup Card */}
        <View style={s.card}>
          <Text style={s.cardTitle}>{backupLastCardTitle()}</Text>

          <View style={s.kvList}>
            <View style={s.kvRow}>
              <Text style={s.kvLabel}>{backupSavedLabel()}</Text>
              <Text style={s.kvValue}>{lastDisplayDate}</Text>
            </View>
            <View style={s.kvRow}>
              <Text style={s.kvLabel}>{backupFileLabel()}</Text>
              <Text style={s.kvValueMono} numberOfLines={1} ellipsizeMode="middle">{lastFileName}</Text>
            </View>
            <View style={s.kvRow}>
              <Text style={s.kvLabel}>{backupSizeLabel()}</Text>
              <Text style={s.kvValue}>{lastFileSize}</Text>
            </View>
            <View style={s.kvRow}>
              <Text style={s.kvLabel}>{backupChangesLabel()}</Text>
              <Text style={s.kvValue}>{backupChangesCount(data?.changedSince ?? 0)}</Text>
            </View>
          </View>

          <Button
            label={backupBusy ? backupCreating() : backupCreateNow()}
            icon="download"
            loading={backupBusy}
            onPress={() => void createBackup('folder')}
            style={s.cardBtn}
            testID="backup-create-btn"
          />
          <Button
            label={backupShareNow()}
            icon="upload"
            variant="secondary"
            disabled={backupBusy}
            onPress={() => void createBackup('share')}
            style={s.cardBtn}
            testID="backup-share-btn"
          />

          <Text style={s.cardCaption}>{backupCreateHelp()}</Text>
        </View>

        {/* 3. What a backup contains Card */}
        <View style={s.card}>
          <Text style={s.cardTitle}>{backupContentsTitle()}</Text>

          <View style={s.tableList}>
            <View style={s.tableRow}>
              <Text style={s.tableLabel}>{backupAccountsLabel()}</Text>
              <Text style={s.tableValue}>{data?.accountCount ?? 0}</Text>
            </View>
            <View style={s.tableRow}>
              <Text style={s.tableLabel}>{backupTransactionsLabel()}</Text>
              <Text style={s.tableValue}>{data?.txCount ?? 0}</Text>
            </View>
            <View style={s.tableRow}>
              <Text style={s.tableLabel}>{backupBudgetsGoalsCatsLabel()}</Text>
              <Text style={s.tableValue}>
                {data ? `${data.budgetCount} · ${data.goalCount} · ${data.categoryCount}` : '0 · 0 · 0'}
              </Text>
            </View>
            <View style={s.tableRow}>
              <Text style={s.tableLabel}>{backupFixedExpensesLabel()}</Text>
              <Text style={s.tableValue}>{data?.recurringCount ?? 0}</Text>
            </View>
            <View style={[s.tableRow, s.tableRowLast]}>
              <Text style={s.tableLabel}>{backupSettingsLabel()}</Text>
              <Text style={s.tableValue}>{backupSettingsIncluded()}</Text>
            </View>
          </View>

          <Text style={s.cardCaption}>{backupFormatNote(1)}</Text>
        </View>

        {/* 4. Restore from a backup Card */}
        <View style={s.card}>
          <Text style={s.cardTitle}>{backupRestoreTitle()}</Text>
          <Text style={s.restoreSub}>{backupRestoreSubtitle()}</Text>

          <Button
            label={backupChooseFile()}
            icon="upload"
            variant="secondary"
            loading={picking}
            onPress={handlePick}
            testID="backup-choose-file"
          />

          <Pressable
            onPress={handleDemoInvalid}
            accessibilityRole="button"
            accessibilityLabel={backupSeeInvalidLink()}
            android_ripple={undefined}
            style={s.linkWrap}
            testID="backup-see-invalid-link"
          >
            <Text style={s.linkText}>{backupSeeInvalidLink()}</Text>
          </Pressable>
        </View>

        {/* 5. Recent backups Card */}
        <View style={s.card}>
          <Text style={s.cardTitle}>{backupRecentTitle()}</Text>

          {data && data.recentLogs.length === 0 ? (
            <Text style={s.emptyText}>{backupRecentEmpty()}</Text>
          ) : (
            <View style={s.recentList}>
              {(data?.recentLogs ?? []).slice(0, 3).map((log, index, arr) => (
                <View key={log.id} style={[s.recentRow, index === arr.length - 1 && s.tableRowLast]}>
                  <Icon name="file" size={20} color={MonoColors.textSecond} />
                  <View style={s.recentTextWrap}>
                    <Text style={s.recentDate}>
                      {formatBackupTime(log.created_at, tz, language).replace(/ [A-Z]{3,4}$/, '')}
                    </Text>
                    <Text style={s.recentMeta}>
                      {log.file_name} · {kb(log.size_bytes)} KB
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          <Text style={s.cardCaption}>{backupRecentCaption()}</Text>
        </View>

        {/* 6. Footer disclaimer */}
        <View style={s.footerNote}>
          <Icon name="info" size={16} color={MonoColors.textMeta} />
          <Text style={s.footerNoteText}>{backupSampleNote()}</Text>
        </View>
      </ScrollView>

      {/* Overlay: Invalid file panel (I3) */}
      {pending && invalidFailure && (
        <InvalidPanel
          pending={pending}
          failure={invalidFailure}
          onBack={dismissSheet}
          onChooseAnother={() => {
            dismissSheet();
            void handlePick();
          }}
        />
      )}

      {/* Overlay: Confirm replacement panel (I2) */}
      {pending && validPending && (
        <ConfirmPanel
          valid={validPending}
          deviceCounts={deviceCounts}
          timezone={tz ?? null}
          onCancel={dismissSheet}
          onConfirm={handleRestore}
          restoring={restoring}
        />
      )}
    </View>
  );
}

// ---- Styles matching the Claude Design / Figma canvas ----

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },

  backRow: {
    paddingHorizontal: 16,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 40,
    paddingRight: 8,
  },
  backText: {
    ...MonoText.body,
    fontSize: 15,
    color: MonoColors.textSecond,
  },

  content: {
    paddingHorizontal: 16,
    gap: 12,
  },

  // 1. Banner
  bannerCard: {
    backgroundColor: '#151516',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#272728',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  bannerTextWrap: {
    flex: 1,
    gap: 4,
  },
  bannerTitle: {
    ...MonoText.bodyStrong,
    fontSize: 15,
    lineHeight: 20,
    color: MonoColors.text,
  },
  bannerSub: {
    ...MonoText.bodyS,
    fontSize: 13,
    lineHeight: 18,
    color: MonoColors.textMeta,
  },

  // Cards
  card: {
    backgroundColor: '#151516',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#272728',
    padding: 16,
  },
  cardTitle: {
    ...MonoText.h2,
    fontSize: 15,
    lineHeight: 20,
    color: MonoColors.text,
    marginBottom: 12,
  },

  // KV list (Last backup)
  kvList: {
    gap: 8,
  },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 24,
  },
  kvLabel: {
    ...MonoText.body,
    fontSize: 14,
    color: MonoColors.textMeta,
  },
  kvValue: {
    ...MonoText.bodyStrong,
    fontSize: 14,
    color: MonoColors.text,
  },
  kvValueMono: {
    ...MonoText.mono,
    fontSize: 13,
    color: MonoColors.text,
    maxWidth: '65%',
  },

  cardBtn: {
    marginTop: 16,
  },
  cardCaption: {
    ...MonoText.caption,
    fontSize: 13,
    lineHeight: 18,
    color: MonoColors.textDisabled,
    marginTop: 10,
  },

  // Table list (What a backup contains)
  tableList: {
    borderTopWidth: 1,
    borderTopColor: '#202022',
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#202022',
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tableLabel: {
    ...MonoText.body,
    fontSize: 14,
    color: MonoColors.textMeta,
  },
  tableValue: {
    ...MonoText.bodyStrong,
    fontSize: 14,
    color: MonoColors.text,
  },

  // Restore card
  restoreSub: {
    ...MonoText.bodyS,
    fontSize: 13,
    lineHeight: 18,
    color: MonoColors.textMeta,
    marginBottom: 14,
  },
  linkWrap: {
    marginTop: 14,
    alignSelf: 'flex-start',
  },
  linkText: {
    ...MonoText.bodyS,
    fontSize: 13,
    color: MonoColors.textSecond,
    textDecorationLine: 'underline',
  },

  // Recent backups card
  emptyText: {
    ...MonoText.bodyS,
    fontSize: 13,
    color: MonoColors.textMeta,
    paddingVertical: 8,
  },
  recentList: {
    borderTopWidth: 1,
    borderTopColor: '#202022',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#202022',
  },
  recentTextWrap: {
    flex: 1,
    gap: 2,
  },
  recentDate: {
    ...MonoText.bodyStrong,
    fontSize: 14,
    color: MonoColors.text,
  },
  recentMeta: {
    ...MonoText.mono,
    fontSize: 12,
    color: MonoColors.textMeta,
  },

  // Footer note
  footerNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 4,
    marginTop: 4,
    marginBottom: 8,
  },
  footerNoteText: {
    ...MonoText.caption,
    fontSize: 12,
    lineHeight: 16,
    color: MonoColors.textDisabled,
    flex: 1,
  },

  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },

  // Sheets (Invalid and Confirm)
  sheetBackdrop: { backgroundColor: 'rgba(0,0,0,0.66)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 16, paddingBottom: 32 },
  sheetCard: {
    backgroundColor: '#151516',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#272728',
    padding: 16,
    gap: 12,
  },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sheetTitle: { ...MonoText.titleM, color: MonoColors.text, flex: 1 },
  sheetBody: { ...MonoText.bodyS, color: MonoColors.textSecond },
  sheetMeta: { ...MonoText.mono, color: MonoColors.textMeta, fontSize: 12 },

  checkList: { gap: 6, marginVertical: 4 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkLabel: { ...MonoText.bodyS, color: MonoColors.textSecond, flex: 1 },
  checkFail: { color: MonoColors.negative },

  compareHeader: { ...MonoText.h2, color: MonoColors.text, marginTop: 4 },
  compareRow: { ...MonoText.bodyS, color: MonoColors.textSecond },

  warnBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: MonoColors.surface,
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
  },
  warnText: { ...MonoText.bodyS, color: MonoColors.textSecond, flex: 1 },

  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  switchLabel: { ...MonoText.body, color: MonoColors.text, flex: 1, marginRight: 12 },

  tickRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, minHeight: 44, paddingVertical: 8 },
  tickBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: MonoColors.textDisabled,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  tickBoxChecked: { backgroundColor: MonoColors.text, borderColor: MonoColors.text },
  tickLabel: { ...MonoText.bodyS, color: MonoColors.textSecond, flex: 1 },

  sheetButtons: { flexDirection: 'row', gap: 12, marginTop: 4 },
  flex1: { flex: 1 },
});

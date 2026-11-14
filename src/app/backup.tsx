// Backup and restore screen (board I, PAGES.md I1/I2/I3).
// ONE create-backup path: useCreateBackup. ONE restore path: restoreBackup from data/backup/restore.
// File picker: File.pickFileAsync() from expo-file-system (no extra dependency).
// Restore confirm flow is an inline sheet (not a route): safety-backup switch + required tick.
import { useQueryClient } from '@tanstack/react-query';
import { File } from 'expo-file-system';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/Card';
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
import { formatBackupTime } from '@/features/more/backupStatus';
import {
  backupBannerText,
  backupChooseFile,
  backupContentsAccounts,
  backupContentsBudgets,
  backupContentsCategories,
  backupContentsFormat,
  backupContentsGoals,
  backupContentsRecurring,
  backupContentsSettings,
  backupContentsTitle,
  backupContentsTransactions,
  backupCreateNow,
  backupCreating,
  backupLastFull,
  backupNeverDone,
  backupRecentEmpty,
  backupRecentRow,
  backupRecentTitle,
  backupRestoreTitle,
  backupScreenTitle,
  cancelLabel,
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
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

// ---- Types ----

interface BackupLogRow { id: number; created_at: string; file_name: string; size_bytes: number; tx_count: number; kind: string }
interface CountsRow { n: number }

interface ScreenData {
  lastBackupAt: string | null;
  changedSince: number;
  timezone: string | null;
  recentLogs: BackupLogRow[];
  // counts for the contents section (live from the DB)
  accountCount: number;
  txCount: number;
  budgetCount: number;
  goalCount: number;
  categoryCount: number;
  recurringCount: number;
}

// A picked file before it is validated
interface PendingFile {
  uri: string;
  name: string;
  sizeBytes: number;
  raw: string;
}

// What to show when the file is valid and we are in the confirm flow
interface ValidPending {
  pending: PendingFile;
  file: BackupFile;
  changedAfter: number; // transactions added after the backup's exported_at
}

// ---- Helpers ----

function kb(bytes: number): string {
  return Math.round(bytes / 1024).toString();
}

// ---- Sub-components ----

function SectionTitle({ children }: { children: string }) {
  return <Text style={s.sectionTitle} accessibilityRole="header">{children}</Text>;
}

function InfoRow({ label, pass }: { label: string; pass: boolean | null }) {
  // pass=null = skipped (grey), true = check, false = x
  const icon = pass === null ? 'minus' : pass ? 'check' : 'close';
  const color = pass === null ? MonoColors.textDisabled : pass ? MonoColors.text : MonoColors.negative;
  return (
    <View style={s.checkRow}>
      <Icon name={icon} size={16} color={color} />
      <Text style={[s.checkLabel, !pass && pass !== null && s.checkFail]}>{label}</Text>
    </View>
  );
}

// ---- Restore: invalid file panel ----

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
  // ponytail: supportedVersion comes from ValidationFailure.supportedVersion, only present for newer_schema_version
  const supportedVersion = failure.reason === 'newer_schema_version' ? failure.supportedVersion : 8;

  return (
    <Animated.View entering={FadeIn} exiting={FadeOut} style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, s.sheetBackdrop]} />
      <View style={s.sheetWrap}>
        <Card style={s.sheetCard}>
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
            <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={cancelLabel()} android_ripple={undefined}
              style={({ pressed }) => [s.btn, s.btnOutline, pressed && s.pressed]}>
              <Text style={[MonoText.bodyStrong, { color: MonoColors.text }]}>{cancelLabel()}</Text>
            </Pressable>
            <Pressable onPress={onChooseAnother} accessibilityRole="button" accessibilityLabel={restoreChooseAnother()} android_ripple={undefined}
              style={({ pressed }) => [s.btn, s.btnSolid, pressed && s.pressed]}>
              <Text style={[MonoText.bodyStrong, { color: MonoColors.bg }]}>{restoreChooseAnother()}</Text>
            </Pressable>
          </View>
        </Card>
      </View>
    </Animated.View>
  );
}

// ---- Restore: confirm panel ----

function ConfirmPanel({
  valid,
  deviceCounts,
  onCancel,
  onConfirm,
  restoring,
}: {
  valid: ValidPending;
  deviceCounts: { accounts: number; transactions: number; budgets: number; goals: number; categories: number; recurring: number };
  onCancel: () => void;
  onConfirm: (safetyFirst: boolean) => void;
  restoring: boolean;
}) {
  const [safety, setSafety] = useState(true);
  const [ticked, setTicked] = useState(false);
  const db = useDb();

  const { file, pending } = valid;
  const [timezone, setTimezone] = useState<string | null>(null);
  // load timezone once
  useState(() => { void getSetting(db, 'timezone').then(setTimezone); });

  const exportedAt = file.exported_at;
  const dateTime = formatBackupTime(exportedAt, timezone);

  const warn = restoreWarning(valid.changedAfter, dateTime);

  return (
    <Animated.View entering={FadeIn} exiting={FadeOut} style={StyleSheet.absoluteFill}>
      <Pressable style={[StyleSheet.absoluteFill, s.sheetBackdrop]} onPress={restoring ? undefined : onCancel} accessible={false} />
      <View style={s.sheetWrap}>
        <Card style={s.sheetCard}>
          <View style={s.sheetTitleRow}>
            <Icon name="database" size={20} color={MonoColors.text} />
            <Text style={s.sheetTitle}>{restoreConfirmTitle()}</Text>
          </View>

          {/* File info */}
          <Text style={s.sheetMeta}>{restoreFileInfo(pending.name, dateTime, kb(pending.sizeBytes))}</Text>
          <Text style={s.sheetMeta}>{restoreFileSchemaV(file.schema_version)}</Text>

          {/* Compare */}
          <Text style={s.compareHeader}>{restoreCompareHeader()}</Text>
          <Text style={s.compareRow}>{restoreCompareAccounts(deviceCounts.accounts, file.counts.accounts)}</Text>
          <Text style={s.compareRow}>{restoreCompareTransactions(deviceCounts.transactions, file.counts.transactions)}</Text>
          <Text style={s.compareRow}>{restoreCompareBudgets(deviceCounts.budgets, file.counts.budgets)}</Text>
          <Text style={s.compareRow}>{restoreCompareGoals(deviceCounts.goals, file.counts.goals)}</Text>
          <Text style={s.compareRow}>{restoreCompareCategories(deviceCounts.categories, file.counts.categories)}</Text>
          <Text style={s.compareRow}>{restoreCompareRecurring(deviceCounts.recurring, file.counts.recurring)}</Text>

          {/* Warning */}
          <View style={s.warnBox}>
            <Icon name="alert" size={16} color={MonoColors.text} />
            <Text style={s.warnText}>{warn}</Text>
          </View>

          {/* Safety backup switch */}
          <View style={s.switchRow}>
            <Text style={s.switchLabel}>{restoreSafetyBackupLabel()}</Text>
            <MonoSwitch value={safety} onValueChange={setSafety} label={restoreSafetyBackupLabel()} disabled={restoring} />
          </View>

          {/* Required tick */}
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

          {/* Buttons */}
          <View style={s.sheetButtons}>
            <Pressable onPress={restoring ? undefined : onCancel} accessibilityRole="button" accessibilityLabel={cancelLabel()}
              android_ripple={undefined} style={({ pressed }) => [s.btn, s.btnOutline, pressed && s.pressed, restoring && s.disabled]}>
              <Text style={[MonoText.bodyStrong, { color: MonoColors.text }]}>{cancelLabel()}</Text>
            </Pressable>
            <Pressable
              onPress={!ticked || restoring ? undefined : () => onConfirm(safety)}
              accessibilityRole="button"
              accessibilityLabel={restoring ? restoreReplacing() : restoreReplaceButton()}
              accessibilityState={{ disabled: !ticked || restoring, busy: restoring }}
              android_ripple={undefined}
              style={({ pressed }) => [s.btn, s.btnSolid, (!ticked || restoring) && s.disabled, pressed && s.pressed]}
            >
              <Text style={[MonoText.bodyStrong, { color: MonoColors.bg }]}>
                {restoring ? restoreReplacing() : restoreReplaceButton()}
              </Text>
            </Pressable>
          </View>
        </Card>
      </View>
    </Animated.View>
  );
}

// ---- Main screen ----

export default function BackupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const db = useDb();
  const queryClient = useQueryClient();
  const { create: createBackup, busy: backupBusy } = useCreateBackup();

  const [data, setData] = useState<ScreenData | null>(null);

  // panel state
  const [pending, setPending] = useState<PendingFile | null>(null);
  const [validPending, setValidPending] = useState<ValidPending | null>(null);
  const [invalidFailure, setInvalidFailure] = useState<ValidationFailure | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [picking, setPicking] = useState(false);

  const load = useCallback(async () => {
    const [lastBackupAt, timezone, accounts, transactions, budgets, goals, categories, recurring, logs] = await Promise.all([
      getLastBackupAt(db),
      getSetting(db, 'timezone'),
      db.getFirstAsync<CountsRow>('select count(*) as n from accounts'),
      db.getFirstAsync<CountsRow>('select count(*) as n from transactions'),
      db.getFirstAsync<CountsRow>('select count(*) as n from budgets'),
      db.getFirstAsync<CountsRow>('select count(*) as n from goals'),
      db.getFirstAsync<CountsRow>('select count(*) as n from categories'),
      db.getFirstAsync<CountsRow>('select count(*) as n from recurring'),
      db.getAllAsync<BackupLogRow>('select * from backup_log order by created_at desc limit 10'),
    ]);
    const changedSince = lastBackupAt ? await countTransactionsChangedSince(db, lastBackupAt) : 0;
    setData({
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
    });
  }, [db]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const handlePick = async () => {
    if (picking) return;
    setPicking(true);
    try {
      const result = await File.pickFileAsync({ mimeTypes: ['application/json', '*/*'] });
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
      // validate
      const { validateBackup } = await import('@/data/backup/validate');
      const vr = await validateBackup(raw, sha256Hex);
      if (!vr.ok) {
        setInvalidFailure(vr);
        setValidPending(null);
      } else {
        // how many device transactions are newer than the backup?
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
      void load();
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
  const lastDisplay = lastAt
    ? backupLastFull(
        formatBackupTime(lastAt, tz),
        lastLog?.file_name ?? '',
        lastLog ? kb(lastLog.size_bytes) : '?',
        data?.changedSince ?? 0,
      )
    : backupNeverDone();

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back"
          android_ripple={undefined} hitSlop={4} style={({ pressed }) => [s.back, pressed && s.pressed]}>
          <Icon name="chevron-left" color={MonoColors.text} />
        </Pressable>
        <Text style={s.headerTitle} accessibilityRole="header">{backupScreenTitle()}</Text>
      </View>

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: 32 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        {/* Banner */}
        <View style={s.banner}>
          <Icon name="lock" size={20} color={MonoColors.textMeta} />
          <Text style={s.bannerText}>{backupBannerText()}</Text>
        </View>

        {/* Last backup */}
        <Card style={s.lastCard}>
          <View style={s.lastRow}>
            {!lastAt && <Icon name="alert" size={16} color={MonoColors.text} />}
            <Text style={s.lastText}>{lastDisplay}</Text>
          </View>
        </Card>

        {/* Create backup */}
        <Pressable
          onPress={backupBusy ? undefined : createBackup}
          accessibilityRole="button"
          accessibilityLabel={backupBusy ? backupCreating() : backupCreateNow()}
          accessibilityState={{ busy: backupBusy }}
          android_ripple={undefined}
          style={({ pressed }) => [s.createBtn, pressed && s.pressed, backupBusy && s.disabled]}
          testID="backup-create-btn"
        >
          <Icon name="download" size={20} color={MonoColors.bg} />
          <Text style={s.createBtnText}>{backupBusy ? backupCreating() : backupCreateNow()}</Text>
        </Pressable>

        {/* Contents */}
        <SectionTitle>{backupContentsTitle()}</SectionTitle>
        <Card>
          <Text style={s.contentLine}>{backupContentsAccounts(data?.accountCount ?? 0)}</Text>
          <Text style={s.contentLine}>{backupContentsTransactions(data?.txCount ?? 0)}</Text>
          <Text style={s.contentLine}>{backupContentsBudgets(data?.budgetCount ?? 0)} · {backupContentsGoals(data?.goalCount ?? 0)}</Text>
          <Text style={s.contentLine}>{backupContentsCategories(data?.categoryCount ?? 0)}</Text>
          <Text style={s.contentLine}>{backupContentsRecurring(data?.recurringCount ?? 0)}</Text>
          <Text style={s.contentLine}>{backupContentsSettings()}</Text>
          <Text style={[s.contentLine, s.meta]}>{backupContentsFormat()}</Text>
        </Card>

        {/* Restore */}
        <SectionTitle>{backupRestoreTitle()}</SectionTitle>
        <Pressable
          onPress={picking ? undefined : handlePick}
          accessibilityRole="button"
          accessibilityLabel={backupChooseFile()}
          android_ripple={undefined}
          style={({ pressed }) => [s.chooseBtn, pressed && s.pressed, picking && s.disabled]}
          testID="backup-choose-file"
        >
          <Icon name="database" size={20} color={MonoColors.text} />
          <Text style={s.chooseBtnText}>{backupChooseFile()}</Text>
        </Pressable>

        {/* Recent backups */}
        <SectionTitle>{backupRecentTitle()}</SectionTitle>
        {data && data.recentLogs.length === 0 ? (
          <Text style={s.empty}>{backupRecentEmpty()}</Text>
        ) : (
          <Card style={{ gap: 8 }}>
            {(data?.recentLogs ?? []).map(log => (
              <Text key={log.id} style={s.logRow}>
                {backupRecentRow(log.file_name, formatBackupTime(log.created_at, tz), kb(log.size_bytes))}
              </Text>
            ))}
          </Card>
        )}
      </ScrollView>

      {/* Overlay panels */}
      {pending && invalidFailure && (
        <InvalidPanel
          pending={pending}
          failure={invalidFailure}
          onBack={dismissSheet}
          onChooseAnother={() => { dismissSheet(); void handlePick(); }}
        />
      )}
      {pending && validPending && (
        <ConfirmPanel
          valid={validPending}
          deviceCounts={deviceCounts}
          onCancel={dismissSheet}
          onConfirm={handleRestore}
          restoring={restoring}
        />
      )}
    </View>
  );
}

// ---- Styles ----

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 4 },
  back: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { ...MonoText.titleM, color: MonoColors.text, flex: 1, marginLeft: 4 },
  content: { paddingHorizontal: 16, gap: 12 },

  banner: { flexDirection: 'row', gap: 10, backgroundColor: MonoColors.surface, borderRadius: 12, padding: 14, alignItems: 'flex-start' },
  bannerText: { ...MonoText.bodyS, color: MonoColors.textSecond, flex: 1 },

  lastCard: { gap: 2 },
  lastRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  lastText: { ...MonoText.bodyS, color: MonoColors.textSecond, flex: 1 },

  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: MonoColors.text, borderRadius: 16, minHeight: 48, paddingHorizontal: 20,
  },
  createBtnText: { ...MonoText.bodyStrong, color: MonoColors.bg },

  sectionTitle: { ...MonoText.label, color: MonoColors.textMeta, marginTop: 4, marginLeft: 4 },

  contentLine: { ...MonoText.bodyS, color: MonoColors.textSecond, lineHeight: 22 },
  meta: { color: MonoColors.textDisabled, marginTop: 4 },

  chooseBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: MonoColors.card, borderRadius: 16, minHeight: 48,
    paddingHorizontal: 16, borderWidth: 1, borderColor: MonoColors.border,
  },
  chooseBtnText: { ...MonoText.bodyStrong, color: MonoColors.text },

  empty: { ...MonoText.bodyS, color: MonoColors.textMeta, marginLeft: 4 },
  logRow: { ...MonoText.mono, color: MonoColors.textSecond, fontSize: 12, lineHeight: 18 },

  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },

  // Sheets
  sheetBackdrop: { backgroundColor: 'rgba(0,0,0,0.66)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 16, paddingBottom: 32 },
  sheetCard: { gap: 12 },
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

  warnBox: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: MonoColors.surface, borderRadius: 10, padding: 10, marginTop: 4 },
  warnText: { ...MonoText.bodyS, color: MonoColors.textSecond, flex: 1 },

  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  switchLabel: { ...MonoText.body, color: MonoColors.text, flex: 1, marginRight: 12 },

  tickRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, minHeight: 44, paddingVertical: 8 },
  tickBox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: MonoColors.textDisabled, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  tickBoxChecked: { backgroundColor: MonoColors.text, borderColor: MonoColors.text },
  tickLabel: { ...MonoText.bodyS, color: MonoColors.textSecond, flex: 1 },

  sheetButtons: { flexDirection: 'row', gap: 12, marginTop: 4 },
  btn: { flex: 1, minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnOutline: { borderWidth: 1, borderColor: MonoColors.border, backgroundColor: MonoColors.card },
  btnSolid: { backgroundColor: MonoColors.text },
});

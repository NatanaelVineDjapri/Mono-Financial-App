// Settings screen (/settings, board "Settings" J, PAGES.md J).
// Matches the Claude Design / Figma board J layout and typography.
// Sections: Privasi (app lock, hide amounts, block screenshots), Format (currency, rates,
// number format, month starts on, timezone), Asisten (AI chat, Gemini key, auto import),
// Data (notifications, backup & restore, categories), Hapus (erase all data with confirm),
// and Tentang (brand lockup, offline note, open-source licenses).
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { HeaderRow } from '@/components/HeaderRow';
import { useHideAmounts } from '@/components/hide-amounts-store';
import { Icon } from '@/components/Icon';
import { MonoSwitch } from '@/components/MonoSwitch';
import { Sheet } from '@/components/Sheet';
import { SheetHeader } from '@/components/SheetHeader';
import { showToast } from '@/components/toast-store';
import { setNumberFormat } from '@/core/money';
import { useDb } from '@/data/db/DbProvider';
import { invalidateAfterWrite, queryKeys } from '@/data/queryKeys';
import { getLastBackupAt } from '@/data/repo/backupLog';
import { getAllSettings, setSetting } from '@/data/repo/settings';
import { resetDatabase } from '@/dev/resetDatabase';
import { deleteKeyAndDisable, setAiEnabled } from '@/features/ai_chat/aiSettings';
import { hasKey } from '@/features/ai_chat/keystore';
import { getRatesOverview } from '@/features/fx/ratesOverview';
import { useImportApps } from '@/features/import/useImportApps';
import { withLockSuspended } from '@/features/lock/useLock';
import { formatBackupTime, zoneOf } from '@/features/more/backupStatus';
import {
  cancelLabel,
  moreBackLabel,
  moreBackText,
  moreSettingsTitle,
  settingsAboutAppTitle,
  settingsAboutLicensesSub,
  settingsAboutLicensesTitle,
  settingsAboutOfflineSub,
  settingsAboutOfflineTitle,
  settingsAboutVersion,
  settingsAiChatSub,
  settingsAiChatTitle,
  settingsAiKeyConfigured,
  settingsAiKeyNotSet,
  settingsAiKeySub,
  settingsAiKeyTitle,
  settingsAppLockPromptDisable,
  settingsAppLockPromptEnable,
  settingsAppLockSub,
  settingsAppLockTitle,
  settingsBackupSub,
  settingsBackupTitle,
  settingsBlockScreenshotsSub,
  settingsBlockScreenshotsTitle,
  settingsCategoriesSub,
  settingsCategoriesTitle,
  settingsCurrencySub,
  settingsCurrencyTitle,
  settingsCurrencyValue,
  settingsEraseDialogConfirm,
  settingsEraseDialogMessage,
  settingsEraseDialogTitle,
  settingsEraseSub,
  settingsEraseSuccessToast,
  settingsEraseTitle,
  settingsGroupAbout,
  settingsGroupAssistant,
  settingsGroupData,
  settingsGroupErase,
  settingsGroupFormat,
  settingsGroupPrivacy,
  settingsHideOnLaunchSub,
  settingsHideOnLaunchTitle,
  settingsImportAutoSub,
  settingsImportAutoTitle,
  settingsMonthStartSub,
  settingsMonthStartTitle,
  settingsMonthStartValue,
  settingsNoLockMessage,
  settingsNoLockOpenSettings,
  settingsNoLockTitle,
  settingsNotifBackupSub,
  settingsNotifBackupTitle,
  settingsNotificationsSub,
  settingsNotificationsTitle,
  settingsNotifRecurringSub,
  settingsNotifRecurringTitle,
  settingsNumberFormatId,
  settingsNumberFormatIntl,
  settingsNumberFormatSub,
  settingsNumberFormatTitle,
  settingsRatesSub,
  settingsRatesTitle,
  settingsRatesValue,
  settingsStatusActive,
  settingsStatusInactive,
  settingsTimezoneSub,
  settingsTimezoneTitle,
  settingsTimezoneValue,
} from '@/i18n';
import { useLanguage } from '@/i18n/lang';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

const TIMEZONES = [
  { key: 'Asia/Jakarta', label: 'WIB', offset: 7 },
  { key: 'Asia/Makassar', label: 'WITA', offset: 8 },
  { key: 'Asia/Jayapura', label: 'WIT', offset: 9 },
] as const;

const MONTH_DAYS = [1, 5, 10, 15, 20, 25, 28] as const;

const LICENSES = [
  { name: 'React Native', license: 'MIT License' },
  { name: 'Expo', license: 'MIT License' },
  { name: 'better-sqlite3 / expo-sqlite', license: 'MIT License' },
  { name: 'TanStack React Query', license: 'MIT License' },
  { name: 'React Native Reanimated', license: 'MIT License' },
  { name: 'Zustand', license: 'MIT License' },
  { name: 'Lucide Icons', license: 'ISC License' },
] as const;

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const db = useDb();
  const queryClient = useQueryClient();
  const language = useLanguage(s => s.language);

  // Import apps count
  const { data: importData } = useImportApps();
  const enabledApps = importData?.apps.filter(a => a.enabled === 1).length ?? 0;

  // Settings data query
  const { data: screenData, refetch } = useQuery({
    queryKey: [...queryKeys.settings, 'screen-overview'],
    queryFn: async () => {
      const [settingsMap, keySaved, lastBackup, rates, schemaRow] = await Promise.all([
        getAllSettings(db),
        hasKey(),
        getLastBackupAt(db),
        getRatesOverview(db),
        db.getFirstAsync<{ value: string }>("select value from meta where key = 'schema_version'").catch(() => null),
      ]);
      return {
        settings: settingsMap,
        hasKey: keySaved,
        lastBackupAt: lastBackup,
        rates,
        schemaVersion: schemaRow?.value ?? '1',
      };
    },
  });

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  // Dialog & sheet states
  const [eraseDialogOpen, setEraseDialogOpen] = useState(false);
  const [eraseBusy, setEraseBusy] = useState(false);
  const [noLockDialogOpen, setNoLockDialogOpen] = useState(false);
  const [tzSheetOpen, setTzSheetOpen] = useState(false);
  const [monthSheetOpen, setMonthSheetOpen] = useState(false);
  const [formatSheetOpen, setFormatSheetOpen] = useState(false);
  const [notifSheetOpen, setNotifSheetOpen] = useState(false);
  const [licensesSheetOpen, setLicensesSheetOpen] = useState(false);

  // Derived values
  const settings = screenData?.settings ?? {};
  const appLock = settings.app_lock !== '0';
  const hideOnLaunch = settings.hide_on_launch === '1';
  const blockScreenshots = settings.block_screenshots !== '0';
  const numFormat = settings.number_format ?? 'id_ID';
  const monthStartDay = parseInt(settings.month_start_day ?? '1', 10) || 1;
  const currentTz = settings.timezone ?? 'Asia/Jakarta';
  const zone = zoneOf(currentTz);
  const aiEnabled = settings.ai_enabled === '1' && (screenData?.hasKey ?? false);
  const backupReminder = settings.backup_reminder !== '0';
  const recurringReminder = settings.recurring_reminders !== '0';
  const notifActive = backupReminder || recurringReminder;

  // Toggle handlers
  const onToggleAppLock = async (val: boolean) => {
    try {
      if (val) {
        const hasHw = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        const enrolledLevel = await LocalAuthentication.getEnrolledLevelAsync();
        if (!hasHw || !isEnrolled || enrolledLevel === LocalAuthentication.SecurityLevel.NONE) {
          setNoLockDialogOpen(true);
          return;
        }

        const res = await withLockSuspended(() =>
          LocalAuthentication.authenticateAsync({
            promptMessage: settingsAppLockPromptEnable(),
            cancelLabel: cancelLabel(),
            disableDeviceFallback: false,
          }),
        );
        if (!res.success) return;
      } else {
        const res = await withLockSuspended(() =>
          LocalAuthentication.authenticateAsync({
            promptMessage: settingsAppLockPromptDisable(),
            cancelLabel: cancelLabel(),
            disableDeviceFallback: false,
          }),
        );
        if (!res.success) return;
      }

      await setSetting(db, 'app_lock', val ? '1' : '0');
      await invalidateAfterWrite(queryClient);
    } catch {
      // Keep switch in current state
    }
  };

  const onToggleHideOnLaunch = async (val: boolean) => {
    await setSetting(db, 'hide_on_launch', val ? '1' : '0');
    useHideAmounts.getState().setHidden(val);
    await invalidateAfterWrite(queryClient);
  };

  const onToggleBlockScreenshots = async (val: boolean) => {
    await setSetting(db, 'block_screenshots', val ? '1' : '0');
    await invalidateAfterWrite(queryClient);
  };

  const onToggleAiChat = async (val: boolean) => {
    if (val && !screenData?.hasKey) {
      router.push('/ai-setup' as never);
      return;
    }
    await setAiEnabled(db, val);
    await invalidateAfterWrite(queryClient);
  };

  const onSelectTimezone = async (tz: string) => {
    await setSetting(db, 'timezone', tz);
    await invalidateAfterWrite(queryClient);
    setTzSheetOpen(false);
  };

  const onSelectMonthStartDay = async (day: number) => {
    await setSetting(db, 'month_start_day', String(day));
    await invalidateAfterWrite(queryClient);
    setMonthSheetOpen(false);
  };

  const onSelectNumberFormat = async (fmt: string) => {
    await setSetting(db, 'number_format', fmt);
    if (fmt === 'id_ID' || fmt === 'en_US') {
      setNumberFormat(fmt);
    }
    await invalidateAfterWrite(queryClient);
    setFormatSheetOpen(false);
  };

  const onToggleBackupReminder = async (val: boolean) => {
    await setSetting(db, 'backup_reminder', val ? '1' : '0');
    await invalidateAfterWrite(queryClient);
  };

  const onToggleRecurringReminder = async (val: boolean) => {
    await setSetting(db, 'recurring_reminders', val ? '1' : '0');
    await invalidateAfterWrite(queryClient);
  };

  const onConfirmErase = async () => {
    setEraseBusy(true);
    try {
      await resetDatabase(db);
      await deleteKeyAndDisable(db);
      await invalidateAfterWrite(queryClient);
      setEraseDialogOpen(false);
      showToast(settingsEraseSuccessToast());
      void refetch();
    } finally {
      setEraseBusy(false);
    }
  };

  // Formatted labels
  const ratesTimeText = screenData?.rates?.lastSuccessAt
    ? formatBackupTime(screenData.rates.lastSuccessAt, currentTz, language).replace(/ [A-Z]{3,4}$/, '')
    : undefined;
  const ratesSubText = settingsRatesSub(ratesTimeText, screenData?.rates?.autoUpdate);

  const backupDateText = screenData?.lastBackupAt
    ? formatBackupTime(screenData.lastBackupAt, currentTz, language).split(',')[0]
    : null;
  const backupSubText = settingsBackupSub(backupDateText);

  return (
    <View style={styles.screen} testID="settings-screen">
      {/* Top back button: "< Lainnya" */}
      <View style={[styles.backRow, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={moreBackLabel()}
          hitSlop={8}
          android_ripple={undefined}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          testID="settings-back"
        >
          <Icon name="chevron-left" size={20} color={MonoColors.textSecond} />
          <Text style={styles.backText}>{moreBackText()}</Text>
        </Pressable>
      </View>

      {/* Screen Title: serif "Pengaturan" */}
      <HeaderRow title={moreSettingsTitle()} withTopInset={false} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 32 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. PRIVASI */}
        <Text style={[styles.sectionHeader, styles.sectionHeaderFirst]} accessibilityRole="header">
          {settingsGroupPrivacy()}
        </Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowTextWrap}>
              <Text style={styles.rowTitle}>{settingsAppLockTitle()}</Text>
              <Text style={styles.rowSub}>{settingsAppLockSub()}</Text>
            </View>
            <MonoSwitch
              value={appLock}
              onValueChange={v => void onToggleAppLock(v)}
              label={settingsAppLockTitle()}
              testID="settings-app-lock-switch"
            />
          </View>

          <View style={styles.row}>
            <View style={styles.rowTextWrap}>
              <Text style={styles.rowTitle}>{settingsHideOnLaunchTitle()}</Text>
              <Text style={styles.rowSub}>{settingsHideOnLaunchSub()}</Text>
            </View>
            <MonoSwitch
              value={hideOnLaunch}
              onValueChange={v => void onToggleHideOnLaunch(v)}
              label={settingsHideOnLaunchTitle()}
              testID="settings-hide-on-launch-switch"
            />
          </View>

          <View style={[styles.row, styles.rowLast]}>
            <View style={styles.rowTextWrap}>
              <Text style={styles.rowTitle}>{settingsBlockScreenshotsTitle()}</Text>
              <Text style={styles.rowSub}>{settingsBlockScreenshotsSub()}</Text>
            </View>
            <MonoSwitch
              value={blockScreenshots}
              onValueChange={v => void onToggleBlockScreenshots(v)}
              label={settingsBlockScreenshotsTitle()}
              testID="settings-block-screenshots-switch"
            />
          </View>
        </View>

        {/* 2. FORMAT */}
        <Text style={styles.sectionHeader} accessibilityRole="header">
          {settingsGroupFormat()}
        </Text>
        <View style={styles.card}>
          {/* Mata uang (read-only with lock) */}
          <View style={styles.row} testID="settings-currency-row">
            <View style={styles.rowTextWrap}>
              <Text style={styles.rowTitle}>{settingsCurrencyTitle()}</Text>
              <Text style={styles.rowSub}>{settingsCurrencySub()}</Text>
            </View>
            <View style={styles.accessoryRow}>
              <Text style={styles.accessoryText}>{settingsCurrencyValue()}</Text>
              <Icon name="lock" size={16} color={MonoColors.textMeta} />
            </View>
          </View>

          {/* Kurs */}
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => router.push('/settings/rates' as never)}
            accessibilityRole="button"
            accessibilityLabel={`${settingsRatesTitle()}, ${settingsRatesValue()}`}
            testID="settings-rates-row"
          >
            <View style={styles.rowTextWrap}>
              <Text style={styles.rowTitle}>{settingsRatesTitle()}</Text>
              <Text style={styles.rowSub}>{ratesSubText}</Text>
            </View>
            <View style={styles.accessoryRow}>
              <Text style={styles.accessoryText}>{settingsRatesValue()}</Text>
              <Icon name="chevron-right" size={16} color={MonoColors.textSecond} />
            </View>
          </Pressable>

          {/* Format angka */}
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => setFormatSheetOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`${settingsNumberFormatTitle()}, ${numFormat === 'id_ID' ? settingsNumberFormatId() : settingsNumberFormatIntl()}`}
            testID="settings-number-format-row"
          >
            <View style={styles.rowTextWrap}>
              <Text style={styles.rowTitle}>{settingsNumberFormatTitle()}</Text>
              <Text style={styles.rowSub}>{settingsNumberFormatSub(numFormat === 'id_ID')}</Text>
            </View>
            <View style={styles.accessoryRow}>
              <Text style={styles.accessoryText}>
                {numFormat === 'id_ID' ? settingsNumberFormatId() : settingsNumberFormatIntl()}
              </Text>
              <Icon name="chevron-right" size={16} color={MonoColors.textSecond} />
            </View>
          </Pressable>

          {/* Bulan dimulai tanggal */}
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => setMonthSheetOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`${settingsMonthStartTitle()}, ${settingsMonthStartValue(monthStartDay)}`}
            testID="settings-month-start-row"
          >
            <View style={styles.rowTextWrap}>
              <Text style={styles.rowTitle}>{settingsMonthStartTitle()}</Text>
              <Text style={styles.rowSub}>{settingsMonthStartSub()}</Text>
            </View>
            <View style={styles.accessoryRow}>
              <Text style={styles.accessoryText}>{settingsMonthStartValue(monthStartDay)}</Text>
              <Icon name="chevron-right" size={16} color={MonoColors.textSecond} />
            </View>
          </Pressable>

          {/* Zona waktu */}
          <Pressable
            style={({ pressed }) => [styles.row, styles.rowLast, pressed && styles.pressed]}
            onPress={() => setTzSheetOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`${settingsTimezoneTitle()}, ${settingsTimezoneValue(zone.label, zone.offsetHours)}`}
            testID="settings-timezone-row"
          >
            <View style={styles.rowTextWrap}>
              <Text style={styles.rowTitle}>{settingsTimezoneTitle()}</Text>
              <Text style={styles.rowSub}>{settingsTimezoneSub()}</Text>
            </View>
            <View style={styles.accessoryRow}>
              <Text style={styles.accessoryText}>{settingsTimezoneValue(zone.label, zone.offsetHours)}</Text>
              <Icon name="chevron-right" size={16} color={MonoColors.textSecond} />
            </View>
          </Pressable>
        </View>

        {/* 3. ASISTEN */}
        <Text style={styles.sectionHeader} accessibilityRole="header">
          {settingsGroupAssistant()}
        </Text>
        <View style={styles.card}>
          {/* Catat lewat chat (AI) */}
          <View style={styles.row}>
            <View style={styles.rowTextWrap}>
              <Text style={styles.rowTitle}>{settingsAiChatTitle()}</Text>
              <Text style={styles.rowSub}>{settingsAiChatSub()}</Text>
            </View>
            <MonoSwitch
              value={aiEnabled}
              onValueChange={v => void onToggleAiChat(v)}
              label={settingsAiChatTitle()}
              testID="settings-ai-chat-switch"
            />
          </View>

          {/* API key Gemini */}
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => router.push('/ai-setup' as never)}
            accessibilityRole="button"
            accessibilityLabel={`${settingsAiKeyTitle()}, ${screenData?.hasKey ? settingsAiKeyConfigured() : settingsAiKeyNotSet()}`}
            testID="settings-ai-key-row"
          >
            <View style={styles.rowTextWrap}>
              <Text style={styles.rowTitle}>{settingsAiKeyTitle()}</Text>
              <Text style={styles.rowSub}>{settingsAiKeySub()}</Text>
            </View>
            <View style={styles.accessoryRow}>
              <Text style={styles.accessoryText}>
                {screenData?.hasKey ? settingsAiKeyConfigured() : settingsAiKeyNotSet()}
              </Text>
              <Icon name="chevron-right" size={16} color={MonoColors.textSecond} />
            </View>
          </Pressable>

          {/* Impor otomatis */}
          <Pressable
            style={({ pressed }) => [styles.row, styles.rowLast, pressed && styles.pressed]}
            onPress={() => router.push('/settings/import' as never)}
            accessibilityRole="button"
            accessibilityLabel={`${settingsImportAutoTitle()}, ${enabledApps > 0 ? settingsStatusActive() : settingsStatusInactive()}`}
            testID="settings-import-row"
          >
            <View style={styles.rowTextWrap}>
              <Text style={styles.rowTitle}>{settingsImportAutoTitle()}</Text>
              <Text style={styles.rowSub}>{settingsImportAutoSub()}</Text>
            </View>
            <View style={styles.accessoryRow}>
              <Text style={styles.accessoryText}>
                {enabledApps > 0 ? settingsStatusActive() : settingsStatusInactive()}
              </Text>
              <Icon name="chevron-right" size={16} color={MonoColors.textSecond} />
            </View>
          </Pressable>
        </View>

        {/* 4. DATA */}
        <Text style={styles.sectionHeader} accessibilityRole="header">
          {settingsGroupData()}
        </Text>
        <View style={styles.card}>
          {/* Notifikasi */}
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => setNotifSheetOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`${settingsNotificationsTitle()}, ${notifActive ? settingsStatusActive() : settingsStatusInactive()}`}
            testID="settings-notifications-row"
          >
            <View style={styles.rowTextWrap}>
              <Text style={styles.rowTitle}>{settingsNotificationsTitle()}</Text>
              <Text style={styles.rowSub}>{settingsNotificationsSub()}</Text>
            </View>
            <View style={styles.accessoryRow}>
              <Text style={styles.accessoryText}>
                {notifActive ? settingsStatusActive() : settingsStatusInactive()}
              </Text>
              <Icon name="chevron-right" size={16} color={MonoColors.textSecond} />
            </View>
          </Pressable>

          {/* Cadangan dan pemulihan */}
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => router.push('/backup' as never)}
            accessibilityRole="button"
            accessibilityLabel={`${settingsBackupTitle()}, ${backupSubText}`}
            testID="settings-backup-row"
          >
            <View style={styles.rowTextWrap}>
              <Text style={styles.rowTitle}>{settingsBackupTitle()}</Text>
              <Text style={styles.rowSub}>{backupSubText}</Text>
            </View>
            <Icon name="chevron-right" size={16} color={MonoColors.textSecond} />
          </Pressable>

          {/* Kategori */}
          <Pressable
            style={({ pressed }) => [styles.row, styles.rowLast, pressed && styles.pressed]}
            onPress={() => router.push('/categories' as never)}
            accessibilityRole="button"
            accessibilityLabel={settingsCategoriesTitle()}
            testID="settings-categories-row"
          >
            <View style={styles.rowTextWrap}>
              <Text style={styles.rowTitle}>{settingsCategoriesTitle()}</Text>
              <Text style={styles.rowSub}>{settingsCategoriesSub()}</Text>
            </View>
            <Icon name="chevron-right" size={16} color={MonoColors.textSecond} />
          </Pressable>
        </View>

        {/* 5. HAPUS */}
        <Text style={styles.sectionHeader} accessibilityRole="header">
          {settingsGroupErase()}
        </Text>
        <View style={styles.card}>
          <Pressable
            style={({ pressed }) => [styles.eraseRow, pressed && styles.pressed]}
            onPress={() => setEraseDialogOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={settingsEraseTitle()}
            testID="settings-erase-row"
          >
            <View style={styles.eraseIcon}>
              <Icon name="trash" size={20} color={MonoColors.text} />
            </View>
            <View style={styles.rowTextWrap}>
              <Text style={styles.rowTitle}>{settingsEraseTitle()}</Text>
              <Text style={styles.rowSub}>{settingsEraseSub()}</Text>
            </View>
            <Icon name="chevron-right" size={16} color={MonoColors.textSecond} />
          </Pressable>
        </View>

        {/* 6. TENTANG */}
        <Text style={styles.sectionHeader} accessibilityRole="header">
          {settingsGroupAbout()}
        </Text>
        <View style={styles.card}>
          {/* Logo row */}
          <View style={styles.brandRow}>
            <Image
              source={require('@/assets/brand/mono-mark.png')}
              style={styles.brandLogo}
              contentFit="contain"
            />
            <View style={styles.rowTextWrap}>
              <Text style={styles.brandTitle}>{settingsAboutAppTitle()}</Text>
              <Text style={styles.rowSub}>
                {settingsAboutVersion('1.0.0', '1', screenData?.schemaVersion ?? '1')}
              </Text>
            </View>
          </View>

          {/* Berfungsi offline */}
          <View style={styles.row}>
            <View style={styles.rowTextWrap}>
              <Text style={styles.rowTitle}>{settingsAboutOfflineTitle()}</Text>
              <Text style={styles.rowSub}>{settingsAboutOfflineSub()}</Text>
            </View>
          </View>

          {/* Lisensi sumber terbuka */}
          <Pressable
            style={({ pressed }) => [styles.row, styles.rowLast, pressed && styles.pressed]}
            onPress={() => setLicensesSheetOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={settingsAboutLicensesTitle()}
            testID="settings-licenses-row"
          >
            <Text style={[styles.rowTitle, styles.rowTextWrap]}>{settingsAboutLicensesTitle()}</Text>
            <Icon name="chevron-right" size={16} color={MonoColors.textSecond} />
          </Pressable>
        </View>
      </ScrollView>

      {/* Dialog: Erase confirmation */}
      <ConfirmDialog
        visible={eraseDialogOpen}
        icon="trash"
        iconColor={MonoColors.negative}
        title={settingsEraseDialogTitle()}
        message={[{ text: settingsEraseDialogMessage() }]}
        cancelLabel={cancelLabel()}
        confirmLabel={settingsEraseDialogConfirm()}
        busy={eraseBusy}
        onCancel={() => setEraseDialogOpen(false)}
        onConfirm={() => void onConfirmErase()}
        testID="settings-erase-dialog"
      />

      {/* Dialog: No lock credentials on device */}
      <ConfirmDialog
        visible={noLockDialogOpen}
        icon="alert-circle"
        iconColor={MonoColors.accent}
        title={settingsNoLockTitle()}
        message={[{ text: settingsNoLockMessage() }]}
        cancelLabel={cancelLabel()}
        confirmLabel={settingsNoLockOpenSettings()}
        onCancel={() => setNoLockDialogOpen(false)}
        onConfirm={() => {
          setNoLockDialogOpen(false);
          void withLockSuspended(() => Linking.openSettings());
        }}
        testID="settings-no-lock-dialog"
      />

      {/* Sheet: Timezone */}
      <Sheet
        visible={tzSheetOpen}
        onClose={() => setTzSheetOpen(false)}
        closeLabel={cancelLabel()}
        testID="timezone-sheet"
      >
        <SheetHeader
          visible={tzSheetOpen}
          icon="calendar"
          title={settingsTimezoneTitle()}
          subtitle={settingsTimezoneSub()}
          onClose={() => setTzSheetOpen(false)}
        />
        <View style={styles.sheetList}>
          {TIMEZONES.map(item => (
            <Pressable
              key={item.key}
              style={({ pressed }) => [
                styles.sheetItem,
                item.key === currentTz && styles.sheetItemSelected,
                pressed && styles.pressed,
              ]}
              onPress={() => void onSelectTimezone(item.key)}
              testID={`timezone-option-${item.key}`}
            >
              <Text style={[styles.sheetItemText, item.key === currentTz && styles.sheetItemTextSelected]}>
                {settingsTimezoneValue(item.label, item.offset)}
              </Text>
              {item.key === currentTz && <Icon name="check" size={16} color={MonoColors.text} />}
            </Pressable>
          ))}
        </View>
      </Sheet>

      {/* Sheet: Month start day */}
      <Sheet
        visible={monthSheetOpen}
        onClose={() => setMonthSheetOpen(false)}
        closeLabel={cancelLabel()}
        testID="month-sheet"
      >
        <SheetHeader
          visible={monthSheetOpen}
          icon="calendar"
          title={settingsMonthStartTitle()}
          subtitle={settingsMonthStartSub()}
          onClose={() => setMonthSheetOpen(false)}
        />
        <View style={styles.sheetList}>
          {MONTH_DAYS.map(day => (
            <Pressable
              key={day}
              style={({ pressed }) => [
                styles.sheetItem,
                day === monthStartDay && styles.sheetItemSelected,
                pressed && styles.pressed,
              ]}
              onPress={() => void onSelectMonthStartDay(day)}
              testID={`month-option-${day}`}
            >
              <Text style={[styles.sheetItemText, day === monthStartDay && styles.sheetItemTextSelected]}>
                {settingsMonthStartValue(day)}
              </Text>
              {day === monthStartDay && <Icon name="check" size={16} color={MonoColors.text} />}
            </Pressable>
          ))}
        </View>
      </Sheet>

      {/* Sheet: Number format */}
      <Sheet
        visible={formatSheetOpen}
        onClose={() => setFormatSheetOpen(false)}
        closeLabel={cancelLabel()}
        testID="number-format-sheet"
      >
        <SheetHeader
          visible={formatSheetOpen}
          icon="slider"
          title={settingsNumberFormatTitle()}
          subtitle={settingsNumberFormatSub(numFormat === 'id_ID')}
          onClose={() => setFormatSheetOpen(false)}
        />
        <View style={styles.sheetList}>
          <Pressable
            style={({ pressed }) => [
              styles.sheetItem,
              numFormat === 'id_ID' && styles.sheetItemSelected,
              pressed && styles.pressed,
            ]}
            onPress={() => void onSelectNumberFormat('id_ID')}
            testID="number-format-option-id"
          >
            <View>
              <Text style={[styles.sheetItemText, numFormat === 'id_ID' && styles.sheetItemTextSelected]}>
                {settingsNumberFormatId()}
              </Text>
              <Text style={styles.sheetItemSub}>Rp1.234.567 · 12,34%</Text>
            </View>
            {numFormat === 'id_ID' && <Icon name="check" size={16} color={MonoColors.text} />}
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.sheetItem,
              numFormat === 'en_US' && styles.sheetItemSelected,
              pressed && styles.pressed,
            ]}
            onPress={() => void onSelectNumberFormat('en_US')}
            testID="number-format-option-en"
          >
            <View>
              <Text style={[styles.sheetItemText, numFormat === 'en_US' && styles.sheetItemTextSelected]}>
                {settingsNumberFormatIntl()}
              </Text>
              <Text style={styles.sheetItemSub}>Rp1,234,567 · 12.34%</Text>
            </View>
            {numFormat === 'en_US' && <Icon name="check" size={16} color={MonoColors.text} />}
          </Pressable>
        </View>
      </Sheet>

      {/* Sheet: Notifications */}
      <Sheet
        visible={notifSheetOpen}
        onClose={() => setNotifSheetOpen(false)}
        closeLabel={cancelLabel()}
        testID="notifications-sheet"
      >
        <SheetHeader
          visible={notifSheetOpen}
          icon="bell"
          title={settingsNotificationsTitle()}
          subtitle={settingsNotificationsSub()}
          onClose={() => setNotifSheetOpen(false)}
        />
        <View style={styles.sheetList}>
          <View style={styles.sheetToggleRow}>
            <View style={styles.rowTextWrap}>
              <Text style={styles.sheetItemText}>{settingsNotifBackupTitle()}</Text>
              <Text style={styles.sheetItemSub}>{settingsNotifBackupSub()}</Text>
            </View>
            <MonoSwitch
              value={backupReminder}
              onValueChange={v => void onToggleBackupReminder(v)}
              label={settingsNotifBackupTitle()}
              testID="notif-backup-switch"
            />
          </View>
          <View style={styles.sheetToggleRow}>
            <View style={styles.rowTextWrap}>
              <Text style={styles.sheetItemText}>{settingsNotifRecurringTitle()}</Text>
              <Text style={styles.sheetItemSub}>{settingsNotifRecurringSub()}</Text>
            </View>
            <MonoSwitch
              value={recurringReminder}
              onValueChange={v => void onToggleRecurringReminder(v)}
              label={settingsNotifRecurringTitle()}
              testID="notif-recurring-switch"
            />
          </View>
        </View>
      </Sheet>

      {/* Sheet: Open-source licenses */}
      <Sheet
        visible={licensesSheetOpen}
        onClose={() => setLicensesSheetOpen(false)}
        closeLabel={cancelLabel()}
        testID="licenses-sheet"
      >
        <SheetHeader
          visible={licensesSheetOpen}
          icon="info"
          title={settingsAboutLicensesTitle()}
          subtitle={settingsAboutLicensesSub()}
          onClose={() => setLicensesSheetOpen(false)}
        />
        <View style={styles.sheetList}>
          {LICENSES.map(item => (
            <View key={item.name} style={styles.licenseRow}>
              <Text style={styles.licenseName}>{item.name}</Text>
              <Text style={styles.licenseKind}>{item.license}</Text>
            </View>
          ))}
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
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
    gap: 0,
  },

  sectionHeader: {
    ...MonoText.label,
    fontSize: 12,
    color: MonoColors.textMeta,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 4,
    paddingTop: 20,
    paddingBottom: 8,
  },
  // The title row already ends with its own bottom padding, so the first group label sits right under it.
  sectionHeaderFirst: {
    paddingTop: 0,
  },

  card: {
    backgroundColor: '#151516',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#272728',
    overflow: 'hidden',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 64,
    borderBottomWidth: 1,
    borderBottomColor: '#202022',
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowTextWrap: {
    flex: 1,
    marginRight: 12,
  },
  rowTitle: {
    ...MonoText.bodyStrong,
    fontSize: 15,
    lineHeight: 20,
    color: MonoColors.text,
  },
  rowSub: {
    ...MonoText.bodyS,
    fontSize: 13,
    lineHeight: 18,
    color: MonoColors.textMeta,
    marginTop: 2,
  },

  accessoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  accessoryText: {
    ...MonoText.body,
    fontSize: 14,
    color: MonoColors.textSecond,
  },

  eraseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 64,
  },
  eraseIcon: {
    marginRight: 12,
  },

  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 64,
    borderBottomWidth: 1,
    borderBottomColor: '#202022',
    gap: 14,
  },
  brandLogo: {
    width: 38,
    height: 38,
    borderRadius: 8,
  },
  brandTitle: {
    ...MonoText.bodyStrong,
    fontSize: 15,
    lineHeight: 20,
    color: MonoColors.text,
  },

  pressed: {
    opacity: 0.75,
  },

  // Bottom sheets content
  sheetList: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 8,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#151516',
    borderWidth: 1,
    borderColor: '#272728',
  },
  sheetItemSelected: {
    borderColor: MonoColors.text,
    backgroundColor: '#1E1E20',
  },
  sheetItemText: {
    ...MonoText.bodyStrong,
    fontSize: 15,
    color: MonoColors.text,
  },
  sheetItemTextSelected: {
    color: MonoColors.text,
  },
  sheetItemSub: {
    ...MonoText.caption,
    fontSize: 12,
    color: MonoColors.textMeta,
    marginTop: 2,
  },
  sheetToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#151516',
    borderWidth: 1,
    borderColor: '#272728',
  },

  licenseRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#202022',
  },
  licenseName: {
    ...MonoText.bodyStrong,
    fontSize: 14,
    color: MonoColors.text,
  },
  licenseKind: {
    ...MonoText.caption,
    fontSize: 12,
    color: MonoColors.textMeta,
    marginTop: 2,
  },
});

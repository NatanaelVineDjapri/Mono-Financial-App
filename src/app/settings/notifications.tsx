// /settings/notifications — Notification settings screen (Notif-Settings / Notif-Denied boards).
import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { useHideAmounts } from '@/components/hide-amounts-store';
import { Icon } from '@/components/Icon';
import { MonoSwitch } from '@/components/MonoSwitch';
import { Sheet } from '@/components/Sheet';
import { SheetHeader } from '@/components/SheetHeader';
import { useDb } from '@/data/db/DbProvider';
import { getSetting, setSetting } from '@/data/repo/settings';
import { invalidateAfterWrite } from '@/data/queryKeys';
import { notificationsHideAmounts, scheduleSync } from '@/features/notifications/scheduler';
import { MonoColors, radius } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';
import {
  cancelLabel,
  notifAllow,
  notifAllowSub,
  notifBackup,
  notifBackupSub,
  notifBillDue,
  notifBillDueSub,
  notifBillOverdue,
  notifBillOverdueSub,
  notifBudgetNear,
  notifBudgetNearSub,
  notifBudgetOver,
  notifBudgetOverSub,
  notifDaily,
  notifDailyTime,
  notifDailyTimeTitle,
  notifDailyWarn,
  notifDeniedBody,
  notifDeniedButton,
  notifDeniedTitle,
  notifGoal,
  notifGoalSub,
  notifGroupBackup,
  notifGroupBills,
  notifGroupBudgets,
  notifGroupGeneral,
  notifGroupGoals,
  notifGroupReminders,
  notifHideNote,
  notifHour,
  notifInboxTitle,
  notifMinute,
  notifPickTime,
  notifQuiet,
  notifQuietEndTitle,
  notifQuietStartTitle,
  notifQuietSub,
  notifSelect,
  notifSettingsBack,
} from '@/i18n';

type Setting = Record<string, string>;

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45] as const;

function pad(n: number): string { return String(n).padStart(2, '0'); }
function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':');
  return `${h}.${m}`;
}

interface TimePickerSheetProps {
  visible: boolean;
  onClose: () => void;
  value: string; // 'HH:MM'
  onSelect: (v: string) => void;
  title: string;
}

function TimePickerSheet({ visible, onClose, value, onSelect, title }: TimePickerSheetProps) {
  const [selH, setSelH] = useState(parseInt(value.split(':')[0] ?? '20', 10));
  const [selM, setSelM] = useState(parseInt(value.split(':')[1] ?? '0', 10));

  // When the saved value changes, the picker starts from it again (adjusting state while rendering, not in an effect).
  const [seenValue, setSeenValue] = useState(value);
  if (value !== seenValue) {
    setSeenValue(value);
    setSelH(parseInt(value.split(':')[0] ?? '20', 10));
    setSelM(parseInt(value.split(':')[1] ?? '0', 10));
  }

  return (
    <Sheet visible={visible} onClose={onClose} closeLabel={cancelLabel()} testID="time-picker-sheet">
      <SheetHeader visible={visible} icon="bell" title={title} subtitle={notifPickTime()} onClose={onClose} />
      <View style={pickerStyles.row}>
        <View style={pickerStyles.col}>
          <Text style={pickerStyles.colLabel}>{notifHour()}</Text>
          <ScrollView style={pickerStyles.scroll} showsVerticalScrollIndicator={false}>
            {HOURS.map(h => (
              <Pressable
                key={h}
                style={[pickerStyles.option, h === selH && pickerStyles.optionSelected]}
                onPress={() => setSelH(h)}
              >
                <Text style={[pickerStyles.optionText, h === selH && pickerStyles.optionTextSelected]}>
                  {pad(h)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
        <View style={pickerStyles.col}>
          <Text style={pickerStyles.colLabel}>{notifMinute()}</Text>
          {MINUTES.map(m => (
            <Pressable
              key={m}
              style={[pickerStyles.option, m === selM && pickerStyles.optionSelected]}
              onPress={() => setSelM(m)}
            >
              <Text style={[pickerStyles.optionText, m === selM && pickerStyles.optionTextSelected]}>
                {pad(m)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Pressable
        style={pickerStyles.confirmBtn}
        onPress={() => { onSelect(`${pad(selH)}:${pad(selM)}`); onClose(); }}
      >
        <Text style={pickerStyles.confirmBtnText}>{notifSelect()}</Text>
      </Pressable>
    </Sheet>
  );
}

const pickerStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, padding: 16 },
  col: { flex: 1 },
  colLabel: { ...MonoText.caption, color: MonoColors.textSecond, marginBottom: 8 },
  scroll: { maxHeight: 200 },
  option: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.sm, alignItems: 'center' },
  optionSelected: { backgroundColor: MonoColors.raised },
  optionText: { ...MonoText.body, color: MonoColors.textSecond },
  optionTextSelected: { color: MonoColors.text, fontWeight: '600' },
  confirmBtn: { margin: 16, borderRadius: radius.md, backgroundColor: MonoColors.raised, padding: 14, alignItems: 'center' },
  confirmBtnText: { ...MonoText.bodyStrong, color: MonoColors.text },
});

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const db = useDb();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<Setting>({});
  const [permissionStatus, setPermissionStatus] = useState<string>('undetermined');
  const [dailyTimePicker, setDailyTimePicker] = useState(false);
  const [quietStartPicker, setQuietStartPicker] = useState(false);
  const [quietEndPicker, setQuietEndPicker] = useState(false);

  const load = useCallback(async () => {
    const all: Setting = {};
    const keys = ['notif_enabled','quiet_start','quiet_end','notif_daily','notif_daily_time',
      'notif_bill_h1','notif_bill_overdue','notif_budget_near','notif_budget_over','notif_goal','notif_backup','hide_on_launch'];
    // A setting that is not there stays absent, so the default below applies (an empty string would pass for a value:
    // after restoring an older backup, "Quiet hours" read ".undefined – .undefined").
    for (const k of keys) {
      const value = await getSetting(db, k);
      if (value != null && value !== '') all[k] = value;
    }
    setSettings(all);
    const { status } = await Notifications.getPermissionsAsync();
    setPermissionStatus(status);
  }, [db]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const save = async (key: string, value: string) => {
    await setSetting(db, key, value);
    setSettings(prev => ({ ...prev, [key]: value }));
    await invalidateAfterWrite(queryClient);
    scheduleSync(db);
  };

  const toggleEnabled = async (v: boolean) => {
    if (v) {
      const { status, canAskAgain } = await Notifications.requestPermissionsAsync();
      setPermissionStatus(status);
      if (status === 'granted') {
        await save('notif_enabled', '1');
      }
    } else {
      await save('notif_enabled', '0');
    }
  };

  const enabled = settings.notif_enabled === '1';
  const denied = permissionStatus === 'denied';
  const dailyTime = settings.notif_daily_time ?? '20:00';
  const quietStart = settings.quiet_start ?? '22:00';
  const quietEnd = settings.quiet_end ?? '06:00';
  const hiddenNow = useHideAmounts(s => s.hidden);
  const hideAmounts = notificationsHideAmounts(settings, hiddenNow);

  // Warn if daily time falls in quiet hours
  function isInQuietHours(timeStr: string): boolean {
    const [sh, sm] = quietStart.split(':').map(Number);
    const [eh, em] = quietEnd.split(':').map(Number);
    const [th, tm] = timeStr.split(':').map(Number);
    const start = sh * 60 + sm, end = eh * 60 + em, t = th * 60 + tm;
    return start > end ? (t >= start || t < end) : (t >= start && t < end);
  }

  const dailyInQuiet = isInQuietHours(dailyTime);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="notif-settings-screen">
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button">
          <Icon name="chevron-left" size={20} color={MonoColors.text} />
          <Text style={styles.backLabel}>{notifSettingsBack()}</Text>
        </Pressable>
      </View>
      <Text style={styles.title}>{notifInboxTitle()}</Text>

      {denied && (
        <View style={styles.deniedBanner}>
          <Icon name="bell" size={16} color={MonoColors.textSecond} />
          <View style={styles.deniedText}>
            <Text style={styles.deniedTitle}>{notifDeniedTitle()}</Text>
            <Text style={styles.deniedBody}>{notifDeniedBody()}</Text>
          </View>
          <Pressable onPress={() => void Linking.openSettings()} style={styles.deniedBtn}>
            <Text style={styles.deniedBtnText}>{notifDeniedButton()}</Text>
          </Pressable>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {/* Umum */}
        <Text style={styles.sectionHeader}>{notifGroupGeneral()}</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{notifAllow()}</Text>
              <Text style={styles.rowSub}>{notifAllowSub()}</Text>
            </View>
            <MonoSwitch
              value={enabled}
              onValueChange={v => void toggleEnabled(v)}
              label={notifAllow()}
              disabled={denied}
              testID="notif-enabled-switch"
            />
          </View>
          <Pressable
            style={({ pressed }) => [styles.row, styles.rowLast, pressed && styles.pressed]}
            onPress={() => setQuietStartPicker(true)}
            accessibilityRole="button"
            testID="quiet-hours-row"
          >
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{notifQuiet()}</Text>
              <Text style={styles.rowSub}>{notifQuietSub()}</Text>
            </View>
            <Text style={styles.rowValue}>{formatTime(quietStart)} – {formatTime(quietEnd)}</Text>
            <Icon name="chevron-right" size={16} color={MonoColors.textSecond} />
          </Pressable>
        </View>

        {/* Pengingat */}
        <Text style={styles.sectionHeader}>{notifGroupReminders()}</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{notifDaily()}</Text>
            </View>
            <MonoSwitch
              value={settings.notif_daily === '1'}
              onValueChange={v => void save('notif_daily', v ? '1' : '0')}
              label={notifDaily()}
              disabled={!enabled || denied}
              testID="notif-daily-switch"
            />
          </View>
          <Pressable
            style={({ pressed }) => [styles.row, styles.rowLast, pressed && styles.pressed]}
            onPress={() => setDailyTimePicker(true)}
            accessibilityRole="button"
            testID="notif-daily-time-row"
          >
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{notifDailyTime()}</Text>
              {dailyInQuiet && (
                <Text style={styles.rowWarn}>{notifDailyWarn(formatTime(quietEnd))}</Text>
              )}
            </View>
            <Text style={styles.rowValue}>{formatTime(dailyTime)}</Text>
            <Icon name="chevron-right" size={16} color={MonoColors.textSecond} />
          </Pressable>
        </View>

        {/* Tagihan berulang */}
        <Text style={styles.sectionHeader}>{notifGroupBills()}</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{notifBillDue()}</Text>
              <Text style={styles.rowSub}>{notifBillDueSub()}</Text>
            </View>
            <MonoSwitch
              value={settings.notif_bill_h1 === '1'}
              onValueChange={v => void save('notif_bill_h1', v ? '1' : '0')}
              label={notifBillDue()}
              disabled={!enabled || denied}
              testID="notif-bill-h1-switch"
            />
          </View>
          <View style={[styles.row, styles.rowLast]}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{notifBillOverdue()}</Text>
              <Text style={styles.rowSub}>{notifBillOverdueSub()}</Text>
            </View>
            <MonoSwitch
              value={settings.notif_bill_overdue === '1'}
              onValueChange={v => void save('notif_bill_overdue', v ? '1' : '0')}
              label={notifBillOverdue()}
              disabled={!enabled || denied}
              testID="notif-bill-overdue-switch"
            />
          </View>
        </View>

        {/* Anggaran */}
        <Text style={styles.sectionHeader}>{notifGroupBudgets()}</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{notifBudgetNear()}</Text>
              <Text style={styles.rowSub}>{notifBudgetNearSub()}</Text>
            </View>
            <MonoSwitch
              value={settings.notif_budget_near === '1'}
              onValueChange={v => void save('notif_budget_near', v ? '1' : '0')}
              label={notifBudgetNear()}
              disabled={!enabled || denied}
              testID="notif-budget-near-switch"
            />
          </View>
          <View style={[styles.row, styles.rowLast]}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{notifBudgetOver()}</Text>
              <Text style={styles.rowSub}>{notifBudgetOverSub()}</Text>
            </View>
            <MonoSwitch
              value={settings.notif_budget_over === '1'}
              onValueChange={v => void save('notif_budget_over', v ? '1' : '0')}
              label={notifBudgetOver()}
              disabled={!enabled || denied}
              testID="notif-budget-over-switch"
            />
          </View>
        </View>

        {/* Target */}
        <Text style={styles.sectionHeader}>{notifGroupGoals()}</Text>
        <View style={styles.card}>
          <View style={[styles.row, styles.rowLast]}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{notifGoal()}</Text>
              <Text style={styles.rowSub}>{notifGoalSub()}</Text>
            </View>
            <MonoSwitch
              value={settings.notif_goal === '1'}
              onValueChange={v => void save('notif_goal', v ? '1' : '0')}
              label={notifGoal()}
              disabled={!enabled || denied}
              testID="notif-goal-switch"
            />
          </View>
        </View>

        {/* Cadangan */}
        <Text style={styles.sectionHeader}>{notifGroupBackup()}</Text>
        <View style={styles.card}>
          <View style={[styles.row, styles.rowLast]}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{notifBackup()}</Text>
              <Text style={styles.rowSub}>{notifBackupSub()}</Text>
            </View>
            <MonoSwitch
              value={settings.notif_backup === '1'}
              onValueChange={v => void save('notif_backup', v ? '1' : '0')}
              label={notifBackup()}
              disabled={!enabled || denied}
              testID="notif-backup-switch"
            />
          </View>
        </View>

        {hideAmounts && (
          <Text style={styles.footnote}>
            {notifHideNote()}
          </Text>
        )}
      </ScrollView>

      {/* Time pickers */}
      <TimePickerSheet
        visible={dailyTimePicker}
        onClose={() => setDailyTimePicker(false)}
        value={dailyTime}
        onSelect={v => void save('notif_daily_time', v)}
        title={notifDailyTimeTitle()}
      />
      <TimePickerSheet
        visible={quietStartPicker}
        onClose={() => { setQuietStartPicker(false); setQuietEndPicker(true); }}
        value={quietStart}
        onSelect={v => void save('quiet_start', v)}
        title={notifQuietStartTitle()}
      />
      <TimePickerSheet
        visible={quietEndPicker}
        onClose={() => setQuietEndPicker(false)}
        value={quietEnd}
        onSelect={v => void save('quiet_end', v)}
        title={notifQuietEndTitle()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  headerRow: { paddingHorizontal: 16, paddingVertical: 8 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backLabel: { ...MonoText.body, color: MonoColors.textSecond },
  title: { ...MonoText.titleL, color: MonoColors.text, paddingHorizontal: 16, paddingBottom: 16 },
  sectionHeader: { ...MonoText.caption, color: MonoColors.textSecond, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 },
  card: { marginHorizontal: 16, borderRadius: radius.md, backgroundColor: MonoColors.card, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: MonoColors.border },
  rowLast: { borderBottomWidth: 0 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...MonoText.body, color: MonoColors.text },
  rowSub: { ...MonoText.caption, color: MonoColors.textSecond },
  rowWarn: { ...MonoText.caption, color: MonoColors.accent },
  rowValue: { ...MonoText.body, color: MonoColors.textSecond },
  pressed: { opacity: 0.7 },
  footnote: { ...MonoText.caption, color: MonoColors.textMeta, marginHorizontal: 16, marginTop: 16, lineHeight: 18 },
  deniedBanner: { margin: 16, borderRadius: radius.md, backgroundColor: MonoColors.card, padding: 16, gap: 8, borderWidth: 1, borderColor: MonoColors.border },
  deniedTitle: { ...MonoText.bodyStrong, color: MonoColors.text },
  deniedBody: { ...MonoText.caption, color: MonoColors.textSecond },
  deniedText: { gap: 4 },
  deniedBtn: { alignSelf: 'flex-start', borderWidth: 1, borderColor: MonoColors.border, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 6 },
  deniedBtnText: { ...MonoText.caption, color: MonoColors.text },
});

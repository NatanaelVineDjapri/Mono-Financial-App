// Automatic import, the screen at /settings/import (boards Import-Setup and Import-Settings), drawn
// from plain props so it can be tested without the database or the native module.
//
//   Import-Setup    (nothing set up yet): what MONO reads and does not read, and the button that
//                   opens the permission guide. Gmail is not here: that source is postponed.
//   Import-Settings (access on, or an app switched on): the link to the review queue, the access
//                   status and last read time, "Didukung penuh" (apps with a parser of their own,
//                   empty until there are real samples), "Aplikasi terdeteksi" (every other app that
//                   posted a notification; read by the general parser, always "Ditebak") and
//                   "Kalau ada masalah".
//
// An app can be switched on only with an account: switching on an app without one opens the account
// picker first. Nothing here shows or keeps the text of a notification.
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Icon, type IconName } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { MonoSwitch } from '@/components/MonoSwitch';
import { formatDateTime } from '@/core/date';
import { isoFromMillis } from '@/core/clock';
import type { ImportAppRow } from '@/data/repo/importApps';
import { ErrorLine } from '@/features/transactions/form/formParts';
import {
  backLabel,
  importAccessOff,
  importAccessOn,
  importAccessRow,
  importAppSwitchLabel,
  importAppToAccount,
  importAppUnmapped,
  importAutoTitle,
  importBatteryNote,
  importDetectedEmpty,
  importDetectedGroup,
  importDetectedHelp,
  importEnableAccess,
  importFullEmpty,
  importFullGroup,
  importIntro,
  importLastRead,
  importNativeMissing,
  importNeverRead,
  importNotifDesc,
  importNotifTitle,
  importNotRead1,
  importNotRead2,
  importNotRead3,
  importNotReadHeader,
  importOnlyEnabledNote,
  importOpenBattery,
  importOpenGuide,
  importOptionalNote,
  importPendingLink,
  importPendingSub,
  importPillOff,
  importPillOn,
  importProblemAccessOffBody,
  importProblemAccessOffTitle,
  importProblemStoppedBody,
  importProblemStoppedTitle,
  importProblemsHeader,
  importReads1,
  importReads2,
  importReadsHeader,
  importRestartService,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { importProblems, importSetupState, type AccessSnapshot } from './notifications/access';

export interface ImportScreenViewProps {
  access: AccessSnapshot;
  apps: readonly ImportAppRow[];
  pending: number;
  accountNames: ReadonlyMap<number, string>;
  message: string | null; // why the last change was refused
  onBack: () => void;
  onOpenGuide: () => void;
  onToggle: (app: ImportAppRow, on: boolean) => void;
  onPickAccount: (app: ImportAppRow) => void;
  onOpenPending: () => void;
  onRestartService: () => void;
  onOpenBattery: () => void;
}

// The three letters on an app's tile: "BCA mobile" -> BCA, "GoPay" -> GOP.
export function appCode(name: string): string {
  const letters = name.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return letters.length >= 3 ? letters.slice(0, 3) : letters || 'APP';
}

export function ImportScreenView(props: ImportScreenViewProps) {
  const insets = useSafeAreaInsets();
  const hasEnabled = props.apps.some(a => a.enabled === 1);
  const state = importSetupState(props.access, hasEnabled);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <IconButton label={backLabel()} onPress={props.onBack} testID="import-back">
          <Icon name="chevron-left" size={24} color={MonoColors.text} />
        </IconButton>
        <Text style={styles.title} accessibilityRole="header">
          {importAutoTitle()}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]} testID={state === 'setup' ? 'import-setup' : 'import-settings'}>
        {!props.access.available && (
          <View style={styles.note} testID="import-native-missing">
            <Icon name="info" size={18} color={MonoColors.text} />
            <Text style={styles.noteText}>{importNativeMissing()}</Text>
          </View>
        )}
        {state === 'setup' ? <SetupBody {...props} /> : <SettingsBody {...props} hasEnabled={hasEnabled} />}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------- Import-Setup

function SetupBody({ onOpenGuide }: ImportScreenViewProps) {
  return (
    <>
      <Text style={styles.intro}>{importIntro()}</Text>

      <View style={[styles.card, styles.cardPad]} testID="import-notif-card">
        <View style={styles.cardHead}>
          <View style={styles.discLg}>
            <Icon name="bell" size={20} color={MonoColors.text} />
          </View>
          <View style={styles.flex}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>{importNotifTitle()}</Text>
              <Pill label={importPillOff()} />
            </View>
            <Text style={[styles.caption, styles.cardDesc]}>{importNotifDesc()}</Text>
          </View>
        </View>
        <Button label={importEnableAccess()} onPress={onOpenGuide} style={styles.cardButton} testID="import-enable-access" />
      </View>

      <GroupHeader label={importReadsHeader()} />
      <ListCard icon="check" lines={[importReads1(), importReads2()]} />
      <GroupHeader label={importNotReadHeader()} />
      <ListCard icon="lock" lines={[importNotRead1(), importNotRead2(), importNotRead3()]} />

      <View style={styles.footnote}>
        <Icon name="info" size={18} color={MonoColors.text} />
        <Text style={styles.footnoteText}>{importOptionalNote()}</Text>
      </View>
    </>
  );
}

// ---------------------------------------------------------------- Import-Settings

function SettingsBody(props: ImportScreenViewProps & { hasEnabled: boolean }) {
  const { access, apps, pending, accountNames, message, hasEnabled } = props;
  const full = apps.filter(a => a.supported_level === 'full');
  const generic = apps.filter(a => a.supported_level !== 'full');
  const problems = importProblems(access, hasEnabled);

  return (
    <>
      <Pressable
        onPress={pending > 0 ? props.onOpenPending : undefined}
        disabled={pending === 0}
        accessibilityRole={pending > 0 ? 'button' : 'text'}
        accessibilityLabel={`${importPendingLink(pending)}. ${importPendingSub()}`}
        style={[styles.card, styles.pending]}
        testID="import-pending"
      >
        <View style={styles.flex}>
          <Text style={styles.pendingTitle}>{importPendingLink(pending)}</Text>
          <Text style={styles.caption}>{importPendingSub()}</Text>
        </View>
        {pending > 0 && <Icon name="chevron-right" size={16} color={MonoColors.textMeta} />}
      </Pressable>

      <View style={styles.groupHead}>
        <Text style={styles.groupLabel}>{importNotifTitle()}</Text>
        <Pill label={access.accessEnabled ? importPillOn() : importPillOff()} check={access.accessEnabled} />
      </View>

      {!!message && <ErrorLine error={{ text: message }} testID="import-message" />}

      <View style={styles.card}>
        <View style={styles.row} testID="import-access-row">
          <View style={styles.flex}>
            <Text style={styles.rowTitle}>{importAccessRow()}</Text>
            <Text style={styles.caption}>{access.lastReadAt != null ? importLastRead(formatDateTime(isoFromMillis(access.lastReadAt))) : importNeverRead()}</Text>
          </View>
          <Text style={styles.value}>{access.accessEnabled ? importAccessOn() : importAccessOff()}</Text>
        </View>
      </View>

      <GroupHeader label={importFullGroup()} />
      {full.length === 0 ? (
        <Text style={styles.emptyText} testID="import-full-empty">
          {importFullEmpty()}
        </Text>
      ) : (
        <View style={styles.card} testID="import-full-list">
          {full.map((app, index) => (
            <AppRow key={app.package} app={app} first={index === 0} accountNames={accountNames} onToggle={props.onToggle} onPickAccount={props.onPickAccount} />
          ))}
        </View>
      )}

      <GroupHeader label={importDetectedGroup()} />
      {generic.length === 0 ? (
        <Text style={styles.emptyText} testID="import-detected-empty">
          {importDetectedEmpty()}
        </Text>
      ) : (
        <>
          <View style={styles.card} testID="import-detected-list">
            {generic.map((app, index) => (
              <AppRow key={app.package} app={app} first={index === 0} accountNames={accountNames} onToggle={props.onToggle} onPickAccount={props.onPickAccount} />
            ))}
          </View>
          <Text style={styles.helpText}>{importDetectedHelp()}</Text>
        </>
      )}
      <Text style={styles.helpText}>{importOnlyEnabledNote()}</Text>

      {(problems.length > 0 || (access.available && access.accessEnabled && !access.ignoringBattery)) && <GroupHeader label={importProblemsHeader()} />}
      <View style={styles.problems}>
        {problems.map(problem =>
          problem.kind === 'battery_saver' ? (
            <View key={problem.kind} style={styles.note} testID="import-problem-battery">
              <Icon name="info" size={18} color={MonoColors.text} />
              <View style={styles.flex}>
                <Text style={styles.noteText}>{importBatteryNote()}</Text>
                <LinkButton label={importOpenBattery()} onPress={props.onOpenBattery} testID="import-open-battery" />
              </View>
            </View>
          ) : (
            <View key={problem.kind} style={styles.bad} testID={`import-problem-${problem.kind}`}>
              <Icon name="alert" size={18} color={MonoColors.negative} />
              <View style={styles.flex}>
                <Text style={styles.badText}>
                  <Text style={styles.badTitle}>{problem.kind === 'access_off' ? importProblemAccessOffTitle() : importProblemStoppedTitle()}</Text>
                  {' '}
                  {problem.kind === 'access_off' ? importProblemAccessOffBody() : importProblemStoppedBody()}
                </Text>
                <LinkButton
                  label={problem.kind === 'access_off' ? importOpenGuide() : importRestartService()}
                  onPress={problem.kind === 'access_off' ? props.onOpenGuide : props.onRestartService}
                  testID={problem.kind === 'access_off' ? 'import-open-guide' : 'import-restart'}
                />
              </View>
            </View>
          ),
        )}
      </View>
    </>
  );
}

// ---------------------------------------------------------------- parts

function AppRow({
  app,
  first,
  accountNames,
  onToggle,
  onPickAccount,
}: {
  app: ImportAppRow;
  first: boolean;
  accountNames: ReadonlyMap<number, string>;
  onToggle: (app: ImportAppRow, on: boolean) => void;
  onPickAccount: (app: ImportAppRow) => void;
}) {
  const accountName = app.account_id != null ? accountNames.get(app.account_id) : undefined;
  const sub = accountName ? importAppToAccount(accountName) : importAppUnmapped();
  const on = app.enabled === 1;
  return (
    <View style={[styles.row, !first && styles.rowSeparator]} testID={`import-app-${app.package}`}>
      <Pressable
        onPress={() => onPickAccount(app)}
        accessibilityRole="button"
        accessibilityLabel={`${app.app_name}, ${sub}`}
        android_ripple={undefined}
        style={styles.rowMain}
        testID={`import-app-pick-${app.package}`}
      >
        <View style={styles.disc}>
          <Text style={styles.code}>{appCode(app.app_name)}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.rowTitle}>{app.app_name}</Text>
          <Text style={styles.caption}>{sub}</Text>
        </View>
      </Pressable>
      <MonoSwitch value={on} onValueChange={next => onToggle(app, next)} label={importAppSwitchLabel(app.app_name, on)} testID={`import-app-switch-${app.package}`} />
    </View>
  );
}

function Pill({ label, check = false }: { label: string; check?: boolean }) {
  return (
    <View style={styles.pill}>
      {check && <Icon name="check" size={16} color={MonoColors.textSecond} />}
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

function GroupHeader({ label }: { label: string }) {
  return (
    <View style={styles.groupHead}>
      <Text style={styles.groupLabel} accessibilityRole="header">
        {label}
      </Text>
    </View>
  );
}

function ListCard({ icon, lines }: { icon: IconName; lines: string[] }) {
  return (
    <View style={[styles.card, styles.listCard]}>
      {lines.map((line, index) => (
        <View key={line} style={[styles.listRow, index > 0 && styles.rowSeparator]}>
          <Icon name={icon} size={18} color={MonoColors.text} />
          <Text style={styles.listText}>{line}</Text>
        </View>
      ))}
    </View>
  );
}

function LinkButton({ label, onPress, testID }: { label: string; onPress: () => void; testID: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.link} testID={testID}>
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  header: { paddingHorizontal: 8, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 4 },
  title: { ...MonoText.titleM, color: MonoColors.text, flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 4 },
  flex: { flex: 1 },
  intro: { ...MonoText.bodyS, color: MonoColors.textSecond, lineHeight: 20 },

  card: { marginTop: 12, backgroundColor: MonoColors.card, borderWidth: 1, borderColor: MonoColors.border, borderRadius: 20 },
  cardPad: { padding: 16 },
  cardHead: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardTitle: { ...MonoText.bodyStrong, color: MonoColors.text },
  cardDesc: { marginTop: 4 },
  cardButton: { marginTop: 14 },
  caption: { ...MonoText.caption, color: MonoColors.textMeta },

  discLg: { width: 44, height: 44, borderRadius: 16, backgroundColor: '#1D1D1E', borderWidth: 1, borderColor: '#2A2A2B', alignItems: 'center', justifyContent: 'center' },
  disc: { width: 36, height: 36, borderRadius: 14, backgroundColor: '#1D1D1E', borderWidth: 1, borderColor: '#2A2A2B', alignItems: 'center', justifyContent: 'center' },
  code: { ...MonoText.label, color: MonoColors.text },

  pill: { minHeight: 24, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: MonoColors.border, borderRadius: 8 },
  pillText: { ...MonoText.caption, color: MonoColors.textSecond },

  groupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 20, paddingBottom: 4, paddingHorizontal: 4, gap: 8 },
  groupLabel: { ...MonoText.label, color: MonoColors.textMeta, textTransform: 'uppercase' },

  listCard: { marginTop: 0, paddingHorizontal: 16 },
  listRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 10 },
  listText: { ...MonoText.bodyS, color: MonoColors.textSecond, flex: 1 },
  footnote: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 18 },
  footnoteText: { ...MonoText.caption, color: MonoColors.textSecond, flex: 1, lineHeight: 17 },

  pending: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: 68, borderWidth: 1.5, borderColor: MonoColors.accent },
  pendingTitle: { ...MonoText.bodyStrong, color: MonoColors.text },

  row: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  rowSeparator: { borderTopWidth: 1, borderTopColor: MonoColors.border },
  rowMain: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowTitle: { ...MonoText.h2, color: MonoColors.text },
  value: { ...MonoText.bodyS, color: MonoColors.textSecond },

  emptyText: { ...MonoText.bodyS, color: MonoColors.textMeta, paddingHorizontal: 4, paddingTop: 4 },
  helpText: { ...MonoText.caption, color: MonoColors.textMeta, paddingHorizontal: 4, paddingTop: 8, lineHeight: 17 },

  problems: { gap: 10, marginTop: 4 },
  bad: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderWidth: 1.5, borderColor: MonoColors.negative, backgroundColor: MonoColors.surface, borderRadius: 16, padding: 14 },
  badText: { ...MonoText.bodyS, color: MonoColors.text },
  badTitle: { fontFamily: MonoText.bodyStrong.fontFamily, color: MonoColors.negative },
  note: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderWidth: 1, borderColor: MonoColors.border, backgroundColor: MonoColors.surface, borderRadius: 16, padding: 14, marginBottom: 8 },
  noteText: { ...MonoText.bodyS, color: MonoColors.textSecond },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  linkText: { ...MonoText.chip, color: MonoColors.text, textDecorationLine: 'underline' },
});

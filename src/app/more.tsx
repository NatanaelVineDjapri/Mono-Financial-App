// More (/more, board "More", PAGES.md M): the secondary menu, pushed from the avatar on Overview
// and not a tab, so there is no tab bar here or on any screen it opens. The backup status comes
// first so the risk of losing data is always in view; then two groups of rows; then the footer.
// It reads when the last backup was made and how many fixed expenses are due, and shows no
// amounts, so hidden-amounts mode has nothing to hide here.
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/Card';
import { Segmented } from '@/components/Segmented';
import { Icon } from '@/components/Icon';
import { BackupStatusCard } from '@/features/more/BackupStatusCard';
import { useCreateBackup } from '@/features/backup/useCreateBackup';
import { MoreRow } from '@/features/more/MoreRow';
import { useMoreData } from '@/features/more/useMoreData';
import { useLanguageSetting } from '@/features/settings/useLanguageSetting';
import {
  devToolsHint,
  devToolsLabel,
  moreBackLabel,
  moreBackText,
  moreBackupRestoreSub,
  moreBackupRestoreTitle,
  moreCategoriesSub,
  moreCategoriesTitle,
  moreFooterLine,
  moreGoalsSub,
  moreGoalsTitle,
  moreGroupData,
  moreGroupLanguage,
  languageEnglishLabel,
  languageIndonesianLabel,
  moreGroupMoney,
  moreLogoLabel,
  moreRecurringSub,
  moreRecurringTitle,
  moreReportsSub,
  moreReportsTitle,
  moreScreenTitle,
  moreSettingsSub,
  moreSettingsTitle,
} from '@/i18n';
import { languageChoiceEnabled } from '@/i18n/lang';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

const LOGO_HEIGHT = 56;
const LOGO_ASPECT = 499 / 431; // assets/brand/mono-lockup.png

export default function MoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { backup, dueCount } = useMoreData();
  const { create: createBackupNow, busy: backupNowBusy } = useCreateBackup();
  const { language, change: changeLanguage } = useLanguageSetting();
  const version = Constants.expoConfig?.version ?? null;
  const go = (path: string) => () => router.push(path as never);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={moreBackLabel()}
          hitSlop={4}
          android_ripple={undefined}
          style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
          testID="more-back"
        >
          <Icon name="chevron-left" color={MonoColors.text} />
          <Text style={styles.backText}>{moreBackText()}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.title} accessibilityRole="header">
          {moreScreenTitle()}
        </Text>

        <BackupStatusCard state={backup} onOpen={go('/backup')} onDownload={createBackupNow} downloadBusy={backupNowBusy} />

        <Text style={styles.group} accessibilityRole="header">
          {moreGroupMoney()}
        </Text>
        <Card style={styles.groupCard}>
          <MoreRow icon="target" title={moreGoalsTitle()} sub={moreGoalsSub()} onPress={go('/goals')} testID="more-goals" />
          <MoreRow icon="refresh" title={moreRecurringTitle()} sub={moreRecurringSub(dueCount)} onPress={go('/recurring')} testID="more-recurring" />
          <MoreRow icon="file-text" title={moreReportsTitle()} sub={moreReportsSub()} onPress={go('/reports')} testID="more-reports" />
          <MoreRow icon="tag" title={moreCategoriesTitle()} sub={moreCategoriesSub()} onPress={go('/categories')} last testID="more-categories" />
        </Card>

        <Text style={styles.group} accessibilityRole="header">
          {moreGroupData()}
        </Text>
        <Card style={styles.groupCard}>
          <MoreRow icon="database" title={moreBackupRestoreTitle()} sub={moreBackupRestoreSub()} onPress={go('/backup')} testID="more-backup" />
          <MoreRow icon="slider" title={moreSettingsTitle()} sub={moreSettingsSub()} onPress={go('/settings')} last testID="more-settings" />
        </Card>

        {languageChoiceEnabled() && (
          <>
            <Text style={styles.group} accessibilityRole="header">
              {moreGroupLanguage()}
            </Text>
            <Card style={styles.languageCard}>
              <Segmented
                options={[
                  { value: 'en', label: languageEnglishLabel() },
                  { value: 'id', label: languageIndonesianLabel() },
                ]}
                value={language}
                onChange={value => changeLanguage(value === 'id' ? 'id' : 'en')}
                testID="language-selector"
              />
            </Card>
          </>
        )}

        {__DEV__ && (
          <Card style={styles.devCard}>
            <MoreRow icon="info" title={devToolsLabel()} sub={devToolsHint()} onPress={go('/dev')} last testID="more-dev" />
          </Card>
        )}

        <View style={styles.footer}>
          <Image source={require('@/assets/brand/mono-lockup.png')} style={{ height: LOGO_HEIGHT, width: LOGO_HEIGHT * LOGO_ASPECT }} resizeMode="contain" accessibilityLabel={moreLogoLabel()} />
          <Text style={styles.footerText}>{moreFooterLine(version)}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  header: { paddingHorizontal: 12, paddingBottom: 8 },
  back: { minHeight: 44, minWidth: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 12 },
  backPressed: { opacity: 0.7 },
  backText: { ...MonoText.body, color: MonoColors.text },
  content: { paddingHorizontal: 16 },
  title: { ...MonoText.titleL, color: MonoColors.text, marginTop: 8, marginBottom: 16 },
  group: { ...MonoText.label, color: MonoColors.textMeta, marginTop: 24, marginBottom: 8, marginLeft: 4 },
  groupCard: { padding: 0, overflow: 'hidden' },
  languageCard: { padding: 12 },
  devCard: { padding: 0, overflow: 'hidden', marginTop: 24 },
  footer: { alignItems: 'center', gap: 8, marginTop: 32 },
  footerText: { ...MonoText.caption, color: MonoColors.textMeta, textAlign: 'center' },
});

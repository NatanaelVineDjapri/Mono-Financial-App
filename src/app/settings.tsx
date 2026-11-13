// Settings (/settings, board "Settings"). Only the "Asisten" group is built so far: the AI chat's
// controls and the way into automatic import (Pengaturan, Asisten, Impor otomatis). The rest of
// the board (reminders, exchange rates, about) comes with its own phases; this screen keeps the
// route real in the meantime, and the row on More lands here.
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { AiSettingsSection } from '@/features/ai_chat/AiSettingsSection';
import { useImportApps } from '@/features/import/useImportApps';
import { MoreRow } from '@/features/more/MoreRow';
import { backLabel, importAutoRowHint, importAutoRowValue, importAutoTitle, moreSettingsTitle, ratesTitle, settingsAssistantGroup, settingsRatesRowHint } from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data } = useImportApps();
  const enabledApps = data?.apps.filter(a => a.enabled === 1).length ?? 0;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <IconButton label={backLabel()} onPress={() => router.back()} testID="settings-back">
          <Icon name="chevron-left" color={MonoColors.text} />
        </IconButton>
        <Text style={styles.title} accessibilityRole="header">
          {moreSettingsTitle()}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}>
        <Text style={styles.group} accessibilityRole="header">
          {settingsAssistantGroup()}
        </Text>
        <Card style={styles.card}>
          <AiSettingsSection onOpenSetup={() => router.push('/ai-setup' as never)} />
        </Card>
        <Card style={styles.rows}>
          <MoreRow
            icon="bell"
            title={importAutoTitle()}
            sub={`${importAutoRowValue(enabledApps)}. ${importAutoRowHint()}`}
            onPress={() => router.push('/settings/import' as never)}
            testID="settings-import-row"
          />
          <MoreRow icon="refresh" title={ratesTitle()} sub={settingsRatesRowHint()} onPress={() => router.push('/settings/rates' as never)} last testID="settings-rates-row" />
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  header: { paddingHorizontal: 12, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { ...MonoText.titleM, color: MonoColors.text },
  content: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  group: { ...MonoText.label, color: MonoColors.textMeta, textTransform: 'uppercase', paddingHorizontal: 4, paddingTop: 8 },
  card: { padding: 16 },
  rows: { padding: 0, overflow: 'hidden' },
});

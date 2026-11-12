// __DEV__-only sample recorder (docs/IMPORT_PLAN.md): the raw text of notifications from the apps
// that are switched on in Automatic import, in memory only, with a Copy button. It is how real
// sample texts are collected, to be pasted into a chat so a parser can be written from real text.
// Nothing here is written to the database or to disk. Unreachable in a production build (same
// Redirect pattern as app/dev/index.tsx).
import * as Clipboard from 'expo-clipboard';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { MonoSwitch } from '@/components/MonoSwitch';
import { showToast } from '@/components/toast-store';
import { getDevAllowSystemApps, setDevAllowSystemApps, setRetainWhenIdle } from '@/features/import/notifications/native';
import { sampleToText, startSampler, useSamplerStore, type Sample } from '@/features/import/notifications/sampler';
import { useImportApps } from '@/features/import/useImportApps';
import { backLabel, importSamplerClear, importSamplerCopied, importSamplerCopy, importSamplerEmpty, importSamplerHint, importSamplerSystemHint, importSamplerSystemLabel, importSamplerTitle } from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

export default function ImportSampler() {
  if (!__DEV__) return <Redirect href="/" />;
  return <ImportSamplerContent />;
}

function ImportSamplerContent() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data } = useImportApps();
  const samples = useSamplerStore(s => s.samples);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [allowSystem, setAllowSystem] = useState(getDevAllowSystemApps);

  // The allowlist as of now, read on every event (apps can be switched on or off meanwhile).
  const allowed = useRef<ReadonlySet<string>>(new Set());
  useEffect(() => {
    allowed.current = new Set((data?.apps ?? []).filter(a => a.enabled === 1).map(a => a.package));
  }, [data]);

  useEffect(() => {
    setRetainWhenIdle(false);
    return startSampler(() => allowed.current);
  }, []);

  const copy = async (sample: Sample) => {
    await Clipboard.setStringAsync(sampleToText(sample));
    setCopiedId(sample.id);
    showToast(importSamplerCopied());
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <IconButton label={backLabel()} onPress={() => router.back()}>
          <Icon name="chevron-left" color={MonoColors.text} />
        </IconButton>
        <Text style={styles.title} accessibilityRole="header">
          {importSamplerTitle()}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}>
        <Text style={styles.hint}>{importSamplerHint()}</Text>
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.pkg}>{importSamplerSystemLabel()}</Text>
            <Text style={styles.meta}>{importSamplerSystemHint()}</Text>
          </View>
          <MonoSwitch
            value={allowSystem}
            onValueChange={next => {
              setDevAllowSystemApps(next);
              setAllowSystem(next);
            }}
            label={importSamplerSystemLabel()}
            testID="sampler-system-switch"
          />
        </View>
        {samples.length > 0 && <Button label={importSamplerClear()} variant="secondary" onPress={() => useSamplerStore.getState().clear()} testID="sampler-clear" />}
        {samples.length === 0 && <Text style={styles.empty}>{importSamplerEmpty()}</Text>}
        {samples.map(sample => (
          <View key={sample.id} style={styles.card} testID={`sample-${sample.id}`}>
            <Text style={styles.pkg}>{sample.package}</Text>
            <Text style={styles.meta}>{new Date(sample.postedAt).toISOString()}</Text>
            <Text style={styles.raw} selectable>
              {sampleToText(sample)}
            </Text>
            <Button label={copiedId === sample.id ? importSamplerCopied() : importSamplerCopy()} variant="secondary" onPress={() => void copy(sample)} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  header: { paddingHorizontal: 12, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { ...MonoText.titleM, color: MonoColors.text },
  content: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  hint: { ...MonoText.bodyS, color: MonoColors.textSecond },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  switchText: { flex: 1, gap: 2 },
  empty: { ...MonoText.bodyS, color: MonoColors.textMeta },
  card: { backgroundColor: MonoColors.card, borderWidth: 1, borderColor: MonoColors.border, borderRadius: 16, padding: 14, gap: 8 },
  pkg: { ...MonoText.bodyStrong, color: MonoColors.text },
  meta: { ...MonoText.caption, color: MonoColors.textMeta },
  raw: { ...MonoText.mono, color: MonoColors.textSecond },
});

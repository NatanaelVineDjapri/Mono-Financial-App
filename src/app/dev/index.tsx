// __DEV__-only dev tools (CLAUDE.md step 5): load/reset the sample dataset and pin the
// clock to the design's reference date, so Ringkasan/Anggaran have something to show
// before real entry screens exist. Unreachable in a production build (same Redirect
// pattern as app/dev/gallery.tsx).
import { useQueryClient } from '@tanstack/react-query';
import { Link, Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { MonoSwitch } from '@/components/MonoSwitch';
import { showToast } from '@/components/toast-store';
import { setClockOverride } from '@/core/clock';
import { useDb } from '@/data/db/DbProvider';
import { invalidateAfterWrite } from '@/data/queryKeys';
import { pickAndImportSql } from '@/dev/importSqlFile';
import { loadNovemberData } from '@/dev/loadNovemberData';
import { importSamplerTitle } from '@/i18n';
import { loadSampleData, loadSampleDataWithValas } from '@/dev/loadSample';
import { resetDatabase } from '@/dev/resetDatabase';
import { MOCK_SCENARIOS, useMockCardStore } from '@/features/nfc/mock/mockCardReader';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

const SAMPLE_DATE_ISO = '2026-10-28T09:00:00+07:00';

export default function DevTools() {
  if (!__DEV__) return <Redirect href="/" />;
  return <DevToolsContent />;
}

function DevToolsContent() {
  const insets = useSafeAreaInsets();
  const db = useDb();
  const queryClient = useQueryClient();
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [confirmingImport, setConfirmingImport] = useState(false);
  const router = useRouter();
  const mockCard = useMockCardStore();

  async function after(action: () => Promise<void>, successMessage: string) {
    try {
      await action();
      await invalidateAfterWrite(queryClient);
      showToast(successMessage);
    } catch (err) {
      await invalidateAfterWrite(queryClient);
      showToast(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Dev tools</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        <Button label="Load sample data" onPress={() => after(() => loadSampleData(db), 'Sample data loaded.')} />
        <Button
          label="Load sample data + Valas"
          variant="secondary"
          onPress={() => after(() => loadSampleDataWithValas(db), 'Sample data + Valas loaded.')}
        />
        <Button
          label="+ Add November transactions"
          variant="secondary"
          onPress={() => after(() => loadNovemberData(db), 'November transactions added.')}
        />

        {confirmingReset ? (
          <View style={styles.confirmRow}>
            <Text style={styles.confirmText}>Reset the database? Everything you entered will be lost.</Text>
            <View style={styles.confirmButtons}>
              <Button
                label="Yes, delete"
                variant="secondary"
                style={styles.confirmButton}
                onPress={() => {
                  setConfirmingReset(false);
                  void after(() => resetDatabase(db), 'Database reset.');
                }}
              />
              <Button label="Cancel" variant="secondary" style={styles.confirmButton} onPress={() => setConfirmingReset(false)} />
            </View>
          </View>
        ) : (
          <Button label="Reset database" variant="secondary" onPress={() => setConfirmingReset(true)} />
        )}

        {confirmingImport ? (
          <View style={styles.confirmRow}>
            <Text style={styles.confirmText}>Replace everything with a .sql file you pick? The current data is cleared first, and put back if the file does not pass the integrity check.</Text>
            <View style={styles.confirmButtons}>
              <Button
                label="Pick file"
                variant="secondary"
                style={styles.confirmButton}
                onPress={() => {
                  setConfirmingImport(false);
                  void (async () => {
                    try {
                      const summary = await pickAndImportSql(db);
                      await invalidateAfterWrite(queryClient);
                      if (summary) showToast(`Imported ${summary.accounts} accounts and ${summary.transactions} records.`);
                    } catch (err) {
                      await invalidateAfterWrite(queryClient);
                      showToast(err instanceof Error ? err.message : String(err));
                    }
                  })();
                }}
              />
              <Button label="Cancel" variant="secondary" style={styles.confirmButton} onPress={() => setConfirmingImport(false)} />
            </View>
          </View>
        ) : (
          <Button label="Import a .sql file (replaces all data)" variant="secondary" onPress={() => setConfirmingImport(true)} />
        )}

        <Button
          label="Set the date to 28 Oct 2026"
          variant="secondary"
          onPress={() => after(async () => setClockOverride(SAMPLE_DATE_ISO), 'Date set to 28 Oct 2026.')}
        />
        <Button
          label="Use the real date"
          variant="secondary"
          onPress={() => after(async () => setClockOverride(null), 'Using the real date again.')}
        />

        <Link href="/dev/gallery" asChild>
          <Button label="Galeri dev" variant="secondary" />
        </Link>

        <Link href="/dev/cards" asChild>
          <Button label="Kartu Fisik Bank (Preview)" variant="secondary" />
        </Link>

        <Link href="/dev/import-sampler" asChild>
          <Button label={importSamplerTitle()} variant="secondary" />
        </Link>

        <View style={styles.mockRow}>
          <Text style={styles.confirmText}>Pretend card (the emulator has no NFC)</Text>
          <MonoSwitch label="Pretend card" value={mockCard.enabled} onValueChange={mockCard.setEnabled} testID="dev-mock-card" />
        </View>
        {mockCard.enabled && (
          <View style={styles.mockList}>
            {MOCK_SCENARIOS.map(scenario => (
              <Button
                key={scenario.id}
                label={`${mockCard.scenario === scenario.id ? '● ' : ''}${scenario.label}`}
                variant="secondary"
                onPress={() => mockCard.setScenario(scenario.id)}
                testID={`dev-mock-${scenario.id}`}
              />
            ))}
            <Button label="Open Scan card" onPress={() => router.push('/nfc/scan' as never)} testID="dev-mock-open" />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  title: { ...MonoText.titleL, color: MonoColors.text },
  list: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  confirmRow: { gap: 12 },
  confirmText: { ...MonoText.body, color: MonoColors.text },
  confirmButtons: { flexDirection: 'row', gap: 12 },
  confirmButton: { flex: 1 },
  mockList: { gap: 12 },
  mockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 48 },
});

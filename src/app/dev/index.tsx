// __DEV__-only dev tools (CLAUDE.md step 5): load/reset the sample dataset and pin the
// clock to the design's reference date, so Ringkasan/Anggaran have something to show
// before real entry screens exist. Unreachable in a production build (same Redirect
// pattern as app/dev/gallery.tsx).
import { Link, Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/Button';
import { showToast } from '@/components/toast-store';
import { setClockOverride } from '@/core/clock';
import { useDb } from '@/data/db/DbProvider';
import { invalidateAfterWrite } from '@/data/queryKeys';
import { loadSampleData } from '@/dev/loadSample';
import { resetDatabase } from '@/dev/resetDatabase';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

const SAMPLE_DATE_ISO = '2026-10-28T09:00:00+07:00';

export default function DevTools() {
  if (!__DEV__) return <Redirect href="/(tabs)/index" />;
  return <DevToolsContent />;
}

function DevToolsContent() {
  const insets = useSafeAreaInsets();
  const db = useDb();
  const queryClient = useQueryClient();
  const [confirmingReset, setConfirmingReset] = useState(false);

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

      <View style={styles.list}>
        <Button label="Muat data contoh" onPress={() => after(() => loadSampleData(db), 'Data contoh dimuat.')} />

        {confirmingReset ? (
          <View style={styles.confirmRow}>
            <Text style={styles.confirmText}>Yakin reset database? Semua data yang sudah dimasukkan akan hilang.</Text>
            <View style={styles.confirmButtons}>
              <Button
                label="Ya, hapus"
                variant="secondary"
                style={styles.confirmButton}
                onPress={() => {
                  setConfirmingReset(false);
                  void after(() => resetDatabase(db), 'Database direset.');
                }}
              />
              <Button label="Batal" variant="secondary" style={styles.confirmButton} onPress={() => setConfirmingReset(false)} />
            </View>
          </View>
        ) : (
          <Button label="Reset database" variant="secondary" onPress={() => setConfirmingReset(true)} />
        )}

        <Button
          label="Set tanggal ke 28 Okt 2026"
          variant="secondary"
          onPress={() => after(async () => setClockOverride(SAMPLE_DATE_ISO), 'Tanggal di-set ke 28 Okt 2026.')}
        />
        <Button
          label="Pakai tanggal asli"
          variant="secondary"
          onPress={() => after(async () => setClockOverride(null), 'Pakai tanggal asli lagi.')}
        />

        <Link href="/dev/gallery" asChild>
          <Button label="Galeri dev" variant="secondary" />
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  title: { ...MonoText.titleL, color: MonoColors.text },
  list: { paddingHorizontal: 20, gap: 12 },
  confirmRow: { gap: 12 },
  confirmText: { ...MonoText.body, color: MonoColors.text },
  confirmButtons: { flexDirection: 'row', gap: 12 },
  confirmButton: { flex: 1 },
});

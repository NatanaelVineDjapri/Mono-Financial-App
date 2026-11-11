// Opens the database once at the root (CLAUDE.md step 4) and makes it available via
// useDb(). `openDb` is injectable so a test can supply a fake that fails once and then
// succeeds, without mocking the native expo-sqlite/expo-asset modules.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { dbOpenFailedMessage, dbRetryLabel } from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

import { openDb as defaultOpenDb } from './open';
import type { Db } from './types';

const DbContext = createContext<Db | null>(null);

// Thrown eagerly (not a silent undefined) so a screen that forgets the provider fails
// loudly in development rather than crashing later on a null dereference.
export function useDb(): Db {
  const db = useContext(DbContext);
  if (!db) {
    throw new Error('useDb() was called outside a <DbProvider>.');
  }
  return db;
}

type DbState = { status: 'loading' } | { status: 'ready'; db: Db } | { status: 'error' };

export interface DbProviderProps {
  children: ReactNode;
  openDb?: () => Promise<Db>;
}

export function DbProvider({ children, openDb = defaultOpenDb }: DbProviderProps) {
  const [state, setState] = useState<DbState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    openDb()
      .then(db => {
        if (!cancelled) setState({ status: 'ready', db });
      })
      .catch(err => {
        // __DEV__-only: the user-facing error screen stays generic (no file paths or SQL
        // content), but the real cause must be visible in the Metro/logcat console —
        // openDb() failing silently is exactly what made this bug hard to diagnose.
        if (__DEV__) console.error('DbProvider: openDb() failed:', err);
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [openDb, attempt]);

  if (state.status === 'loading') {
    return <View style={styles.screen} testID="db-wait-screen" />;
  }

  if (state.status === 'error') {
    return (
      <View style={[styles.screen, styles.errorScreen]} testID="db-error-screen">
        <Text style={styles.errorText}>{dbOpenFailedMessage()}</Text>
        <Button
          label={dbRetryLabel()}
          onPress={() => {
            setState({ status: 'loading' });
            setAttempt(a => a + 1);
          }}
        />
      </View>
    );
  }

  return <DbContext.Provider value={state.db}>{children}</DbContext.Provider>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
  errorScreen: { alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 32 },
  errorText: { ...MonoText.body, color: MonoColors.text, textAlign: 'center' },
});

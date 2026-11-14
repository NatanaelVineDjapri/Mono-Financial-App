// Lock gate in src/app/_layout.tsx.
// Guards the entire application: while locked, nothing underneath is mounted.
// Listens to AppState changes (30s background grace) and saves deep links opened while locked.
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { useDb } from '@/data/db/DbProvider';
import { getSetting } from '@/data/repo/settings';
import { MonoColors } from '@/theme/tokens';
import { LockScreen } from './LockScreen';
import { shouldLock } from './lockState';
import { useLock } from './useLock';

export interface LockGateProps {
  children: ReactNode;
  autoPrompt?: boolean;
}

export function LockGate({ children, autoPrompt = true }: LockGateProps) {
  const db = useDb();
  const router = useRouter();
  const status = useLock(s => s.status);
  const [lockEnabled, setLockEnabled] = useState<boolean | null>(null);
  const lockEnabledRef = useRef<boolean | null>(null);
  lockEnabledRef.current = lockEnabled;

  const isColdStartRef = useRef(true);

  // 1. Initial read on mount (cold start)
  useEffect(() => {
    let cancelled = false;
    getSetting(db, 'app_lock')
      .then(value => {
        if (cancelled) return;
        const enabled = value !== '0';
        setLockEnabled(enabled);

        const mustLock = shouldLock({
          appLockOn: enabled,
          isColdStart: isColdStartRef.current,
          backgroundedAt: null,
          now: Date.now(),
        });
        isColdStartRef.current = false;

        if (mustLock) {
          useLock.getState().lock();
        } else {
          useLock.getState().unlock();
        }
      })
      .catch(() => {
        if (!cancelled) {
          isColdStartRef.current = false;
          setLockEnabled(false);
          useLock.getState().unlock();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [db]);

  // 2. AppState lifecycle management
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async nextAppState => {
      const { authenticating, backgroundedAt, suspended } = useLock.getState();
      if (authenticating) return; // ignore biometric system prompt transition

      if (nextAppState === 'background') {
        useLock.getState().setBackgroundedAt(Date.now());
      } else if (nextAppState === 'active') {
        try {
          const val = await getSetting(db, 'app_lock');
          const enabled = val != null ? val !== '0' : (lockEnabledRef.current ?? true);
          setLockEnabled(enabled);

          const mustLock = shouldLock({
            appLockOn: enabled,
            isColdStart: false,
            backgroundedAt,
            now: Date.now(),
            suspended,
          });

          if (mustLock) {
            useLock.getState().lock();
          }
        } catch {
          // Keep current state on error
        }
      }
    });

    return () => subscription.remove();
  }, [db]);

  // 3. Deep link handling while locked
  useEffect(() => {
    const sub = Linking.addEventListener('url', event => {
      if (useLock.getState().status === 'locked') {
        useLock.getState().setPendingTarget(event.url);
      }
    });

    void Linking.getInitialURL().then(url => {
      if (url && useLock.getState().status === 'locked') {
        useLock.getState().setPendingTarget(url);
      }
    });

    return () => sub.remove();
  }, []);

  // 4. Navigate to pending deep link after unlock
  useEffect(() => {
    if (status === 'unlocked') {
      const pending = useLock.getState().pendingTarget;
      if (pending) {
        useLock.getState().setPendingTarget(null);
        try {
          const path = pending.includes('://')
            ? pending.replace(/^[a-zA-Z0-9]+:\/\/?/, '/')
            : pending;
          const target = path.startsWith('/') ? path : `/${path}`;
          router.push(target as never);
        } catch {
          router.push(pending as never);
        }
      }
    }
  }, [status, router]);

  // Waiting for initial db settings read: show same splash as app startup
  if (status === 'checking' || lockEnabled === null) {
    return (
      <View style={styles.splash} testID="lock-gate-splash">
        <Image
          style={styles.mark}
          source={require('@/assets/brand/mono-mark.png')}
          contentFit="contain"
        />
      </View>
    );
  }

  // When locked: render ONLY LockScreen (no child screens mounted, no queries executed)
  if (status === 'locked') {
    return <LockScreen autoPrompt={autoPrompt} />;
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: MonoColors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: {
    width: 120,
    height: 120 * (219 / 222),
  },
});

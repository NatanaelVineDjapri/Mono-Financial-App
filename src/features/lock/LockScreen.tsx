// Lock screen (papan Lock and Lock-Failed).
// Shown when app_lock is enabled and the app is cold-started or backgrounded > grace period.
// Biometric authentication with device credential fallback (PIN / pattern / password).
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  AccessibilityInfo,
  BackHandler,
  findNodeHandle,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { useDb } from '@/data/db/DbProvider';
import { invalidateAfterWrite } from '@/data/queryKeys';
import { setSetting } from '@/data/repo/settings';
import {
  lockBtnDisable,
  lockBtnOpenSettings,
  lockBtnUnlock,
  lockErrorFailed,
  lockErrorLockout,
  lockErrorNoHardware,
  lockFootnote,
  lockPromptCancel,
  lockPromptMessage,
  lockScanA11y,
  lockSubtitle,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';
import { useLock, withLockSuspended } from './useLock';

// ponytail: 30s lockout timeout matches system biometric cooldown; upgrade if custom OS lockout durations differ.
const LOCKOUT_COOLDOWN_MS = 30000;

export interface LockScreenProps {
  autoPrompt?: boolean;
}

export function LockScreen({ autoPrompt = true }: LockScreenProps) {
  const insets = useSafeAreaInsets();
  const db = useDb();
  const queryClient = useQueryClient();
  const { authenticating, failedReason, setAuthenticating, setFailedReason, unlock } = useLock();
  const [noHardwareOrEnrolled, setNoHardwareOrEnrolled] = useState(false);
  const unlockBtnRef = useRef<ComponentRef<typeof View>>(null);
  const lockoutTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (lockoutTimerRef.current) clearTimeout(lockoutTimerRef.current);
    };
  }, []);

  // System back button exits app, never navigates into protected screens
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      BackHandler.exitApp();
      return true;
    });
    return () => sub.remove();
  }, []);

  // Accessibility: initial focus on "Buka kunci"
  useEffect(() => {
    const handle = unlockBtnRef.current ? findNodeHandle(unlockBtnRef.current) : null;
    if (handle != null) {
      AccessibilityInfo.setAccessibilityFocus(handle);
    }
  }, [noHardwareOrEnrolled]);

  const handleAuth = useCallback(async () => {
    const { authenticating: isAuth, failedReason: reason } = useLock.getState();
    if (isAuth || reason === 'lockout') return;
    setAuthenticating(true);
    try {
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: lockPromptMessage(),
        cancelLabel: lockPromptCancel(),
        disableDeviceFallback: false,
      });

      if (res.success) {
        unlock();
      } else {
        const err = res.error;
        if (err && (err === 'lockout' || err.includes('lockout'))) {
          setFailedReason('lockout');
          if (lockoutTimerRef.current) clearTimeout(lockoutTimerRef.current);
          lockoutTimerRef.current = setTimeout(() => {
            if (useLock.getState().failedReason === 'lockout') {
              useLock.getState().setFailedReason(null);
            }
          }, LOCKOUT_COOLDOWN_MS);
        } else if (err === 'user_cancel' || err === 'app_cancel' || err === 'system_cancel' || (err && err.includes('cancel'))) {
          // Batal sendiri: kembali ke keadaan normal tanpa pesan galat
          setFailedReason(null);
        } else {
          // Sidik jari tidak dikenali
          setFailedReason('failed');
        }
      }
    } catch {
      setFailedReason('failed');
    } finally {
      setAuthenticating(false);
    }
  }, [setAuthenticating, setFailedReason, unlock]);

  // Check hardware & enrolled status on mount
  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const hasHw = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        const enrolledLevel = await LocalAuthentication.getEnrolledLevelAsync();
        if (!mounted) return;
        if (!hasHw || !enrolled || enrolledLevel === LocalAuthentication.SecurityLevel.NONE) {
          setNoHardwareOrEnrolled(true);
          setFailedReason('no_hardware');
          return;
        }
      } catch {
        // Fallback to allowing auth attempt
      }

      if (autoPrompt) {
        void handleAuth();
      }
    })();

    return () => {
      mounted = false;
    };
  }, [autoPrompt, handleAuth, setFailedReason]);

  const handleDisableLock = async () => {
    await setSetting(db, 'app_lock', '0');
    await invalidateAfterWrite(queryClient);
    unlock();
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, 24) + 40,
          paddingBottom: Math.max(insets.bottom, 24) + 16,
        },
      ]}
      testID="lock-screen"
    >
      {/* Top / Brand Lockup Section */}
      <View style={styles.topSection}>
        <Image source={require('@/assets/brand/mono-mark.png')} style={styles.mark} contentFit="contain" />
        <Text style={styles.title}>MONO Finance</Text>

        {noHardwareOrEnrolled ? (
          <Text style={styles.subtext}>{lockErrorNoHardware()}</Text>
        ) : failedReason === 'lockout' ? (
          <Text style={[styles.subtext, styles.errorText]}>{lockErrorLockout()}</Text>
        ) : failedReason === 'failed' ? (
          <Text style={[styles.subtext, styles.errorText]}>
            {lockErrorFailed()}
          </Text>
        ) : (
          <Text style={styles.subtext}>{lockSubtitle()}</Text>
        )}
      </View>

      {/* Middle Interactive Section */}
      <View style={styles.actionSection}>
        {noHardwareOrEnrolled ? (
          <View style={styles.buttonGroup}>
            <Button
              label={lockBtnOpenSettings()}
              onPress={() => void withLockSuspended(() => Linking.openSettings())}
              testID="lock-open-settings-btn"
            />
            <Button
              label={lockBtnDisable()}
              variant="secondary"
              onPress={() => void handleDisableLock()}
              testID="lock-disable-btn"
            />
          </View>
        ) : (
          <View style={styles.buttonGroup}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={lockScanA11y()}
              disabled={authenticating || failedReason === 'lockout'}
              onPress={() => void handleAuth()}
              style={({ pressed }) => [
                styles.fingerprintBtn,
                pressed && styles.fingerprintPressed,
                (authenticating || failedReason === 'lockout') && styles.disabled,
              ]}
              testID="lock-fingerprint-btn"
            >
              <Icon name="fingerprint" size={28} color={MonoColors.text} />
            </Pressable>

            <View ref={unlockBtnRef} collapsable={false} style={styles.unlockBtnWrapper}>
              <Button
                label={lockBtnUnlock()}
                onPress={() => void handleAuth()}
                disabled={authenticating || failedReason === 'lockout'}
                loading={authenticating}
                testID="lock-unlock-btn"
              />
            </View>
          </View>
        )}
      </View>

      {/* Footer Note */}
      <View style={styles.footerSection}>
        <Text style={styles.footerNote}>{lockFootnote()}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MonoColors.bg,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  topSection: {
    alignItems: 'center',
    paddingTop: 32,
  },
  mark: {
    width: 56,
    height: 56,
    marginBottom: 20,
  },
  title: {
    ...MonoText.titleL,
    color: MonoColors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtext: {
    ...MonoText.body,
    color: MonoColors.textSecond,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 22,
  },
  errorText: {
    color: MonoColors.negative,
  },
  actionSection: {
    width: '100%',
    alignItems: 'center',
    gap: 20,
  },
  buttonGroup: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
  },
  unlockBtnWrapper: {
    width: '100%',
  },
  fingerprintBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: MonoColors.card,
    borderWidth: 1,
    borderColor: MonoColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  fingerprintPressed: {
    backgroundColor: MonoColors.raised,
  },
  disabled: {
    opacity: 0.4,
  },
  footerSection: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  footerNote: {
    ...MonoText.caption,
    color: MonoColors.textMeta,
    textAlign: 'center',
  },
});

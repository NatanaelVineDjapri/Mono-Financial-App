// Whether MONO can read notifications at all, and what to tell the person when it cannot. The
// decision is pure (`importProblems`, `importSetupState`); the hook only reads the native answers
// and reads them again every time the app comes back to the front (the person may have been in
// Android's settings).
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import * as native from './native';

export interface AccessSnapshot {
  available: boolean; // the native module is in this build
  accessEnabled: boolean; // Android's "Notification access" is on for MONO
  connected: boolean; // the listener service is bound right now
  ignoringBattery: boolean; // MONO is exempt from battery optimisation
  lastReadAt: number | null; // epoch ms of the last allowed notification read
}

export const NO_ACCESS: AccessSnapshot = { available: false, accessEnabled: false, connected: false, ignoringBattery: true, lastReadAt: null };

export function readAccess(): AccessSnapshot {
  return {
    available: native.nativeAvailable,
    accessEnabled: native.isAccessEnabled(),
    connected: native.isConnected(),
    ignoringBattery: native.isIgnoringBatteryOptimizations(),
    lastReadAt: native.getLastReadAt(),
  };
}

// 'bad' problems have the red frame; 'note' ones are information (Import-Settings, "Kalau ada masalah").
export type ImportProblem = { kind: 'access_off'; level: 'bad' } | { kind: 'service_stopped'; level: 'bad' } | { kind: 'battery_saver'; level: 'note' };

// Only once something is switched on does a missing permission count as a problem: before that it
// is just "not set up".
export function importProblems(access: AccessSnapshot, hasEnabledApps: boolean): ImportProblem[] {
  if (!access.available || !hasEnabledApps) return [];
  const problems: ImportProblem[] = [];
  if (!access.accessEnabled) problems.push({ kind: 'access_off', level: 'bad' });
  else if (!access.connected) problems.push({ kind: 'service_stopped', level: 'bad' });
  if (access.accessEnabled && !access.ignoringBattery) problems.push({ kind: 'battery_saver', level: 'note' });
  return problems;
}

// Import-Setup when nothing is set up yet, Import-Settings otherwise.
export function importSetupState(access: AccessSnapshot, hasEnabledApps: boolean): 'setup' | 'settings' {
  return access.accessEnabled || hasEnabledApps ? 'settings' : 'setup';
}

// The guide for "setelan terbatas" is only shown while the permission is not on.
export function shouldShowPermissionGuide(access: AccessSnapshot): boolean {
  return !access.accessEnabled;
}

export function useNotificationAccess(): { access: AccessSnapshot; refresh: () => void } {
  const [access, setAccess] = useState<AccessSnapshot>(readAccess);
  const refresh = useCallback(() => setAccess(readAccess()), []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  return { access, refresh };
}

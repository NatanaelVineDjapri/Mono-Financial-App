// The JavaScript side of modules/notification-listener (Kotlin). Every call is safe when the native
// module is not there (Expo Go, Jest, a build made before the module was added): it answers
// "nothing" instead of throwing, and `nativeAvailable` says which case it is.
//
// The native side decides which notifications reach JavaScript (the allowlist); this file only
// asks it questions and listens. No notification text is kept here.
import { requireOptionalNativeModule } from 'expo';

export interface RawNotification {
  package: string;
  title: string | null;
  text: string | null;
  bigText: string | null;
  postedAt: number; // epoch milliseconds
}

export interface NativeSeenApp {
  package: string;
  appName: string;
  lastSeenAt: number; // epoch milliseconds
}

export interface NativeSubscription {
  remove: () => void;
}

interface NativeListenerModule {
  isAccessEnabled(): boolean;
  isConnected(): boolean;
  openAccessSettings(): void;
  openAppInfo(): void;
  isIgnoringBatteryOptimizations(): boolean;
  openBatterySettings(): void;
  requestRebind(): void;
  setAllowedPackages(packages: string[]): void;
  getAllowedPackages(): string[];
  getSeenApps(): NativeSeenApp[];
  forgetSeenApp(pkg: string): void;
  getLastReadAt(): number | null;
  setRetainWhenIdle(retain: boolean): void;
  drainQueue(): RawNotification[];
  addListener(event: 'onNotification', listener: (event: RawNotification) => void): NativeSubscription;
}

const native = requireOptionalNativeModule<NativeListenerModule>('MonoNotificationListener');

export const nativeAvailable: boolean = native != null;

function safe<T>(fn: (m: NativeListenerModule) => T, fallback: T): T {
  if (!native) return fallback;
  try {
    return fn(native);
  } catch {
    return fallback;
  }
}

export const isAccessEnabled = () => safe(m => m.isAccessEnabled(), false);
export const isConnected = () => safe(m => m.isConnected(), false);
export const openAccessSettings = () => safe(m => m.openAccessSettings(), undefined);
export const openAppInfo = () => safe(m => m.openAppInfo(), undefined);
export const isIgnoringBatteryOptimizations = () => safe(m => m.isIgnoringBatteryOptimizations(), true);
export const openBatterySettings = () => safe(m => m.openBatterySettings(), undefined);
export const requestRebind = () => safe(m => m.requestRebind(), undefined);
export const setAllowedPackages = (packages: readonly string[]) => safe(m => m.setAllowedPackages([...packages]), undefined);
export const getAllowedPackages = () => safe(m => m.getAllowedPackages(), [] as string[]);
export const getSeenApps = () => safe(m => m.getSeenApps(), [] as NativeSeenApp[]);
export const forgetSeenApp = (pkg: string) => safe(m => m.forgetSeenApp(pkg), undefined);
export const getLastReadAt = () => safe(m => m.getLastReadAt(), null as number | null);
export const setRetainWhenIdle = (retain: boolean) => safe(m => m.setRetainWhenIdle(retain), undefined);
export const drainQueue = () => safe(m => m.drainQueue(), [] as RawNotification[]);

// Listen for notifications of allowed apps. Returns a subscription, or null when there is no module.
export function addNotificationListener(listener: (event: RawNotification) => void): NativeSubscription | null {
  return safe(m => m.addListener('onNotification', listener), null as NativeSubscription | null);
}

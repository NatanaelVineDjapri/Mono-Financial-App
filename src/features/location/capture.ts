import * as Location from 'expo-location';

const LAST_KNOWN_MAX_AGE_MS = 20 * 60 * 1000;

export interface CapturedLocation {
  latE6: number;
  lngE6: number;
  accuracyM: number | null;
  capturedAt: string;
}

export function toCapturedLocation(position: Location.LocationObject): CapturedLocation {
  return {
    latE6: Math.round(position.coords.latitude * 1_000_000),
    lngE6: Math.round(position.coords.longitude * 1_000_000),
    accuracyM: position.coords.accuracy == null ? null : Math.round(position.coords.accuracy),
    capturedAt: new Date(position.timestamp).toISOString(),
  };
}

export function usableLocation(location: CapturedLocation): boolean {
  return location.accuracyM == null || location.accuracyM <= 500;
}

export async function captureForegroundLocation(now = Date.now()): Promise<CapturedLocation | null> {
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    if (permission.status !== Location.PermissionStatus.GRANTED) return null;

    const last = await Location.getLastKnownPositionAsync();
    if (last && now - last.timestamp < LAST_KNOWN_MAX_AGE_MS && (last.coords.accuracy == null || last.coords.accuracy <= 200)) {
      const result = toCapturedLocation(last);
      return usableLocation(result) ? result : null;
    }

    try {
      const current = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 6_000);
      const result = toCapturedLocation(current);
      return usableLocation(result) ? result : null;
    } catch (err) {
      if (__DEV__) console.warn('location: current position failed', err);
      // Balanced accuracy is answered from network (Wi-Fi and cell) positioning, which an emulator, or a
      // phone with no signal, does not have. Ask the GPS once more, for a little longer, before giving up.
      try {
        const gps = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }), 8_000);
        const result = toCapturedLocation(gps);
        return usableLocation(result) ? result : null;
      } catch (gpsErr) {
        if (__DEV__) console.warn('location: GPS position failed', gpsErr);
      }
      // Some Android emulator images deliver the GPS fix just after the native request
      // times out. Re-read the device cache once; it still has to be fresh and accurate.
      const refreshed = await Location.getLastKnownPositionAsync();
      if (!refreshed || now - refreshed.timestamp >= LAST_KNOWN_MAX_AGE_MS || (refreshed.coords.accuracy != null && refreshed.coords.accuracy > 200)) return null;
      const result = toCapturedLocation(refreshed);
      return usableLocation(result) ? result : null;
    }
  } catch (err) {
    if (__DEV__) console.warn('location: capture failed', err);
    return null;
  }
}

async function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('location_timeout')), milliseconds); }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

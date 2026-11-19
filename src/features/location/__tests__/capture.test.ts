import * as Location from 'expo-location';

import { captureForegroundLocation, toCapturedLocation, usableLocation } from '../capture';

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3, High: 4 },
  PermissionStatus: { GRANTED: 'granted' },
  getForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

const api = Location as jest.Mocked<typeof Location>;
const position = (timestamp: number, accuracy: number | null = 25) => ({
  timestamp,
  coords: { latitude: -6.1234567, longitude: 106.8123456, accuracy, altitude: null, heading: null, speed: null },
  mocked: false,
} as Location.LocationObject);

describe('transaction location capture', () => {
  beforeEach(() => jest.resetAllMocks());

  test('uses a fresh accurate last known position and converts to integer e6', async () => {
    const now = 2_000_000;
    api.getForegroundPermissionsAsync.mockResolvedValue({ status: Location.PermissionStatus.GRANTED } as never);
    api.getLastKnownPositionAsync.mockResolvedValue(position(now - 60_000) as never);
    expect(await captureForegroundLocation(now)).toMatchObject({ latE6: -6123457, lngE6: 106812346, accuracyM: 25 });
    expect(api.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  test('permission denied, timeout, and poor accuracy return no location', async () => {
    api.getForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' } as never);
    expect(await captureForegroundLocation()).toBeNull();

    api.getForegroundPermissionsAsync.mockResolvedValue({ status: Location.PermissionStatus.GRANTED } as never);
    api.getLastKnownPositionAsync.mockResolvedValue(null);
    api.getCurrentPositionAsync.mockRejectedValue(new Error('timeout'));
    expect(await captureForegroundLocation()).toBeNull();

    api.getCurrentPositionAsync.mockResolvedValue(position(Date.now(), 501) as never);
    expect(await captureForegroundLocation()).toBeNull();
  });

  test('when the balanced (network) request times out, the GPS request is tried and its fix is used', async () => {
    api.getForegroundPermissionsAsync.mockResolvedValue({ status: Location.PermissionStatus.GRANTED } as never);
    api.getLastKnownPositionAsync.mockResolvedValue(null);
    api.getCurrentPositionAsync.mockRejectedValueOnce(new Error('location_timeout')).mockResolvedValueOnce(position(Date.now(), 12) as never);
    expect(await captureForegroundLocation()).toMatchObject({ latE6: -6123457, lngE6: 106812346, accuracyM: 12 });
    expect(api.getCurrentPositionAsync.mock.calls.map(([options]) => options?.accuracy)).toEqual([Location.Accuracy.Balanced, Location.Accuracy.High]);
  });

  test('a GPS fix that is not accurate enough is not used either', async () => {
    api.getForegroundPermissionsAsync.mockResolvedValue({ status: Location.PermissionStatus.GRANTED } as never);
    api.getLastKnownPositionAsync.mockResolvedValue(null);
    api.getCurrentPositionAsync.mockRejectedValueOnce(new Error('location_timeout')).mockResolvedValueOnce(position(Date.now(), 900) as never);
    expect(await captureForegroundLocation()).toBeNull();
  });

  test('does not accept an unusable accuracy', () => {
    const location = toCapturedLocation(position(Date.now(), 501));
    expect(usableLocation(location)).toBe(false);
  });
});

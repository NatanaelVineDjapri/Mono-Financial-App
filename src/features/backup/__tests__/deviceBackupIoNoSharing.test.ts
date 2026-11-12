// A build made before expo-sharing was added has no native module for it, and expo-sharing throws
// the moment it is imported. The screen that imports deviceBackupIo (More) must still open: only
// sharing fails, and createBackup reports a backup that could not be made.
import { deviceBackupIo } from '../deviceBackupIo';

jest.mock('expo-sharing', () => {
  throw new Error("Cannot find native module 'ExpoSharing'");
});
jest.mock('expo-file-system', () => ({ File: class {}, Paths: { cache: { uri: 'file:///cache/', list: () => [] } } }));

describe('deviceBackupIo without the native sharing module', () => {
  test('importing it did not throw (this file loaded), and sharing alone fails', async () => {
    await expect(deviceBackupIo.share('file:///cache/x.json')).rejects.toThrow(/ExpoSharing/);
  });
});

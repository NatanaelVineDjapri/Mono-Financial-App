// The real device behind createBackup: a folder the person picks (Android's folder picker, through
// expo-file-system) or a file in the app's cache folder and the system share sheet (expo-sharing). Backup files from earlier runs are cleared out of the cache
// first, so at most one copy of the data lingers there; the latest one stays until the next backup
// because the app that received it may still be reading it when the share sheet closes.
import { Directory, File, Paths } from 'expo-file-system';
import { requireOptionalNativeModule } from 'expo';

import { backupShareTitle } from '@/i18n';
import { withLockSuspended } from '@/features/lock/useLock';

import type { BackupIo } from './createBackup';

const BACKUP_FILE = /^mono-backup-.*\.json$/;

function clearOldBackups(): void {
  try {
    for (const entry of Paths.cache.list()) {
      if (entry instanceof File && BACKUP_FILE.test(entry.name)) entry.delete();
    }
  } catch {
    // A leftover file is not worth failing a backup over.
  }
}

// expo-sharing is loaded only when a backup is shared. It looks for its native module the moment it
// is imported and throws if the build has none (a build made before the module was added), which
// would take the whole More screen down with it; loaded here, the failure is just a backup that
// could not be shared, and createBackup reports it.
function loadSharing(): typeof import('expo-sharing') {
  if (!requireOptionalNativeModule('ExpoSharing')) throw new Error('sharing_unavailable');
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- deliberately lazy, see above
  return require('expo-sharing');
}

// expo-file-system rejects the folder picker with "The file picker was cancelled by the user" when the
// person backs out; that is a choice, not an error.
function isPickerCancelled(err: unknown): boolean {
  const text = err instanceof Error ? `${(err as { code?: string }).code ?? ''} ${err.message}` : String(err);
  return /cancel/i.test(text);
}

export const deviceBackupIo: BackupIo = {
  async write(fileName, json) {
    clearOldBackups();
    const file = new File(Paths.cache, fileName);
    if (file.exists) file.delete();
    file.create();
    await file.write(json);
    return { uri: file.uri, sizeBytes: file.size ?? json.length };
  },
  async saveToFolder(fileName, json) {
    let folder: Directory;
    try {
      folder = await withLockSuspended(() => Directory.pickDirectoryAsync());
    } catch (err) {
      if (isPickerCancelled(err)) return null;
      throw err;
    }
    const file = folder.createFile(fileName, 'application/json');
    await file.write(json);
    return { sizeBytes: file.size ?? json.length };
  },
  async share(uri) {
    const Sharing = loadSharing();
    if (!(await Sharing.isAvailableAsync())) throw new Error('sharing_unavailable');
    await withLockSuspended(() =>
      Sharing.shareAsync(uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: backupShareTitle() }),
    );
  },
};

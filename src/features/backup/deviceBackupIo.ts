// The real device behind createBackup: a file in the app's cache folder and the system share sheet
// (expo-file-system, expo-sharing). Backup files from earlier runs are cleared out of the cache
// first, so at most one copy of the data lingers there; the latest one stays until the next backup
// because the app that received it may still be reading it when the share sheet closes.
import { File, Paths } from 'expo-file-system';

import { backupShareTitle } from '@/i18n';

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
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- deliberately lazy, see above
  return require('expo-sharing');
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
  async share(uri) {
    const Sharing = loadSharing();
    if (!(await Sharing.isAvailableAsync())) throw new Error('sharing_unavailable');
    await Sharing.shareAsync(uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: backupShareTitle() });
  },
};

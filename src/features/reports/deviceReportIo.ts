// The real device behind the Reports CSV exports: a file in the app's cache folder and the
// system share sheet (expo-file-system, expo-sharing). Earlier CSV exports are cleared from
// the cache first, so at most one copy of each kind lingers there; the newest stays until the
// app that received it may still be reading it as the share sheet closes.
import { File, Paths } from 'expo-file-system';
import { requireOptionalNativeModule } from 'expo';

import { reportsCsvShareTitle } from '@/i18n';

import type { ReportIo } from './createReportCsv';

const REPORT_FILE = /^mono-(transactions|balances)-.*\.csv$/;

function clearOldExports(): void {
  try {
    for (const entry of Paths.cache.list()) {
      if (entry instanceof File && REPORT_FILE.test(entry.name)) entry.delete();
    }
  } catch {
    // A leftover file is not worth failing an export over.
  }
}

// expo-sharing is loaded only when a CSV is shared. It looks for its native module the
// moment it is imported and throws if the build has none; loaded here, the failure is just
// an export that could not be shared, and the caller reports it.
function loadSharing(): typeof import('expo-sharing') {
  if (!requireOptionalNativeModule('ExpoSharing')) throw new Error('sharing_unavailable');
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- deliberately lazy, see above
  return require('expo-sharing');
}

export const deviceReportIo: ReportIo = {
  async write(fileName, content) {
    clearOldExports();
    const file = new File(Paths.cache, fileName);
    if (file.exists) file.delete();
    file.create();
    await file.write(content);
    return { uri: file.uri };
  },
  async share(uri) {
    const Sharing = loadSharing();
    if (!(await Sharing.isAvailableAsync())) throw new Error('sharing_unavailable');
    await Sharing.shareAsync(uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle: reportsCsvShareTitle() });
  },
};

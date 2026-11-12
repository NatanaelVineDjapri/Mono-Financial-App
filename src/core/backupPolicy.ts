// The one number behind "your backup is getting old". The backup status strip on More and the
// backup reminder (Settings, Data, "Backup reminder", still to be built) must both import it from
// here, so the strip and the reminder can never disagree about when a backup counts as stale.
export const BACKUP_STALE_AFTER_DAYS = 7;

// A backup made `daysSinceBackup` calendar days ago is stale from the seventh day on.
export function isBackupStale(daysSinceBackup: number): boolean {
  return daysSinceBackup >= BACKUP_STALE_AFTER_DAYS;
}

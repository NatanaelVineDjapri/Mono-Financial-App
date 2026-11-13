// Migration 5 -> 6: "Perbarui otomatis" (settings.fx_auto_update) is now on from the start.
// The default lives in the seeded settings row, so a database created by an older build still
// carries its '0'. Flip it once here; after this build every write to the switch goes through
// setFxAutoUpdate, so a later '0' is a real choice and is never touched again.
import type { Db } from '../types';

export async function turnOnFxAutoUpdate(db: Db): Promise<void> {
  await db.runAsync("update settings set value = '1' where key = 'fx_auto_update' and value = '0'");
}

// Which greeting Overview shows. The app counts itself once per launch (not once per visit to the
// screen) in `settings.greeting_day` / `settings.greeting_opens`; the count starts again each
// day. Until it is read the hook returns null, so the greeting is never drawn twice in two
// wordings.
import { useEffect, useState } from 'react';

import { now, today } from '@/core/clock';
import { useDb } from '@/data/db/DbProvider';
import { getSetting, setSetting } from '@/data/repo/settings';
import type { Db } from '@/data/db/types';
import type { GreetingKind } from '@/i18n';

import { countOpen, greetingKind, hourWib, kindForHour } from './greeting';

export const GREETING_DAY_SETTING = 'greeting_day';
export const GREETING_OPENS_SETTING = 'greeting_opens';

// One count per app launch: the first screen to ask does it, the rest reuse the answer.
let launch: Promise<number> | null = null;

export function resetLaunchCountForTests(): void {
  launch = null;
}

async function registerOpen(db: Db): Promise<number> {
  const [day, count] = await Promise.all([getSetting(db, GREETING_DAY_SETTING), getSetting(db, GREETING_OPENS_SETTING)]);
  const next = countOpen({ day, count: Number(count) || 0 }, today());
  await setSetting(db, GREETING_DAY_SETTING, next.day);
  await setSetting(db, GREETING_OPENS_SETTING, String(next.count));
  return next.count;
}

export function useGreeting(): GreetingKind | null {
  const db = useDb();
  const [kind, setKind] = useState<GreetingKind | null>(null);

  useEffect(() => {
    let cancelled = false;
    const hour = hourWib(now().getTime());
    launch ??= registerOpen(db);
    launch
      .then(count => {
        if (!cancelled) setKind(greetingKind(hour, count));
      })
      .catch(() => {
        // The count could not be read or written: greet by the time of day, as on a first open.
        if (!cancelled) setKind(kindForHour(hour));
      });
    return () => {
      cancelled = true;
    };
  }, [db]);

  return kind;
}

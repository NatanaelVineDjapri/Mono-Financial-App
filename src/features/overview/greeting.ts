// The greeting on Overview (the screen's one serif line). It follows the time of day in WIB:
// "Good morning" from 5 to 11, "Good afternoon" 12 to 17, "Good evening" from 18 to 4. When the app
// has been opened several times on the same day, it stops greeting and asks instead:
// "How are you, Nael?". Pure: the hour and the number of opens go in, a kind comes out; the
// words are in src/i18n (welcomeGreeting).
import type { GreetingKind } from '@/i18n';

// The third time the app is opened in one day, the greeting becomes the check-in.
export const CHECKIN_FROM_OPEN = 3;

const WIB_OFFSET_MS = 7 * 3600000;

export function hourWib(nowMs: number): number {
  return new Date(nowMs + WIB_OFFSET_MS).getUTCHours();
}

export function kindForHour(hour: number): Exclude<GreetingKind, 'checkin'> {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 15) return 'afternoon';
  if (hour >= 15 && hour < 18) return 'late_afternoon';
  return 'evening';
}

export function greetingKind(hour: number, opensToday: number): GreetingKind {
  return opensToday >= CHECKIN_FROM_OPEN ? 'checkin' : kindForHour(hour);
}

export interface OpenCount {
  day: string | null; // 'YYYY-MM-DD' of the last count
  count: number;
}

// One more open: the count goes up on the same day and starts again at 1 on a new day.
export function countOpen(previous: OpenCount, today: string): { day: string; count: number } {
  return previous.day === today ? { day: today, count: previous.count + 1 } : { day: today, count: 1 };
}

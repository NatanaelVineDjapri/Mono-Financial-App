// Reports reads: the selected period + range through getReport, and the month-start
// setting the period stepper needs. Invalidated with everything else after a write.
import { useQuery } from '@tanstack/react-query';

import { today } from '@/core/clock';
import { periodOfDate } from '@/core/date';
import { useDb } from '@/data/db/DbProvider';
import { queryKeys } from '@/data/queryKeys';
import { getReport, type ReportRange } from '@/domain/reports';
import { getMonthStartDay } from '@/domain/transactionsList';

export function useMonthStartDay(): number {
  const db = useDb();
  const query = useQuery({
    queryKey: [...queryKeys.settings, 'month-start-day'],
    queryFn: () => getMonthStartDay(db),
    staleTime: Infinity,
  });
  return query.data ?? 1;
}

export function useReport(period: string, range: ReportRange) {
  const db = useDb();
  return useQuery({
    queryKey: [...queryKeys.reports, period, range],
    queryFn: () => getReport(db, { period, range, todayIso: today() }),
  });
}

export function useCurrentPeriod(startDay: number): string {
  return periodOfDate(today(), startDay);
}

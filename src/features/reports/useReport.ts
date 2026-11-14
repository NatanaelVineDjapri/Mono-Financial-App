// Reports reads: the selected period + range through getReport, and the month-start
// setting the period stepper needs. Invalidated with everything else after a write.
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { today } from '@/core/clock';
import { periodOfDate } from '@/core/date';
import { useDb } from '@/data/db/DbProvider';
import { queryKeys } from '@/data/queryKeys';
import { getReport, REPORT_RANGE_MONTHS, type ReportRange } from '@/domain/reports';
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

const ALL_RANGES = Object.keys(REPORT_RANGE_MONTHS) as ReportRange[];

// Switching the range or the month must not blank the screen: the report that was showing stays up until
// the new one is ready (placeholderData), and once a report has loaded the other ranges of the same
// month are read in the background, so a tap on 3 months or 6 months finds its numbers already cached.
// Every read is a local query; a write invalidates them all (invalidateAfterWrite) and they refill.
export function useReport(period: string, range: ReportRange) {
  const db = useDb();
  const queryClient = useQueryClient();
  const keyOf = (r: ReportRange) => [...queryKeys.reports, period, r] as const;
  const read = (r: ReportRange) => getReport(db, { period, range: r, todayIso: today() });

  const query = useQuery({
    queryKey: keyOf(range),
    queryFn: () => read(range),
    placeholderData: keepPreviousData,
  });

  const loaded = query.isSuccess && !query.isPlaceholderData;
  useEffect(() => {
    if (!loaded) return;
    for (const other of ALL_RANGES) {
      if (other !== range) void queryClient.prefetchQuery({ queryKey: keyOf(other), queryFn: () => read(other) });
    }
    // keyOf and read only close over period, db and today(); the effect reruns when those change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, period, range, db, queryClient]);

  return query;
}

export function useCurrentPeriod(startDay: number): string {
  return periodOfDate(today(), startDay);
}

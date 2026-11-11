// The AI screens follow the "Block screenshots" setting (FLAG_SECURE through expo-screen-capture):
// the key and the conversation are the most private things the app shows. The setting defaults
// to on. Any failure of the native module leaves the screen as it is; it never blocks the UI.
import { useQuery } from '@tanstack/react-query';
import { allowScreenCaptureAsync, preventScreenCaptureAsync } from 'expo-screen-capture';
import { useEffect } from 'react';

import { useDb } from '@/data/db/DbProvider';
import { queryKeys } from '@/data/queryKeys';
import { getSetting } from '@/data/repo/settings';

export function useBlockScreenshots(tag: string): void {
  const db = useDb();
  const { data: setting } = useQuery({ queryKey: [...queryKeys.settings, 'block-screenshots'], queryFn: () => getSetting(db, 'block_screenshots'), staleTime: 0 });
  const block = setting !== '0'; // on unless the person turned it off

  useEffect(() => {
    if (!block) return undefined;
    preventScreenCaptureAsync(tag).catch(() => {});
    return () => {
      allowScreenCaptureAsync(tag).catch(() => {});
    };
  }, [block, tag]);
}

// What the entry points of the card scan need to know: whether this phone has NFC at all (the buttons are hidden when
// it does not, unless the pretend reader of a development build is on), and which card an account is linked to.
import { useQuery } from '@tanstack/react-query';

import { useDb } from '@/data/db/DbProvider';
import { getCardLinkByAccount } from '@/data/repo/cardLinks';

import { isNfcAvailable } from './cardReaderProvider';
import { useMockCardStore } from './mock/mockCardReader';

export function useNfcAvailable(): boolean {
  const db = useDb();
  const mock = useMockCardStore(s => s.enabled);
  const { data } = useQuery({
    queryKey: ['nfc', 'available', mock],
    queryFn: () => isNfcAvailable(db),
    staleTime: Infinity,
  });
  return data === true;
}

export function useAccountCardLink(accountId: number | undefined) {
  const db = useDb();
  return useQuery({
    queryKey: ['nfc', 'link', accountId],
    enabled: accountId != null,
    queryFn: () => getCardLinkByAccount(db, accountId as number),
  });
}

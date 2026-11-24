// /nfc/new: a card that no account has yet. Make an e-money account from it, or link it to an e-wallet account that
// already exists (and go on to compare the balances). Only the last 4 digits and a fingerprint of the number are kept.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { nowIso } from '@/core/clock';
import { useDb } from '@/data/db/DbProvider';
import { invalidateAfterWrite } from '@/data/queryKeys';
import { listLinkableAccounts } from '@/data/repo/cardLinks';
import { createAccountFromCard, linkCardToAccount } from '@/domain/cards/links';
import { DEFAULT_ACCOUNT_NAME } from '@/domain/cards/types';
import { NewCardView } from '@/features/nfc/NewCardView';
import { useScanSession } from '@/features/nfc/scanSession';
import { nfcLinkFailure } from '@/i18n';

export default function NfcNewRoute() {
  const router = useRouter();
  const db = useDb();
  const queryClient = useQueryClient();
  const card = useScanSession(s => s.card);
  const clear = useScanSession(s => s.clear);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const leaving = useRef(false); // set when this screen is being left on purpose, so the "no card" check below stays quiet

  const { data: linkable = [] } = useQuery({ queryKey: ['nfc', 'linkable'], queryFn: () => listLinkableAccounts(db) });

  useEffect(() => {
    if (!card && !leaving.current) router.back();
  }, [card, router]);
  if (!card) return null;

  const close = () => {
    leaving.current = true;
    clear();
    router.back();
  };

  const onCreate = async (name: string, openingBalance: number) => {
    setBusy(true);
    setError(null);
    const result = await createAccountFromCard(db, { card, name, openingBalance, now: nowIso() });
    setBusy(false);
    if (!result.ok) {
      setError(nfcLinkFailure(result.reason));
      return;
    }
    await invalidateAfterWrite(queryClient);
    leaving.current = true;
    clear();
    router.replace({ pathname: '/account/[id]', params: { id: String(result.value.accountId) } } as never);
  };

  const onLink = async (accountId: number) => {
    setBusy(true);
    setError(null);
    const result = await linkCardToAccount(db, { accountId, card, now: nowIso() });
    setBusy(false);
    if (!result.ok) {
      setError(nfcLinkFailure(result.reason));
      return;
    }
    await invalidateAfterWrite(queryClient);
    router.replace('/nfc/result' as never); // linked: on to the comparison of the balances
  };

  return (
    <NewCardView
      card={card}
      defaultName={DEFAULT_ACCOUNT_NAME(card.issuer)}
      linkable={linkable}
      busy={busy}
      error={error}
      onCreate={(name, balance) => void onCreate(name, balance)}
      onLink={id => void onLink(id)}
      onClose={close}
    />
  );
}

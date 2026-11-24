// /nfc/result: the card balance against the balance of the account it is linked to. Recording the difference goes
// through the same domain checks as a manual transaction (source 'nfc'); nothing is recorded until the button is tapped.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { nowIso } from '@/core/clock';

import { useDb } from '@/data/db/DbProvider';
import { invalidateAfterWrite } from '@/data/queryKeys';
import { previewAdjustment, recordAdjustment } from '@/domain/cards/adjustment';
import { findCardAccount } from '@/domain/cards/links';
import { ResultView } from '@/features/nfc/ResultView';
import { useScanSession } from '@/features/nfc/scanSession';
import { nfcBalanceChanged } from '@/i18n';

export default function NfcResultRoute() {
  const router = useRouter();
  const db = useDb();
  const queryClient = useQueryClient();
  const card = useScanSession(s => s.card);
  const clear = useScanSession(s => s.clear);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const leaving = useRef(false); // set when this screen is being left on purpose, so the "no card" check below stays quiet

  const { data, refetch } = useQuery({
    queryKey: ['nfc', 'result', card?.fingerprint, card?.balance],
    enabled: card != null,
    queryFn: async () => {
      const link = await findCardAccount(db, card!.fingerprint);
      if (!link) return null;
      const preview = await previewAdjustment(db, link.account_id, card!.balance);
      return preview ? { link, preview } : null;
    },
  });

  // Nothing to show without a card (the screen was reopened by itself): go back.
  useEffect(() => {
    if (!card && !leaving.current) router.back();
  }, [card, router]);
  if (!card || !data) return null;

  const close = () => {
    leaving.current = true;
    clear();
    router.back();
  };

  const onRecord = async () => {
    setBusy(true);
    setError(null);
    const result = await recordAdjustment(db, { accountId: data.link.account_id, cardBalance: card.balance, expectedDiff: data.preview.diff, now: nowIso() });
    setBusy(false);
    if (result.ok) {
      await invalidateAfterWrite(queryClient);
      leaving.current = true;
      clear();
      router.replace({ pathname: '/account/[id]', params: { id: String(data.link.account_id) } } as never);
    } else if (result.reason === 'balance_changed') {
      setError(nfcBalanceChanged());
      await refetch();
    } else if (result.reason === 'refused') {
      setError(result.message);
    } else {
      await refetch(); // the balances are the same now: the screen says so
    }
  };

  return (
    <ResultView
      card={card}
      accountName={data.link.account_name}
      preview={data.preview}
      busy={busy}
      error={error}
      onRecord={() => void onRecord()}
      onSkip={close}
      onClose={close}
    />
  );
}

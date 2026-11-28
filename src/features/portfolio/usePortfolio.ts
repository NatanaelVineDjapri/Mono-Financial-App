// Reads for the portfolio screens, and the price update: prices from Yahoo (features/portfolio/yahoo), then exchange
// rates for foreign stocks through the normal rate refresh. Never blocks the screen; a failure keeps what is stored.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { nowIso } from '@/core/clock';
import { useDb } from '@/data/db/DbProvider';
import { invalidateAfterWrite } from '@/data/queryKeys';
import { listAccountsForForm } from '@/data/repo/accounts';
import { refreshRates } from '@/domain/fx';
import { getLastQuoteFetch, getNetWorthMode, listPortfolios, listPositions, listSymbols, saveQuotes } from '@/domain/portfolio';

import { fetchQuotes, type StockError } from './yahoo';

const STALE_MS = 5 * 60 * 1000;

export function usePortfolios() {
  const db = useDb();
  return useQuery({
    queryKey: ['portfolio', 'list'],
    queryFn: async () => ({ portfolios: await listPortfolios(db), mode: await getNetWorthMode(db), fetchedAt: await getLastQuoteFetch(db) }),
    staleTime: 0,
  });
}

export function usePositions(portfolioId: number) {
  const db = useDb();
  return useQuery({ queryKey: ['portfolio', 'positions', portfolioId], queryFn: () => listPositions(db, portfolioId), staleTime: 0 });
}

// The rupiah accounts a portfolio's cash can be.
export function useCashAccounts() {
  const db = useDb();
  return useQuery({
    queryKey: ['portfolio', 'cash-accounts'],
    queryFn: async () => (await listAccountsForForm(db)).filter(a => a.type !== 'forex').map(a => ({ id: a.id, name: a.name, type: a.type, icon: a.icon, balance: a.balance, openingDate: a.opening_date })),
  });
}

// `auto`: update on opening when the prices are older than five minutes.
export function usePriceUpdate(auto: boolean) {
  const db = useDb();
  const queryClient = useQueryClient();
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<StockError | null>(null);
  const running = useRef(false);

  const update = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setUpdating(true);
    setError(null);
    try {
      const symbols = await listSymbols(db);
      if (symbols.length > 0) {
        const { quotes, failed } = await fetchQuotes(symbols);
        await saveQuotes(db, quotes, nowIso());
        // rates for foreign stocks (its own throttle; no foreign currency, nothing is asked)
        await refreshRates(db, nowIso());
        setError(failed);
        await invalidateAfterWrite(queryClient);
      }
    } catch {
      setError('invalid');
    } finally {
      running.current = false;
      setUpdating(false);
    }
  }, [db, queryClient]);

  useEffect(() => {
    if (!auto) return;
    void (async () => {
      const last = await getLastQuoteFetch(db);
      if (!last || Date.now() - new Date(last).getTime() > STALE_MS) await update();
    })().catch(() => undefined);
  }, [auto, db, update]);

  return { update, updating, error };
}

import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/api/client';

// Shared data-fetch/loading/error/pull-to-refresh state for screens backed
// by a single GET call. Re-fetches whenever `fetcher`'s identity changes —
// for fetchers that close over a changing value (e.g. a route param), wrap
// them in `useCallback(() => getX(id), [id])` at the call site so the
// dependency stays a statically-checkable literal array there.
export function useApi<T>(fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const result = await fetcher();
        setData(result);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Something went wrong.');
      } finally {
        if (isRefresh) setRefreshing(false);
        else setLoading(false);
      }
    },
    [fetcher]
  );

  useEffect(() => {
    // Fetching data on mount/when `fetcher` changes is the documented,
    // legitimate use of an Effect (unlike syncing derived state) — the
    // setState calls happen asynchronously after `await fetcher()`, not
    // synchronously within this effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return { data, loading, error, refreshing, refresh: () => load(true), reload: () => load(false), setData };
}

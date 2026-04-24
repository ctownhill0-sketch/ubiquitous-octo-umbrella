// LeadStack™ — Generic API hook with loading/error state
import { useState, useEffect, useCallback, useRef } from "react";

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  options?: { pollInterval?: number; fallback?: T }
): ApiState<T> {
  const [data, setData] = useState<T | null>(options?.fallback ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetch_ = useCallback(async () => {
    try {
      setError(null);
      const result = await fetcher();
      if (mountedRef.current) {
        setData(result);
        setLoading(false);
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : "Unknown error");
        setLoading(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    fetch_();
    return () => { mountedRef.current = false; };
  }, [fetch_]);

  useEffect(() => {
    if (!options?.pollInterval) return;
    const id = setInterval(fetch_, options.pollInterval);
    return () => clearInterval(id);
  }, [fetch_, options?.pollInterval]);

  return { data, loading, error, refetch: fetch_ };
}

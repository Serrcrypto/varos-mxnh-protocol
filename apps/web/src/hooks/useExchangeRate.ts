import { useCallback, useEffect, useState } from "react";
import { getFxRate, type FxRateData } from "../lib/api";

type UseExchangeRateResult = {
  data: FxRateData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const POLL_MS = 30_000;

export function useExchangeRate(enabled = true): UseExchangeRateResult {
  const [data, setData] = useState<FxRateData | null>(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const next = await getFxRate();
      setData(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar tipo de cambio");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const id = window.setInterval(() => {
      void refresh();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [enabled, refresh]);

  return { data, loading, error, refresh };
}

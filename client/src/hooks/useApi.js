import { useCallback, useState } from 'react';
import { addEntry } from '../lib/scanHistory';

export function useApi(endpoint, initialData = null) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = useCallback(
    async (target, extraParams = {}) => {
      if (!target) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ target, ...extraParams });
        const resp = await fetch(`/api/${endpoint}?${params.toString()}`);
        const body = await resp.json();
        if (!resp.ok) throw new Error(body.error || body.message || `HTTP ${resp.status}`);
        setData(body);
        addEntry({ module: endpoint, target, data: body });
        return body;
      } catch (err) {
        setError(err.message);
        setData(null);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [endpoint]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, run, reset };
}

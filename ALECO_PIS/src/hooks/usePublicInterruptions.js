import { useState, useEffect, useCallback, useRef } from 'react';
import { listInterruptions } from '../api/interruptionsApi.js';

const PUBLIC_LIMIT = 50;
/** Background refresh while tab visible (~100s) */
const POLL_MS = 100_000;

/**
 * Public power-advisory bulletin: load, refetch on tab focus, light polling.
 * @returns {{ interruptions: object[], loading: boolean, listUnavailable: boolean, refetch: () => Promise<void> }}
 */
export function usePublicInterruptions() {
  const [interruptions, setInterruptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listUnavailable, setListUnavailable] = useState(false);
  const initialDone = useRef(false);

  const load = useCallback(async ({ showSpinner = false } = {}) => {
    if (showSpinner || !initialDone.current) {
      setLoading(true);
    }
    setListUnavailable(false);
    try {
      const r = await listInterruptions({ limit: PUBLIC_LIMIT });
      if (r.success && !r.unavailable) {
        setListUnavailable(false);
        setInterruptions(r.data);
      } else {
        setListUnavailable(true);
        setInterruptions([]);
      }
    } catch {
      setListUnavailable(true);
      setInterruptions([]);
    } finally {
      initialDone.current = true;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load({ showSpinner: true });
  }, [load]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        load({ showSpinner: false });
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        load({ showSpinner: false });
      }
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const refetch = useCallback(() => load({ showSpinner: true }), [load]);

  return { interruptions, loading, listUnavailable, refetch };
}

import { useState, useEffect, useCallback, useRef } from 'react';
import { listInterruptions } from '../api/interruptionsApi.js';

const PUBLIC_LIMIT = 50;
/** Background refresh while tab visible */
const POLL_MS = 30_000;
/** Faster poll when upcoming items may flip status (dateTimeStart) */
const POLL_MS_FAST = 10_000;

/**
 * Public power-advisory bulletin: load, refetch on tab focus, light polling.
 * @returns {{ interruptions: object[], loading: boolean, listUnavailable: boolean, refetch: () => Promise<void> }}
 */
export function usePublicInterruptions() {
  const [interruptions, setInterruptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listUnavailable, setListUnavailable] = useState(false);
  const [nextScheduledAt, setNextScheduledAt] = useState(null);
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
        setNextScheduledAt(r.meta?.nextScheduledAt ?? null);
      } else {
        setListUnavailable(true);
        setInterruptions([]);
        setNextScheduledAt(null);
      }
    } catch {
      setListUnavailable(true);
      setInterruptions([]);
      setNextScheduledAt(null);
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
    const hasUpcoming = interruptions.some((i) => {
      const start = i?.dateTimeStart ? new Date(i.dateTimeStart).getTime() : 0;
      return start > 0 && start > Date.now();
    });
    const hasPendingVisibility = interruptions.some((i) => {
      const pv = i?.publicVisibleAt ? new Date(i.publicVisibleAt).getTime() : 0;
      return pv > 0 && pv > Date.now();
    });
    const intervalMs = hasUpcoming || hasPendingVisibility ? POLL_MS_FAST : POLL_MS;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        load({ showSpinner: false });
      }
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [load, interruptions]);

  // When the backend reports a future advisory, schedule a precise refetch ~1s after it goes live.
  useEffect(() => {
    if (!nextScheduledAt) return;
    const goLiveMs = new Date(nextScheduledAt).getTime();
    const delay = goLiveMs - Date.now() + 1_000;
    if (delay <= 0) {
      load({ showSpinner: false });
      return;
    }
    const id = window.setTimeout(() => {
      if (document.visibilityState === 'visible') load({ showSpinner: false });
    }, delay);
    return () => window.clearTimeout(id);
  }, [nextScheduledAt, load]);

  const refetch = useCallback(() => load({ showSpinner: true }), [load]);

  return { interruptions, loading, listUnavailable, refetch };
}

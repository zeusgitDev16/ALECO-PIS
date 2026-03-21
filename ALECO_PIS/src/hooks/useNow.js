import { useState, useEffect } from 'react';

const DEFAULT_INTERVAL_MS = 60_000;
const FAST_INTERVAL_MS = 5_000;

/**
 * Returns current time (ms) that updates on an interval.
 * Uses 5s interval when any upcoming items exist so status flips within seconds of go-live.
 * @param {object[]} [upcomingItems] - items with go-live (publicVisibleAt or dateTimeStart) in the future
 * @returns {number} Date.now()
 */
export function useNow(upcomingItems = []) {
  const [now, setNow] = useState(() => Date.now());

  const hasUpcoming = upcomingItems.length > 0;
  const intervalMs = hasUpcoming ? FAST_INTERVAL_MS : DEFAULT_INTERVAL_MS;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}

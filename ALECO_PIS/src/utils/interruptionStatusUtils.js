/**
 * Parse API datetime (ISO or YYYY-MM-DD HH:mm) to ms for comparison with Date.now().
 * @param {string|null|undefined} apiDateTime
 * @returns {number|null}
 */
function parseToMs(apiDateTime) {
  if (!apiDateTime || !String(apiDateTime).trim()) return null;
  const d = new Date(apiDateTime);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

/**
 * Countdown to go-live moment (publicVisibleAt or dateTimeStart). Returns null if not upcoming.
 * @param {object} item
 * @param {number} [nowMs]
 * @returns {{ hours: number, minutes: number }|null}
 */
export function getCountdownToStart(item, nowMs = Date.now()) {
  const goLiveMs = parseToMs(item?.publicVisibleAt) ?? parseToMs(item?.dateTimeStart);
  if (!goLiveMs || goLiveMs <= nowMs) return null;
  const diff = goLiveMs - nowMs;
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  return { hours, minutes };
}

/**
 * Public SPA base URL for server-side poster capture (Puppeteer).
 * Aligns with CORS / deployment docs: PUBLIC_APP_URL or FRONTEND_ORIGIN on the API host.
 */

export function getPublicAppBaseUrl() {
  const env = typeof globalThis.process !== 'undefined' ? globalThis.process.env : {};
  const base = (env.PUBLIC_APP_URL || env.FRONTEND_ORIGIN || '').trim();
  return base ? base.replace(/\/$/, '') : '';
}

/**
 * @param {number} id - interruption id
 * @param {'print'|'infographic'} [variant] - `print` = full ALECO layout for capture; `infographic` = feed-style block
 * @returns {string|null} Absolute URL to poster page, or null if env not set
 */
export function getPublicPosterPageUrl(id, variant = 'print') {
  const base = getPublicAppBaseUrl();
  if (!base) return null;
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (variant === 'infographic') {
    return `${base}/poster/interruption/${n}`;
  }
  return `${base}/print-interruption/${n}`;
}

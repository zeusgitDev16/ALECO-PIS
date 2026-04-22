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
 * @returns {string|null} Absolute URL to minimal poster page, or null if env not set
 */
export function getPublicPosterPageUrl(id) {
  const base = getPublicAppBaseUrl();
  if (!base) return null;
  return `${base}/poster/interruption/${id}`;
}

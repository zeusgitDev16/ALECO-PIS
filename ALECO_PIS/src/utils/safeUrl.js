/**
 * XSS hardening for URL attributes (href, src, window.open).
 * Blocks javascript:, data:, blob: (for remote/API-driven URLs), vbscript:, etc.
 */

/**
 * User-edited profile / external links: only http(s).
 * Naked domains get https:// prepended (e.g. linkedin.com/in/foo).
 * @param {string|null|undefined} raw
 * @returns {string|null}
 */
export function getSafeHttpUrl(raw) {
  if (raw == null || typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t) return null;
  try {
    const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
    const u = new URL(withScheme);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.href;
  } catch {
    return null;
  }
}

/**
 * Remote image / asset URLs (API, Cloudinary, Google avatars): only http(s).
 * Relative paths like /uploads/x resolve against the current page origin.
 * @param {string|null|undefined} raw
 * @returns {string|null}
 */
export function getSafeResourceUrl(raw) {
  if (raw == null || typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t) return null;
  try {
    const base =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://localhost';
    const u = new URL(t, base);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.href;
  } catch {
    return null;
  }
}

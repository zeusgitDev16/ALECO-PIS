/**
 * Central API base for fetch + axios.
 * - Local dev: uses VITE_API_URL from .env or http://localhost:5000
 * - Production (e.g. Vercel): set VITE_API_URL in hosting env to your public API URL
 * - Optional: VITE_API_URL_PRODUCTION if you keep VITE_API_URL for local-only files
 */
export function getApiBaseUrl() {
    const trim = (v) => (typeof v === 'string' ? v.trim().replace(/\/$/, '') : '');
    const primary = trim(import.meta.env.VITE_API_URL);
    if (primary) return primary;
    const fallback = trim(import.meta.env.VITE_API_URL_PRODUCTION);
    if (import.meta.env.PROD && fallback) return fallback;
    return 'http://localhost:5000';
}

/**
 * Central API base for fetch + axios.
 * - Local dev: uses VITE_API_URL from .env or http://localhost:5000
 * - Production build: VITE_API_URL or VITE_API_URL_PRODUCTION must be set at build time (throws if missing)
 */
export function getApiBaseUrl() {
    const trim = (v) => (typeof v === 'string' ? v.trim().replace(/\/$/, '') : '');
    const primary = trim(import.meta.env.VITE_API_URL);
    if (primary) return primary;
    const fallback = trim(import.meta.env.VITE_API_URL_PRODUCTION);
    if (import.meta.env.PROD) {
        if (fallback) return fallback;
        const msg =
            'ALECO PIS: Production build has no API base URL. Set VITE_API_URL or VITE_API_URL_PRODUCTION in the frontend build environment and rebuild.';
        console.error(msg);
        throw new Error(msg);
    }
    return 'http://localhost:5000';
}

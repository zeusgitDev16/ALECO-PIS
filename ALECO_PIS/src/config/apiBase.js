/**
 * Central API base for fetch + axios.
 * - Local dev: uses VITE_API_URL from .env or http://localhost:5000
 * - Production build: VITE_API_URL_PRODUCTION is checked first, then VITE_API_URL (throws if both missing)
 */
export function getApiBaseUrl() {
    const trim = (v) => (typeof v === 'string' ? v.trim().replace(/\/$/, '') : '');
    const productionUrl = trim(import.meta.env.VITE_API_URL_PRODUCTION);
    const devUrl = trim(import.meta.env.VITE_API_URL);
    if (import.meta.env.PROD) {
        if (productionUrl) return productionUrl;
        if (devUrl) return devUrl;
        const msg =
            'ALECO PIS: Production build has no API base URL. Set VITE_API_URL_PRODUCTION in the frontend build environment and rebuild.';
        console.error(msg);
        throw new Error(msg);
    }
    return devUrl || 'http://localhost:5000';
}

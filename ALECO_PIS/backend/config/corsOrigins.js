/**
 * CORS allowlist for Express (local dev + optional env).
 * Idempotent: same inputs → same Set of origins. Trailing slashes normalized.
 *
 * Production browser clients: set at least one of PUBLIC_APP_URL, FRONTEND_ORIGIN,
 * or CORS_ALLOWED_ORIGINS on the API host (no vendor-specific defaults in code).
 */

export function normalizeOrigin(origin) {
    if (!origin || typeof origin !== 'string') return '';
    return origin.trim().replace(/\/$/, '');
}

/**
 * @returns {string[]} deduped list of allowed browser origins
 */
export function buildAllowedCorsOrigins() {
    const defaults = [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:4173',
        'http://127.0.0.1:4173',
        'http://localhost:5000',
        'http://127.0.0.1:5000',
    ];

    const fromList = (process.env.CORS_ALLOWED_ORIGINS || '')
        .split(',')
        .map((s) => normalizeOrigin(s))
        .filter(Boolean);

    // Optional: primary public SPA URL (custom domain or second Vercel project)
    const primary = normalizeOrigin(
        process.env.PUBLIC_APP_URL || process.env.FRONTEND_ORIGIN || ''
    );
    const primaryList = primary ? [primary] : [];

    return [...new Set([...defaults.map(normalizeOrigin), ...fromList, ...primaryList])];
}

/** True if any production SPA origin was supplied via env (not only localhost defaults). */
export function hasExplicitPublicCorsEnv() {
    return Boolean(
        (process.env.PUBLIC_APP_URL || '').trim() ||
        (process.env.FRONTEND_ORIGIN || '').trim() ||
        (process.env.CORS_ALLOWED_ORIGINS || '').trim()
    );
}

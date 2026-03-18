/**
 * Centralized API base URL for fetch calls.
 * Uses VITE_API_URL from env, falls back to localhost:5000.
 */
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * @param {string} path - API path (e.g. '/api/tickets/submit')
 * @returns {string} Full URL
 */
export const apiUrl = (path) => {
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${API_BASE}${p}`;
};

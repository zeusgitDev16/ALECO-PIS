import { getApiBaseUrl } from '../config/apiBase.js';

const API_BASE = getApiBaseUrl();

/**
 * @param {string} path - API path (e.g. '/api/tickets/submit')
 * @returns {string} Full URL
 */
export const apiUrl = (path) => {
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${API_BASE}${p}`;
};

import { clearLocalStoragePreservingPreferences } from './clearLocalStoragePreservingPreferences.js';

/**
 * Authenticated fetch wrapper — drop-in replacement for window.fetch().
 *
 * Reads JWT (Bearer token) and legacy session headers (X-User-Email, X-Token-Version)
 * from localStorage and attaches them to every outgoing request, mirroring the Axios
 * request interceptor in axiosConfig.js.
 *
 * On 401 (AUTH_REQUIRED / AUTH_INVALID / AUTH_STALE) or 403 (AUTH_DISABLED) the session
 * is cleared and admin pages are redirected to the landing page — same as the Axios
 * response interceptor.
 *
 * Safe for public endpoints: the server's `isPublicApiRoute()` short-circuits before
 * inspecting headers, so attaching credentials to a public call is a harmless no-op.
 *
 * Usage:  import { authFetch } from '../utils/authFetch';
 *         const res = await authFetch(apiUrl('/api/tickets'), { method: 'GET' });
 */
export async function authFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});

  if (typeof localStorage !== 'undefined') {
    const accessToken = localStorage.getItem('accessToken');
    const email = localStorage.getItem('userEmail');
    const tokenVersion = localStorage.getItem('tokenVersion');

    if (accessToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }
    if (email && !headers.has('X-User-Email')) {
      headers.set('X-User-Email', email);
    }
    if (tokenVersion !== null && tokenVersion !== undefined && !headers.has('X-Token-Version')) {
      headers.set('X-Token-Version', String(tokenVersion));
    }
  }

  const res = await fetch(url, { ...options, headers });

  // Mirror axiosConfig.js response interceptor: clear session on auth failure
  if (res.status === 401 || res.status === 403) {
    try {
      const clone = res.clone();
      const json = await clone.json().catch(() => null);
      const code = json?.code;
      const shouldClear =
        (res.status === 401 && ['AUTH_REQUIRED', 'AUTH_INVALID', 'AUTH_STALE', 'AUTH_TOKEN_REQUIRED'].includes(code)) ||
        (res.status === 403 && code === 'AUTH_DISABLED');

      if (shouldClear) {
        clearLocalStoragePreservingPreferences();
        if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin-')) {
          window.location.assign('/');
          return res; // Prevent further processing during redirect
        }
      }
    } catch {
      // JSON parse failed — not our auth response, let caller handle it
    }
  }

  return res;
}

/**
 * Patches global fetch() so requests to the API origin include session headers when present.
 * Keeps public landing + auth flows working without manual header wiring on every call.
 */
import { getApiBaseUrl } from '../config/apiBase.js';
import { clearLocalStoragePreservingPreferences } from './clearLocalStoragePreservingPreferences.js';

const API_BASE = getApiBaseUrl();

const SESSION_FAIL = new Set(['AUTH_REQUIRED', 'AUTH_INVALID', 'AUTH_STALE', 'AUTH_DISABLED']);

function appendSessionHeaders(input, init) {
  const email = typeof localStorage !== 'undefined' ? localStorage.getItem('userEmail') : null;
  const tokenVersion = typeof localStorage !== 'undefined' ? localStorage.getItem('tokenVersion') : null;
  if (!email || tokenVersion === null || tokenVersion === undefined) {
    return [input, init];
  }

  let url = typeof input === 'string' ? input : input?.url;
  if (!url) return [input, init];
  try {
    const abs = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    if (!abs.href.startsWith(API_BASE)) {
      return [input, init];
    }
  } catch {
    return [input, init];
  }

  const nextInit = { ...(init || {}) };
  const h = new Headers(nextInit.headers || {});
  if (!h.has('X-User-Email')) h.set('X-User-Email', email);
  if (!h.has('X-Token-Version')) h.set('X-Token-Version', String(tokenVersion));
  nextInit.headers = h;
  return [input, nextInit];
}

export function installFetchSessionHeaders() {
  if (typeof window === 'undefined' || window.__alecoFetchSessionPatched) return;
  window.__alecoFetchSessionPatched = true;
  const orig = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const [nextInput, nextInit] = appendSessionHeaders(input, init);
    const res = await orig(nextInput, nextInit);
    if (
      (res.status === 401 || res.status === 403) &&
      typeof window !== 'undefined' &&
      window.location.pathname.startsWith('/admin-')
    ) {
      const data = await res
        .clone()
        .json()
        .catch(() => ({}));
      if (SESSION_FAIL.has(data.code)) {
        clearLocalStoragePreservingPreferences();
        window.location.assign('/');
      }
    }
    return res;
  };
}

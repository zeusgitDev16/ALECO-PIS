import { LOCALSTORAGE_PRESERVED_ON_LOGOUT } from './recentOpenedStorageKeys';

/**
 * Clears localStorage but restores non-secret UX preferences (recent-opened, theme, etc.).
 * Use instead of raw localStorage.clear() on logout / forced session invalidation.
 */
export function clearLocalStoragePreservingPreferences() {
  const backup = {};
  for (const key of LOCALSTORAGE_PRESERVED_ON_LOGOUT) {
    try {
      const v = localStorage.getItem(key);
      if (v !== null) backup[key] = v;
    } catch {
      /* ignore */
    }
  }
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
  for (const [k, v] of Object.entries(backup)) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  }
}

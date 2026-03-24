/**
 * Single source of truth for recent-opened localStorage keys.
 * Used by hooks + logout preservation so keys stay in sync.
 */
export const RECENT_OPENED_TICKETS_KEY = 'aleco_recent_opened_tickets';
export const RECENT_OPENED_TICKETS_TIME_RANGE_KEY = 'aleco_recent_opened_tickets_time_range';
export const RECENT_OPENED_TICKETS_COLLAPSED_KEY = 'aleco_recent_opened_collapsed';

export const RECENT_OPENED_ADVISORIES_KEY = 'aleco_recent_opened_advisories';
export const RECENT_OPENED_ADVISORIES_TIME_RANGE_KEY = 'aleco_recent_opened_advisories_time_range';
export const RECENT_OPENED_ADVISORIES_COLLAPSED_KEY = 'aleco_recent_opened_advisories_collapsed';

/** Non-auth UX keys restored after logout / session invalidation */
export const LOCALSTORAGE_PRESERVED_ON_LOGOUT = [
  'app-theme',
  RECENT_OPENED_TICKETS_KEY,
  RECENT_OPENED_TICKETS_TIME_RANGE_KEY,
  RECENT_OPENED_TICKETS_COLLAPSED_KEY,
  RECENT_OPENED_ADVISORIES_KEY,
  RECENT_OPENED_ADVISORIES_TIME_RANGE_KEY,
  RECENT_OPENED_ADVISORIES_COLLAPSED_KEY,
];

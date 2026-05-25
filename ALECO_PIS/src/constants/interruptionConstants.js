/**
 * Shared constants for power advisories (interruptions).
 * Keep in sync with backend/constants/interruptionConstants.js for RESOLVED_DISPLAY_HOURS.
 */

/** Resolved advisories stay on public bulletin for 1 week (168h) before hiding/archiving. */
export const RESOLVED_DISPLAY_HOURS = 168;

/** Milliseconds equivalent for client-side time calculations. */
export const RESOLVED_DISPLAY_MS = RESOLVED_DISPLAY_HOURS * 60 * 60 * 1000;

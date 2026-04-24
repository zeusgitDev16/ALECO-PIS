/**
 * Power advisory (aleco_interruptions) type + status values.
 * Keep in sync with DB ENUM and src/utils/interruptionLabels.js
 */

export const INTERRUPTION_TYPE_VALUES = ['Scheduled', 'Emergency', 'NgcScheduled'];

export const INTERRUPTION_STATUS_VALUES = ['Pending', 'Ongoing', 'Energized'];

/** @type {Set<string>} */
export const INTERRUPTION_TYPES = new Set(INTERRUPTION_TYPE_VALUES);

/** @type {Set<string>} */
export const INTERRUPTION_STATUSES = new Set(INTERRUPTION_STATUS_VALUES);

/** Types that use scheduled lifecycle (Pending → Ongoing → Energized) and optional bulletin scheduling. */
export const INTERRUPTION_SCHEDULED_LIKE_TYPES = new Set(['Scheduled', 'NgcScheduled']);

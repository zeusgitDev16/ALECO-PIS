/**
 * Power advisory display labels vs API/DB values.
 * DB status: Pending | Ongoing | Energized (legacy rows may still read Restored until migrated).
 * DB type: Scheduled | Emergency | NgcScheduled (legacy: Unscheduled → Emergency).
 */

/** Types that use scheduled lifecycle (Pending before start) and optional bulletin scheduling. */
export const INTERRUPTION_SCHEDULED_LIKE_TYPES = new Set(['Scheduled', 'NgcScheduled', 'CustomPoster']);

/** @param {string} type */
export function isScheduledLikeOutageType(type) {
  return INTERRUPTION_SCHEDULED_LIKE_TYPES.has(String(type || ''));
}

/** @param {string} type */
export function isCustomPosterType(type) {
  return String(type || '') === 'CustomPoster';
}

/** Immediate-publish outage (no staged bulletin by type). */
export function isEmergencyOutageType(type) {
  const t = String(type || '');
  return t === 'Emergency' || t === 'Unscheduled';
}

/** @param {string} status */
export function getStatusDisplayLabel(status) {
  const s = String(status || '');
  if (s === 'Pending') return 'Upcoming';
  if (s === 'Energized') return 'Energized';
  if (s === 'Restored') return 'Energized';
  if (s === 'Ongoing') return 'Ongoing';
  return s || '—';
}

/** @param {string|null|undefined} type */
export function getTypeDisplayLabel(type) {
  const t = String(type || '');
  const o = TYPE_FORM_OPTIONS.find((x) => x.value === t);
  if (o) return o.label;
  if (t === 'Unscheduled') return 'emergency';
  return t || '—';
}

/** Options for admin <select>: value is API enum, label is user-facing */
export const STATUS_FORM_OPTIONS = [
  { value: 'Pending', label: 'Upcoming' },
  { value: 'Ongoing', label: 'Ongoing' },
  { value: 'Energized', label: 'Energized' },
];

/** Lifecycle options when creating an advisory (no finalize status at create time) */
export const STATUS_FORM_OPTIONS_CREATE = STATUS_FORM_OPTIONS.filter((o) => o.value !== 'Energized');

export const TYPE_FORM_OPTIONS = [
  { value: 'Scheduled', label: 'scheduled' },
  { value: 'Emergency', label: 'emergency' },
  { value: 'NgcScheduled', label: 'NGCP scheduled' },
  { value: 'CustomPoster', label: 'power interruption (custom)' },
];

/** Optional structured cause tag (API / DB `causeCategory`); first value '' = none */
export const CAUSE_CATEGORY_FORM_OPTIONS = [
  { value: '', label: '(none)' },
  { value: 'Maintenance', label: 'Maintenance / planned work' },
  { value: 'Equipment', label: 'Equipment / fault' },
  { value: 'Vegetation', label: 'Vegetation / tree contact' },
  { value: 'Weather', label: 'Weather' },
  { value: 'ThirdParty', label: 'Third party / vehicle damage' },
  { value: 'Load', label: 'Load / system operations' },
  { value: 'Other', label: 'Other' },
];

/** @param {string|null|undefined} value */
export function getCauseCategoryLabel(value) {
  if (value == null || String(value).trim() === '') return '';
  const v = String(value);
  const o = CAUSE_CATEGORY_FORM_OPTIONS.find((x) => x.value === v);
  return o ? o.label : v;
}

/** Filter chip keys map to API status or 'all' */
export const FILTER_CHIPS = [
  { key: 'all', label: 'All', apiStatus: null },
  { key: 'pending', label: 'Upcoming', apiStatus: 'Pending' },
  { key: 'ongoing', label: 'Ongoing', apiStatus: 'Ongoing' },
  { key: 'energized', label: 'Energized', apiStatus: 'Energized' },
];

/** True when advisory is in the post-outage / re-energized lifecycle state (for display windows, etc.). */
export function isInterruptionEnergizedStatus(status) {
  const s = String(status || '');
  return s === 'Energized' || s === 'Restored';
}

/**
 * CSS class suffix for status chips (maps legacy Restored + Energized → energized).
 * @param {string|null|undefined} status
 */
export function interruptionStatusForCssClass(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'restored' || s === 'energized') return 'energized';
  return s;
}

/**
 * Power advisory display labels vs API/DB values.
 * DB status: Pending | Ongoing | Restored → user-facing: Upcoming | Ongoing | Resolved
 */

/** @param {string} status */
export function getStatusDisplayLabel(status) {
  const s = String(status || '');
  if (s === 'Pending') return 'Upcoming';
  if (s === 'Restored') return 'Resolved';
  if (s === 'Ongoing') return 'Ongoing';
  return s || '—';
}

/** Options for admin <select>: value is API enum, label is user-facing */
export const STATUS_FORM_OPTIONS = [
  { value: 'Pending', label: 'Upcoming' },
  { value: 'Ongoing', label: 'Ongoing' },
  { value: 'Restored', label: 'Resolved' },
];

/** Lifecycle options when creating an advisory (no resolve at create time) */
export const STATUS_FORM_OPTIONS_CREATE = STATUS_FORM_OPTIONS.filter((o) => o.value !== 'Restored');

export const TYPE_FORM_OPTIONS = [
  { value: 'Scheduled', label: 'Scheduled interruption' },
  { value: 'Unscheduled', label: 'Unscheduled outage' },
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
  { key: 'restored', label: 'Resolved', apiStatus: 'Restored' },
];

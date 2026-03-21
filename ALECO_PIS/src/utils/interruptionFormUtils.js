import { getStatusDisplayLabel } from './interruptionLabels.js';
import { isoToDatetimeLocalPhilippine } from './dateUtils.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

const PH_OFFSET_HOURS = 8;

/**
 * Convert ISO/UTC updatedAt from API to MySQL-compatible format for concurrency check.
 * Backend compares DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i') with this value.
 * @param {string|null|undefined} isoString - e.g. "2026-03-20T05:30:00.000Z"
 * @returns {string} e.g. "2026-03-20 13:30:00" (Philippine time)
 */
export function toMysqlFormatForConcurrency(isoString) {
  if (!isoString || !String(isoString).trim()) return '';
  try {
    return dayjs.utc(isoString).add(PH_OFFSET_HOURS, 'hour').format('YYYY-MM-DD HH:mm:ss');
  } catch {
    return '';
  }
}

/** @typedef {{ type: string, status: string, statusChangeRemark: string, affectedAreasText: string, feeder: string, cause: string, causeCategory: string, dateTimeStart: string, dateTimeEndEstimated: string, dateTimeRestored: string, schedulePublicLater: boolean, publicVisibleAt: string, body: string, controlNo: string, imageUrl: string }} InterruptionFormState */

export const emptyForm = {
  type: 'Unscheduled',
  status: 'Pending',
  statusChangeRemark: '',
  affectedAreasText: '',
  feeder: '',
  cause: '',
  causeCategory: '',
  dateTimeStart: '',
  dateTimeEndEstimated: '',
  dateTimeRestored: '',
  schedulePublicLater: false,
  publicVisibleAt: '',
  body: '',
  controlNo: '',
  imageUrl: '',
};

/** API DTO datetime → datetime-local input. Handles ISO (UTC) and legacy "YYYY-MM-DD HH:mm". */
export function displayToDatetimeLocal(s) {
  if (!s) return '';
  const str = String(s).trim();
  if (/Z$/i.test(str) || str.includes('T') && str.length > 16) {
    return isoToDatetimeLocalPhilippine(str);
  }
  return str.replace(' ', 'T').slice(0, 16);
}

/**
 * Parse datetime-local value (YYYY-MM-DDTHH:mm) to a local wall-clock Date, or null.
 * Avoids `new Date(isoString)` timezone quirks.
 * @param {string} [s]
 * @returns {Date | null}
 */
export function datetimeLocalStringToDate(s) {
  if (!s || typeof s !== 'string') return null;
  const t = s.trim();
  const [datePart, timePart = '00:00'] = t.split('T');
  if (!datePart) return null;
  const [ys, ms, ds] = datePart.split('-');
  const y = parseInt(ys, 10);
  const m = parseInt(ms, 10);
  const d = parseInt(ds, 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const [hs, mins = '0'] = timePart.split(':');
  const h = parseInt(hs, 10) || 0;
  const min = parseInt(mins, 10) || 0;
  const dt = new Date(y, m - 1, d, h, min, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

/**
 * @param {Date | null | undefined} d
 * @returns {string} datetime-local fragment or ''
 */
export function dateToDatetimeLocalString(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local → API string */
export function datetimeLocalToApi(s) {
  if (!s || !String(s).trim()) return null;
  return String(s).replace('T', ' ');
}

/**
 * Mirrors server {@link computeInitialStatus} for UI preview on create.
 * @param {string} type - Scheduled | Unscheduled
 * @param {string} dateTimeStartLocal - datetime-local value
 * @returns {{ apiStatus: 'Pending' | 'Ongoing', displayLabel: string }}
 */
export function computeInitialStatusPreview(type, dateTimeStartLocal) {
  const d = datetimeLocalStringToDate(dateTimeStartLocal);
  if (!d || Number.isNaN(d.getTime())) {
    return { apiStatus: 'Ongoing', displayLabel: getStatusDisplayLabel('Ongoing') };
  }
  if (type === 'Scheduled' && d.getTime() > Date.now()) {
    return { apiStatus: 'Pending', displayLabel: getStatusDisplayLabel('Pending') };
  }
  return { apiStatus: 'Ongoing', displayLabel: getStatusDisplayLabel('Ongoing') };
}

/**
 * @param {InterruptionFormState} form
 * @param {{ editingId: number|null, baselineUpdatedAt?: string|null, baselineStatus?: string }} opts
 * @returns {object} POST/PUT body for /api/interruptions
 */
export function buildInterruptionPayload(form, { editingId, baselineUpdatedAt, baselineStatus } = {}) {
  const affectedAreas = form.affectedAreasText
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

  const publicVisibleAt =
    form.type === 'Unscheduled'
      ? null
      : form.schedulePublicLater && form.publicVisibleAt && String(form.publicVisibleAt).trim()
        ? datetimeLocalToApi(form.publicVisibleAt)
        : null;

  const causeCategory =
    form.causeCategory && String(form.causeCategory).trim() ? String(form.causeCategory).trim() : null;

  /** @type {Record<string, unknown>} */
  const payload = {
    type: form.type,
    affectedAreas,
    feeder: form.feeder,
    cause: form.cause,
    dateTimeStart: datetimeLocalToApi(form.dateTimeStart),
    dateTimeEndEstimated: datetimeLocalToApi(form.dateTimeEndEstimated),
    publicVisibleAt,
    causeCategory,
    body: form.body && String(form.body).trim() ? String(form.body).trim() : null,
    controlNo: form.controlNo && String(form.controlNo).trim() ? String(form.controlNo).trim() : null,
    imageUrl: form.imageUrl && String(form.imageUrl).trim() ? String(form.imageUrl).trim() : null,
  };

  if (!editingId) {
    const { apiStatus } = computeInitialStatusPreview(form.type, form.dateTimeStart);
    payload.status = apiStatus;
    return payload;
  }

  payload.status = form.status;

  const statusIsChanging = baselineStatus != null && form.status !== baselineStatus;
  const isPendingToOngoing = baselineStatus === 'Pending' && form.status === 'Ongoing';
  if (statusIsChanging && !isPendingToOngoing && form.statusChangeRemark) {
    payload.statusChangeRemark = String(form.statusChangeRemark).trim();
  }

  if (form.status === 'Restored') {
    payload.dateTimeRestored = datetimeLocalToApi(form.dateTimeRestored);
  } else {
    payload.dateTimeRestored = null;
  }

  const base = baselineUpdatedAt != null ? String(baselineUpdatedAt).trim() : '';
  if (base) {
    const mysqlFormat = toMysqlFormatForConcurrency(base);
    payload.expectedUpdatedAt = mysqlFormat || base;
  }

  return payload;
}

/**
 * Validates form before submit. Returns array of error messages.
 * Requires: feeder (always), and either body OR cause.
 * When status changes (except Pending→Ongoing), requires statusChangeRemark.
 * @param {InterruptionFormState} form
 * @param {{ baselineStatus?: string }} [opts]
 * @returns {string[]}
 */
export function validateInterruptionForm(form, { baselineStatus } = {}) {
  const errors = [];
  const hasBody = form.body && String(form.body).trim();
  const hasCause = form.cause && String(form.cause).trim();
  const hasFeeder = form.feeder && String(form.feeder).trim();
  const hasDateTimeStart = form.dateTimeStart && String(form.dateTimeStart).trim();

  if (!hasFeeder) {
    errors.push('Feeder is required.');
  }
  if (!hasBody && !hasCause) {
    errors.push('Provide either a post body (content) or a cause/reason. At least one is required.');
  }

  const statusIsChanging = baselineStatus != null && form.status !== baselineStatus;
  const isPendingToOngoing = baselineStatus === 'Pending' && form.status === 'Ongoing';
  if (statusIsChanging && !isPendingToOngoing) {
    const remark = form.statusChangeRemark && String(form.statusChangeRemark).trim();
    if (!remark) {
      errors.push('A remark is required when changing status. Enter the reason in the "Reason for status change" field below the Lifecycle dropdown (not in the advisory body).');
    }
  }
  if (!hasDateTimeStart) {
    errors.push('Start date and time is required.');
  }
  if (form.schedulePublicLater && form.publicVisibleAt && String(form.publicVisibleAt).trim()) {
    const p = datetimeLocalStringToDate(form.publicVisibleAt);
    if (p && p.getTime() <= Date.now()) {
      errors.push('Goes live at must be a future date and time.');
    }
  }
  return errors;
}

/** @param {object} row - interruption DTO from API */
export function rowToFormState(row) {
  const hasSchedule = Boolean(row.publicVisibleAt && String(row.publicVisibleAt).trim());
  return {
    type: row.type,
    status: row.status,
    statusChangeRemark: '',
    affectedAreasText: (row.affectedAreas || []).join(', '),
    feeder: row.feeder || '',
    cause: row.cause || '',
    causeCategory: row.causeCategory ? String(row.causeCategory) : '',
    dateTimeStart: displayToDatetimeLocal(row.dateTimeStart),
    dateTimeEndEstimated: displayToDatetimeLocal(row.dateTimeEndEstimated),
    dateTimeRestored: displayToDatetimeLocal(row.dateTimeRestored),
    schedulePublicLater: hasSchedule,
    publicVisibleAt: hasSchedule ? displayToDatetimeLocal(row.publicVisibleAt) : '',
    body: row.body ? String(row.body) : '',
    controlNo: row.controlNo ? String(row.controlNo) : '',
    imageUrl: row.imageUrl ? String(row.imageUrl) : '',
  };
}

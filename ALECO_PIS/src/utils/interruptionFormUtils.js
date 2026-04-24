import {
  getStatusDisplayLabel,
  isEmergencyOutageType,
  isScheduledLikeOutageType,
} from './interruptionLabels.js';
import { isoToDatetimeLocalPhilippine, toMysqlFormatPhilippine } from './dateUtils.js';

/** Alias for backwards compatibility; delegates to dateUtils. */
export function toMysqlFormatForConcurrency(isoString) {
  return toMysqlFormatPhilippine(isoString);
}

/** @typedef {{ type: string, status: string, statusChangeRemark: string, affectedAreasText: string, affectedAreasGrouped: { heading: string, items: string[] }[], feeder: string, feederId: number | null, cause: string, causeCategory: string, dateTimeStart: string, dateTimeEndEstimated: string, dateTimeRestored: string, schedulePublicLater: boolean, publicVisibleAt: string, body: string, controlNo: string, imageUrl: string, posterImageUrl: string, scheduleAutoRestore: boolean, scheduledRestoreAt: string, scheduledRestoreRemark: string }} InterruptionFormState */

export const emptyForm = {
  type: 'Emergency',
  status: 'Pending',
  statusChangeRemark: '',
  affectedAreasText: '',
  affectedAreasGrouped: [],
  feeder: '',
  feederId: null,
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
  posterImageUrl: '',
  scheduleAutoRestore: false,
  scheduledRestoreAt: '',
  scheduledRestoreRemark: '',
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
 * Philippine civil wall time (API "YYYY-MM-DD HH:mm" or datetime-local) → ISO with +08:00 for poster/dateUtils.
 * @param {string|null|undefined} wall
 * @returns {string|null}
 */
export function wallClockApiToPosterIso(wall) {
  if (!wall || !String(wall).trim()) return null;
  const s = String(wall).trim().replace('T', ' ');
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return null;
  return `${m[1]}T${m[2]}:${m[3]}:00+08:00`;
}

/**
 * Mirrors server {@link computeInitialStatus} for UI preview on create.
 * @param {string} type - Scheduled | Emergency | NgcScheduled
 * @param {string} dateTimeStartLocal - datetime-local value
 * @returns {{ apiStatus: 'Pending' | 'Ongoing', displayLabel: string }}
 */
export function computeInitialStatusPreview(type, dateTimeStartLocal) {
  const d = datetimeLocalStringToDate(dateTimeStartLocal);
  if (!d || Number.isNaN(d.getTime())) {
    return { apiStatus: 'Ongoing', displayLabel: getStatusDisplayLabel('Ongoing') };
  }
  if (isScheduledLikeOutageType(type) && d.getTime() > Date.now()) {
    return { apiStatus: 'Pending', displayLabel: getStatusDisplayLabel('Pending') };
  }
  return { apiStatus: 'Ongoing', displayLabel: getStatusDisplayLabel('Ongoing') };
}

/**
 * @param {InterruptionFormState} form
 * @param {{ editingId: number|null, baselineUpdatedAt?: string|null }} opts
 * @returns {object} POST/PUT body for /api/interruptions
 */
export function buildInterruptionPayload(form, { editingId, baselineUpdatedAt } = {}) {
  const affectedAreas = form.affectedAreasText
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

  const publicVisibleAt =
    isEmergencyOutageType(form.type)
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
    feederId: form.feederId != null && String(form.feederId).trim() !== '' ? Number(form.feederId) : null,
    cause: form.cause,
    dateTimeStart: datetimeLocalToApi(form.dateTimeStart),
    dateTimeEndEstimated: datetimeLocalToApi(form.dateTimeEndEstimated),
    causeCategory,
    body: form.body && String(form.body).trim() ? String(form.body).trim() : null,
    controlNo: form.controlNo && String(form.controlNo).trim() ? String(form.controlNo).trim() : null,
    imageUrl: form.imageUrl && String(form.imageUrl).trim() ? String(form.imageUrl).trim() : null,
    affectedAreasGrouped: Array.isArray(form.affectedAreasGrouped) ? form.affectedAreasGrouped : [],
  };

  // Scheduled auto-restoration
  if (form.scheduleAutoRestore && form.scheduledRestoreAt && String(form.scheduledRestoreAt).trim()) {
    payload.scheduledRestoreAt = datetimeLocalToApi(form.scheduledRestoreAt);
    payload.scheduledRestoreRemark = form.scheduledRestoreRemark && String(form.scheduledRestoreRemark).trim()
      ? String(form.scheduledRestoreRemark).trim()
      : null;
  } else {
    payload.scheduledRestoreAt = null;
    payload.scheduledRestoreRemark = null;
  }

  if (!editingId) {
    payload.publicVisibleAt = publicVisibleAt;
    const { apiStatus } = computeInitialStatusPreview(form.type, form.dateTimeStart);
    payload.status = apiStatus;
    return payload;
  }

  // When editing, don't change status — status is managed via UpdateAdvisoryModal
  // Just pass through dateTimeRestored if it exists on the form (from previous save)
  if (form.dateTimeRestored && String(form.dateTimeRestored).trim()) {
    payload.dateTimeRestored = datetimeLocalToApi(form.dateTimeRestored);
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
 * Status changes are now handled in UpdateAdvisoryModal, not here.
 * @param {InterruptionFormState} form
 * @returns {string[]}
 */
export function validateInterruptionForm(form, { editingId = null } = {}) {
  const errors = [];
  const hasBody = form.body && String(form.body).trim();
  const hasCause = form.cause && String(form.cause).trim();
  const hasFeeder = form.feeder && String(form.feeder).trim();
  const hasFeederId =
    form.feederId != null &&
    String(form.feederId).trim() !== '' &&
    Number.isInteger(Number(form.feederId)) &&
    Number(form.feederId) > 0;
  const hasDateTimeStart = form.dateTimeStart && String(form.dateTimeStart).trim();

  if (!hasFeeder && !hasFeederId) {
    errors.push('Feeder is required.');
  }
  if (!hasBody && !hasCause) {
    errors.push('Provide either a post body (content) or a cause/reason. At least one is required.');
  }
  if (!hasDateTimeStart) {
    errors.push('Start date and time is required.');
  }
  if (isScheduledLikeOutageType(form.type)) {
    const cn = form.controlNo && String(form.controlNo).trim();
    if (!cn) {
      errors.push('Control # is required for scheduled advisories (poster reference).');
    }
  }
  // Public bulletin timing is create-only; ignore on edit to avoid stale/locked schedule blocking updates.
  if (!editingId && form.schedulePublicLater && form.publicVisibleAt && String(form.publicVisibleAt).trim()) {
    const p = datetimeLocalStringToDate(form.publicVisibleAt);
    if (p && p.getTime() <= Date.now()) {
      errors.push('Goes live at must be a future date and time.');
    }
  }
  if (form.scheduleAutoRestore) {
    const ertS = form.dateTimeEndEstimated && String(form.dateTimeEndEstimated).trim();
    if (!ertS) {
      errors.push('Estimated restoration (ERT) is required when scheduling automatic restoration.');
    } else {
      const ert = datetimeLocalStringToDate(form.dateTimeEndEstimated);
      if (!ert) {
        errors.push('Estimated restoration (ERT) must be a valid date and time.');
      }
    }
    if (!form.scheduledRestoreAt || !String(form.scheduledRestoreAt).trim()) {
      errors.push('Scheduled auto-restoration requires a date and time.');
    } else {
      const r = datetimeLocalStringToDate(form.scheduledRestoreAt);
      if (r && r.getTime() <= Date.now()) {
        errors.push('Scheduled restoration time must be in the future.');
      }
      if (r && ertS) {
        const ert = datetimeLocalStringToDate(form.dateTimeEndEstimated);
        if (ert && r.getTime() <= ert.getTime()) {
          errors.push(
            'Auto-restore must be after ERT (e.g. if ERT is 5:00 PM, choose 5:01 PM or later).',
          );
        }
      }
    }
    if (!form.scheduledRestoreRemark || !String(form.scheduledRestoreRemark).trim()) {
      errors.push('A remark is required for scheduled auto-restoration (it will be logged when auto-restored).');
    }
  }
  return errors;
}

/**
 * Map edit form state → DTO-shaped object for poster preview helpers (datetime as API wall-clock strings).
 * @param {InterruptionFormState} form
 * @returns {object}
 */
export function formStateToPosterPreviewDto(form) {
  const affectedAreas = String(form.affectedAreasText || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  const toApi = (local) => (local && String(local).trim() ? datetimeLocalToApi(local) : null);
  const toIso = (local) => wallClockApiToPosterIso(toApi(local));
  return {
    type: form.type,
    status: form.status,
    controlNo: form.controlNo && String(form.controlNo).trim() ? String(form.controlNo).trim() : null,
    cause: form.cause && String(form.cause).trim() ? String(form.cause).trim() : null,
    body: form.body && String(form.body).trim() ? String(form.body).trim() : null,
    causeCategory: form.causeCategory && String(form.causeCategory).trim() ? String(form.causeCategory).trim() : null,
    feeder: form.feeder || '',
    dateTimeStart: toIso(form.dateTimeStart),
    dateTimeEndEstimated: toIso(form.dateTimeEndEstimated),
    dateTimeRestored: toIso(form.dateTimeRestored),
    affectedAreas,
    affectedAreasGrouped: Array.isArray(form.affectedAreasGrouped) ? form.affectedAreasGrouped : [],
    posterImageUrl: form.posterImageUrl && String(form.posterImageUrl).trim() ? String(form.posterImageUrl).trim() : null,
  };
}

/** @param {object} row - interruption DTO from API */
export function rowToFormState(row) {
  const hasSchedule = Boolean(row.publicVisibleAt && String(row.publicVisibleAt).trim());
  return {
    type: row.type,
    status: row.status,
    statusChangeRemark: '',
    affectedAreasText: (row.affectedAreas || []).join(', '),
    affectedAreasGrouped: Array.isArray(row.affectedAreasGrouped) ? row.affectedAreasGrouped : [],
    feeder: row.feeder || '',
    feederId: row.feederId != null ? Number(row.feederId) : null,
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
    posterImageUrl: row.posterImageUrl ? String(row.posterImageUrl) : '',
    scheduleAutoRestore: Boolean(row.scheduledRestoreAt && String(row.scheduledRestoreAt).trim()),
    scheduledRestoreAt: displayToDatetimeLocal(row.scheduledRestoreAt),
    scheduledRestoreRemark: row.scheduledRestoreRemark ? String(row.scheduledRestoreRemark) : '',
  };
}

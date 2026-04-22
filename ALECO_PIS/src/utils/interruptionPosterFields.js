/**
 * Single source of truth mapping advisory DTO/form-shaped objects → poster slots.
 * Policy: docs/ADMIN_INTERRUPTIONS_POSTER_FIELD_GAP.md (REASON precedence, time range).
 */

import {
  getCauseCategoryLabel,
  isEmergencyOutageType,
} from './interruptionLabels.js';
import { formatToPhilippineTimeRangeShort } from './dateUtils.js';

const EM_DASH = '\u2014';

/**
 * @param {string|null|undefined} text
 * @returns {string}
 */
function firstParagraphOrFull(text) {
  const t = String(text || '').trim();
  if (!t) return '';
  const idx = t.search(/\n\s*\n/);
  if (idx === -1) {
    const lineBreak = t.indexOf('\n');
    return lineBreak === -1 ? t : t.slice(0, lineBreak).trim();
  }
  return t.slice(0, idx).trim();
}

/**
 * Poster headline (uppercase banner), aligned with public infographic.
 * @param {{ type?: string|null }} item
 * @returns {string}
 */
export function getPosterHeadlineText(item) {
  const type = item?.type || 'Emergency';
  if (type === 'Scheduled') return 'SCHEDULED POWER INTERRUPTION';
  if (type === 'NgcScheduled') return 'NGCP SCHEDULED POWER INTERRUPTION';
  if (isEmergencyOutageType(type)) return 'EMERGENCY POWER INTERRUPTION';
  return 'POWER INTERRUPTION';
}

/**
 * REASON line: non-empty `cause` first; else first paragraph of `body`; else cause category label; else em dash.
 * @param {{ cause?: string|null, body?: string|null, causeCategory?: string|null }} item
 * @returns {string}
 */
export function getPosterReasonText(item) {
  const cause = item?.cause != null ? String(item.cause).trim() : '';
  if (cause) return cause;
  const bodyBit = firstParagraphOrFull(item?.body);
  if (bodyBit) return bodyBit;
  const cat = getCauseCategoryLabel(item?.causeCategory);
  if (cat) return cat;
  return EM_DASH;
}

/**
 * Same as getPosterReasonText but for ALL CAPS display (feed pills).
 * @param {{ cause?: string|null, body?: string|null, causeCategory?: string|null }} item
 * @returns {string}
 */
export function getPosterReasonTextUpper(item) {
  return getPosterReasonText(item).toUpperCase();
}

/**
 * Time range for poster: both times → "h:mm A - h:mm A"; end missing → start time only.
 * @param {string|null|undefined} dateTimeStartIso
 * @param {string|null|undefined} dateTimeEndEstimatedIso
 * @returns {string}
 */
export function getPosterTimeRangeDisplay(dateTimeStartIso, dateTimeEndEstimatedIso) {
  if (!dateTimeStartIso || !String(dateTimeStartIso).trim()) return '';
  return (
    formatToPhilippineTimeRangeShort(dateTimeStartIso, dateTimeEndEstimatedIso) || ''
  );
}

/**
 * Reference / control number for poster header, e.g. (SIAPR2026-053).
 * @param {string|null|undefined} controlNo
 * @returns {string} Empty if no control number.
 */
export function getPosterReferenceDisplay(controlNo) {
  const raw = controlNo != null ? String(controlNo).trim() : '';
  if (!raw) return '';
  const inner = raw.startsWith('(') && raw.endsWith(')') ? raw.slice(1, -1).trim() : raw;
  if (!inner) return '';
  return `(${inner})`;
}

/**
 * Flat affected areas from DTO (fallback when grouped is absent).
 * @param {{ affectedAreas?: string[] }} item
 * @returns {string[]}
 */
export function getPosterAffectedAreasFlat(item) {
  const a = item?.affectedAreas;
  if (!Array.isArray(a)) return [];
  return a.map(String).map((s) => s.trim()).filter(Boolean);
}

/**
 * Grouped sections for poster: `{ heading, items[] }[]` when present on item.
 * @param {{ affectedAreasGrouped?: { heading?: string, items?: string[] }[] }} item
 * @returns {{ heading: string, items: string[] }[]}
 */
export function getPosterAffectedAreasGrouped(item) {
  const g = item?.affectedAreasGrouped;
  if (!Array.isArray(g)) return [];
  return g
    .map((block) => ({
      heading: block?.heading != null ? String(block.heading).trim() : '',
      items: Array.isArray(block?.items)
        ? block.items.map(String).map((s) => s.trim()).filter(Boolean)
        : [],
    }))
    .filter((b) => b.heading || b.items.length > 0);
}

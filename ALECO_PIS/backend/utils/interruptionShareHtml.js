/**
 * Escape text for safe insertion into HTML attribute or body.
 * @param {string|null|undefined} s
 * @returns {string}
 */
export function escapeHtmlAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r?\n/g, ' ');
}

/** @param {string|null|undefined} type */
export function shareHeadlineFromType(type) {
  const t = String(type || 'Emergency');
  if (t === 'Scheduled') return 'SCHEDULED POWER INTERRUPTION';
  if (t === 'NgcScheduled') return 'NGCP SCHEDULED POWER INTERRUPTION';
  if (t === 'Emergency' || t === 'Unscheduled') return 'EMERGENCY POWER INTERRUPTION';
  return 'POWER INTERRUPTION';
}

/**
 * Short description for og:description.
 * @param {{ feeder?: string|null, cause?: string|null, body?: string|null }} dto
 */
export function shareDescriptionFromDto(dto) {
  const parts = [];
  const feeder = dto?.feeder != null ? String(dto.feeder).trim() : '';
  if (feeder) parts.push(feeder);
  const cause = dto?.cause != null ? String(dto.cause).trim() : '';
  const body = dto?.body != null ? String(dto.body).trim() : '';
  const text = cause || (body ? body.split(/\n/)[0].trim() : '');
  if (text) parts.push(text.length > 220 ? `${text.slice(0, 217)}…` : text);
  const out = parts.join(' — ');
  return out || 'ALECO power advisory';
}

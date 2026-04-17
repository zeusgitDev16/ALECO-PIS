/**
 * Extended service memo fields stored in internal_notes as JSON until DB migration.
 * @see docs/SERVICE_MEMOS_FEATURE&FLOW.MD
 */

const EXT_VERSION = 1;

/**
 * @param {string|null|undefined} internalNotes
 * @returns {object}
 */
export function parseExtended(internalNotes) {
  if (!internalNotes || typeof internalNotes !== 'string') {
    return {};
  }
  const trimmed = internalNotes.trim();
  if (!trimmed.startsWith('{')) {
    return { legacy_plain_text: internalNotes };
  }
  try {
    const o = JSON.parse(trimmed);
    if (o && typeof o === 'object' && o.v === EXT_VERSION) {
      return o;
    }
    return { legacy_plain_text: internalNotes };
  } catch {
    return { legacy_plain_text: internalNotes };
  }
}

/**
 * @param {object} ext
 * @returns {string}
 */
export function stringifyExtended(ext) {
  const payload = {
    v: EXT_VERSION,
    intake_time: ext.intake_time ?? null,
    referral_received_date: ext.referral_received_date ?? null,
    referral_received_time: ext.referral_received_time ?? null,
    site_arrived_date: ext.site_arrived_date ?? null,
    site_arrived_time: ext.site_arrived_time ?? null,
    finished_date: ext.finished_date ?? null,
    finished_time: ext.finished_time ?? null,
  };
  if (ext.user_notes != null && String(ext.user_notes).trim() !== '') {
    payload.user_notes = String(ext.user_notes).trim();
  }
  return JSON.stringify(payload);
}

/**
 * Merge DB row + parsed extended into a flat object for API responses.
 * @param {object} row - aleco_service_memos row
 * @param {object} ticket - joined ticket row or null
 */
export function mergeMemoForResponse(row, ticket) {
  const ext = parseExtended(row.internal_notes);
  const legacyText = ext.legacy_plain_text;
  const isStructured = ext.v === EXT_VERSION;

  const sd = row.service_date ? String(row.service_date).slice(0, 10) : null;

  const out = {
    ...row,
    internal_notes:
      legacyText !== undefined
        ? legacyText
        : isStructured
          ? ext.user_notes ?? ''
          : row.internal_notes,
    intake_time: ext.intake_time ?? null,
    referral_received_date: ext.referral_received_date ?? null,
    referral_received_time: ext.referral_received_time ?? null,
    site_arrived_date: ext.site_arrived_date ?? null,
    site_arrived_time: ext.site_arrived_time ?? null,
    finished_date: ext.finished_date ?? null,
    finished_time: ext.finished_time ?? null,
    intake_date: row.service_date ?? null,
    action_taken: row.work_performed ?? null,
  };

  // Legacy rows without v1 JSON: supply placeholders so validation / UI can save once to migrate
  if (!isStructured && !legacyText) {
    out.intake_time = out.intake_time || '00:00';
    out.referral_received_date = out.referral_received_date || sd;
    out.referral_received_time = out.referral_received_time || '00:00';
    out.finished_date = out.finished_date || sd;
    out.finished_time = out.finished_time || '00:00';
  }

  if (ticket) {
    const parts = [ticket.first_name, ticket.middle_name, ticket.last_name].filter(Boolean);
    out.requested_by = parts.join(' ').replace(/\s+/g, ' ').trim();
    out.account_number = ticket.account_number ?? '';
    out.location = ticket.address ?? '';
    out.contact_no = ticket.phone_number ?? '';
    out.action_desired = ticket.action_desired ?? '';
  }

  return out;
}

/**
 * Validate required memo fields for create/update (optional: site arrived).
 * @param {object} body
 * @returns {{ ok: boolean, missing: string[] }}
 */
export function validateMemoPayload(body) {
  const required = [
    ['received_by', body.received_by],
    ['intake_date', body.intake_date ?? body.service_date],
    ['intake_time', body.intake_time],
    ['referred_to', body.referred_to],
    ['referral_received_date', body.referral_received_date],
    ['referral_received_time', body.referral_received_time],
    ['action_taken', body.action_taken ?? body.work_performed],
    ['finished_date', body.finished_date],
    ['finished_time', body.finished_time],
  ];

  const missing = [];
  for (const [key, val] of required) {
    if (val === undefined || val === null || String(val).trim() === '') {
      missing.push(key);
    }
  }

  // Optional: site_arrived_date / site_arrived_time — no validation

  return { ok: missing.length === 0, missing };
}

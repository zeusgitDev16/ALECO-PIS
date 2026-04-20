/**
 * Shared mapping for aleco_interruptions + aleco_interruption_updates rows.
 */

/** Parse DB text: JSON array or comma-separated */
export function parseAffectedAreas(text) {
  if (text == null || text === '') return [];
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(text)) {
    text = text.toString('utf8');
  }
  if (Array.isArray(text)) {
    return text.map(String).filter(Boolean);
  }
  if (typeof text !== 'string') return [];
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try {
      const j = JSON.parse(trimmed);
      if (Array.isArray(j)) return j.map(String).filter(Boolean);
    } catch {
      /* fall through */
    }
  }
  return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
}

/** Store as JSON array string for consistent reads */
export function serializeAffectedAreas(areas) {
  if (Array.isArray(areas)) {
    return JSON.stringify(areas.filter(Boolean).map(String));
  }
  if (typeof areas === 'string' && areas.trim()) {
    return serializeAffectedAreas(parseAffectedAreas(areas));
  }
  return JSON.stringify([]);
}

/** Format JS Date using local civil time (Asia/Manila when process.env.TZ is set). Never use toISOString() for advisory wall times. */
function formatLocalDateTimeForDto(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDisplayDateTime(val) {
  if (val == null || val === '') return null;
  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) return null;
    return formatLocalDateTimeForDto(val);
  }
  const s = String(val).replace('T', ' ');
  if (/^0000-00-00/.test(s)) return null;
  return s.length >= 16 ? s.slice(0, 16) : s;
}

/**
 * Client sends Philippines civil time (datetime-local → "YYYY-MM-DD HH:mm").
 * Store that exact wall clock in MySQL DATETIME — do NOT convert via UTC (toISOString).
 */
export function toMysqlDateTime(input) {
  if (input === undefined || input === null || input === '') return null;
  const raw = typeof input === 'string' ? input.trim() : String(input);
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    const sec = m[6] != null ? String(m[6]).padStart(2, '0').slice(0, 2) : '00';
    return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${sec}`;
  }
  const d = new Date(input);
  if (!Number.isNaN(d.getTime())) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
  }
  return null;
}

/** MySQL DATETIME string or Date → 'YYYY-MM-DD HH:mm:ss' for comparisons */
export function toMysqlDateTimeFromRow(val) {
  if (val == null || val === '') return null;
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${val.getFullYear()}-${pad(val.getMonth() + 1)}-${pad(val.getDate())} ${pad(val.getHours())}:${pad(val.getMinutes())}:${pad(val.getSeconds())}`;
  }
  const s = String(val).replace('T', ' ');
  if (/^0000-00-00/.test(s)) return null;
  return s.length >= 19 ? s.slice(0, 19) : s.length >= 16 ? `${s.slice(0, 10)} ${s.slice(11, 16)}:00` : null;
}

/**
 * Convert DB datetime to ISO UTC for client (client uses formatToPhilippineTime).
 * DB uses timezone '+08:00' and dateStrings:true, so we get "YYYY-MM-DD HH:mm:ss" in Philippine time.
 * Treat that explicitly as Asia/Manila to get correct UTC regardless of server TZ.
 */
export function toIsoForClient(val) {
  if (val == null || val === '') return null;
  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) return null;
    return val.toISOString();
  }
  const s = String(val).trim();
  if (!s) return null;
  // Already has Z or explicit offset - parse as-is
  if (/Z$/i.test(s) || /[+-]\d{2}:?\d{2}$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  // MySQL "YYYY-MM-DD HH:mm:ss" or "YYYY-MM-DDTHH:mm:ss" - treat as Philippine (+08:00)
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?/);
  if (m) {
    const isoWithOffset = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] || '00'}+08:00`;
    const d = new Date(isoWithOffset);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function mapRowToDto(row) {
  if (!row || row.id == null) return null;
  try {
    return {
      id: row.id,
      type: row.type,
      status: row.status,
      affectedAreas: parseAffectedAreas(row.affected_areas),
      feederId: row.feeder_id != null ? Number(row.feeder_id) : null,
      feeder: row.feeder ?? '',
      cause: row.cause ?? null,
      causeCategory: row.cause_category ? String(row.cause_category) : null,
      body: row.body != null ? String(row.body) : null,
      controlNo: row.control_no != null ? String(row.control_no) : null,
      imageUrl: row.image_url != null ? String(row.image_url) : null,
      dateTimeStart: toIsoForClient(row.date_time_start),
      dateTimeEndEstimated: row.date_time_end_estimated ? toIsoForClient(row.date_time_end_estimated) : null,
      dateTimeRestored: row.date_time_restored ? toIsoForClient(row.date_time_restored) : null,
      publicVisibleAt: row.public_visible_at ? toIsoForClient(row.public_visible_at) : null,
      scheduledRestoreAt: row.scheduled_restore_at ? toIsoForClient(row.scheduled_restore_at) : null,
      scheduledRestoreRemark: row.scheduled_restore_remark != null ? String(row.scheduled_restore_remark) : null,
      pulledFromFeedAt: row.pulled_from_feed_at != null ? toIsoForClient(row.pulled_from_feed_at) : null,
      createdAt: toIsoForClient(row.created_at),
      updatedAt: toIsoForClient(row.updated_at),
      deletedAt: toIsoForClient(row.deleted_at),
    };
  } catch (err) {
    console.error('Interruptions mapRowToDto error:', err, row?.id);
    return null;
  }
}

export function mapUpdateRowToDto(row) {
  if (!row || row.id == null) return null;
  return {
    id: row.id,
    interruptionId: row.interruption_id,
    remark: row.remark ?? '',
    kind: row.kind ?? 'user',
    actorEmail: row.actor_email ?? null,
    actorName: row.actor_name ?? null,
    createdAt: toIsoForClient(row.created_at),
  };
}

/**
 * Initial status for new advisories: Scheduled + future start → Pending; else Ongoing.
 * @param {string} type - Scheduled | Unscheduled
 * @param {string|null} startMysql - YYYY-MM-DD HH:mm:ss
 */
export function computeInitialStatus(type, startMysql) {
  if (!startMysql) return 'Ongoing';
  const m = String(startMysql).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return 'Ongoing';
  const startMs = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    m[6] != null ? Number(m[6]) : 0,
    0
  ).getTime();
  if (Number.isNaN(startMs)) return 'Ongoing';
  if (type === 'Scheduled' && startMs > Date.now()) return 'Pending';
  return 'Ongoing';
}

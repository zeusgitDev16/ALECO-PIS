export function normalizeExpectedUpdatedAt(raw) {
  const value = String(raw || '').trim();
  return value || null;
}

/**
 * Generic optimistic-locking WHERE builder.
 *
 * @param {import('mysql2/promise').Pool} pool
 * @param {object} opts
 * @param {string}   opts.table             - Table name (e.g. 'aleco_service_memos')
 * @param {string}   opts.idCol             - Primary-key column name (e.g. 'id', 'ticket_id')
 * @param {*}        opts.idValue           - Primary-key value
 * @param {string[]} opts.selectCols        - Extra columns to include in the returned `latest` snapshot
 * @param {string|null} opts.expectedUpdatedAt - ISO/MySQL timestamp the client last saw; null = skip check
 *
 * @returns {Promise<{
 *   whereSql: string,
 *   whereParams: any[],
 *   conflict: boolean,
 *   missing: boolean,
 *   latest: object|null
 * }>}
 */
export async function buildOptimisticWhere(pool, { table, idCol, idValue, selectCols = [], expectedUpdatedAt }) {
  const extraCols = selectCols.length ? `, ${selectCols.join(', ')}` : '';
  const [rows] = await pool.execute(
    `SELECT ${idCol}, updated_at${extraCols} FROM \`${table}\` WHERE ${idCol} = ? LIMIT 1`,
    [idValue]
  );
  const latest = rows[0] || null;

  if (!latest) {
    return {
      whereSql: `${idCol} = ?`,
      whereParams: [idValue],
      conflict: false,
      missing: true,
      latest: null,
    };
  }

  if (!expectedUpdatedAt) {
    return {
      whereSql: `${idCol} = ?`,
      whereParams: [idValue],
      conflict: false,
      missing: false,
      latest,
    };
  }

  const latestIso = latest.updated_at ? new Date(latest.updated_at).toISOString() : '';
  let expectedIso = '';
  try {
    expectedIso = new Date(expectedUpdatedAt).toISOString();
  } catch {
    return {
      whereSql: `${idCol} = ?`,
      whereParams: [idValue],
      conflict: true,
      missing: false,
      latest,
    };
  }

  if (!latestIso || latestIso !== expectedIso) {
    return {
      whereSql: `${idCol} = ?`,
      whereParams: [idValue],
      conflict: true,
      missing: false,
      latest,
    };
  }

  return {
    whereSql: `${idCol} = ? AND updated_at = ?`,
    whereParams: [idValue, latest.updated_at],
    conflict: false,
    missing: false,
    latest,
  };
}

/**
 * Ticket-specific wrapper around buildOptimisticWhere.
 * Preserved for backward compatibility with existing callers in tickets.js.
 */
export async function buildOptimisticTicketWhere(pool, ticketId, expectedUpdatedAt) {
  const result = await buildOptimisticWhere(pool, {
    table: 'aleco_tickets',
    idCol: 'ticket_id',
    idValue: ticketId,
    selectCols: ['status'],
    expectedUpdatedAt,
  });
  return {
    whereSql: result.whereSql,
    whereParams: result.whereParams,
    conflict: result.conflict,
    latest: result.latest
      ? {
          ticket_id: result.latest.ticket_id,
          status: result.latest.status,
          updated_at: result.latest.updated_at,
        }
      : null,
  };
}


export function normalizeExpectedUpdatedAt(raw) {
  const value = String(raw || '').trim();
  return value || null;
}

export async function buildOptimisticTicketWhere(pool, ticketId, expectedUpdatedAt) {
  if (!expectedUpdatedAt) {
    return {
      whereSql: 'ticket_id = ?',
      whereParams: [ticketId],
      conflict: false,
      latest: null,
    };
  }

  const [rows] = await pool.execute(
    'SELECT ticket_id, status, updated_at FROM aleco_tickets WHERE ticket_id = ? LIMIT 1',
    [ticketId]
  );
  const latest = rows[0] || null;
  if (!latest) {
    return {
      whereSql: 'ticket_id = ?',
      whereParams: [ticketId],
      conflict: false,
      latest: null,
    };
  }

  const latestUpdatedAt = latest.updated_at ? new Date(latest.updated_at).toISOString() : '';
  let expectedIso = '';
  try {
    expectedIso = new Date(expectedUpdatedAt).toISOString();
  } catch {
    return {
      whereSql: 'ticket_id = ?',
      whereParams: [ticketId],
      conflict: true,
      latest: {
        ticket_id: latest.ticket_id,
        status: latest.status,
        updated_at: latest.updated_at,
      },
    };
  }
  if (!latestUpdatedAt || latestUpdatedAt !== expectedIso) {
    return {
      whereSql: 'ticket_id = ?',
      whereParams: [ticketId],
      conflict: true,
      latest: {
        ticket_id: latest.ticket_id,
        status: latest.status,
        updated_at: latest.updated_at,
      },
    };
  }

  return {
    whereSql: 'ticket_id = ? AND updated_at = ?',
    whereParams: [ticketId, latest.updated_at],
    conflict: false,
    latest: {
      ticket_id: latest.ticket_id,
      status: latest.status,
      updated_at: latest.updated_at,
    },
  };
}


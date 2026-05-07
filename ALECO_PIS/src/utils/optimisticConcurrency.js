const CONFLICT_CODES = new Set([
  'CONFLICT_STALE_TICKET',
  'CONFLICT_STALE_INTERRUPTION',
  'CONFLICT_STALE_MEMO',
  'CONFLICT_STALE_CREW',
  'CONFLICT_STALE_LINEMAN',
]);

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeExpectedUpdatedAt(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

export function isOptimisticConflict(status, data) {
  if (status !== 409) return false;
  const code = String(data?.code || '').trim();
  return !code || CONFLICT_CODES.has(code);
}

export function withExpectedUpdatedAt(body, expectedUpdatedAt, fieldName = 'expected_updated_at') {
  const normalized = normalizeExpectedUpdatedAt(expectedUpdatedAt);
  if (!normalized) return body;
  if (!isPlainObject(body)) return body;
  return { ...body, [fieldName]: normalized };
}

export async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}


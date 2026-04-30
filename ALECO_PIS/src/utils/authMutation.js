import { authFetch } from './authFetch';
import { isOptimisticConflict, parseJsonSafe, withExpectedUpdatedAt } from './optimisticConcurrency';

/**
 * Shared mutation wrapper for authenticated API writes.
 * Unifies expected-updated-at attachment, JSON parsing, and conflict normalization.
 */
export async function authMutation(url, options = {}) {
  const {
    method = 'POST',
    headers = {},
    body = null,
    expectedUpdatedAt = null,
    expectedUpdatedAtField = null,
    emitRealtime = null,
  } = options;

  const normalizedHeaders = new Headers(headers || {});
  if (!normalizedHeaders.has('Content-Type') && body != null) {
    normalizedHeaders.set('Content-Type', 'application/json');
  }

  let nextBody = body;
  if (body != null && expectedUpdatedAtField) {
    nextBody = withExpectedUpdatedAt(body, expectedUpdatedAt, expectedUpdatedAtField);
  }

  const fetchBody = nextBody == null
    ? undefined
    : typeof nextBody === 'string'
      ? nextBody
      : JSON.stringify(nextBody);

  const response = await authFetch(url, {
    method,
    headers: normalizedHeaders,
    ...(fetchBody !== undefined ? { body: fetchBody } : {}),
  });

  const data = await parseJsonSafe(response);
  const conflict = isOptimisticConflict(response.status, data);

  if (response.ok && emitRealtime && typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('aleco:realtime-change', {
        detail: {
          module: emitRealtime.module || 'system',
          source: 'auth-mutation',
          ts: new Date().toISOString(),
        },
      })
    );
  }

  return {
    response,
    data,
    ok: response.ok,
    status: response.status,
    success: Boolean(response.ok && data?.success === true),
    conflict,
  };
}


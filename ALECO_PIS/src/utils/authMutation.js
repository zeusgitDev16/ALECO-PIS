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
    signal,
  } = options;

  const formDataBody = typeof FormData !== 'undefined' && body instanceof FormData;
  const normalizedHeaders = new Headers(headers || {});
  if (!normalizedHeaders.has('Content-Type') && body != null && !formDataBody) {
    normalizedHeaders.set('Content-Type', 'application/json');
  }

  let nextBody = body;
  if (body != null && expectedUpdatedAtField && !formDataBody) {
    nextBody = withExpectedUpdatedAt(body, expectedUpdatedAt, expectedUpdatedAtField);
  }

  const fetchBody = nextBody == null
    ? undefined
    : formDataBody
      ? nextBody
    : typeof nextBody === 'string'
      ? nextBody
      : JSON.stringify(nextBody);

  const response = await authFetch(url, {
    method,
    headers: normalizedHeaders,
    ...(fetchBody !== undefined ? { body: fetchBody } : {}),
    ...(signal ? { signal } : {}),
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


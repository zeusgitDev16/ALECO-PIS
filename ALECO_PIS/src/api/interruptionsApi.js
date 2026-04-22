/**
 * Power advisories — single client for GET/POST/PUT/DELETE /api/interruptions.
 * @see backend/routes/interruptions.js
 */
import { apiUrl } from '../utils/api';
import { authFetch } from '../utils/authFetch';

/**
 * @typedef {object} InterruptionsListResult
 * @property {boolean} ok - HTTP response ok
 * @property {boolean} success - API reported success with usable list (empty array is OK)
 * @property {object[]} data
 * @property {string|null} message
 * @property {boolean} unavailable - true when public should show "bulletin unavailable"
 */

/**
 * @param {{ limit?: number, includeFuture?: boolean, includeDeleted?: boolean, deletedOnly?: boolean }} opts
 * @returns {Promise<InterruptionsListResult>}
 */
export async function listInterruptions({
  limit = 100,
  includeFuture = false,
  includeDeleted = false,
  deletedOnly = false,
} = {}) {
  const cap = Math.min(Math.max(parseInt(String(limit), 10) || 100, 1), 200);
  const qs = new URLSearchParams({ limit: String(cap) });
  if (includeFuture) qs.set('includeFuture', '1');
  if (includeDeleted) qs.set('includeDeleted', '1');
  if (deletedOnly) qs.set('deletedOnly', '1');
  let res;
  try {
    res = await authFetch(apiUrl(`/api/interruptions?${qs.toString()}`));
  } catch {
    return {
      ok: false,
      success: false,
      data: [],
      message: null,
      unavailable: true,
    };
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    return {
      ok: false,
      success: false,
      data: [],
      message: typeof json?.message === 'string' ? json.message : null,
      unavailable: true,
    };
  }
  if (json && json.success === true) {
    return {
      ok: true,
      success: true,
      data: Array.isArray(json.data) ? json.data : [],
      message: null,
      unavailable: false,
    };
  }
  return {
    ok: true,
    success: false,
    data: [],
    message: typeof json?.message === 'string' ? json.message : null,
    unavailable: true,
  };
}

/**
 * Public advisory DTO (no auth). Same visibility as public bulletin list.
 * @param {number} id
 * @returns {Promise<{ ok: boolean, success: boolean, data: object|null, message: string|null }>}
 */
export async function getPublicInterruptionSnapshot(id) {
  const nid = parseInt(String(id), 10);
  if (!Number.isFinite(nid) || nid <= 0) {
    return { ok: false, success: false, data: null, message: 'Invalid id.' };
  }
  let res;
  try {
    res = await fetch(apiUrl(`/api/public/interruptions/${nid}`), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
  } catch {
    return { ok: false, success: false, data: null, message: 'Network error.' };
  }
  const json = await res.json().catch(() => null);
  const success = res.ok && json && json.success === true;
  return {
    ok: res.ok,
    success,
    data: success ? json.data ?? null : null,
    message: typeof json?.message === 'string' ? json.message : null,
  };
}

/**
 * @param {object} body - POST body (camelCase per backend)
 * @returns {Promise<{ ok: boolean, success: boolean, data: object|null, message: string|null }>}
 */
export async function createInterruption(body) {
  let res;
  try {
    res = await authFetch(apiUrl('/api/interruptions'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, status: 0, success: false, data: null, message: null };
  }
  const json = await res.json().catch(() => null);
  const success = res.ok && json && json.success === true;
  return {
    ok: res.ok,
    status: res.status,
    success,
    data: json?.data ?? null,
    message: typeof json?.message === 'string' ? json.message : null,
  };
}

/**
 * @param {number} id
 * @param {object} body
 */
export async function updateInterruption(id, body) {
  let res;
  try {
    res = await authFetch(apiUrl(`/api/interruptions/${id}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, status: 0, success: false, data: null, message: null };
  }
  const json = await res.json().catch(() => null);
  const success = res.ok && json && json.success === true;
  return {
    ok: res.ok,
    status: res.status,
    success,
    data: json?.data ?? null,
    message: typeof json?.message === 'string' ? json.message : null,
  };
}

/**
 * Pull advisory out of public feed (temporarily hide without archiving).
 * @param {number} id
 * @returns {Promise<{ ok: boolean, success: boolean, data: object|null, message: string|null }>}
 */
export async function pullFromFeed(id) {
  try {
    const res = await authFetch(apiUrl(`/api/interruptions/${id}/pull-from-feed`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const json = await res.json().catch(() => null);
    const success = res.ok && json && json.success === true;
    return {
      ok: res.ok,
      success,
      data: success ? json?.data ?? null : null,
      message: typeof json?.message === 'string' ? json.message : null,
    };
  } catch {
    return { ok: false, success: false, data: null, message: null };
  }
}

/**
 * Push advisory back into public feed.
 * @param {number} id
 * @returns {Promise<{ ok: boolean, success: boolean, data: object|null, message: string|null }>}
 */
export async function pushToFeed(id) {
  try {
    const res = await authFetch(apiUrl(`/api/interruptions/${id}/push-to-feed`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const json = await res.json().catch(() => null);
    const success = res.ok && json && json.success === true;
    return {
      ok: res.ok,
      success,
      data: success ? json?.data ?? null : null,
      message: typeof json?.message === 'string' ? json.message : null,
    };
  } catch {
    return { ok: false, success: false, data: null, message: null };
  }
}

/**
 * @param {number} id
 */
export async function deleteInterruption(id) {
  let res;
  try {
    res = await authFetch(apiUrl(`/api/interruptions/${id}`), { method: 'DELETE' });
  } catch {
    return { ok: false, success: false, message: null };
  }
  const json = await res.json().catch(() => null);
  const success = res.ok && json && json.success === true;
  return {
    ok: res.ok,
    success,
    message: typeof json?.message === 'string' ? json.message : null,
  };
}

/**
 * Permanently delete an archived advisory. Only works when advisory is archived (soft-deleted).
 * @param {number} id
 * @returns {Promise<{ ok: boolean, success: boolean, message: string|null }>}
 */
export async function permanentlyDeleteInterruption(id) {
  let res;
  try {
    res = await authFetch(apiUrl(`/api/interruptions/${id}/permanent`), { method: 'DELETE' });
  } catch {
    return { ok: false, success: false, message: null };
  }
  const json = await res.json().catch(() => null);
  const success = res.ok && json && json.success === true;
  return {
    ok: res.ok,
    success,
    message: typeof json?.message === 'string' ? json.message : null,
  };
}

/**
 * @param {number} id
 * @returns {Promise<{ ok: boolean, success: boolean, data: object|null, message: string|null }>}
 */
export async function restoreInterruption(id) {
  let res;
  try {
    res = await authFetch(apiUrl(`/api/interruptions/${id}/restore`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
  } catch {
    return { ok: false, success: false, data: null, message: null };
  }
  const json = await res.json().catch(() => null);
  const success = res.ok && json && json.success === true;
  return {
    ok: res.ok,
    success,
    data: json?.data ?? null,
    message: typeof json?.message === 'string' ? json.message : null,
  };
}

/**
 * @param {number} id
 * @returns {Promise<{ ok: boolean, success: boolean, data: object|null, message: string|null }>}
 */
export async function getInterruption(id) {
  let res;
  try {
    res = await authFetch(apiUrl(`/api/interruptions/${id}`));
  } catch {
    return { ok: false, success: false, data: null, message: null };
  }
  const json = await res.json().catch(() => null);
  const success = res.ok && json && json.success === true;
  return {
    ok: res.ok,
    success,
    data: json?.data ?? null,
    message: typeof json?.message === 'string' ? json.message : null,
  };
}

/**
 * Upload image for advisory. Returns imageUrl for form.
 * @param {File} file - Image file (field name: image)
 * @returns {Promise<{ ok: boolean, imageUrl: string|null, message: string|null }>}
 */
export async function uploadInterruptionImage(file) {
  const formData = new FormData();
  formData.append('image', file);
  let res;
  try {
    res = await authFetch(apiUrl('/api/interruptions/upload-image'), {
      method: 'POST',
      body: formData,
    });
  } catch {
    return { ok: false, imageUrl: null, message: 'Upload failed.' };
  }
  const json = await res.json().catch(() => null);
  const success = res.ok && json && json.success === true;
  return {
    ok: success,
    imageUrl: success ? json.imageUrl ?? null : null,
    message: typeof json?.message === 'string' ? json.message : null,
  };
}

/**
 * @param {number} id
 * @param {{ remark: string, actorEmail?: string, actorName?: string }} body
 */
export async function addInterruptionUpdate(id, body) {
  let res;
  try {
    res = await authFetch(apiUrl(`/api/interruptions/${id}/updates`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, success: false, data: null, message: null };
  }
  const json = await res.json().catch(() => null);
  const success = res.ok && json && json.success === true;
  return {
    ok: res.ok,
    success,
    data: json?.data ?? null,
    message: typeof json?.message === 'string' ? json.message : null,
  };
}

/**
 * Stub: set poster_image_url (Cloudinary placeholder when configured, else stub:// or INTERRUPTION_POSTER_STUB_BASE_URL).
 * @param {number} id
 * @returns {Promise<{ ok: boolean, success: boolean, data: object|null, message: string|null }>}
 */
export async function generateInterruptionPosterStub(id) {
  let res;
  try {
    res = await authFetch(apiUrl(`/api/interruptions/${id}/poster-stub`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
  } catch {
    return { ok: false, success: false, data: null, message: null };
  }
  const json = await res.json().catch(() => null);
  const success = res.ok && json && json.success === true;
  return {
    ok: res.ok,
    success,
    data: json?.data ?? null,
    message: typeof json?.message === 'string' ? json.message : null,
  };
}

/**
 * Puppeteer capture of /poster/interruption/:id on the deployed SPA; uploads to Cloudinary.
 * @param {number} id
 * @returns {Promise<{ ok: boolean, success: boolean, data: object|null, message: string|null }>}
 */
export async function captureInterruptionPoster(id) {
  let res;
  try {
    res = await authFetch(apiUrl(`/api/interruptions/${id}/poster-capture`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
  } catch {
    return { ok: false, success: false, data: null, message: null };
  }
  const json = await res.json().catch(() => null);
  const success = res.ok && json && json.success === true;
  return {
    ok: res.ok,
    success,
    data: json?.data ?? null,
    message: typeof json?.message === 'string' ? json.message : null,
  };
}

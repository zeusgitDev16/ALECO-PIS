/**
 * Service memos — client for GET/POST/PUT /api/service-memos.
 * @see backend/routes/service-memos.js
 */
import { apiUrl } from '../utils/api';
import axios from './axiosConfig';
import { authMutation } from '../utils/authMutation';
import { REALTIME_MODULES } from '../constants/realtimeModules';

/**
 * Load a ticket row for memo creation (admin list API).
 * @param {string} ticketId
 * @param {{ exactMatchOnly?: boolean }} [options] — if true, only succeed when DB returns that exact ticket_id (for debounced verify / Load).
 * @returns {Promise<{ ok: boolean, ticket: object|null, message: string|null }>}
 */
export async function fetchTicketPreviewForMemo(ticketId, options = {}) {
  const exactOnly = options.exactMatchOnly === true;
  const q = (ticketId || '').trim();
  if (!q) {
    return { ok: false, ticket: null, message: 'Enter a ticket ID.' };
  }
  try {
    const response = await axios.get('/api/filtered-tickets', {
      params: { searchQuery: q },
    });
    if (!response.data?.success || !Array.isArray(response.data.data)) {
      return { ok: false, ticket: null, message: 'Could not load tickets.' };
    }
    const rows = response.data.data;
    if (exactOnly) {
      const exact = rows.find((t) => t.ticket_id === q);
      if (!exact) {
        return { ok: false, ticket: null, message: 'No ticket found with that exact ID.' };
      }
      return { ok: true, ticket: exact, message: null };
    }
    const exact = rows.find((t) => t.ticket_id === q);
    const ticket = exact || rows[0] || null;
    if (!ticket) {
      return { ok: false, ticket: null, message: 'No ticket found for that search.' };
    }
    return { ok: true, ticket, message: null };
  } catch (e) {
    return { ok: false, ticket: null, message: e?.message || 'Network error.' };
  }
}

function authHeaders() {
  const accessToken =
    typeof localStorage !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const userEmail = typeof localStorage !== 'undefined' ? localStorage.getItem('userEmail') : null;
  const userName = typeof localStorage !== 'undefined' ? localStorage.getItem('userName') : null;
  const tokenVersion = typeof localStorage !== 'undefined' ? localStorage.getItem('tokenVersion') : null;
  const h = {
    'X-User-Email': userEmail || '',
    'X-User-Name': userName || '',
  };
  if (accessToken) h.Authorization = `Bearer ${accessToken}`;
  if (tokenVersion !== null && tokenVersion !== undefined) h['X-Token-Version'] = String(tokenVersion);
  return h;
}

/**
 * @param {{
 *   tab?: string,
 *   search?: string,
 *   searchMemo?: string,
 *   searchTicket?: string,
 *   searchAccount?: string,
 *   searchCustomer?: string,
 *   searchAddress?: string,
 *   status?: string,
 *   startDate?: string,
 *   endDate?: string,
 *   owner?: string
 * }} opts
 * @returns {Promise<{ ok: boolean, success: boolean, data: object[], message: string|null }>}
 */
export async function listServiceMemos({
  tab = 'all',
  search = '',
  searchMemo = '',
  searchTicket = '',
  searchAccount = '',
  searchCustomer = '',
  searchAddress = '',
  status = '',
  municipality = '',
  startDate = '',
  endDate = '',
  owner = '',
} = {}) {
  const qs = new URLSearchParams();
  if (tab) qs.set('tab', tab);
  if (search) qs.set('search', search);
  if (searchMemo) qs.set('searchMemo', searchMemo);
  if (searchTicket) qs.set('searchTicket', searchTicket);
  if (searchAccount) qs.set('searchAccount', searchAccount);
  if (searchCustomer) qs.set('searchCustomer', searchCustomer);
  if (searchAddress) qs.set('searchAddress', searchAddress);
  if (status) qs.set('status', status);
  if (municipality) qs.set('municipality', municipality);
  if (startDate) qs.set('startDate', startDate);
  if (endDate) qs.set('endDate', endDate);
  if (owner) qs.set('owner', owner);

  let res;
  try {
    res = await fetch(apiUrl(`/api/service-memos?${qs.toString()}`), {
      headers: { ...authHeaders() },
    });
  } catch {
    return {
      ok: false,
      success: false,
      data: [],
      message: 'Network error. Please check your connection.',
    };
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    return {
      ok: false,
      success: false,
      data: [],
      message: typeof json?.message === 'string' ? json.message : 'Failed to fetch service memos.',
    };
  }
  if (json && json.success === true) {
    return {
      ok: true,
      success: true,
      data: Array.isArray(json.data) ? json.data : [],
      message: null,
    };
  }
  return {
    ok: true,
    success: false,
    data: [],
    message: typeof json?.message === 'string' ? json.message : 'Failed to fetch service memos.',
  };
}

/**
 * @param {number|string} id
 * @returns {Promise<{ ok: boolean, success: boolean, data: object|null, message: string|null }>}
 */
export async function getServiceMemo(id) {
  let res;
  try {
    res = await fetch(apiUrl(`/api/service-memos/${id}`), {
      headers: { ...authHeaders() },
    });
  } catch {
    return { ok: false, success: false, data: null, message: 'Network error.' };
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    return {
      ok: false,
      success: false,
      data: null,
      message: typeof json?.message === 'string' ? json.message : 'Failed to load service memo.',
    };
  }
  if (json && json.success === true && json.data) {
    return { ok: true, success: true, data: json.data, message: null };
  }
  return { ok: true, success: false, data: null, message: 'Invalid response.' };
}

/**
 * @param {object} body - POST body
 * @returns {Promise<{ ok: boolean, success: boolean, data: object|null, message: string|null }>}
 */
export async function createServiceMemo(body) {
  try {
    const result = await authMutation(apiUrl('/api/service-memos'), {
      method: 'POST',
      body,
      emitRealtime: { module: REALTIME_MODULES.SERVICE_MEMOS },
    });
    return {
      ok: result.ok,
      success: result.success,
      data: result.data?.data ?? null,
      status: result.status,
      message:
        typeof result.data?.message === 'string'
          ? result.data.message
          : !result.ok
            ? `Request failed (${result.status}).`
            : null,
    };
  } catch {
    return { ok: false, success: false, data: null, message: 'Network error.', status: 0 };
  }
}

/**
 * Preview next memo control number (PREFIX-##########) from saved memos only—does not reserve until POST save.
 * @param {string} ticketId
 * @returns {Promise<{ ok: boolean, success: boolean, data: { control_number?: string, prefix?: string }|null, message: string|null, status: number }>}
 */
export async function allocateControlNumber(ticketId) {
  const q = String(ticketId || '').trim();
  if (!q) {
    return { ok: false, success: false, data: null, message: 'Ticket ID is required.', status: 400 };
  }
  try {
    const result = await authMutation(apiUrl('/api/service-memos/allocate-control-number'), {
      method: 'POST',
      body: { ticket_id: q },
      emitRealtime: { module: REALTIME_MODULES.SERVICE_MEMOS },
    });
    return {
      ok: result.ok,
      success: result.success,
      data: result.data?.data ?? null,
      status: result.status,
      message:
        typeof result.data?.message === 'string'
          ? result.data.message
          : !result.ok
            ? `Request failed (${result.status}).`
            : null,
    };
  } catch {
    return { ok: false, success: false, data: null, message: 'Network error.', status: 0 };
  }
}

/**
 * @param {number} id
 * @param {object} body
 * @returns {Promise<{ ok: boolean, success: boolean, message: string|null }>}
 */
export async function updateServiceMemo(id, body, expectedUpdatedAt = null) {
  try {
    const result = await authMutation(apiUrl(`/api/service-memos/${id}`), {
      method: 'PUT',
      body,
      expectedUpdatedAt,
      expectedUpdatedAtField: 'expected_updated_at',
      emitRealtime: { module: REALTIME_MODULES.SERVICE_MEMOS },
    });
    return {
      ok: result.ok,
      success: result.success,
      conflict: result.conflict,
      latest: result.data?.latest ?? null,
      message: typeof result.data?.message === 'string' ? result.data.message : null,
    };
  } catch {
    return { ok: false, success: false, conflict: false, latest: null, message: 'Network error.' };
  }
}

/**
 * @param {number} id
 * @returns {Promise<{ ok: boolean, success: boolean, message: string|null }>}
 */
export async function closeServiceMemo(id, expectedUpdatedAt = null) {
  try {
    const result = await authMutation(apiUrl(`/api/service-memos/${id}/close`), {
      method: 'PUT',
      body: {},
      expectedUpdatedAt,
      expectedUpdatedAtField: 'expected_updated_at',
      emitRealtime: { module: REALTIME_MODULES.SERVICE_MEMOS },
    });
    return {
      ok: result.ok,
      success: result.success,
      conflict: result.conflict,
      latest: result.data?.latest ?? null,
      message: typeof result.data?.message === 'string' ? result.data.message : null,
    };
  } catch {
    return { ok: false, success: false, conflict: false, latest: null, message: 'Network error.' };
  }
}

/**
 * @param {number} id
 * @returns {Promise<{ ok: boolean, success: boolean, message: string|null }>}
 */
export async function deleteServiceMemo(id) {
  try {
    const result = await authMutation(apiUrl(`/api/service-memos/${id}`), {
      method: 'DELETE',
      body: {},
      emitRealtime: { module: REALTIME_MODULES.SERVICE_MEMOS },
    });
    return {
      ok: result.ok,
      success: result.success,
      message: typeof result.data?.message === 'string' ? result.data.message : null,
    };
  } catch {
    return { ok: false, success: false, message: 'Network error.' };
  }
}

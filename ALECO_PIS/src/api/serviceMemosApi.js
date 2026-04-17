/**
 * Service memos — client for GET/POST/PUT /api/service-memos.
 * @see backend/routes/service-memos.js
 */
import { apiUrl } from '../utils/api';
import axios from './axiosConfig';

/**
 * Load a ticket row for memo creation (admin list API).
 * @param {string} ticketId
 * @returns {Promise<{ ok: boolean, ticket: object|null, message: string|null }>}
 */
export async function fetchTicketPreviewForMemo(ticketId) {
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
    const exact = response.data.data.find((t) => t.ticket_id === q);
    const ticket = exact || response.data.data[0] || null;
    if (!ticket) {
      return { ok: false, ticket: null, message: 'No ticket found for that search.' };
    }
    return { ok: true, ticket, message: null };
  } catch (e) {
    return { ok: false, ticket: null, message: e?.message || 'Network error.' };
  }
}

function authHeaders() {
  const userEmail = typeof localStorage !== 'undefined' ? localStorage.getItem('userEmail') : null;
  const userName = typeof localStorage !== 'undefined' ? localStorage.getItem('userName') : null;
  return {
    'X-User-Email': userEmail || '',
    'X-User-Name': userName || '',
  };
}

/**
 * @param {{ tab?: string, search?: string, status?: string, startDate?: string, endDate?: string, owner?: string }} opts
 * @returns {Promise<{ ok: boolean, success: boolean, data: object[], message: string|null }>}
 */
export async function listServiceMemos({
  tab = 'all',
  search = '',
  status = '',
  startDate = '',
  endDate = '',
  owner = '',
} = {}) {
  const qs = new URLSearchParams();
  if (tab) qs.set('tab', tab);
  if (search) qs.set('search', search);
  if (status) qs.set('status', status);
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
  let res;
  try {
    res = await fetch(apiUrl('/api/service-memos'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, success: false, data: null, message: 'Network error.' };
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
 * @param {object} body
 * @returns {Promise<{ ok: boolean, success: boolean, message: string|null }>}
 */
export async function updateServiceMemo(id, body) {
  let res;
  try {
    res = await fetch(apiUrl(`/api/service-memos/${id}`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, success: false, message: 'Network error.' };
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
 * @returns {Promise<{ ok: boolean, success: boolean, message: string|null }>}
 */
export async function closeServiceMemo(id) {
  let res;
  try {
    res = await fetch(apiUrl(`/api/service-memos/${id}/close`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: '{}',
    });
  } catch {
    return { ok: false, success: false, message: 'Network error.' };
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
 * @returns {Promise<{ ok: boolean, success: boolean, message: string|null }>}
 */
export async function deleteServiceMemo(id) {
  let res;
  try {
    res = await fetch(apiUrl(`/api/service-memos/${id}`), {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
    });
  } catch {
    return { ok: false, success: false, message: 'Network error.' };
  }
  const json = await res.json().catch(() => null);
  const success = res.ok && json && json.success === true;
  return {
    ok: res.ok,
    success,
    message: typeof json?.message === 'string' ? json.message : null,
  };
}

import { apiUrl } from '../utils/api';

async function jsonFetch(path, options = {}) {
    let res;
    try {
        res = await fetch(apiUrl(path), options);
    } catch {
        return { ok: false, success: false, data: null, message: null, status: 0 };
    }
    const json = await res.json().catch(() => null);
    return {
        ok: res.ok,
        status: res.status,
        success: res.ok && json?.success === true,
        data: json?.data ?? null,
        message: typeof json?.message === 'string' ? json.message : null,
    };
}

export const listB2BContacts = ({ q = '', feederId = '', active = '' } = {}) =>
    jsonFetch(`/api/b2b-mail/contacts?q=${encodeURIComponent(q)}&feederId=${encodeURIComponent(feederId)}&active=${encodeURIComponent(active)}`);

export const createB2BContact = (body) =>
    jsonFetch('/api/b2b-mail/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
    });

export const updateB2BContact = (id, body) =>
    jsonFetch(`/api/b2b-mail/contacts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
    });

export const toggleB2BContactActive = (id, active) =>
    jsonFetch(`/api/b2b-mail/contacts/${id}/active`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: Boolean(active) }),
    });

export const listB2BMessages = ({ folder = 'all', q = '' } = {}) =>
    jsonFetch(`/api/b2b-mail/messages?folder=${encodeURIComponent(folder)}&q=${encodeURIComponent(q)}`);

export const getB2BMessageDetail = (id) => jsonFetch(`/api/b2b-mail/messages/${id}`);

export const saveB2BDraft = (body) =>
    jsonFetch('/api/b2b-mail/messages/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
    });

export const updateB2BDraft = (id, body) =>
    jsonFetch(`/api/b2b-mail/messages/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
    });

export const sendB2BMessage = (id) =>
    jsonFetch(`/api/b2b-mail/messages/${id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
    });

export const retryB2BMessage = (id) =>
    jsonFetch(`/api/b2b-mail/messages/${id}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
    });

export const listB2BTemplates = () => jsonFetch('/api/b2b-mail/templates');

export const createB2BTemplate = (body) =>
    jsonFetch('/api/b2b-mail/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
    });

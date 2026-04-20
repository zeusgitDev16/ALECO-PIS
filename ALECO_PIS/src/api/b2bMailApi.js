import { apiUrl } from '../utils/api';

function adminHeaders(extra = {}) {
    const h = { ...extra };
    if (typeof localStorage !== 'undefined') {
        const e = localStorage.getItem('userEmail');
        const n = localStorage.getItem('userName');
        if (e) h['X-User-Email'] = e;
        if (n) h['X-User-Name'] = n;
    }
    return h;
}

async function jsonFetch(path, options = {}) {
    let res;
    try {
        const headers = { ...adminHeaders(), ...(options.headers || {}) };
        res = await fetch(apiUrl(path), { ...options, headers });
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
        totalInbound: json?.totalInbound ?? null,
    };
}

export const listB2BContacts = ({ q = '', feederId = '', active = '' } = {}) =>
    jsonFetch(`/api/b2b-mail/contacts?q=${encodeURIComponent(q)}&feederId=${encodeURIComponent(feederId)}&active=${encodeURIComponent(active)}`);

export const createB2BContact = (body) =>
    jsonFetch('/api/b2b-mail/contacts', {
        method: 'POST',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body || {}),
    });

export const updateB2BContact = (id, body) =>
    jsonFetch(`/api/b2b-mail/contacts/${id}`, {
        method: 'PUT',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body || {}),
    });

export const toggleB2BContactActive = (id, active) =>
    jsonFetch(`/api/b2b-mail/contacts/${id}/active`, {
        method: 'PATCH',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ active: Boolean(active) }),
    });

export const sendB2BContactVerification = (id) =>
    jsonFetch(`/api/b2b-mail/contacts/${id}/send-verification`, {
        method: 'POST',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: '{}',
    });

export const listB2BMessages = ({ folder = 'all', q = '' } = {}) =>
    jsonFetch(`/api/b2b-mail/messages?folder=${encodeURIComponent(folder)}&q=${encodeURIComponent(q)}`);

export const getB2BMessageDetail = (id) => jsonFetch(`/api/b2b-mail/messages/${id}`);

export const saveB2BDraft = (body) =>
    jsonFetch('/api/b2b-mail/messages/draft', {
        method: 'POST',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body || {}),
    });

export const updateB2BDraft = (id, body) =>
    jsonFetch(`/api/b2b-mail/messages/${id}`, {
        method: 'PUT',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body || {}),
    });

export const previewB2BRecipientsBody = (body) =>
    jsonFetch('/api/b2b-mail/messages/preview-recipients', {
        method: 'POST',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body || {}),
    });

export const previewB2BRecipientsByMessageId = (id) =>
    jsonFetch(`/api/b2b-mail/messages/${id}/preview-recipients`, {
        method: 'POST',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: '{}',
    });

export const sendB2BMessage = (id) =>
    jsonFetch(`/api/b2b-mail/messages/${id}/send`, {
        method: 'POST',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: '{}',
    });

export const retryB2BMessage = (id) =>
    jsonFetch(`/api/b2b-mail/messages/${id}/retry`, {
        method: 'POST',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: '{}',
    });

export const listB2BTemplates = () => jsonFetch('/api/b2b-mail/templates');

export const createB2BTemplate = (body) =>
    jsonFetch('/api/b2b-mail/templates', {
        method: 'POST',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body || {}),
    });

export const listB2BInbound = ({ messageId = '' } = {}) =>
    jsonFetch(`/api/b2b-mail/inbound?messageId=${encodeURIComponent(messageId)}`);

export const refreshB2BInbound = ({ messageId = '' } = {}) => {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 60000);
    return jsonFetch(`/api/b2b-mail/inbound/refresh?messageId=${encodeURIComponent(messageId)}`, {
        method: 'POST',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: '{}',
        signal: controller.signal,
    }).finally(() => clearTimeout(tid));
};

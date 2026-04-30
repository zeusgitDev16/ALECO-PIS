import { apiUrl } from '../utils/api';
import { authFetch } from '../utils/authFetch';
import { authMutation } from '../utils/authMutation';
import { REALTIME_MODULES } from '../constants/realtimeModules';

async function jsonFetch(path, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const url = apiUrl(path);
    try {
        if (method === 'GET') {
            const res = await authFetch(url, { ...options });
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

        const rawBody = options.body;
        const parsedBody = typeof rawBody === 'string'
            ? (rawBody.trim() ? JSON.parse(rawBody) : {})
            : (rawBody || {});
        const mutation = await authMutation(url, {
            method,
            body: parsedBody,
            emitRealtime: { module: REALTIME_MODULES.B2B_MAIL },
            ...(options.signal ? { signal: options.signal } : {}),
        });
        return {
            ok: mutation.ok,
            status: mutation.status,
            success: mutation.success,
            data: mutation.data?.data ?? null,
            message: typeof mutation.data?.message === 'string' ? mutation.data.message : null,
            totalInbound: mutation.data?.totalInbound ?? null,
        };
    } catch {
        return { ok: false, success: false, data: null, message: null, status: 0 };
    }
}

export const listB2BContacts = ({ q = '', feederId = '', active = '' } = {}) =>
    jsonFetch(`/api/b2b-mail/contacts?q=${encodeURIComponent(q)}&feederId=${encodeURIComponent(feederId)}&active=${encodeURIComponent(active)}`);

export const createB2BContact = (body) =>
    jsonFetch('/api/b2b-mail/contacts', {
        method: 'POST',
        body: body || {},
    });

export const updateB2BContact = (id, body) =>
    jsonFetch(`/api/b2b-mail/contacts/${id}`, {
        method: 'PUT',
        body: body || {},
    });

export const toggleB2BContactActive = (id, active) =>
    jsonFetch(`/api/b2b-mail/contacts/${id}/active`, {
        method: 'PATCH',
        body: { active: Boolean(active) },
    });

export const sendB2BContactVerification = (id) =>
    jsonFetch(`/api/b2b-mail/contacts/${id}/send-verification`, {
        method: 'POST',
        body: {},
    });

export const listB2BMessages = ({ folder = 'all', q = '' } = {}) =>
    jsonFetch(`/api/b2b-mail/messages?folder=${encodeURIComponent(folder)}&q=${encodeURIComponent(q)}`);

export const getB2BMessageDetail = (id) => jsonFetch(`/api/b2b-mail/messages/${id}`);

export const saveB2BDraft = (body) =>
    jsonFetch('/api/b2b-mail/messages/draft', {
        method: 'POST',
        body: body || {},
    });

export const updateB2BDraft = (id, body) =>
    jsonFetch(`/api/b2b-mail/messages/${id}`, {
        method: 'PUT',
        body: body || {},
    });

export const previewB2BRecipientsBody = (body) =>
    jsonFetch('/api/b2b-mail/messages/preview-recipients', {
        method: 'POST',
        body: body || {},
    });

export const previewB2BRecipientsByMessageId = (id) =>
    jsonFetch(`/api/b2b-mail/messages/${id}/preview-recipients`, {
        method: 'POST',
        body: {},
    });

export const sendB2BMessage = (id) =>
    jsonFetch(`/api/b2b-mail/messages/${id}/send`, {
        method: 'POST',
        body: {},
    });

export const retryB2BMessage = (id) =>
    jsonFetch(`/api/b2b-mail/messages/${id}/retry`, {
        method: 'POST',
        body: {},
    });

export const listB2BTemplates = () => jsonFetch('/api/b2b-mail/templates');

export const createB2BTemplate = (body) =>
    jsonFetch('/api/b2b-mail/templates', {
        method: 'POST',
        body: body || {},
    });

export const listB2BInbound = ({ messageId = '' } = {}) =>
    jsonFetch(`/api/b2b-mail/inbound?messageId=${encodeURIComponent(messageId)}`);

export const refreshB2BInbound = ({ messageId = '' } = {}) => {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 60000);
    return jsonFetch(`/api/b2b-mail/inbound/refresh?messageId=${encodeURIComponent(messageId)}`, {
        method: 'POST',
        body: {},
        signal: controller.signal,
    }).finally(() => clearTimeout(tid));
};

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiUrl } from '../utils/api';
import { authFetch } from '../utils/authFetch';
import {
    createB2BContact,
    createB2BTemplate,
    getB2BMessageDetail,
    listB2BContacts,
    listB2BInbound,
    listB2BMessages,
    listB2BTemplates,
    previewB2BRecipientsBody,
    previewB2BRecipientsByMessageId,
    retryB2BMessage,
    saveB2BDraft,
    sendB2BContactVerification,
    sendB2BMessage,
    toggleB2BContactActive,
    updateB2BContact,
    updateB2BDraft,
} from '../api/b2bMailApi';

const defaultCompose = {
    id: null,
    targetMode: 'all_feeders',
    selectedFeederIds: [],
    selectedContactIds: [],
    interruptionId: null,
    templateId: null,
    subject: '',
    bodyText: '',
    bodyHtml: '',
};

function parseStoredIds(val) {
    if (val == null) return [];
    if (Array.isArray(val)) return val.map((n) => Number(n)).filter((x) => Number.isFinite(x) && x > 0);
    try {
        const p = JSON.parse(String(val));
        return Array.isArray(p) ? p.map((n) => Number(n)).filter((x) => Number.isFinite(x) && x > 0) : [];
    } catch {
        return [];
    }
}

function validateComposeForSend(compose, activeContactCount) {
    const mode = compose.targetMode;
    if (!String(compose.subject || '').trim() && !String(compose.bodyText || '').trim()) {
        return 'Add a subject or body before sending.';
    }
    if (mode === 'selected_feeders' && (!compose.selectedFeederIds || compose.selectedFeederIds.length === 0)) {
        return 'Select at least one feeder.';
    }
    if (mode === 'manual_contacts' && (!compose.selectedContactIds || compose.selectedContactIds.length === 0)) {
        return 'Select at least one contact.';
    }
    if (
        mode === 'interruption_linked' &&
        (compose.interruptionId == null || compose.interruptionId === '' || Number.isNaN(Number(compose.interruptionId)))
    ) {
        return 'Enter a valid interruption (advisory) ID.';
    }
    if (mode === 'all_feeders' && activeContactCount === 0) {
        return 'No active B2B contacts. Add contacts before sending to all feeders.';
    }
    return null;
}

export function useB2BMail() {
    const [folder, setFolder] = useState('all');
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    const [mailList, setMailList] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [selectedDetail, setSelectedDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const [contacts, setContacts] = useState([]);
    const [contactQuery, setContactQuery] = useState('');
    const [templates, setTemplates] = useState([]);
    const [feeders, setFeeders] = useState([]);
    const [compose, setCompose] = useState({ ...defaultCompose });

    const [previewResult, setPreviewResult] = useState(null);
    const [inboundList, setInboundList] = useState([]);
    const [inboundLoading, setInboundLoading] = useState(false);

    const lastHydratedSelectedId = useRef(null);

    const activeContactCount = useMemo(
        () =>
            contacts.filter(
                (c) =>
                    (c.is_active === 1 || c.is_active === true) &&
                    (c.email_verified === 1 || c.email_verified === true)
            ).length,
        [contacts]
    );

    const loadFeeders = useCallback(async () => {
        try {
            const res = await authFetch(apiUrl('/api/feeders'));
            const json = await res.json().catch(() => null);
            if (res.ok && json?.success && Array.isArray(json.areas)) {
                setFeeders(json.areas);
            }
        } catch {
            setFeeders([]);
        }
    }, []);

    const loadMessages = useCallback(async () => {
        setLoading(true);
        const r = await listB2BMessages({ folder, q: query });
        if (r.success && Array.isArray(r.data)) {
            setMailList(r.data);
        } else {
            setMailList([]);
        }
        setLoading(false);
    }, [folder, query]);

    const loadContacts = useCallback(async () => {
        const r = await listB2BContacts({ q: contactQuery });
        if (r.success && Array.isArray(r.data)) {
            setContacts(r.data);
        } else {
            setContacts([]);
        }
    }, [contactQuery]);

    const loadTemplates = useCallback(async () => {
        const r = await listB2BTemplates();
        if (r.success && Array.isArray(r.data)) setTemplates(r.data);
    }, []);

    const loadDetail = useCallback(async (id) => {
        if (!id) {
            setSelectedDetail(null);
            return;
        }
        setDetailLoading(true);
        const r = await getB2BMessageDetail(id);
        setSelectedDetail(r.success ? r.data : null);
        setDetailLoading(false);
    }, []);

    const loadInbound = useCallback(async (messageId = '') => {
        setInboundLoading(true);
        const r = await listB2BInbound({ messageId: messageId != null ? String(messageId) : '' });
        if (r.success && Array.isArray(r.data)) {
            setInboundList(r.data);
        } else {
            setInboundList([]);
        }
        setInboundLoading(false);
    }, []);

    useEffect(() => {
        loadMessages();
    }, [loadMessages]);

    useEffect(() => {
        loadContacts();
    }, [loadContacts]);

    useEffect(() => {
        loadTemplates();
        loadFeeders();
    }, [loadTemplates, loadFeeders]);

    useEffect(() => {
        loadDetail(selectedId);
    }, [selectedId, loadDetail]);

    useEffect(() => {
        if (!selectedId) {
            lastHydratedSelectedId.current = null;
            return;
        }
        const m = selectedDetail?.message;
        if (!m || Number(m.id) !== Number(selectedId)) return;
        if (lastHydratedSelectedId.current === selectedId) return;
        lastHydratedSelectedId.current = selectedId;
        setCompose({
            id: m.id,
            targetMode: m.target_mode || 'all_feeders',
            selectedFeederIds: parseStoredIds(m.selected_feeder_ids),
            selectedContactIds: parseStoredIds(m.selected_contact_ids),
            interruptionId: m.interruption_id != null ? Number(m.interruption_id) : null,
            templateId: m.template_id != null ? Number(m.template_id) : null,
            subject: m.subject || '',
            bodyText: m.body_text || '',
            bodyHtml: m.body_html || '',
        });
    }, [selectedId, selectedDetail]);

    useEffect(() => {
        const mid = selectedId != null ? String(selectedId) : '';
        loadInbound(mid);
    }, [selectedId, loadInbound]);

    const startNewCompose = useCallback(() => {
        lastHydratedSelectedId.current = null;
        setSelectedId(null);
        setSelectedDetail(null);
        setCompose({ ...defaultCompose });
        setPreviewResult(null);
    }, []);

    const saveDraft = useCallback(async () => {
        setSaving(true);
        const payload = { ...compose };
        const r = compose.id ? await updateB2BDraft(compose.id, payload) : await saveB2BDraft(payload);
        if (r.success && r.data) {
            setCompose((prev) => ({ ...prev, id: r.data.id }));
            setMessage({ type: 'ok', text: 'Draft saved.' });
            await loadMessages();
        } else {
            setMessage({ type: 'err', text: r.message || 'Failed to save draft.' });
        }
        setSaving(false);
        return r;
    }, [compose, loadMessages]);

    const previewRecipients = useCallback(async () => {
        setPreviewResult(null);
        setSaving(true);
        let r;
        if (compose.id) {
            r = await previewB2BRecipientsByMessageId(compose.id);
        } else {
            r = await previewB2BRecipientsBody(compose);
        }
        setSaving(false);
        if (r.success && r.data) {
            setPreviewResult(r.data);
            setMessage({ type: 'ok', text: `Preview: ${r.data.count} recipient(s).` });
        } else {
            setMessage({ type: 'err', text: r.message || 'Preview failed.' });
        }
        return r;
    }, [compose]);

    const sendNow = useCallback(async () => {
        const v = validateComposeForSend(compose, activeContactCount);
        if (v) {
            setMessage({ type: 'err', text: v });
            return { success: false };
        }
        let mid = compose.id;
        if (!mid) {
            const d = await saveDraft();
            if (!d.success || !d.data?.id) return d;
            mid = d.data.id;
        }
        setSaving(true);
        const r = await sendB2BMessage(mid);
        if (r.success) {
            setMessage({ type: 'ok', text: 'Email sent.' });
            await loadMessages();
            await loadDetail(mid);
            await loadInbound(String(mid));
        } else {
            setMessage({ type: 'err', text: r.message || 'Failed to send.' });
        }
        setSaving(false);
        return r;
    }, [compose, activeContactCount, saveDraft, loadMessages, loadDetail, loadInbound]);

    const retryFailed = useCallback(
        async (id) => {
            const r = await retryB2BMessage(id);
            if (r.success) {
                setMessage({ type: 'ok', text: 'Retry completed.' });
                await loadMessages();
                await loadDetail(id);
            } else {
                setMessage({ type: 'err', text: r.message || 'Retry failed.' });
            }
            return r;
        },
        [loadMessages, loadDetail]
    );

    const upsertContact = useCallback(
        async (draft) => {
            const r = draft?.id ? await updateB2BContact(draft.id, draft) : await createB2BContact(draft);
            await loadContacts();
            return r;
        },
        [loadContacts]
    );

    const setContactActive = useCallback(
        async (id, active) => {
            const r = await toggleB2BContactActive(id, active);
            await loadContacts();
            return r;
        },
        [loadContacts]
    );

    const sendContactVerification = useCallback(
        async (id) => {
            const r = await sendB2BContactVerification(id);
            if (r.success) {
                setMessage({ type: 'ok', text: 'Verification email sent.' });
                await loadContacts();
            } else {
                setMessage({ type: 'err', text: r.message || 'Failed to send verification.' });
            }
            return r;
        },
        [loadContacts]
    );

    const addTemplate = useCallback(
        async (tpl) => {
            const r = await createB2BTemplate(tpl);
            await loadTemplates();
            return r;
        },
        [loadTemplates]
    );

    const selectedFeederLabels = useMemo(() => {
        const map = new Map();
        for (const area of feeders || []) {
            for (const f of area.feeders || []) {
                map.set(Number(f.id), f.label || `${area.label} ${f.code}`);
            }
        }
        return (compose.selectedFeederIds || []).map((id) => ({ id, label: map.get(Number(id)) || `Feeder #${id}` }));
    }, [feeders, compose.selectedFeederIds]);

    return {
        folder,
        setFolder,
        query,
        setQuery,
        loading,
        saving,
        message,
        setMessage,
        mailList,
        selectedId,
        setSelectedId,
        selectedDetail,
        detailLoading,
        contacts,
        contactQuery,
        setContactQuery,
        templates,
        feeders,
        compose,
        setCompose,
        selectedFeederLabels,
        previewResult,
        inboundList,
        inboundLoading,
        activeContactCount,
        startNewCompose,
        refreshAll: async () => {
            await Promise.all([loadMessages(), loadContacts(), loadTemplates(), loadFeeders()]);
        },
        refreshInbound: () => loadInbound(selectedId != null ? String(selectedId) : ''),
        saveDraft,
        previewRecipients,
        sendNow,
        retryFailed,
        upsertContact,
        setContactActive,
        sendContactVerification,
        addTemplate,
    };
}

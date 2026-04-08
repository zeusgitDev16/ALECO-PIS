import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiUrl } from '../utils/api';
import {
    createB2BContact,
    createB2BTemplate,
    getB2BMessageDetail,
    listB2BContacts,
    listB2BMessages,
    listB2BTemplates,
    retryB2BMessage,
    saveB2BDraft,
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
    const [compose, setCompose] = useState(defaultCompose);

    const loadFeeders = useCallback(async () => {
        try {
            const res = await fetch(apiUrl('/api/feeders'));
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

    const saveDraft = useCallback(async () => {
        setSaving(true);
        const actorEmail = typeof localStorage !== 'undefined' ? localStorage.getItem('userEmail') : null;
        const actorName = typeof localStorage !== 'undefined' ? localStorage.getItem('userName') : null;
        const payload = { ...compose, actorEmail, actorName };
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

    const sendNow = useCallback(async () => {
        if (!compose.id) {
            const d = await saveDraft();
            if (!d.success || !d.data?.id) return d;
        }
        setSaving(true);
        const r = await sendB2BMessage(compose.id || selectedId);
        if (r.success) {
            setMessage({ type: 'ok', text: 'Email sent.' });
            await loadMessages();
            if (compose.id) await loadDetail(compose.id);
        } else {
            setMessage({ type: 'err', text: r.message || 'Failed to send.' });
        }
        setSaving(false);
        return r;
    }, [compose.id, selectedId, saveDraft, loadMessages, loadDetail]);

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

    const addTemplate = useCallback(
        async (tpl) => {
            const actorEmail = typeof localStorage !== 'undefined' ? localStorage.getItem('userEmail') : null;
            const r = await createB2BTemplate({ ...tpl, actorEmail });
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
        refreshAll: async () => {
            await Promise.all([loadMessages(), loadContacts(), loadTemplates(), loadFeeders()]);
        },
        saveDraft,
        sendNow,
        retryFailed,
        upsertContact,
        setContactActive,
        addTemplate,
    };
}

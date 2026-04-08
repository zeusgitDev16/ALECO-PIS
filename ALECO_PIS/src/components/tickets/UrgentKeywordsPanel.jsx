import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { apiUrl } from '../../utils/api';
import { DEFAULT_URGENT_KEYWORDS } from '../../constants/urgentKeywordsDefaults';
import ConfirmModal from './ConfirmModal';
import '../../CSS/UrgentKeywordsPanel.css';

const LS_COLLAPSE_KEY = 'urgentKeywordsCollapsed';

const UrgentKeywordsPanel = () => {
    const [keywords, setKeywords] = useState([]);
    /** True when list is the legacy default copy — not yet stored (empty DB) or load failed */
    const [showDefaultsNotice, setShowDefaultsNotice] = useState(false);
    /** Pending chip removal after ConfirmModal */
    const [removeConfirm, setRemoveConfirm] = useState(null);
    const [collapsed, setCollapsed] = useState(() => {
        try {
            const saved = localStorage.getItem(LS_COLLAPSE_KEY);
            if (saved === 'true' || saved === 'false') return saved === 'true';
        } catch {}
        return true; // default: closed
    });
    const [draft, setDraft] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setShowDefaultsNotice(false);
        try {
            const res = await fetch(apiUrl('/api/urgent-keywords'));
            const data = await res.json();
            if (!res.ok || !data?.success || !Array.isArray(data.keywords)) {
                throw new Error(data?.message || 'Failed to load');
            }
            if (data.keywords.length === 0) {
                setKeywords([...DEFAULT_URGENT_KEYWORDS]);
                setShowDefaultsNotice(true);
            } else {
                setKeywords(data.keywords);
            }
        } catch (e) {
            console.error(e);
            setKeywords([...DEFAULT_URGENT_KEYWORDS]);
            setShowDefaultsNotice(true);
            toast.warning(
                'Could not reach the server list. Showing the legacy default keywords — edit and Save to store them in the database.'
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        try {
            localStorage.setItem(LS_COLLAPSE_KEY, String(collapsed));
        } catch {}
    }, [collapsed]);

    const addDraft = () => {
        const s = draft.trim().toLowerCase();
        if (!s) {
            toast.warning('Enter a keyword or phrase.');
            return;
        }
        if (keywords.some((k) => k.toLowerCase() === s)) {
            toast.warning('That keyword is already in the list.');
            return;
        }
        setKeywords((prev) => [...prev, s]);
        setDraft('');
    };

    const removeAt = (index) => {
        setKeywords((prev) => prev.filter((_, i) => i !== index));
    };

    const requestRemove = (index, keyword) => {
        setRemoveConfirm({ index, keyword });
    };

    const confirmRemove = () => {
        if (removeConfirm == null) return;
        removeAt(removeConfirm.index);
        setRemoveConfirm(null);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(apiUrl('/api/urgent-keywords'), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keywords })
            });
            const data = await res.json();
            if (!res.ok || !data?.success) {
                throw new Error(data?.message || 'Save failed');
            }
            setKeywords(data.keywords || []);
            setShowDefaultsNotice(false);
            toast.success('Urgent keywords saved.');
        } catch (e) {
            console.error(e);
            toast.error(e?.message || 'Could not save keywords.');
        } finally {
            setSaving(false);
        }
    };

    const removeTitle = showDefaultsNotice ? 'Remove from legacy default list?' : 'Remove keyword?';
    const removeMessage =
        removeConfirm == null
            ? ''
            : showDefaultsNotice
              ? `Remove “${removeConfirm.keyword}” from this list? It is not saved to the database until you click Save.`
              : `Remove “${removeConfirm.keyword}” from the urgent keywords list? Save to apply changes to new reports.`;

    return (
        <div className="urgent-keywords-panel" aria-label="Urgent keyword configuration">
            <div className="urgent-keywords-panel__header">
                <div className="urgent-keywords-panel__header-row">
                    <h4 className="urgent-keywords-panel__title">Urgent keywords</h4>
                    <button
                        type="button"
                        className="urgent-keywords-panel__collapse-btn"
                        onClick={() => setCollapsed((v) => !v)}
                        aria-expanded={!collapsed}
                        aria-label={collapsed ? 'Expand urgent keywords' : 'Collapse urgent keywords'}
                        title={collapsed ? 'Show urgent keywords' : 'Hide urgent keywords'}
                    >
                        <span
                            className={`urgent-keywords-panel__caret ${collapsed ? 'is-collapsed' : 'is-expanded'}`}
                            aria-hidden="true"
                        >
                            ▾
                        </span>
                    </button>
                </div>
                <p className="urgent-keywords-panel__hint">
                    Reports whose concern text matches these phrases (word boundaries) are
                    flagged urgent. Changes apply to new submissions immediately after Save.
                </p>
            </div>

            {!collapsed && showDefaultsNotice && !loading && (
                <p className="urgent-keywords-panel__defaults-notice" role="status">
                    <strong>Legacy default list.</strong> The keywords below are the former hardcoded
                    set — edit as needed, then click <strong>Save</strong> so they are stored in the
                    database and used by Report a Problem and ticket submission.
                </p>
            )}

            {collapsed ? (
                <p className="urgent-keywords-panel__collapsed-hint">
                    Hidden. Click the arrow to manage keywords.
                </p>
            ) : loading ? (
                <p className="urgent-keywords-panel__loading">Loading keywords…</p>
            ) : (
                <>
                    <div className="urgent-keywords-panel__chips">
                        {keywords.length === 0 ? (
                            <span className="urgent-keywords-panel__empty">No keywords — no auto-urgent matches.</span>
                        ) : (
                            keywords.map((kw, i) => (
                                <span key={`${kw}-${i}`} className="urgent-keywords-chip">
                                    <span className="urgent-keywords-chip__text">{kw}</span>
                                    <button
                                        type="button"
                                        className="urgent-keywords-chip__remove"
                                        onClick={() => requestRemove(i, kw)}
                                        aria-label={`Remove ${kw}`}
                                    >
                                        ×
                                    </button>
                                </span>
                            ))
                        )}
                    </div>

                    <div className="urgent-keywords-panel__row">
                        <input
                            type="text"
                            className="urgent-keywords-panel__input"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    addDraft();
                                }
                            }}
                            placeholder="Add word or phrase…"
                            maxLength={128}
                            aria-label="New keyword"
                        />
                        <button
                            type="button"
                            className="urgent-keywords-panel__btn urgent-keywords-panel__btn--secondary"
                            onClick={addDraft}
                        >
                            Add
                        </button>
                        <button
                            type="button"
                            className="urgent-keywords-panel__btn urgent-keywords-panel__btn--primary"
                            onClick={handleSave}
                            disabled={saving}
                        >
                            {saving ? 'Saving…' : 'Save'}
                        </button>
                    </div>
                </>
            )}

            <ConfirmModal
                isOpen={removeConfirm != null}
                onClose={() => setRemoveConfirm(null)}
                onConfirm={confirmRemove}
                title={removeTitle}
                message={removeMessage}
                confirmLabel="Remove"
                cancelLabel="Cancel"
                variant="danger"
            />
        </div>
    );
};

export default UrgentKeywordsPanel;

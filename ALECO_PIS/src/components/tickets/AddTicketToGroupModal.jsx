import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'react-toastify';
import { apiUrl } from '../../utils/api';
import { authFetch } from '../../utils/authFetch';
import { formatTicketStatusLabel } from '../../utils/ticketStatusDisplay';
import '../../CSS/AddTicketToGroupModal.css';

/**
 * AddTicketToGroupModal - Pick standalone (ungrouped) tickets to add to a Pending group.
 *
 * Production considerations:
 *  - Only fetches standalone ungrouped tickets (groupFilter=ungrouped) so we never offer
 *    a ticket that already belongs to another group or is a GROUP master.
 *  - Defensive client-side guards mirror the backend (skip GROUP-* ids, skip the group itself).
 *  - Tickets that already have a service memo are allowed (badge shown for awareness).
 *  - Submission is delegated to `onSubmit(mainTicketId, ids)`; the backend re-validates and
 *    returns a skipped[] breakdown that the parent surfaces.
 */
const AddTicketToGroupModal = ({ isOpen, onClose, group, onSubmit }) => {
    const [tickets, setTickets] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState(null);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState(() => new Set());
    const [isSubmitting, setIsSubmitting] = useState(false);

    const mainTicketId = group?.ticket_id || null;

    const fetchCandidates = useCallback(async (signal) => {
        setIsLoading(true);
        setLoadError(null);
        try {
            // Pull standalone, non-deleted tickets that are not yet in any group.
            const params = new URLSearchParams({ groupFilter: 'ungrouped' });
            const res = await authFetch(apiUrl(`/api/filtered-tickets?${params.toString()}`), { signal });
            const data = await res.json();
            if (!res.ok || !data?.success) {
                throw new Error(data?.message || 'Failed to load tickets.');
            }
            const rows = Array.isArray(data.data) ? data.data : [];
            // Defensive: exclude GROUP masters and the current group id (should already be excluded).
            const eligible = rows.filter(
                (t) => t.ticket_id && !t.ticket_id.startsWith('GROUP-') && t.ticket_id !== mainTicketId
            );
            setTickets(eligible);
        } catch (err) {
            if (err?.name === 'AbortError') return;
            console.error('Add-to-group candidate fetch error:', err);
            setLoadError(err.message || 'Failed to load tickets.');
            setTickets([]);
        } finally {
            setIsLoading(false);
        }
    }, [mainTicketId]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const ctrl = new AbortController();
        setSelected(new Set());
        setSearch('');
        fetchCandidates(ctrl.signal);
        return () => ctrl.abort();
    }, [isOpen, fetchCandidates]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return tickets;
        return tickets.filter((t) => {
            const haystack = [
                t.ticket_id,
                t.first_name,
                t.middle_name,
                t.last_name,
                t.address,
                t.municipality,
                t.district,
                t.category,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return haystack.includes(q);
        });
    }, [tickets, search]);

    const toggle = (ticketId) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(ticketId)) next.delete(ticketId);
            else next.add(ticketId);
            return next;
        });
    };

    const toggleAllVisible = () => {
        setSelected((prev) => {
            const next = new Set(prev);
            const visibleIds = filtered.map((t) => t.ticket_id);
            const allSelected = visibleIds.length > 0 && visibleIds.every((id) => next.has(id));
            if (allSelected) {
                visibleIds.forEach((id) => next.delete(id));
            } else {
                visibleIds.forEach((id) => next.add(id));
            }
            return next;
        });
    };

    const handleSubmit = async () => {
        const ids = Array.from(selected);
        if (ids.length === 0) {
            toast.error('Select at least one ticket to add.');
            return;
        }
        setIsSubmitting(true);
        try {
            const result = await onSubmit?.(mainTicketId, ids);
            if (result?.success) {
                onClose();
            }
            // Conflicts/failures are toasted + refetched by the parent.
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen || !group) return null;

    const visibleIds = filtered.map((t) => t.ticket_id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

    return (
        <div className="add-to-group-overlay" onClick={onClose}>
            <div className="add-to-group-modal" onClick={(e) => e.stopPropagation()}>
                <div className="add-to-group-header">
                    <div className="add-to-group-title-block">
                        <h2 className="add-to-group-title">Add Tickets to Group</h2>
                        <p className="add-to-group-subtitle">
                            Group <span className="highlight-id">{mainTicketId}</span> — select standalone tickets to include
                        </p>
                    </div>
                    <button className="add-to-group-close" onClick={onClose} aria-label="Close">&times;</button>
                </div>

                <div className="add-to-group-toolbar">
                    <input
                        type="text"
                        className="add-to-group-search"
                        placeholder="Search by ID, name, location, or category..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <button
                        type="button"
                        className="add-to-group-selectall"
                        onClick={toggleAllVisible}
                        disabled={visibleIds.length === 0}
                    >
                        {allVisibleSelected ? 'Clear Visible' : 'Select Visible'}
                    </button>
                </div>

                <div className="add-to-group-body">
                    {isLoading ? (
                        <div className="add-to-group-empty">Loading tickets…</div>
                    ) : loadError ? (
                        <div className="add-to-group-empty add-to-group-error">{loadError}</div>
                    ) : filtered.length === 0 ? (
                        <div className="add-to-group-empty">
                            {tickets.length === 0
                                ? 'No standalone tickets available to add.'
                                : 'No tickets match your search.'}
                        </div>
                    ) : (
                        <ul className="add-to-group-list">
                            {filtered.map((t) => {
                                const fullName = [t.first_name, t.middle_name, t.last_name]
                                    .filter(Boolean)
                                    .join(' ')
                                    .trim();
                                const location = t.municipality
                                    ? `${t.address ? `${t.address}, ` : ''}${t.municipality}`
                                    : (t.address || '—');
                                const statusKey = t.status ? t.status.toLowerCase().replace(/\s/g, '') : 'pending';
                                const isChecked = selected.has(t.ticket_id);
                                return (
                                    <li
                                        key={t.ticket_id}
                                        className={`add-to-group-item ${isChecked ? 'selected' : ''}`}
                                        onClick={() => toggle(t.ticket_id)}
                                    >
                                        <input
                                            type="checkbox"
                                            className="add-to-group-checkbox"
                                            checked={isChecked}
                                            onChange={() => toggle(t.ticket_id)}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                        <div className="add-to-group-item-main">
                                            <div className="add-to-group-item-top">
                                                <span className="add-to-group-ticket-id">{t.ticket_id}</span>
                                                <span className="add-to-group-category">{t.category || '—'}</span>
                                                {t.has_service_memo ? (
                                                    <span className="add-to-group-memo-badge" title="Has a service memo">Memo</span>
                                                ) : null}
                                            </div>
                                            <div className="add-to-group-item-sub">
                                                <span className="add-to-group-name">{fullName || 'Unknown'}</span>
                                                <span className="add-to-group-dot">·</span>
                                                <span className="add-to-group-location" title={location}>📍 {location}</span>
                                            </div>
                                        </div>
                                        <span className={`add-to-group-status status-pill-solid ${statusKey}`}>
                                            {formatTicketStatusLabel(t.status)}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                <div className="add-to-group-footer">
                    <span className="add-to-group-count">{selected.size} selected</span>
                    <div className="add-to-group-footer-actions">
                        <button type="button" className="btn-action btn-cancel" onClick={onClose}>Cancel</button>
                        <button
                            type="button"
                            className="btn-action btn-ongoing"
                            onClick={handleSubmit}
                            disabled={isSubmitting || selected.size === 0}
                        >
                            {isSubmitting ? 'Adding…' : `Add ${selected.size > 0 ? selected.size : ''} Ticket${selected.size === 1 ? '' : 's'}`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AddTicketToGroupModal;

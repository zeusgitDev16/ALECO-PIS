import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { apiUrl } from '../../utils/api';
import { authFetch } from '../../utils/authFetch';
import '../../CSS/BulkResolveModal.css';

const DRAFT_STORAGE_KEY = 'bulkResolveDrafts';

const BulkResolveModal = ({ isOpen, onClose, selectedIds, tickets, onRefetch }) => {
    // Mode states
    const [remarksMode, setRemarksMode] = useState('individual'); // 'bulk' | 'individual'
    const [referredToMode, setReferredToMode] = useState('bulk'); // 'bulk' | 'individual'
    const [statusMode, setStatusMode] = useState('bulk'); // 'bulk' | 'individual'
    const [accomplishedByMode, setAccomplishedByMode] = useState('individual'); // 'bulk' | 'individual'
    
    // Data states
    const [bulkRemarks, setBulkRemarks] = useState('');
    const [remarksData, setRemarksData] = useState({});
    const [bulkReferredTo, setBulkReferredTo] = useState('');
    const [referredToData, setReferredToData] = useState({});
    const [bulkStatus, setBulkStatus] = useState('Restored');
    const [statusData, setStatusData] = useState({});
    const [bulkAccomplishedBy, setBulkAccomplishedBy] = useState('');
    const [accomplishedByData, setAccomplishedByData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Load draft from localStorage on mount and initialize status defaults
    useEffect(() => {
        if (isOpen) {
            try {
                const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
                const draft = saved ? JSON.parse(saved) : {};
                
                setRemarksMode(draft.remarksMode || 'individual');
                setBulkRemarks(draft.bulkRemarks || '');
                setRemarksData(draft.remarksData || {});
                setReferredToMode(draft.referredToMode || 'bulk');
                setBulkReferredTo(draft.bulkReferredTo || '');
                setReferredToData(draft.referredToData || {});
                setStatusMode(draft.statusMode || 'bulk');
                setBulkStatus(draft.bulkStatus || 'Restored');
                setAccomplishedByMode(draft.accomplishedByMode || 'individual');
                setBulkAccomplishedBy(draft.bulkAccomplishedBy || '');
                setAccomplishedByData(draft.accomplishedByData || {});

                // Initialize statusData with 'Restored' for any tickets missing a value
                // This prevents the validation bug where dropdown shows 'Restored' but state is undefined
                const initialStatusData = { ...(draft.statusData || {}) };
                selectedIds.forEach(id => {
                    if (!initialStatusData[id]) {
                        initialStatusData[id] = 'Restored';
                    }
                });
                setStatusData(initialStatusData);
            } catch (e) {
                console.error('Failed to load draft:', e);
                // Fallback: still initialize status defaults
                const initialStatusData = {};
                selectedIds.forEach(id => { initialStatusData[id] = 'Restored'; });
                setStatusData(initialStatusData);
            }
        }
    }, [isOpen, selectedIds]);

    // Save draft to localStorage whenever data changes
    useEffect(() => {
        if (isOpen) {
            try {
                localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
                    remarksMode,
                    bulkRemarks,
                    remarksData,
                    referredToMode,
                    bulkReferredTo,
                    referredToData,
                    statusMode,
                    bulkStatus,
                    statusData,
                    accomplishedByMode,
                    bulkAccomplishedBy,
                    accomplishedByData
                }));
            } catch (e) {
                console.error('Failed to save draft:', e);
            }
        }
    }, [remarksMode, bulkRemarks, remarksData, referredToMode, bulkReferredTo, referredToData, statusMode, bulkStatus, statusData, accomplishedByMode, bulkAccomplishedBy, accomplishedByData, isOpen]);

    // Convert remarks data when mode changes
    const handleRemarksModeChange = (newMode) => {
        if (newMode === 'bulk' && remarksMode === 'individual') {
            // Individual → Bulk: Use first ticket's remarks
            const firstTicketId = selectedIds[0];
            setBulkRemarks(remarksData[firstTicketId] || '');
        } else if (newMode === 'individual' && remarksMode === 'bulk') {
            // Bulk → Individual: Copy bulk remarks to all tickets
            const newRemarksData = {};
            selectedIds.forEach(id => {
                newRemarksData[id] = bulkRemarks;
            });
            setRemarksData(newRemarksData);
        }
        setRemarksMode(newMode);
    };

    // Convert referred to data when mode changes
    const handleReferredToModeChange = (newMode) => {
        if (newMode === 'bulk' && referredToMode === 'individual') {
            // Individual → Bulk: Use first ticket's referred to
            const firstTicketId = selectedIds[0];
            setBulkReferredTo(referredToData[firstTicketId] || '');
        } else if (newMode === 'individual' && referredToMode === 'bulk') {
            // Bulk → Individual: Copy bulk referred to to all tickets
            const newReferredToData = {};
            selectedIds.forEach(id => {
                newReferredToData[id] = bulkReferredTo;
            });
            setReferredToData(newReferredToData);
        }
        setReferredToMode(newMode);
    };

    // Convert status data when mode changes
    const handleStatusModeChange = (newMode) => {
        if (newMode === 'bulk' && statusMode === 'individual') {
            // Individual → Bulk: Use first ticket's status
            const firstTicketId = selectedIds[0];
            setBulkStatus(statusData[firstTicketId] || 'Restored');
        } else if (newMode === 'individual' && statusMode === 'bulk') {
            // Bulk → Individual: Copy bulk status to all tickets
            const newStatusData = {};
            selectedIds.forEach(id => {
                newStatusData[id] = bulkStatus;
            });
            setStatusData(newStatusData);
        }
        setStatusMode(newMode);
    };

    // Convert accomplished by data when mode changes
    const handleAccomplishedByModeChange = (newMode) => {
        if (newMode === 'bulk' && accomplishedByMode === 'individual') {
            // Individual → Bulk: Use first ticket's accomplished by
            const firstTicketId = selectedIds[0];
            setBulkAccomplishedBy(accomplishedByData[firstTicketId] || '');
        } else if (newMode === 'individual' && accomplishedByMode === 'bulk') {
            // Bulk → Individual: Copy bulk accomplished by to all tickets
            const newAccomplishedByData = {};
            selectedIds.forEach(id => {
                newAccomplishedByData[id] = bulkAccomplishedBy;
            });
            setAccomplishedByData(newAccomplishedByData);
        }
        setAccomplishedByMode(newMode);
    };

    const handleRemarksChange = (ticketId) => (value) => {
        setRemarksData(prev => ({
            ...prev,
            [ticketId]: value
        }));
    };

    const handleReferredToChange = (ticketId) => (value) => {
        setReferredToData(prev => ({
            ...prev,
            [ticketId]: value
        }));
    };

    const handleStatusChange = (ticketId) => (value) => {
        setStatusData(prev => ({
            ...prev,
            [ticketId]: value
        }));
    };

    const handleAccomplishedByChange = (ticketId) => (value) => {
        setAccomplishedByData(prev => ({
            ...prev,
            [ticketId]: value
        }));
    };

    const handleMeClick = (ticketId) => {
        const userEmail = localStorage.getItem('userEmail');
        if (!userEmail) {
            toast.warning('No user email found in session. Please type your name manually.');
            return;
        }
        if (accomplishedByMode === 'bulk') {
            setBulkAccomplishedBy(userEmail);
        } else {
            setAccomplishedByData(prev => ({
                ...prev,
                [ticketId]: userEmail
            }));
        }
    };

    const handleMinimize = () => {
        onClose();
        toast.info('Draft saved. Reopen the modal to continue.');
    };

    const handleClearDraft = () => {
        setRemarksMode('individual');
        setBulkRemarks('');
        setRemarksData({});
        setReferredToMode('bulk');
        setBulkReferredTo('');
        setReferredToData({});
        setStatusMode('bulk');
        setBulkStatus('Restored');
        setStatusData({});
        setAccomplishedByMode('individual');
        setBulkAccomplishedBy('');
        setAccomplishedByData({});
        localStorage.removeItem(DRAFT_STORAGE_KEY);
    };

    const handleSubmit = async () => {
        // Validate status based on mode
        if (statusMode === 'bulk') {
            if (!bulkStatus) {
                toast.error('Status is required.');
                return;
            }
        } else {
            const missingStatus = selectedIds.filter(id => !statusData[id]);
            if (missingStatus.length > 0) {
                toast.error(`Status is required for all tickets. Missing: ${missingStatus.length} ticket(s).`);
                return;
            }
        }

        // Validate remarks based on mode
        if (remarksMode === 'bulk') {
            if (!bulkRemarks.trim()) {
                toast.error('Resolution remarks are required.');
                return;
            }
        } else {
            const missingRemarks = selectedIds.filter(id => !remarksData[id]?.trim());
            if (missingRemarks.length > 0) {
                toast.error(`Resolution remarks are required for all tickets. Missing: ${missingRemarks.length} ticket(s).`);
                return;
            }
        }

        setIsSubmitting(true);
        try {
            const groupMasters = selectedIds.filter(id => id?.startsWith('GROUP-'));
            const regularTickets = selectedIds.filter(id => !id?.startsWith('GROUP-'));

            // Prepare status data (always convert to individual for API)
            const finalStatusData = statusMode === 'bulk' 
                ? Object.fromEntries(selectedIds.map(id => [id, bulkStatus]))
                : statusData;

            // Prepare remarks data (always convert to individual for API)
            const finalRemarksData = remarksMode === 'bulk' 
                ? Object.fromEntries(selectedIds.map(id => [id, bulkRemarks]))
                : remarksData;

            // Prepare referred to data (always convert to individual for API)
            const finalReferredToData = referredToMode === 'bulk'
                ? Object.fromEntries(selectedIds.map(id => [id, bulkReferredTo]))
                : referredToData;

            // Prepare accomplished by data (always convert to individual for API)
            const finalAccomplishedByData = accomplishedByMode === 'bulk'
                ? Object.fromEntries(selectedIds.map(id => [id, bulkAccomplishedBy]))
                : accomplishedByData;

            // Handle group masters
            for (const mainTicketId of groupMasters) {
                const snapshot = (tickets || []).find((t) => t.ticket_id === mainTicketId);
                const response = await authFetch(apiUrl(`/api/tickets/group/${mainTicketId}/status`), {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        status: finalStatusData[mainTicketId],
                        resolution_remarks: finalRemarksData[mainTicketId],
                        referred_to: finalReferredToData[mainTicketId],
                        accomplished_by: finalAccomplishedByData[mainTicketId],
                        actor_email: localStorage.getItem('userEmail') || null,
                        expected_updated_at: snapshot?.updated_at ?? null
                    })
                });
                const data = await response.json();
                if (response.status === 409) {
                    toast.warning(data.message || `Group ${mainTicketId} was updated by someone else.`);
                    continue;
                }
                if (!response.ok || !data.success) {
                    toast.error(`Failed to update group ${mainTicketId}: ${data.message}`);
                    continue;
                }
            }

            // Handle regular tickets with individual data
            if (regularTickets.length > 0) {
                const payload = regularTickets.map(ticketId => {
                    const ticket = (tickets || []).find(t => t.ticket_id === ticketId);
                    return {
                        ticket_id: ticketId,
                        status: finalStatusData[ticketId],
                        resolution_remarks: finalRemarksData[ticketId],
                        referred_to: finalReferredToData[ticketId],
                        accomplished_by: finalAccomplishedByData[ticketId],
                        expected_updated_at: ticket?.updated_at ?? null
                    };
                });

                const response = await authFetch(apiUrl('/api/tickets/bulk/status'), {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        tickets: payload,
                        actor_email: localStorage.getItem('userEmail') || null
                    })
                });

                const data = await response.json();
                
                // Handle 409 Conflict - some tickets were modified by another user
                if (response.status === 409) {
                    const conflictIds = data.conflicts?.map(c => c.ticket_id).join(', ') || 'unknown';
                    const updatedCount = data.updated?.length || 0;
                    const conflictCount = data.conflicts?.length || 0;
                    
                    if (updatedCount > 0) {
                        toast.warning(
                            `Partial success: ${updatedCount} ticket(s) updated, ${conflictCount} skipped due to conflicts. Conflicting tickets: ${conflictIds}. Please refresh and try again.`,
                            { autoClose: 10000 }
                        );
                        // Refetch to show updated state of successfully updated tickets
                        onRefetch();
                    } else {
                        toast.error(
                            `Update failed: All ${conflictCount} ticket(s) were modified by another user. Conflicting tickets: ${conflictIds}. Please refresh and try again.`,
                            { autoClose: 10000 }
                        );
                    }
                    setIsSubmitting(false);
                    return;
                }
                
                if (!response.ok || !data.success) {
                    toast.error(`Failed: ${data.message}`);
                    setIsSubmitting(false);
                    return;
                }

                // Surface skipped memo syncs (e.g. memo already closed) to the user
                if (Array.isArray(data.memoSyncSkipped) && data.memoSyncSkipped.length > 0) {
                    const skippedIds = data.memoSyncSkipped.map(s => s.ticket_id).join(', ');
                    toast.warning(
                        `Memo status sync skipped for ${data.memoSyncSkipped.length} ticket(s): ${skippedIds}. Reopen their memos to re-sync.`,
                        { autoClose: 8000 }
                    );
                }
            }

            toast.success(`${groupMasters.length + regularTickets.length} ticket(s) status updated.`);
            handleClearDraft();
            onRefetch();
            onClose();
        } catch (error) {
            console.error('Error bulk updating ticket status:', error);
            toast.error('Failed to update ticket status. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const selectedTickets = (tickets || []).filter(t => selectedIds.includes(t.ticket_id));

    return (
        <div className="bulk-resolve-modal-backdrop" onClick={handleMinimize}>
            <div className="bulk-resolve-modal-container" onClick={(e) => e.stopPropagation()}>
                {/* Fixed Header */}
                <div className="bulk-resolve-modal-header" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '18px 24px', borderBottom: '1px solid rgba(0, 0, 0, 0.1)', background: '#ffffff', flexShrink: 0, position: 'relative' }}>
                    <div className="header-text-group" style={{ flex: 1, minWidth: 0, maxWidth: 'calc(100% - 100px)', paddingRight: '10px' }}>
                        <h2 className="header-title" style={{ color: '#1f2937', fontSize: '1rem', fontWeight: 700, margin: '0 0 4px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', visibility: 'visible', opacity: 1 }}>Bulk Update Ticket Status</h2>
                        <p className="header-subtitle" style={{ color: '#495057', fontSize: '0.8125rem', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', visibility: 'visible', opacity: 1 }}>
                            Update status and add remarks for {selectedIds.length} selected ticket(s)
                        </p>
                    </div>
                    <div className="header-actions" style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0, position: 'absolute', right: '24px', top: '50%', transform: 'translateY(-50%)' }}>
                        <span
                            onClick={handleMinimize}
                            title="Minimize (keep draft)"
                            style={{ width: '24px', height: '24px', borderRadius: '8px', border: '1px solid rgba(0, 0, 0, 0.15)', background: 'rgba(255, 255, 255, 0.9)', color: '#1f2937', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, visibility: 'visible', opacity: 1, padding: 0, minWidth: '24px', minHeight: '24px', userSelect: 'none', transition: 'all 0.2s ease' }}
                        >
                            −
                        </span>
                        <span
                            onClick={onClose}
                            title="Close and discard draft"
                            style={{ width: '24px', height: '24px', borderRadius: '8px', border: '1px solid rgba(0, 0, 0, 0.15)', background: 'rgba(255, 255, 255, 0.9)', color: '#1f2937', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, visibility: 'visible', opacity: 1, padding: 0, minWidth: '24px', minHeight: '24px', userSelect: 'none', transition: 'all 0.2s ease' }}
                        >
                            ✕
                        </span>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="bulk-resolve-modal-content">
                    {/* Status Section */}
                    <div className="bulk-resolve-section">
                        <div className="section-header">
                            <h3 className="section-title">Status (Required)</h3>
                            <div className="mode-toggle">
                                <button
                                    type="button"
                                    className={`toggle-btn ${statusMode === 'bulk' ? 'active' : ''}`}
                                    onClick={() => handleStatusModeChange('bulk')}
                                >
                                    Bulk
                                </button>
                                <button
                                    type="button"
                                    className={`toggle-btn ${statusMode === 'individual' ? 'active' : ''}`}
                                    onClick={() => handleStatusModeChange('individual')}
                                >
                                    Individual
                                </button>
                            </div>
                        </div>
                        {statusMode === 'bulk' ? (
                            <div className="common-field">
                                <select
                                    className="field-input"
                                    value={bulkStatus}
                                    onChange={(e) => setBulkStatus(e.target.value)}
                                >
                                    <option value="Restored">Restored</option>
                                    <option value="Unresolved">Unresolved</option>
                                    <option value="NoFaultFound">No Fault Found</option>
                                    <option value="AccessDenied">Access Denied</option>
                                </select>
                            </div>
                        ) : (
                            <div className="individual-fields-list">
                                {selectedTickets.map((ticket) => (
                                    <div key={ticket.ticket_id} className="individual-field-item">
                                        <div className="ticket-info-header">
                                            <span className="ticket-id-badge">{ticket.ticket_id}</span>
                                            <span className="consumer-name">
                                                {ticket.first_name} {ticket.last_name}
                                            </span>
                                        </div>
                                        <select
                                            className="field-input"
                                            value={statusData[ticket.ticket_id] || 'Restored'}
                                            onChange={(e) => handleStatusChange(ticket.ticket_id)(e.target.value)}
                                        >
                                            <option value="Restored">Restored</option>
                                            <option value="Unresolved">Unresolved</option>
                                            <option value="NoFaultFound">No Fault Found</option>
                                            <option value="AccessDenied">Access Denied</option>
                                        </select>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Remarks Section */}
                    <div className="bulk-resolve-section">
                        <div className="section-header">
                            <h3 className="section-title">Resolution Remarks (Required)</h3>
                            <div className="mode-toggle">
                                <button
                                    type="button"
                                    className={`toggle-btn ${remarksMode === 'bulk' ? 'active' : ''}`}
                                    onClick={() => handleRemarksModeChange('bulk')}
                                >
                                    Bulk
                                </button>
                                <button
                                    type="button"
                                    className={`toggle-btn ${remarksMode === 'individual' ? 'active' : ''}`}
                                    onClick={() => handleRemarksModeChange('individual')}
                                >
                                    Individual
                                </button>
                            </div>
                        </div>
                        {remarksMode === 'bulk' ? (
                            <div className="common-field">
                                <textarea
                                    className="remark-textarea"
                                    value={bulkRemarks}
                                    onChange={(e) => setBulkRemarks(e.target.value)}
                                    placeholder="Enter resolution remarks (applies to all tickets)..."
                                    rows={4}
                                />
                            </div>
                        ) : (
                            <div className="individual-fields-list">
                                {selectedTickets.map((ticket) => (
                                    <div key={ticket.ticket_id} className="ticket-remark-item">
                                        <div className="ticket-info-header">
                                            <span className="ticket-id-badge">{ticket.ticket_id}</span>
                                            <span className="consumer-name">
                                                {ticket.first_name} {ticket.last_name}
                                            </span>
                                        </div>
                                        <textarea
                                            className="remark-textarea"
                                            value={remarksData[ticket.ticket_id] || ''}
                                            onChange={(e) => handleRemarksChange(ticket.ticket_id)(e.target.value)}
                                            placeholder="Enter resolution remarks for this ticket..."
                                            rows={3}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Referred To Section */}
                    <div className="bulk-resolve-section">
                        <div className="section-header">
                            <h3 className="section-title">Referred To (Optional)</h3>
                            <div className="mode-toggle">
                                <button
                                    type="button"
                                    className={`toggle-btn ${referredToMode === 'bulk' ? 'active' : ''}`}
                                    onClick={() => handleReferredToModeChange('bulk')}
                                >
                                    Bulk
                                </button>
                                <button
                                    type="button"
                                    className={`toggle-btn ${referredToMode === 'individual' ? 'active' : ''}`}
                                    onClick={() => handleReferredToModeChange('individual')}
                                >
                                    Individual
                                </button>
                            </div>
                        </div>
                        {referredToMode === 'bulk' ? (
                            <div className="common-field">
                                <input
                                    type="text"
                                    className="field-input"
                                    value={bulkReferredTo}
                                    onChange={(e) => setBulkReferredTo(e.target.value)}
                                    placeholder="e.g., Crew Name or Department (applies to all tickets)"
                                />
                            </div>
                        ) : (
                            <div className="individual-fields-list">
                                {selectedTickets.map((ticket) => (
                                    <div key={ticket.ticket_id} className="individual-field-item">
                                        <div className="ticket-info-header">
                                            <span className="ticket-id-badge">{ticket.ticket_id}</span>
                                            <span className="consumer-name">
                                                {ticket.first_name} {ticket.last_name}
                                            </span>
                                        </div>
                                        <input
                                            type="text"
                                            className="field-input"
                                            value={referredToData[ticket.ticket_id] || ''}
                                            onChange={(e) => handleReferredToChange(ticket.ticket_id)(e.target.value)}
                                            placeholder="e.g., Crew Name or Department"
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Accomplished By Section */}
                    <div className="bulk-resolve-section">
                        <div className="section-header">
                            <h3 className="section-title">Accomplished By (Optional)</h3>
                            <div className="mode-toggle">
                                <button
                                    type="button"
                                    className={`toggle-btn ${accomplishedByMode === 'bulk' ? 'active' : ''}`}
                                    onClick={() => handleAccomplishedByModeChange('bulk')}
                                >
                                    Bulk
                                </button>
                                <button
                                    type="button"
                                    className={`toggle-btn ${accomplishedByMode === 'individual' ? 'active' : ''}`}
                                    onClick={() => handleAccomplishedByModeChange('individual')}
                                >
                                    Individual
                                </button>
                            </div>
                        </div>
                        {accomplishedByMode === 'bulk' ? (
                            <div className="common-field">
                                <div className="accomplished-by-wrapper">
                                    <input
                                        type="text"
                                        className="field-input"
                                        value={bulkAccomplishedBy}
                                        onChange={(e) => setBulkAccomplishedBy(e.target.value)}
                                        placeholder="e.g., John Doe (applies to all tickets)"
                                    />
                                    <button
                                        type="button"
                                        className="me-button"
                                        onClick={() => handleMeClick(null)}
                                        title="Use my email"
                                    >
                                        Me
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="individual-fields-list">
                                {selectedTickets.map((ticket) => (
                                    <div key={ticket.ticket_id} className="individual-field-item">
                                        <div className="ticket-info-header">
                                            <span className="ticket-id-badge">{ticket.ticket_id}</span>
                                            <span className="consumer-name">
                                                {ticket.first_name} {ticket.last_name}
                                            </span>
                                        </div>
                                        <div className="accomplished-by-wrapper">
                                            <input
                                                type="text"
                                                className="field-input"
                                                value={accomplishedByData[ticket.ticket_id] || ''}
                                                onChange={(e) => handleAccomplishedByChange(ticket.ticket_id)(e.target.value)}
                                                placeholder="e.g., John Doe"
                                            />
                                            <button
                                                type="button"
                                                className="me-button"
                                                onClick={() => handleMeClick(ticket.ticket_id)}
                                                title="Use my email"
                                            >
                                                Me
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Fixed Footer */}
                <div className="bulk-resolve-modal-footer">
                    <button
                        type="button"
                        className="btn-clear-draft"
                        onClick={handleClearDraft}
                        disabled={isSubmitting}
                    >
                        Clear Draft
                    </button>
                    <button
                        type="button"
                        className="btn-submit-resolve"
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Updating...' : `Update ${selectedIds.length} Ticket(s)`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BulkResolveModal;

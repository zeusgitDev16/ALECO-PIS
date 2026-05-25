import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiUrl } from '../../utils/api';
import { formatToPhilippineTime } from '../../utils/dateUtils';
import { formatTicketStatusLabel } from '../../utils/ticketStatusDisplay';
import TicketLocationMap from '../maps/TicketLocationMap';
import '../../CSS/TicketDetailPane.css';
import '../../CSS/TicketDashboard.css';
import DispatchTicketModal from './DispatchTicketModal';
import EditTicketModal from './EditTicketModal';
import ConfirmModal from './ConfirmModal';
import TicketHistoryLogs from './TicketHistoryLogs';
import { getSafeResourceUrl } from '../../utils/safeUrl';
import { authFetch } from '../../utils/authFetch';

/**
 * TicketDetailPane - A high-fidelity modal for viewing and updating ticket specifics.
 */
const TicketDetailPane = ({ ticket, onUpdateTicket, onDispatchGroup, onUngroup, onDeleteTicket, onClose, onRefetch, crews }) => {
    const navigate = useNavigate();
    const [copiedField, setCopiedField] = useState(null);
    const [uiScale, setUiScale] = useState(null);
    const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
    const [isGroupDispatchOpen, setIsGroupDispatchOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isUngroupConfirmOpen, setIsUngroupConfirmOpen] = useState(false);
    const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);
    const [isMemoCreating, setIsMemoCreating] = useState(false);
    const [memoCreatedData, setMemoCreatedData] = useState(null);
    const [memoCreationError, setMemoCreationError] = useState(null);
    const [isUnresolvedConfirmOpen, setIsUnresolvedConfirmOpen] = useState(false);
    const [isNoFaultFoundConfirmOpen, setIsNoFaultFoundConfirmOpen] = useState(false);
    const [isAccessDeniedConfirmOpen, setIsAccessDeniedConfirmOpen] = useState(false);
    const [resolutionRemarks, setResolutionRemarks] = useState('');
    const [referredTo, setReferredTo] = useState('');
    const [accomplishedBy, setAccomplishedBy] = useState('');
    const [replaceRemarks, setReplaceRemarks] = useState(false);
    const [isUpdatingTicketStatus, setIsUpdatingTicketStatus] = useState(false);
    const [groupData, setGroupData] = useState(null);
    const [memoControlNumber, setMemoControlNumber] = useState('');
    const [memoStatus, setMemoStatus] = useState('');
    const [isMemoLoading, setIsMemoLoading] = useState(false);
    const [isFlipped, setIsFlipped] = useState(false);

    const isGroupMaster = ticket?.ticket_id?.startsWith('GROUP-');
    const isGroupChild = !!ticket?.parent_ticket_id;
    const safeEvidenceImageUrl = ticket?.image_url ? getSafeResourceUrl(ticket.image_url) : null;
    const mainTicketId = isGroupMaster ? ticket.ticket_id : ticket?.parent_ticket_id;
    const children = groupData?.children || [];

    // Helper function to refetch memo status after ticket update
    const refetchMemoStatus = (serviceMemoId) => {
        if (!serviceMemoId) return;
        const memoId = Number(serviceMemoId);
        authFetch(apiUrl(`/api/service-memos/${memoId}`))
            .then((res) => res.json().catch(() => null))
            .then((json) => {
                const status = String(json?.data?.memo_status || '').trim();
                setMemoStatus(status);
            })
            .catch(() => {
                setMemoStatus('');
            });
    };

    // Fetch group with children when viewing a GROUP master
    useEffect(() => {
        if (ticket?.ticket_id?.startsWith('GROUP-')) {
            fetch(apiUrl(`/api/tickets/group/${ticket.ticket_id}`))
                .then(res => res.json())
                .then(data => data.success ? setGroupData(data.data) : setGroupData(null))
                .catch(() => setGroupData(null));
        } else {
            setGroupData(null);
        }
    }, [ticket?.ticket_id]);

    useEffect(() => {
        let active = true;
        const memoId = Number(ticket?.service_memo_id);
        const shouldLoadMemo = Number.isFinite(memoId) && memoId > 0 && !isGroupMaster;

        if (!shouldLoadMemo) {
            setMemoControlNumber('');
            setIsMemoLoading(false);
            return () => {
                active = false;
            };
        }

        setIsMemoLoading(true);
        authFetch(apiUrl(`/api/service-memos/${memoId}`))
            .then((res) => res.json().catch(() => null))
            .then((json) => {
                if (!active) return;
                const controlNo = String(json?.data?.control_number || '').trim();
                const status = String(json?.data?.memo_status || '').trim();
                setMemoControlNumber(controlNo);
                setMemoStatus(status);
            })
            .catch(() => {
                if (!active) return;
                setMemoControlNumber('');
                setMemoStatus('');
            })
            .finally(() => {
                if (!active) return;
                setIsMemoLoading(false);
            });

        return () => {
            active = false;
        };
    }, [ticket?.service_memo_id, isGroupMaster]);

    // Add/remove modal-open class to body to prevent sticky header overlap
    useEffect(() => {
        document.body.classList.add('modal-open');

        return () => {
            document.body.classList.remove('modal-open');
        };
    }, []);

    // TicketDetailPane renders outside .tickets-page-container; copy its --ticket-ui-scale to this modal.
    useEffect(() => {
        try {
            const el = document.querySelector('.tickets-page-container');
            if (!el) return;
            const v = window.getComputedStyle(el).getPropertyValue('--ticket-ui-scale');
            const trimmed = String(v || '').trim();
            if (trimmed) setUiScale(trimmed);
        } catch {
            /* leave null => CSS falls back to 1 */
        }
    }, []);

    // 1. Idempotent Guard
    if (!ticket) return null;

    // 2. Formatting Helpers
    const formattedDate = formatToPhilippineTime(ticket.created_at);

    const fullName = `${ticket.first_name} ${ticket.middle_name || ''} ${ticket.last_name}`.replace(/\s+/g, ' ').trim();

    // 3. Clipboard Logic
    const handleCopy = (text, fieldName) => {
        if (!text) return;
        
        navigator.clipboard.writeText(text).then(() => {
            setCopiedField(fieldName);
            // Reset the "Copied!" message back to "Copy" after 2 seconds
            setTimeout(() => setCopiedField(null), 2000);
        }).catch(err => console.error("Failed to copy text: ", err));
    };

    // 4. One-click Create Service Memo Handler
    const handleCreateServiceMemo = async () => {
        setIsMemoCreating(true);
        setMemoCreationError(null);
        setMemoCreatedData(null);

        try {
            if (isGroupMaster) {
                // Group ticket: fetch children and create bulk memos
                const groupRes = await authFetch(apiUrl(`/api/tickets/group/${ticket.ticket_id}`));
                const groupData = await groupRes.json();
                
                if (!groupData.success || !groupData.data?.children) {
                    throw new Error('Failed to fetch group children');
                }

                const childTicketIds = groupData.data.children.map(c => c.ticket_id);
                
                const bulkRes = await authFetch(apiUrl('/api/service-memos/bulk'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ticket_ids: childTicketIds }),
                });
                
                const bulkResult = await bulkRes.json();
                
                if (bulkResult.success) {
                    setMemoCreatedData({
                        type: 'bulk',
                        created: bulkResult.data.created || [],
                        skipped: bulkResult.data.skipped || [],
                    });
                    if (onRefetch) onRefetch();
                } else {
                    setMemoCreationError(bulkResult.message || 'Failed to create service memos');
                }
            } else {
                // Individual ticket: create single memo
                const res = await authFetch(apiUrl('/api/service-memos'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ticket_id: ticket.ticket_id }),
                });
                
                const result = await res.json();
                
                if (result.success) {
                    setMemoCreatedData({
                        type: 'single',
                        control_number: result.data.control_number,
                        id: result.data.id,
                    });
                    if (onRefetch) onRefetch();
                } else {
                    setMemoCreationError(result.message || 'Failed to create service memo');
                }
            }
        } catch (error) {
            console.error('Create service memo error:', error);
            setMemoCreationError('Network error. Please try again.');
        } finally {
            setIsMemoCreating(false);
        }
    };

    return (
        <div
            className="ticket-modal-overlay"
            onClick={onClose}
            style={uiScale ? { '--ticket-ui-scale': uiScale } : undefined}
        >
            <div className="ticket-modal-content" onClick={(e) => e.stopPropagation()}>
                
                <button className="ticket-modal-close-btn" onClick={onClose} aria-label="Close Modal">
                    &times;
                </button>

                <div className="ticket-detail-flip-container">
                    <div className={`ticket-detail-flip-inner ${isFlipped ? 'flipped' : ''}`}>
                        <div className="ticket-detail-front">
                {/* --- SECTION 1: HEADER --- */}
                <div className="detail-header">
                    <div className="detail-header-align-shell">
                        <div className="header-left">
                            <h2
                                className={`detail-title detail-title-copyable ${copiedField === 'ticketId' ? 'copied' : ''}`}
                                onClick={() => handleCopy(ticket.ticket_id, 'ticketId')}
                                title={copiedField === 'ticketId' ? 'Copied' : 'Click to copy Ticket ID'}
                            >
                                {ticket.ticket_id}
                            </h2>
                            <div className="header-badges">
                                <span className={`status-tag ${ticket.status?.toLowerCase()}`}>
                                    {ticket.status}
                                </span>
                            </div>
                        </div>
                        <div className="header-right">
                            <div className="reported-date">{formattedDate}</div>
                        </div>
                    </div>
                </div>

                {/* Resolution stepper: 1) Dispatch → 2) In Progress → 3) Resolved */}
                <div className="resolution-stepper">
                    <div className={`stepper-step ${['Pending', 'Unresolved'].includes(ticket.status) ? 'active' : ''} ${['Ongoing', 'Restored', 'Unresolved', 'NoFaultFound', 'AccessDenied'].includes(ticket.status) ? 'done' : ''}`}>
                        <span className="stepper-num">1</span>
                        <span className="stepper-label stepper-label-full">Dispatch</span>
                        <span className="stepper-label stepper-label-short" aria-hidden="true">Disp</span>
                    </div>
                    <div className="stepper-connector" />
                    <div className={`stepper-step ${['Ongoing'].includes(ticket.status) ? 'active' : ''} ${['Restored', 'Unresolved', 'NoFaultFound', 'AccessDenied'].includes(ticket.status) ? 'done' : ''}`}>
                        <span className="stepper-num">2</span>
                        <span className="stepper-label stepper-label-full">In Progress</span>
                        <span className="stepper-label stepper-label-short" aria-hidden="true">Prog</span>
                    </div>
                    <div className="stepper-connector" />
                    <div className={`stepper-step ${['Restored', 'NoFaultFound', 'AccessDenied'].includes(ticket.status) ? 'active' : ''}`}>
                        <span className="stepper-num">3</span>
                        <span className="stepper-label stepper-label-full">Resolved</span>
                        <span className="stepper-label stepper-label-short" aria-hidden="true">Done</span>
                    </div>
                </div>

                <hr className="detail-divider" />

                {/* --- SCROLLABLE BODY (middle only; footer stays fixed like advisory modal) --- */}
                <div className="ticket-detail-scroll-outer">
                <div className="ticket-detail-body-scroll">
                {/* --- SECTION 2: REPORTER & SYSTEM INFO --- */}
                <div className="detail-grid">
                    {!isGroupMaster && (
                        <>
                            {ticket.is_manual === 1 && (
                                <div className="detail-group">
                                    <span className="manual-badge" title="Created manually by dispatcher" style={{ display: 'inline-block' }}>
                                        Manually Created
                                    </span>
                                </div>
                            )}
                            <div className="detail-group">
                                <label>Memo Link</label>
                                <p className="detail-value memo-link-highlight">
                                    {isMemoLoading
                                        ? 'Loading memo...'
                                        : (memoControlNumber || 'No memo yet')}
                                </p>
                            </div>
                            <div className="detail-group">
                                <label>Reporter Name</label>
                                <p className="detail-value">{fullName}</p>
                            </div>
                            {/* UPGRADED: Copyable Contact Number */}
                            <div className="detail-group">
                                <label>Contact Number</label>
                                <div 
                                    className="detail-value copyable-box" 
                                    onClick={() => handleCopy(ticket.phone_number, 'phone')}
                                >
                                    <span>{ticket.phone_number}</span>
                                    <span className={`copy-indicator ${copiedField === 'phone' ? 'success' : ''}`}>
                                        {copiedField === 'phone' ? '✓ Copied' : '📋 Copy'}
                                    </span>
                                </div>
                            </div>
                            {/* UPGRADED: Copyable Account Number (Only if it exists) */}
                            <div className="detail-group">
                                <label>Account Number</label>
                                {ticket.account_number ? (
                                    <div 
                                        className="detail-value copyable-box" 
                                        onClick={() => handleCopy(ticket.account_number, 'account')}
                                    >
                                        <span>{ticket.account_number}</span>
                                        <span className={`copy-indicator ${copiedField === 'account' ? 'success' : ''}`}>
                                            {copiedField === 'account' ? '✓ Copied' : '📋 Copy'}
                                        </span>
                                    </div>
                                ) : (
                                    <p className="detail-value">Unlinked Account</p>
                                )}
                            </div>
                        </>
                    )}

                    <div className="detail-group">
                        <label>Issue Category</label>
                        <p className="detail-value category-highlight">{ticket.category}</p>
                    </div>
                    
                    <div className="detail-group full-width">
                        <label>Service Location</label>
                        <p className="detail-value location-text">
                            📍 {ticket.address ? `${ticket.address}, ` : ''}
                            {ticket.purok ? `Purok ${ticket.purok}, ` : ''}
                            {ticket.barangay ? `${ticket.barangay}, ` : ''}
                            {ticket.municipality || '—'}
                            <br />
                            <small className="district-sub">{ticket.district || ''}</small>
                        </p>
                    </div>

                    {ticket.reported_lat && ticket.reported_lng && (
                        <div className="detail-group full-width">
                            <label>Map Location</label>
                            <TicketLocationMap
                                latitude={Number(ticket.reported_lat)}
                                longitude={Number(ticket.reported_lng)}
                                accuracy={ticket.location_accuracy ?? null}
                                municipality={ticket.municipality}
                                district={ticket.district}
                            />
                            <div className="ticket-map-actions">
                                <a
                                    className="ticket-map-external-link"
                                    href={`https://maps.google.com/?q=${ticket.reported_lat},${ticket.reported_lng}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    View on Google Maps
                                </a>
                            </div>
                        </div>
                    )}
                </div>

                {/* --- SECTION 3: CONTENT & EVIDENCE --- */}
                <div className="detail-content-section">
                    {isGroupMaster && (
                        <div className="detail-group full-width">
                            <label>Group Title</label>
                            <p className="detail-value">{ticket.address}</p>
                        </div>
                    )}
                    <div className="detail-group">
                        <label>{isGroupMaster ? 'Summary / Remarks' : "User's Concern"}</label>
                        <div className="concern-box">
                            {ticket.concern}
                        </div>
                    </div>

                    <div className="detail-group">
                        <label>Action Desired</label>
                        <div className="concern-box">
                            {ticket.action_desired || '—'}
                        </div>
                    </div>

                    {isGroupMaster && children.length > 0 && (
                        <div className="detail-group full-width group-children-section">
                            <label>Child Tickets ({children.length})</label>
                            <ul className="group-children-list">
                                {children.map((c) => {
                                    const childLocation = c.municipality
                                        ? `${c.municipality}, ${c.district || 'Albay'}`
                                        : (c.address || '—');
                                    const statusKey = c.status ? c.status.toLowerCase().replace(/\s/g, '') : 'pending';
                                    return (
                                        <li key={c.ticket_id} className="group-child-item">
                                            <div className="group-child-top">
                                                <span className="child-id">{c.ticket_id}</span>
                                                <span className="child-category">{c.category}</span>
                                            </div>
                                            <div className="card-footer-metadata group-child-foot">
                                                <div className="location-scroll-wrapper">
                                                    <span className="location-text-full">{childLocation}</span>
                                                </div>
                                                <span className={`status-pill-solid ${statusKey}`}>
                                                    {formatTicketStatusLabel(c.status)}
                                                </span>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}

                    {safeEvidenceImageUrl && (
                        <div className="detail-group evidence-section">
                            <label>Attached Evidence</label>
                            <div className="image-wrapper">
                                <img 
                                    src={safeEvidenceImageUrl} 
                                    alt="Technical Evidence" 
                                    className="evidence-img" 
                                    onClick={() => window.open(safeEvidenceImageUrl, '_blank', 'noopener,noreferrer')}
                                />
                                <span className="image-hint">Click image to expand</span>
                            </div>
                        </div>
                    )}

                    {(ticket.assigned_crew || ticket.eta || ticket.dispatch_notes || ticket.concern_resolution_notes) && ['Ongoing', 'Restored', 'Unresolved', 'NoFaultFound', 'AccessDenied'].includes(ticket.status) && (
                        <div className="detail-group dispatch-info-section">
                            <label>{ticket.concern_resolution_notes ? 'Resolution Info' : 'Dispatch Info'}</label>
                            <div className="dispatch-info-box">
                                {ticket.assigned_crew && <p><strong>Crew:</strong> {ticket.assigned_crew}</p>}
                                {ticket.eta && <p><strong>ETA:</strong> {ticket.eta}</p>}
                                {ticket.dispatch_notes && <p><strong>Notes:</strong> {ticket.dispatch_notes}</p>}
                                {ticket.concern_resolution_notes && <p><strong>Concern Notes:</strong> {ticket.concern_resolution_notes}</p>}
                            </div>
                        </div>
                    )}

                    {ticket.lineman_remarks && (
                        <div className="detail-group lineman-remarks-section">
                            <label>Field Technician Remarks</label>
                            <div className="lineman-remarks-box">
                                {ticket.lineman_remarks}
                            </div>
                        </div>
                    )}
                </div>
                </div>
                </div>

                {/* --- SECTION 4: ADMIN ACTIONS (fixed footer, never scrolls) --- */}
                <div className={`action-footer ${ticket.status === 'Pending' ? 'pending' : ''}`}>
                    {!isGroupMaster && !isGroupChild && (
                        <>
                            <button
                                type="button"
                                className="btn-action btn-edit"
                                onClick={() => setIsEditModalOpen(true)}
                                title="Edit Ticket"
                            >
                                Edit Ticket
                            </button>
                            {onDeleteTicket && (
                                <button
                                    type="button"
                                    className="btn-action btn-delete"
                                    onClick={() => setIsDeleteConfirmOpen(true)}
                                    title="Delete Ticket"
                                >
                                    Delete Ticket
                                </button>
                            )}
                        </>
                    )}
                    
                    {!isGroupChild && (!ticket.service_memo_id || isGroupMaster) && (
                        <button
                            type="button"
                            className="btn-action btn-create-memo"
                            onClick={handleCreateServiceMemo}
                            disabled={isMemoCreating}
                            title="Create Service Memo"
                        >
                            {isMemoCreating ? 'Creating...' : 'Create Service Memo'}
                        </button>
                    )}
                    
                    {ticket.status !== 'Pending' && (
                        <>
                            {['Unresolved'].includes(ticket.status) && (
                                <>
                                    {isGroupMaster ? (
                                        onDispatchGroup && (
                                            <button
                                                className="btn-action btn-ongoing"
                                                onClick={() => setIsGroupDispatchOpen(true)}
                                                title="Re-dispatch (Dispatch All)"
                                            >
                                                Re-dispatch (Dispatch All)
                                            </button>
                                        )
                                    ) : (
                                        <>
                                            <button
                                                className="btn-action btn-ongoing"
                                                onClick={() => setIsDispatchModalOpen(true)}
                                                title="Re-dispatch"
                                            >
                                                Re-dispatch
                                            </button>
                                            {isGroupChild && onDispatchGroup && (
                                                <button
                                                    className="btn-action btn-ongoing"
                                                    onClick={() => setIsGroupDispatchOpen(true)}
                                                    title="Dispatch All"
                                                >
                                                    Dispatch All
                                                </button>
                                            )}
                                        </>
                                    )}
                                </>
                            )}

                            {(isGroupMaster || isGroupChild) && mainTicketId && onUngroup && (
                                <button
                                    className="btn-action btn-ungroup"
                                    onClick={() => setIsUngroupConfirmOpen(true)}
                                    title="Ungroup"
                                >
                                    Ungroup
                                </button>
                            )}

                            <button
                                className="btn-action btn-resolved"
                                onClick={() => {
                                    setResolutionRemarks('');
                                    setReferredTo('');
                                    setAccomplishedBy('');
                                    setReplaceRemarks(false);
                                    setIsRestoreConfirmOpen(true);
                                }}
                                title="Mark as Restored"
                            >
                                Mark as Restored
                            </button>

                            <button
                                className="btn-action btn-unresolved"
                                onClick={() => {
                                    setResolutionRemarks('');
                                    setReferredTo('');
                                    setAccomplishedBy('');
                                    setReplaceRemarks(false);
                                    setIsUnresolvedConfirmOpen(true);
                                }}
                                title="Mark as Unresolved"
                            >
                                Mark as Unresolved
                            </button>
                            <button
                                className="btn-action btn-nff"
                                onClick={() => {
                                    setResolutionRemarks('');
                                    setReferredTo('');
                                    setAccomplishedBy('');
                                    setReplaceRemarks(false);
                                    setIsNoFaultFoundConfirmOpen(true);
                                }}
                                title="No Fault Found"
                            >
                                No Fault Found
                            </button>
                            <button
                                className="btn-action btn-access-denied"
                                onClick={() => {
                                    setResolutionRemarks('');
                                    setReferredTo('');
                                    setAccomplishedBy('');
                                    setReplaceRemarks(false);
                                    setIsAccessDeniedConfirmOpen(true);
                                }}
                                title="Access Denied"
                            >
                                Access Denied
                            </button>
                        </>
                    )}
                </div>
                        </div>

                        <div className="ticket-detail-back">
                            <div className="ticket-history-header">
                                <h3 className="ticket-history-title">Ticket History</h3>
                                <p className="ticket-history-subtitle">{ticket.ticket_id} — All actions by dispatchers and field crew</p>
                            </div>
                            <div className="ticket-detail-back-scroll">
                                <TicketHistoryLogs ticketId={ticket.ticket_id} isVisible={isFlipped} />
                            </div>
                        </div>
                    </div>
                    <button type="button" className="flip-toggle-btn" onClick={() => setIsFlipped(v => !v)} title={isFlipped ? 'View Details' : 'View History'}>
                        {isFlipped ? 'View Details' : 'View History'}
                    </button>
                </div>
            </div>

            <DispatchTicketModal 
                isOpen={isDispatchModalOpen}
                onClose={() => setIsDispatchModalOpen(false)}
                ticket={ticket}
                crews={crews}
                onSubmit={(dispatchData) => {
                    onUpdateTicket(ticket.ticket_id, 'Ongoing', dispatchData);
                    setIsDispatchModalOpen(false);
                    onClose(); 
                }}
            />

            <EditTicketModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                ticket={ticket}
                onSuccess={() => {
                    onRefetch?.();
                }}
            />

            <ConfirmModal
                isOpen={isDeleteConfirmOpen}
                onClose={() => setIsDeleteConfirmOpen(false)}
                onConfirm={() => {
                    onDeleteTicket?.(ticket.ticket_id);
                }}
                title="Permanently Delete Ticket"
                message={`This will permanently delete ticket ${ticket.ticket_id} and remove any uploaded image from storage. This action cannot be undone.`}
                confirmLabel="Permanently Delete"
                cancelLabel="Cancel"
                variant="danger"
                requireConfirmText={ticket.ticket_id}
            />

            <ConfirmModal
                isOpen={isUngroupConfirmOpen}
                onClose={() => setIsUngroupConfirmOpen(false)}
                onConfirm={() => {
                    onUngroup?.(mainTicketId);
                }}
                title="Dissolve Group"
                message="All tickets will become standalone. Continue?"
                confirmLabel="Dissolve"
                cancelLabel="Cancel"
                variant="ungroup"
            />

            <ConfirmModal
                isOpen={isRestoreConfirmOpen}
                onClose={() => setIsRestoreConfirmOpen(false)}
                onConfirm={async () => {
                    if (!resolutionRemarks.trim()) {
                        alert('Resolution remarks are required.');
                        return;
                    }
                    if (replaceRemarks && !confirm('This will overwrite existing remarks and referred_to. Continue?')) {
                        return;
                    }
                    setIsUpdatingTicketStatus(true);
                    try {
                        await onUpdateTicket(ticket.ticket_id, 'Restored', null, resolutionRemarks, referredTo, replaceRemarks, accomplishedBy);
                        // Refetch memo status after update
                        refetchMemoStatus(ticket.service_memo_id);
                        setIsRestoreConfirmOpen(false);
                        onClose();
                    } catch (error) {
                        console.error('Error updating ticket status:', error);
                        alert('Failed to update ticket status. Please try again.');
                    } finally {
                        setIsUpdatingTicketStatus(false);
                    }
                }}
                title="Mark as Restored"
                message={
                    <>
                        Mark ticket {ticket.ticket_id} as Restored? This will close the ticket. Only confirm if resolution has been completed.
                        {memoStatus && memoStatus !== 'saved' && memoStatus !== 'deployed' && (
                            <p style={{ marginTop: '12px', color: '#d32f2f', fontWeight: '600' }}>
                                ⚠️ Warning: This ticket has a service memo that is already closed (status: {memoStatus}). Changing the status will update the memo again.
                            </p>
                        )}
                    </>
                }
                confirmLabel={isUpdatingTicketStatus ? 'Updating...' : 'Mark Restored'}
                cancelLabel="Cancel"
                variant="success"
                disabled={isUpdatingTicketStatus}
            >
                <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '0.9rem' }}>
                        Resolution Remarks (Required)
                    </label>
                    <textarea
                        value={resolutionRemarks}
                        onChange={(e) => setResolutionRemarks(e.target.value)}
                        placeholder="Describe the resolution details..."
                        rows={3}
                        style={{
                            width: '100%',
                            padding: '8px 10px',
                            fontSize: '0.9rem',
                            border: '1.5px solid #ccc',
                            borderRadius: '6px',
                            boxSizing: 'border-box',
                            outline: 'none',
                            resize: 'vertical',
                            marginBottom: '12px',
                        }}
                        autoFocus
                    />
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '0.9rem' }}>
                        Referred To (Optional)
                    </label>
                    <input
                        type="text"
                        value={referredTo}
                        onChange={(e) => setReferredTo(e.target.value)}
                        placeholder="e.g., Maintenance Department, External Contractor"
                        style={{
                            width: '100%',
                            padding: '8px 10px',
                            fontSize: '0.9rem',
                            border: '1.5px solid #ccc',
                            borderRadius: '6px',
                            boxSizing: 'border-box',
                            outline: 'none',
                            marginBottom: '12px',
                        }}
                    />
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '0.9rem' }}>
                        Accomplished By (Optional)
                    </label>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                        <input
                            type="text"
                            value={accomplishedBy}
                            onChange={(e) => setAccomplishedBy(e.target.value)}
                            placeholder="Name of person who accomplished the task"
                            style={{
                                flex: 1,
                                padding: '8px 10px',
                                fontSize: '0.9rem',
                                border: '1.5px solid #ccc',
                                borderRadius: '6px',
                                boxSizing: 'border-box',
                                outline: 'none',
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => {
                                const currentUserName = typeof localStorage !== 'undefined' ? localStorage.getItem('userName') : '';
                                setAccomplishedBy(currentUserName || '');
                            }}
                            style={{
                                padding: '8px 16px',
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                border: '1.5px solid #3b82f6',
                                borderRadius: '6px',
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            Me
                        </button>
                    </div>
                    {memoStatus && memoStatus !== 'saved' && memoStatus !== 'deployed' && (
                        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e0e0e0' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                                <input
                                    type="checkbox"
                                    checked={replaceRemarks}
                                    onChange={(e) => setReplaceRemarks(e.target.checked)}
                                    style={{ cursor: 'pointer' }}
                                />
                                Replace existing remarks and referred_to
                            </label>
                        </div>
                    )}
                </div>
            </ConfirmModal>

            <ConfirmModal
                isOpen={isUnresolvedConfirmOpen}
                onClose={() => setIsUnresolvedConfirmOpen(false)}
                onConfirm={async () => {
                    if (!resolutionRemarks.trim()) {
                        alert('Resolution remarks are required.');
                        return;
                    }
                    if (replaceRemarks && !confirm('This will overwrite existing remarks and referred_to. Continue?')) {
                        return;
                    }
                    setIsUpdatingTicketStatus(true);
                    try {
                        await onUpdateTicket(ticket.ticket_id, 'Unresolved', null, resolutionRemarks, referredTo, replaceRemarks, accomplishedBy);
                        // Refetch memo status after update
                        refetchMemoStatus(ticket.service_memo_id);
                        setIsUnresolvedConfirmOpen(false);
                        onClose();
                    } catch (error) {
                        console.error('Error updating ticket status:', error);
                        alert('Failed to update ticket status. Please try again.');
                    } finally {
                        setIsUpdatingTicketStatus(false);
                    }
                }}
                title="Mark as Unresolved"
                message={
                    <>
                        Mark ticket {ticket.ticket_id} as Unresolved? The ticket will return to the queue for re-dispatch.
                        {memoStatus && memoStatus !== 'saved' && memoStatus !== 'deployed' && (
                            <p style={{ marginTop: '12px', color: '#d32f2f', fontWeight: '600' }}>
                                ⚠️ Warning: This ticket has a service memo that is already closed (status: {memoStatus}). Changing the status will update the memo again.
                            </p>
                        )}
                    </>
                }
                confirmLabel={isUpdatingTicketStatus ? 'Updating...' : 'Mark Unresolved'}
                cancelLabel="Cancel"
                variant="unresolved"
                disabled={isUpdatingTicketStatus}
            >
                <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '0.9rem' }}>
                        Resolution Remarks (Required)
                    </label>
                    <textarea
                        value={resolutionRemarks}
                        onChange={(e) => setResolutionRemarks(e.target.value)}
                        placeholder="Describe why the ticket could not be resolved..."
                        rows={3}
                        style={{
                            width: '100%',
                            padding: '8px 10px',
                            fontSize: '0.9rem',
                            border: '1.5px solid #ccc',
                            borderRadius: '6px',
                            boxSizing: 'border-box',
                            outline: 'none',
                            resize: 'vertical',
                            marginBottom: '12px',
                        }}
                        autoFocus
                    />
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '0.9rem' }}>
                        Referred To (Optional)
                    </label>
                    <input
                        type="text"
                        value={referredTo}
                        onChange={(e) => setReferredTo(e.target.value)}
                        placeholder="e.g., Maintenance Department, External Contractor"
                        style={{
                            width: '100%',
                            padding: '8px 10px',
                            fontSize: '0.9rem',
                            border: '1.5px solid #ccc',
                            borderRadius: '6px',
                            boxSizing: 'border-box',
                            outline: 'none',
                            marginBottom: '12px',
                        }}
                    />
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '0.9rem' }}>
                        Accomplished By (Optional)
                    </label>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                        <input
                            type="text"
                            value={accomplishedBy}
                            onChange={(e) => setAccomplishedBy(e.target.value)}
                            placeholder="Name of person who accomplished the task"
                            style={{
                                flex: 1,
                                padding: '8px 10px',
                                fontSize: '0.9rem',
                                border: '1.5px solid #ccc',
                                borderRadius: '6px',
                                boxSizing: 'border-box',
                                outline: 'none',
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => {
                                const currentUserName = typeof localStorage !== 'undefined' ? localStorage.getItem('userName') : '';
                                setAccomplishedBy(currentUserName || '');
                            }}
                            style={{
                                padding: '8px 16px',
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                border: '1.5px solid #3b82f6',
                                borderRadius: '6px',
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            Me
                        </button>
                    </div>
                    {memoStatus && memoStatus !== 'saved' && memoStatus !== 'deployed' && (
                        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e0e0e0' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                                <input
                                    type="checkbox"
                                    checked={replaceRemarks}
                                    onChange={(e) => setReplaceRemarks(e.target.checked)}
                                    style={{ cursor: 'pointer' }}
                                />
                                Replace existing remarks and referred_to
                            </label>
                        </div>
                    )}
                </div>
            </ConfirmModal>

            <ConfirmModal
                isOpen={isNoFaultFoundConfirmOpen}
                onClose={() => setIsNoFaultFoundConfirmOpen(false)}
                onConfirm={async () => {
                    if (!resolutionRemarks.trim()) {
                        alert('Resolution remarks are required.');
                        return;
                    }
                    if (replaceRemarks && !confirm('This will overwrite existing remarks and referred_to. Continue?')) {
                        return;
                    }
                    setIsUpdatingTicketStatus(true);
                    try {
                        await onUpdateTicket(ticket.ticket_id, 'NoFaultFound', null, resolutionRemarks, referredTo, replaceRemarks, accomplishedBy);
                        // Refetch memo status after update
                        refetchMemoStatus(ticket.service_memo_id);
                        setIsNoFaultFoundConfirmOpen(false);
                        onClose();
                    } catch (error) {
                        console.error('Error updating ticket status:', error);
                        alert('Failed to update ticket status. Please try again.');
                    } finally {
                        setIsUpdatingTicketStatus(false);
                    }
                }}
                title="No Fault Found"
                message={
                    <>
                        Mark ticket {ticket.ticket_id} as No Fault Found? This will close the ticket. Only confirm if the field crew verified no fault at the location.
                        {memoStatus && memoStatus !== 'saved' && memoStatus !== 'deployed' && (
                            <p style={{ marginTop: '12px', color: '#d32f2f', fontWeight: '600' }}>
                                ⚠️ Warning: This ticket has a service memo that is already closed (status: {memoStatus}). Changing the status will update the memo again.
                            </p>
                        )}
                    </>
                }
                confirmLabel={isUpdatingTicketStatus ? 'Updating...' : 'No Fault Found'}
                cancelLabel="Cancel"
                variant="nff"
                disabled={isUpdatingTicketStatus}
            >
                <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '0.9rem' }}>
                        Resolution Remarks (Required)
                    </label>
                    <textarea
                        value={resolutionRemarks}
                        onChange={(e) => setResolutionRemarks(e.target.value)}
                        placeholder="Describe the verification results..."
                        rows={3}
                        style={{
                            width: '100%',
                            padding: '8px 10px',
                            fontSize: '0.9rem',
                            border: '1.5px solid #ccc',
                            borderRadius: '6px',
                            boxSizing: 'border-box',
                            outline: 'none',
                            resize: 'vertical',
                            marginBottom: '12px',
                        }}
                        autoFocus
                    />
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '0.9rem' }}>
                        Referred To (Optional)
                    </label>
                    <input
                        type="text"
                        value={referredTo}
                        onChange={(e) => setReferredTo(e.target.value)}
                        placeholder="e.g., Maintenance Department, External Contractor"
                        style={{
                            width: '100%',
                            padding: '8px 10px',
                            fontSize: '0.9rem',
                            border: '1.5px solid #ccc',
                            borderRadius: '6px',
                            boxSizing: 'border-box',
                            outline: 'none',
                            marginBottom: '12px',
                        }}
                    />
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '0.9rem' }}>
                        Accomplished By (Optional)
                    </label>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                        <input
                            type="text"
                            value={accomplishedBy}
                            onChange={(e) => setAccomplishedBy(e.target.value)}
                            placeholder="Name of person who accomplished the task"
                            style={{
                                flex: 1,
                                padding: '8px 10px',
                                fontSize: '0.9rem',
                                border: '1.5px solid #ccc',
                                borderRadius: '6px',
                                boxSizing: 'border-box',
                                outline: 'none',
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => {
                                const currentUserName = typeof localStorage !== 'undefined' ? localStorage.getItem('userName') : '';
                                setAccomplishedBy(currentUserName || '');
                            }}
                            style={{
                                padding: '8px 16px',
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                border: '1.5px solid #3b82f6',
                                borderRadius: '6px',
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            Me
                        </button>
                    </div>
                    {memoStatus && memoStatus !== 'saved' && memoStatus !== 'deployed' && (
                        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e0e0e0' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                                <input
                                    type="checkbox"
                                    checked={replaceRemarks}
                                    onChange={(e) => setReplaceRemarks(e.target.checked)}
                                    style={{ cursor: 'pointer' }}
                                />
                                Replace existing remarks and referred_to
                            </label>
                        </div>
                    )}
                </div>
            </ConfirmModal>

            <ConfirmModal
                isOpen={isAccessDeniedConfirmOpen}
                onClose={() => setIsAccessDeniedConfirmOpen(false)}
                onConfirm={async () => {
                    if (!resolutionRemarks.trim()) {
                        alert('Resolution remarks are required.');
                        return;
                    }
                    if (replaceRemarks && !confirm('This will overwrite existing remarks and referred_to. Continue?')) {
                        return;
                    }
                    setIsUpdatingTicketStatus(true);
                    try {
                        await onUpdateTicket(ticket.ticket_id, 'AccessDenied', null, resolutionRemarks, referredTo, replaceRemarks, accomplishedBy);
                        // Refetch memo status after update
                        refetchMemoStatus(ticket.service_memo_id);
                        setIsAccessDeniedConfirmOpen(false);
                        onClose();
                    } catch (error) {
                        console.error('Error updating ticket status:', error);
                        alert('Failed to update ticket status. Please try again.');
                    } finally {
                        setIsUpdatingTicketStatus(false);
                    }
                }}
                title="Access Denied"
                message={
                    <>
                        Mark ticket {ticket.ticket_id} as Access Denied? This will close the ticket. Only confirm if the field crew could not access the service location.
                        {memoStatus && memoStatus !== 'saved' && memoStatus !== 'deployed' && (
                            <p style={{ marginTop: '12px', color: '#d32f2f', fontWeight: '600' }}>
                                ⚠️ Warning: This ticket has a service memo that is already closed (status: {memoStatus}). Changing the status will update the memo again.
                            </p>
                        )}
                    </>
                }
                confirmLabel={isUpdatingTicketStatus ? 'Updating...' : 'Access Denied'}
                cancelLabel="Cancel"
                variant="access-denied"
                disabled={isUpdatingTicketStatus}
            >
                <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '0.9rem' }}>
                        Resolution Remarks (Required)
                    </label>
                    <textarea
                        value={resolutionRemarks}
                        onChange={(e) => setResolutionRemarks(e.target.value)}
                        placeholder="Describe why access was denied..."
                        rows={3}
                        style={{
                            width: '100%',
                            padding: '8px 10px',
                            fontSize: '0.9rem',
                            border: '1.5px solid #ccc',
                            borderRadius: '6px',
                            boxSizing: 'border-box',
                            outline: 'none',
                            resize: 'vertical',
                            marginBottom: '12px',
                        }}
                        autoFocus
                    />
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '0.9rem' }}>
                        Referred To (Optional)
                    </label>
                    <input
                        type="text"
                        value={referredTo}
                        onChange={(e) => setReferredTo(e.target.value)}
                        placeholder="e.g., Maintenance Department, External Contractor"
                        style={{
                            width: '100%',
                            padding: '8px 10px',
                            fontSize: '0.9rem',
                            border: '1.5px solid #ccc',
                            borderRadius: '6px',
                            boxSizing: 'border-box',
                            outline: 'none',
                            marginBottom: '12px',
                        }}
                    />
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '0.9rem' }}>
                        Accomplished By (Optional)
                    </label>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                        <input
                            type="text"
                            value={accomplishedBy}
                            onChange={(e) => setAccomplishedBy(e.target.value)}
                            placeholder="Name of person who accomplished the task"
                            style={{
                                flex: 1,
                                padding: '8px 10px',
                                fontSize: '0.9rem',
                                border: '1.5px solid #ccc',
                                borderRadius: '6px',
                                boxSizing: 'border-box',
                                outline: 'none',
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => {
                                const currentUserName = typeof localStorage !== 'undefined' ? localStorage.getItem('userName') : '';
                                setAccomplishedBy(currentUserName || '');
                            }}
                            style={{
                                padding: '8px 16px',
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                border: '1.5px solid #3b82f6',
                                borderRadius: '6px',
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            Me
                        </button>
                    </div>
                    {memoStatus && memoStatus !== 'saved' && memoStatus !== 'deployed' && (
                        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e0e0e0' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                                <input
                                    type="checkbox"
                                    checked={replaceRemarks}
                                    onChange={(e) => setReplaceRemarks(e.target.checked)}
                                    style={{ cursor: 'pointer' }}
                                />
                                Replace existing remarks and referred_to
                            </label>
                        </div>
                    )}
                </div>
            </ConfirmModal>

            {/* Memo Creation Success Modal */}
            {memoCreatedData && (
                <ConfirmModal
                    isOpen={!!memoCreatedData}
                    onClose={() => {
                        setMemoCreatedData(null);
                        onClose();
                    }}
                    onConfirm={() => {
                        if (memoCreatedData.type === 'single') {
                            // Dispatch custom event to open service memo modal
                            window.dispatchEvent(new CustomEvent('aleco:open-service-memo', { 
                                detail: { memoId: memoCreatedData.id, mode: 'edit' }
                            }));
                            setMemoCreatedData(null);
                            onClose();
                        } else {
                            setMemoCreatedData(null);
                            onClose();
                        }
                    }}
                    title={memoCreatedData.type === 'single' ? 'Service Memo Created' : 'Service Memos Created'}
                    message={
                        memoCreatedData.type === 'single' 
                            ? `Memo #${memoCreatedData.control_number} has been created successfully.`
                            : `${memoCreatedData.created.length} memo(s) created successfully.\n\nCreated: ${memoCreatedData.created.map(m => m.control_number).join(', ')}${memoCreatedData.skipped.length > 0 ? `\n\nSkipped: ${memoCreatedData.skipped.length} ticket(s) (already have memos)` : ''}`
                    }
                    confirmLabel={memoCreatedData.type === 'single' ? 'View Memo' : 'Close'}
                    cancelLabel="Close"
                    variant="success"
                />
            )}

            {/* Memo Creation Error Toast */}
            {memoCreationError && (
                <div style={{
                    position: 'fixed',
                    top: '20px',
                    right: '20px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    padding: '12px 20px',
                    borderRadius: '6px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    zIndex: 10000,
                    maxWidth: '400px',
                }}>
                    {memoCreationError}
                    <button 
                        onClick={() => setMemoCreationError(null)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'white',
                            marginLeft: '10px',
                            cursor: 'pointer',
                            fontSize: '16px',
                        }}
                    >
                        ×
                    </button>
                </div>
            )}

            {mainTicketId && (
                <DispatchTicketModal
                    isOpen={isGroupDispatchOpen}
                    onClose={() => setIsGroupDispatchOpen(false)}
                    ticket={ticket}
                    crews={crews}
                    groupMainTicketId={mainTicketId}
                    titleOverride="🚚 Dispatch Whole Group"
                    subtitleOverride={`Assign same crew to all tickets in group ${mainTicketId}`}
                    onSubmit={(dispatchData) => {
                        onDispatchGroup(mainTicketId, dispatchData);
                        setIsGroupDispatchOpen(false);
                        onClose();
                    }}
                />
            )}

        </div>
    );
};

export default TicketDetailPane;

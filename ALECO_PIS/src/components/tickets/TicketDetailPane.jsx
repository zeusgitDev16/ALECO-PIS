import React, { useState, useEffect } from 'react';
import { apiUrl } from '../../utils/api';
import { formatToPhilippineTime } from '../../utils/dateUtils';
import { formatTicketStatusLabel } from '../../utils/ticketStatusDisplay';
import LocationPreviewMap from '../LocationPreviewMap';
import '../../CSS/TicketDetailPane.css';
import '../../CSS/TicketDashboard.css';
import DispatchTicketModal from './DispatchTicketModal';
import HoldTicketModal from './HoldTicketModal';
import EditTicketModal from './EditTicketModal';
import ConfirmModal from './ConfirmModal';
import TicketHistoryLogs from './TicketHistoryLogs';

/**
 * TicketDetailPane - A high-fidelity modal for viewing and updating ticket specifics.
 */
const TicketDetailPane = ({ ticket, onUpdateTicket, onPutHold, onResumeFromHold, onDispatchGroup, onUngroup, onDeleteTicket, onClose, onRefetch, crews }) => {
    const [copiedField, setCopiedField] = useState(null);
    const [uiScale, setUiScale] = useState(null);
    const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
    const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
    const [isGroupDispatchOpen, setIsGroupDispatchOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isUngroupConfirmOpen, setIsUngroupConfirmOpen] = useState(false);
    const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);
    const [isRevertConfirmOpen, setIsRevertConfirmOpen] = useState(false);
    const [isUnresolvedConfirmOpen, setIsUnresolvedConfirmOpen] = useState(false);
    const [isNoFaultFoundConfirmOpen, setIsNoFaultFoundConfirmOpen] = useState(false);
    const [isAccessDeniedConfirmOpen, setIsAccessDeniedConfirmOpen] = useState(false);
    const [groupData, setGroupData] = useState(null);
    const [isFlipped, setIsFlipped] = useState(false);

    const isGroupMaster = ticket?.ticket_id?.startsWith('GROUP-');
    const isGroupChild = !!ticket?.parent_ticket_id;
    const mainTicketId = isGroupMaster ? ticket.ticket_id : ticket?.parent_ticket_id;
    const children = groupData?.children || [];

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
                    <div className="header-left">
                        <h2 className="detail-title">{ticket.ticket_id}</h2>
                        <span className={`status-tag ${ticket.status?.toLowerCase()}`}>
                            {ticket.status}
                        </span>
                        {isGroupMaster && (
                            <span className="group-badge-detail">
                                {ticket.child_count ?? children.length ?? 0} ticket{(ticket.child_count ?? children.length ?? 0) !== 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                    <div className="header-right">
                        <span className="reported-label">Reported On</span>
                        <div className="reported-date">{formattedDate}</div>
                    </div>
                </div>

                {/* Resolution stepper: 1) Dispatch → 2) In Progress → 3) Resolved */}
                <div className="resolution-stepper">
                    <div className={`stepper-step ${['Pending', 'Unresolved'].includes(ticket.status) ? 'active' : ''} ${['Ongoing', 'OnHold', 'Restored', 'Unresolved', 'NoFaultFound', 'AccessDenied'].includes(ticket.status) ? 'done' : ''}`}>
                        <span className="stepper-num">1</span>
                        <span className="stepper-label stepper-label-full">Dispatch</span>
                        <span className="stepper-label stepper-label-short" aria-hidden="true">Disp</span>
                    </div>
                    <div className="stepper-connector" />
                    <div className={`stepper-step ${['Ongoing', 'OnHold'].includes(ticket.status) ? 'active' : ''} ${['Restored', 'Unresolved', 'NoFaultFound', 'AccessDenied'].includes(ticket.status) ? 'done' : ''}`}>
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
                            <LocationPreviewMap
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

                    {ticket.image_url && (
                        <div className="detail-group evidence-section">
                            <label>Attached Evidence</label>
                            <div className="image-wrapper">
                                <img 
                                    src={ticket.image_url} 
                                    alt="Technical Evidence" 
                                    className="evidence-img" 
                                    onClick={() => window.open(ticket.image_url, '_blank')}
                                />
                                <span className="image-hint">Click image to expand</span>
                            </div>
                        </div>
                    )}

                    {(ticket.assigned_crew || ticket.eta || ticket.dispatch_notes) && ['Ongoing', 'OnHold', 'Restored', 'Unresolved', 'NoFaultFound', 'AccessDenied'].includes(ticket.status) && (
                        <div className="detail-group dispatch-info-section">
                            <label>Dispatch Info</label>
                            <div className="dispatch-info-box">
                                {ticket.assigned_crew && <p><strong>Crew:</strong> {ticket.assigned_crew}</p>}
                                {ticket.eta && <p><strong>ETA:</strong> {ticket.eta}</p>}
                                {ticket.dispatch_notes && <p><strong>Notes:</strong> {ticket.dispatch_notes}</p>}
                                {ticket.hold_reason && (
                                    <p className="hold-info"><strong>On Hold:</strong> {ticket.hold_reason}{ticket.hold_since ? ` (since ${formatToPhilippineTime(ticket.hold_since)})` : ''}</p>
                                )}
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
                <div className="action-footer">
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
                    {ticket.status === 'Pending' && (
                        <>
                            {isGroupMaster ? (
                                onDispatchGroup && (
                                    <button
                                        className="btn-action btn-ongoing"
                                        onClick={() => setIsGroupDispatchOpen(true)}
                                        title="Start Resolution (Dispatch All)"
                                    >
                                        Start Resolution (Dispatch All)
                                    </button>
                                )
                            ) : (
                                <>
                                    <button
                                        className="btn-action btn-ongoing"
                                        onClick={() => setIsDispatchModalOpen(true)}
                                        title="Start Resolution"
                                    >
                                        Start Resolution
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

                    {['Unresolved', 'OnHold'].includes(ticket.status) && (
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

                    {['Pending', 'Ongoing', 'OnHold', 'Unresolved'].includes(ticket.status) && (
                        <button
                            className="btn-action btn-resolved"
                            onClick={() => setIsRestoreConfirmOpen(true)}
                            title="Mark as Restored"
                        >
                            Mark as Restored
                        </button>
                    )}

                    {['Restored', 'NoFaultFound', 'AccessDenied'].includes(ticket.status) && (
                        <button
                            className="btn-action btn-revert-pending"
                            onClick={() => setIsRevertConfirmOpen(true)}
                            title="Revert to Pending"
                        >
                            Revert to Pending
                        </button>
                    )}

                    {ticket.status === 'Ongoing' && !isGroupMaster && (
                        <button
                            className="btn-action btn-hold"
                            onClick={() => setIsHoldModalOpen(true)}
                            title="Put on Hold"
                        >
                            Put on Hold
                        </button>
                    )}

                    {ticket.status === 'OnHold' && onResumeFromHold && (
                        <button
                            type="button"
                            className="btn-action btn-ongoing"
                            onClick={() => onResumeFromHold(ticket.ticket_id)}
                            title="Clear hold and continue work"
                        >
                            Resume work
                        </button>
                    )}

                    {['Ongoing', 'OnHold'].includes(ticket.status) && (
                        <>
                            <button
                                className="btn-action btn-unresolved"
                                onClick={() => setIsUnresolvedConfirmOpen(true)}
                                title="Mark as Unresolved"
                            >
                                Mark as Unresolved
                            </button>
                            <button
                                className="btn-action btn-nff"
                                onClick={() => setIsNoFaultFoundConfirmOpen(true)}
                                title="No Fault Found"
                            >
                                No Fault Found
                            </button>
                            <button
                                className="btn-action btn-access-denied"
                                onClick={() => setIsAccessDeniedConfirmOpen(true)}
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

            <HoldTicketModal
                isOpen={isHoldModalOpen}
                onClose={() => setIsHoldModalOpen(false)}
                ticket={ticket}
                onSubmit={(holdData) => {
                    onPutHold(ticket.ticket_id, holdData);
                    setIsHoldModalOpen(false);
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
                title="Delete Ticket"
                message={`Delete ticket ${ticket.ticket_id}? This cannot be undone.`}
                confirmLabel="Delete"
                cancelLabel="Cancel"
                variant="danger"
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
                onConfirm={() => {
                    onUpdateTicket(ticket.ticket_id, 'Restored');
                    setIsRestoreConfirmOpen(false);
                    onClose();
                }}
                title="Mark as Restored"
                message={`Mark ticket ${ticket.ticket_id} as Restored? This will close the ticket. Only confirm if resolution has been completed.`}
                confirmLabel="Mark Restored"
                cancelLabel="Cancel"
                variant="success"
            />

            <ConfirmModal
                isOpen={isRevertConfirmOpen}
                onClose={() => setIsRevertConfirmOpen(false)}
                onConfirm={() => {
                    onUpdateTicket(ticket.ticket_id, 'Pending');
                    setIsRevertConfirmOpen(false);
                    onClose();
                }}
                title="Revert to Pending"
                message={`Revert ticket ${ticket.ticket_id} to Pending? The ticket will be reopened and you can start resolution again. Use this if the ticket was closed by mistake or needs further action.`}
                confirmLabel="Revert to Pending"
                cancelLabel="Cancel"
                variant="revert-pending"
            />

            <ConfirmModal
                isOpen={isUnresolvedConfirmOpen}
                onClose={() => setIsUnresolvedConfirmOpen(false)}
                onConfirm={() => {
                    onUpdateTicket(ticket.ticket_id, 'Unresolved');
                    setIsUnresolvedConfirmOpen(false);
                    onClose();
                }}
                title="Mark as Unresolved"
                message={`Mark ticket ${ticket.ticket_id} as Unresolved? The ticket will return to the queue for re-dispatch.`}
                confirmLabel="Mark Unresolved"
                cancelLabel="Cancel"
                variant="unresolved"
            />

            <ConfirmModal
                isOpen={isNoFaultFoundConfirmOpen}
                onClose={() => setIsNoFaultFoundConfirmOpen(false)}
                onConfirm={() => {
                    onUpdateTicket(ticket.ticket_id, 'NoFaultFound');
                    setIsNoFaultFoundConfirmOpen(false);
                    onClose();
                }}
                title="No Fault Found"
                message={`Mark ticket ${ticket.ticket_id} as No Fault Found? This will close the ticket. Only confirm if the field crew verified no fault at the location.`}
                confirmLabel="No Fault Found"
                cancelLabel="Cancel"
                variant="nff"
            />

            <ConfirmModal
                isOpen={isAccessDeniedConfirmOpen}
                onClose={() => setIsAccessDeniedConfirmOpen(false)}
                onConfirm={() => {
                    onUpdateTicket(ticket.ticket_id, 'AccessDenied');
                    setIsAccessDeniedConfirmOpen(false);
                    onClose();
                }}
                title="Access Denied"
                message={`Mark ticket ${ticket.ticket_id} as Access Denied? This will close the ticket. Only confirm if the field crew could not access the service location.`}
                confirmLabel="Access Denied"
                cancelLabel="Cancel"
                variant="access-denied"
            />

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

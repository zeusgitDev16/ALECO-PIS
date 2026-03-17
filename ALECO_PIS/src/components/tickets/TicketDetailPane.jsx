import React, { useState, useEffect } from 'react';
import '../../CSS/TicketDetailPane.css';
import DispatchTicketModal from './DispatchTicketModal';
import HoldTicketModal from './HoldTicketModal';

/**
 * TicketDetailPane - A high-fidelity modal for viewing and updating ticket specifics.
 */
const TicketDetailPane = ({ ticket, onUpdateTicket, onPutHold, onDispatchGroup, onClose, crews }) => {
    const [copiedField, setCopiedField] = useState(null);
    const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
    const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
    const [isGroupDispatchOpen, setIsGroupDispatchOpen] = useState(false);

    const isGroupMaster = ticket?.ticket_id?.startsWith('GROUP-');
    const isGroupChild = !!ticket?.parent_ticket_id;
    const mainTicketId = isGroupMaster ? ticket.ticket_id : ticket?.parent_ticket_id;

    // Add/remove modal-open class to body to prevent sticky header overlap
    useEffect(() => {
        document.body.classList.add('modal-open');

        return () => {
            document.body.classList.remove('modal-open');
        };
    }, []);

    // 1. Idempotent Guard
    if (!ticket) return null;

    // 2. Formatting Helpers
    const formattedDate = new Date(ticket.created_at).toLocaleString('en-PH', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

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
        <div className="ticket-modal-overlay" onClick={onClose}>
            <div className="ticket-modal-content" onClick={(e) => e.stopPropagation()}>
                
                <button className="ticket-modal-close-btn" onClick={onClose} aria-label="Close Modal">
                    &times;
                </button>

                {/* --- SECTION 1: HEADER --- */}
                <div className="detail-header">
                    <div className="header-left">
                        <h2 className="detail-title">{ticket.ticket_id}</h2>
                        <span className={`status-tag ${ticket.status?.toLowerCase()}`}>
                            {ticket.status}
                        </span>
                    </div>
                    <div className="header-right">
                        <span className="reported-label">Reported On</span>
                        <div className="reported-date">{formattedDate}</div>
                    </div>
                </div>

                {/* Resolution stepper: 1) Dispatch → 2) In Progress → 3) Resolved */}
                <div className="resolution-stepper">
                    <div className={`stepper-step ${['Pending', 'Unresolved'].includes(ticket.status) ? 'active' : ''} ${['Ongoing', 'Restored', 'Unresolved', 'NoFaultFound', 'AccessDenied'].includes(ticket.status) ? 'done' : ''}`}>
                        <span className="stepper-num">1</span>
                        <span className="stepper-label">Dispatch</span>
                    </div>
                    <div className="stepper-connector" />
                    <div className={`stepper-step ${ticket.status === 'Ongoing' ? 'active' : ''} ${['Restored', 'Unresolved', 'NoFaultFound', 'AccessDenied'].includes(ticket.status) ? 'done' : ''}`}>
                        <span className="stepper-num">2</span>
                        <span className="stepper-label">In Progress</span>
                    </div>
                    <div className="stepper-connector" />
                    <div className={`stepper-step ${['Restored', 'NoFaultFound', 'AccessDenied'].includes(ticket.status) ? 'active' : ''}`}>
                        <span className="stepper-num">3</span>
                        <span className="stepper-label">Resolved</span>
                    </div>
                </div>

                <hr className="detail-divider" />

                {/* --- SECTION 2: REPORTER & SYSTEM INFO --- */}
                <div className="detail-grid">
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
                </div>

                {/* --- SECTION 3: CONTENT & EVIDENCE --- */}
                <div className="detail-content-section">
                    <div className="detail-group">
                        <label>User's Concern</label>
                        <div className="concern-box">
                            {ticket.concern}
                        </div>
                    </div>

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

                    {(ticket.assigned_crew || ticket.eta || ticket.dispatch_notes) && ['Ongoing', 'Restored', 'Unresolved', 'NoFaultFound', 'AccessDenied'].includes(ticket.status) && (
                        <div className="detail-group dispatch-info-section">
                            <label>Dispatch Info</label>
                            <div className="dispatch-info-box">
                                {ticket.assigned_crew && <p><strong>Crew:</strong> {ticket.assigned_crew}</p>}
                                {ticket.eta && <p><strong>ETA:</strong> {ticket.eta}</p>}
                                {ticket.dispatch_notes && <p><strong>Notes:</strong> {ticket.dispatch_notes}</p>}
                                {ticket.hold_reason && (
                                    <p className="hold-info"><strong>On Hold:</strong> {ticket.hold_reason}{ticket.hold_since ? ` (since ${new Date(ticket.hold_since).toLocaleString('en-PH')})` : ''}</p>
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

                {/* --- SECTION 4: ADMIN ACTIONS --- */}
                <div className="action-footer">
                    {ticket.status === 'Pending' && (
                        <>
                            <button
                                className="btn-action btn-ongoing"
                                onClick={() => setIsDispatchModalOpen(true)}
                            >
                                Start Resolution
                            </button>
                            {(isGroupMaster || isGroupChild) && onDispatchGroup && (
                                <button
                                    className="btn-action btn-ongoing"
                                    onClick={() => setIsGroupDispatchOpen(true)}
                                >
                                    Dispatch All
                                </button>
                            )}
                        </>
                    )}

                    {ticket.status === 'Unresolved' && (
                        <>
                            <button
                                className="btn-action btn-ongoing"
                                onClick={() => setIsDispatchModalOpen(true)}
                            >
                                Re-dispatch
                            </button>
                            {(isGroupMaster || isGroupChild) && onDispatchGroup && (
                                <button
                                    className="btn-action btn-ongoing"
                                    onClick={() => setIsGroupDispatchOpen(true)}
                                >
                                    Dispatch All
                                </button>
                            )}
                        </>
                    )}

                    {['Pending', 'Ongoing', 'Unresolved'].includes(ticket.status) && (
                        <button
                            className="btn-action btn-resolved"
                            onClick={() => {
                                onUpdateTicket(ticket.ticket_id, 'Restored');
                                onClose();
                            }}
                        >
                            Mark as Restored
                        </button>
                    )}

                    {ticket.status === 'Ongoing' && (
                        <>
                            <button
                                className="btn-action btn-hold"
                                onClick={() => setIsHoldModalOpen(true)}
                            >
                                Put on Hold
                            </button>
                            <button
                                className="btn-action btn-unresolved"
                                onClick={() => {
                                    onUpdateTicket(ticket.ticket_id, 'Unresolved');
                                    onClose();
                                }}
                            >
                                Mark as Unresolved
                            </button>
                            <button
                                className="btn-action btn-nff"
                                onClick={() => {
                                    onUpdateTicket(ticket.ticket_id, 'NoFaultFound');
                                    onClose();
                                }}
                            >
                                No Fault Found
                            </button>
                            <button
                                className="btn-action btn-access-denied"
                                onClick={() => {
                                    onUpdateTicket(ticket.ticket_id, 'AccessDenied');
                                    onClose();
                                }}
                            >
                                Access Denied
                            </button>
                        </>
                    )}
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

            {mainTicketId && (
                <DispatchTicketModal
                    isOpen={isGroupDispatchOpen}
                    onClose={() => setIsGroupDispatchOpen(false)}
                    ticket={ticket}
                    crews={crews}
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
import React, { useState } from 'react';
import '../../CSS/TicketDashboard.css';
import DispatchTicketModal from './DispatchTicketModal'; // <-- 1. Import the new Lego brick

/**
 * TicketDetailPane - A high-fidelity modal for viewing and updating ticket specifics.
 */
const TicketDetailPane = ({ ticket, onUpdateTicket, onClose }) => {
    const [copiedField, setCopiedField] = useState(null);
    const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false); // <-- 2. New state for the dispatch workflow

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
                            {ticket.barangay}, {ticket.municipality}
                            <br />
                            <small className="district-sub">{ticket.district}</small>
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
                </div>

                {/* --- SECTION 4: ADMIN ACTIONS --- */}
                <div className="action-footer">
                    {ticket.status === 'Pending' && (
                        <button 
                            className="btn-action btn-ongoing"
                            onClick={() => setIsDispatchModalOpen(true)} /* <-- THE FIX: Opens the dispatch form instead of closing the ticket */
                        >
                            Start Resolution
                        </button>
                    )}
                    
                    {['Pending', 'Ongoing'].includes(ticket.status) && (
                        <button 
                            className="btn-action btn-restored"
                            onClick={() => {
                                onUpdateTicket(ticket.ticket_id, 'Restored');
                                onClose();
                            }}
                        >
                            Mark as Restored
                        </button>
                )}
                </div>
            </div>

            {/* --- NEW LOGISTICS WORKFLOW: The Dispatch Modal --- */}
            <DispatchTicketModal 
                isOpen={isDispatchModalOpen}
                onClose={() => setIsDispatchModalOpen(false)}
                ticket={ticket}
                onSubmit={(dispatchData) => {
                    // 1. Pass the new dispatch data AND the status up to the parent
                    onUpdateTicket(ticket.ticket_id, 'Ongoing', dispatchData);
                    // 2. Close both the dispatch form AND the main ticket pane
                    setIsDispatchModalOpen(false);
                    onClose(); 
                }}
            />

        </div>
    );
};

export default TicketDetailPane;
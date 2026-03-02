import React from 'react';
import '../../CSS/TicketDashboard.css';

const TicketDetailPane = ({ ticket, onUpdateTicket, onClose }) => {
    
    // Idempotent guard: If no ticket is selected, render nothing.
    if (!ticket) return null;

    return (
        /* Overlay click will trigger onClose to dismiss the modal */
        <div className="ticket-modal-overlay" onClick={onClose}>
            
            /* Stop propagation prevents clicks inside the white box from closing the modal */
            <div className="ticket-modal-content ticket-detail-container" onClick={(e) => e.stopPropagation()}>
                
                {/* Close Button */}
                <button className="ticket-modal-close-btn" onClick={onClose}>
                    &times;
                </button>

                {/* Header */}
                <div className="detail-header" style={{ paddingRight: '30px' }}>
                    <div>
                        <h2 className="detail-title">{ticket.ticket_id}</h2>
                        <span className={`status-tag ${ticket.status.toLowerCase()}`}>{ticket.status}</span>
                    </div>
                    <div style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        <div>Reported: {new Date(ticket.created_at).toLocaleString()}</div>
                    </div>
                </div>

                {/* Reporter & Location Data */}
                <div className="detail-grid">
                    <div className="detail-group">
                        <label>Reporter Name</label>
                        <p>{ticket.first_name} {ticket.middle_name || ''} {ticket.last_name}</p>
                    </div>
                    <div className="detail-group">
                        <label>Contact Number</label>
                        <p>{ticket.phone_number}</p>
                    </div>
                    <div className="detail-group">
                        <label>Account Number</label>
                        <p>{ticket.account_number || 'N/A'}</p>
                    </div>
                    <div className="detail-group">
                        <label>Category</label>
                        <p>{ticket.category}</p>
                    </div>
                    <div className="detail-group" style={{ gridColumn: 'span 2' }}>
                        <label>Exact Location</label>
                        <p>{ticket.address}, {ticket.purok ? `${ticket.purok}, ` : ''}{ticket.barangay}, {ticket.municipality}, {ticket.district}</p>
                    </div>
                </div>

                {/* The Concern */}
                <div className="detail-group">
                    <label>User's Concern</label>
                    <div className="concern-box">
                        {ticket.concern}
                    </div>
                </div>

                {/* Evidence Image */}
                {ticket.image_url && (
                    <div className="detail-group">
                        <label>Attached Evidence</label>
                        <img src={ticket.image_url} alt="User submission" className="evidence-img" />
                    </div>
                )}

                {/* Action Buttons */}
                <div className="action-buttons">
                    {ticket.status === 'Pending' && (
                        <button 
                            className="btn-action btn-ongoing"
                            onClick={() => {
                                onUpdateTicket(ticket.ticket_id, 'Ongoing');
                                onClose(); // Optionally close after action
                            }}
                        >
                            Mark as Ongoing
                        </button>
                    )}
                    
                    {['Pending', 'Ongoing'].includes(ticket.status) && (
                        <button 
                            className="btn-action btn-restored"
                            onClick={() => {
                                onUpdateTicket(ticket.ticket_id, 'Restored');
                                onClose(); // Optionally close after action
                            }}
                        >
                            Mark as Restored
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TicketDetailPane;
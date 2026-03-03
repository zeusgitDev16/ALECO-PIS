import React from 'react';
import '../../CSS/TicketDashboard.css';

const TicketListPane = ({ tickets, isLoading, selectedTicket, onSelectTicket }) => {
    
    if (isLoading) {
        return (
            <div className="ticket-list-status">
                <p>Loading tickets...</p>
            </div>
        );
    }

    if (!tickets || tickets.length === 0) {
        return (
            <div className="ticket-list-status">
                <p>No tickets found.</p>
            </div>
        );
    }

    return (
        <div className="ticket-grid-wrapper">
            {tickets.map(ticket => (
                /* The Container Wrapper: Highlights separation and handles selection */
                <div 
                    key={ticket.ticket_id}
                    className={`ticket-card-container ${selectedTicket?.ticket_id === ticket.ticket_id ? 'selected' : ''}`}
                    onClick={() => onSelectTicket(ticket)}
                >
                    {/* Header: ID and Date (Left Aligned & Bolded) */}
                    <div className="card-header-row">
                        <span className="ticket-id-bold">{ticket.ticket_id}</span>
                        <span className="ticket-date-label">
                            {new Date(ticket.created_at).toLocaleDateString('en-PH', { 
                                month: 'short', 
                                day: 'numeric',
                                year: 'numeric' 
                            })}
                        </span>
                    </div>
                    
                    {/* Content: Concern and Category (Occupies full width) */}
                    <div className="card-body-content">
                        <h4 className="concern-text-highlight">{ticket.concern}</h4>
                        <div className="category-tag-container">
                            <span className="category-badge-outline">{ticket.category}</span>
                        </div>
                    </div>

                    {/* Footer: Metadata with Horizontal Scroll for Small Screens */}
                    <div className="card-footer-metadata">
                        <div className="location-scroll-wrapper">
                            <span className="geo-icon">📍</span>
                            <span className="location-text-full">
                                {ticket.purok ? `Purok ${ticket.purok}, ` : ''} 
                                {ticket.barangay}, {ticket.municipality}, {ticket.district}
                            </span>
                        </div>
                        <div className="status-badge-container">
                            <span className={`status-pill-solid ${ticket.status.toLowerCase()}`}>
                                {ticket.status}
                            </span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default TicketListPane;
import React from 'react';
// Make sure this path points to wherever your main CSS is stored!
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

    // --- NEW: THE DEDUPLICATION FILTER ---
    // This explicitly hides any ticket that is urgent from the standard list
    const normalTickets = tickets.filter(ticket => ticket.is_urgent !== 1 && ticket.is_urgent !== true);

    if (normalTickets.length === 0) {
        return (
            <div className="ticket-list-status">
                <p>All clear! No standard tickets right now.</p>
            </div>
        );
    }

    return (
        <div className="ticket-grid-wrapper">
            {normalTickets.map(ticket => (
                <div 
                    key={ticket.ticket_id}
                    className={`ticket-card-container ${selectedTicket?.ticket_id === ticket.ticket_id ? 'selected' : ''}`}
                    onClick={() => onSelectTicket(ticket)}
                >
                    {/* 1. ADD THIS NEW BANNER AT THE TOP */}
                     <div className="ticket-category-banner">
                         {ticket.category}
                    </div>
                    {/* Header: ID and Date */}
                    <div className="card-header-row">
                        <span className="ticket-id-bold">{ticket.ticket_id}</span>
                        <span className="ticket-date-label">
                            {new Date(ticket.created_at).toLocaleDateString('en-PH', { 
                                month: 'short', day: 'numeric', year: 'numeric' 
                            })}
                        </span>
                    </div>
                    
                    {/* Content: Concern */}
                    <div className="card-body-content">
                        <h4 className="concern-text-highlight">{ticket.concern}</h4>
                    </div>

                    {/* Footer: Metadata */}
                    <div className="card-footer-metadata">
                            <div className="location-scroll-wrapper">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--text-secondary)'}}>
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                    <circle cx="12" cy="10" r="3"></circle>
                                </svg>
                                <span className="location-text-full">
                                    {ticket.barangay ? `Brgy ${ticket.barangay}, ${ticket.municipality}` : ticket.address}
                                </span>
                            </div>
                            
                            {/* Uses your existing status pill logic */}
                            <span className={`status-pill-solid ${ticket.status ? ticket.status.toLowerCase() : 'pending'}`}>
                                {ticket.status || 'Pending'}
                            </span>
                        </div>
                </div>
            ))}
        </div>
    );
};

export default TicketListPane;
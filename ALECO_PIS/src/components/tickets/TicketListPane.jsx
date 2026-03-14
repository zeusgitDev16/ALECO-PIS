import React from 'react';
import '../../CSS/TicketDashboard.css'; 

const TicketListPane = ({ tickets, isLoading, selectedTicket, onSelectTicket, selectedIds, onToggleSelect }) => {
    
    if (isLoading) {
        return (
            <div className="ticket-list-pane-wrapper">
                <div className="ticket-list-status">
                    <p>Loading tickets...</p>
                </div>
            </div>
        );
    }

    if (!tickets || tickets.length === 0) {
        return (
            <div className="ticket-list-pane-wrapper">
                <div className="ticket-list-status">
                    <p>No tickets found.</p>
                </div>
            </div>
        );
    }

    const normalTickets = tickets.filter(ticket => ticket.is_urgent !== 1 && ticket.is_urgent !== true);

    if (normalTickets.length === 0) {
        return (
            <div className="ticket-list-pane-wrapper">
                <div className="ticket-list-status">
                    <p>All clear! No standard tickets right now.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="ticket-list-pane-wrapper">
            <div className="ticket-grid-wrapper">
                {normalTickets.map(ticket => (
                    <div 
                        key={ticket.ticket_id}
                        className={`ticket-card-container ${selectedTicket?.ticket_id === ticket.ticket_id ? 'selected' : ''}`}
                        onClick={() => onSelectTicket(ticket)}
                    >
                        <div className="ticket-category-banner">
                            <input 
                                type="checkbox" 
                                className="ticket-bulk-checkbox"
                                checked={selectedIds?.includes(ticket.ticket_id)}
                                onChange={() => {}}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleSelect(ticket.ticket_id);
                                }}
                            />
                            <span className="banner-category-text">{ticket.category}</span>
                        </div>

                        <div className="card-header-row">
                            <span className="ticket-id-bold">{ticket.ticket_id}</span>
                            <span className="ticket-date-label">
                                {new Date(ticket.created_at).toLocaleDateString('en-PH', { 
                                    month: 'short', day: 'numeric', year: 'numeric' 
                                })}
                            </span>
                        </div>
                        
                        <div className="card-body-content">
                            <p className="concern-text-highlight">{ticket.concern}</p>
                        </div>

                        <div className="card-footer-metadata">
                            <div className="location-scroll-wrapper">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--text-secondary)'}}>
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                    <circle cx="12" cy="10" r="3"></circle>
                                </svg>
                                <span className="location-text-full">
                                    {ticket.municipality 
                                        ? `${ticket.municipality}, ${ticket.district || 'Albay'}` 
                                        : ticket.address || 'Location not specified'}
                                </span>
                            </div>
                            
                            <span className={`status-pill-solid ${ticket.status ? ticket.status.toLowerCase() : 'pending'}`}>
                                {ticket.status || 'Pending'}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TicketListPane;

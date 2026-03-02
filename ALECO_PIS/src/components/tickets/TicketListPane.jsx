import React from 'react';
import '../../CSS/TicketDashboard.css';

const TicketListPane = ({ tickets, isLoading, selectedTicket, onSelectTicket }) => {
    
    if (isLoading) {
        return <div className="ticket-list-container"><p style={{color: 'var(--text-secondary)', textAlign: 'center'}}>Loading tickets...</p></div>;
    }

    if (!tickets || tickets.length === 0) {
        return <div className="ticket-list-container"><p style={{color: 'var(--text-secondary)', textAlign: 'center'}}>No tickets found.</p></div>;
    }

    return (
        <div className="ticket-list-container">
            {tickets.map(ticket => (
                <div 
                    key={ticket.ticket_id}
                    className={`ticket-card-compact ${selectedTicket?.ticket_id === ticket.ticket_id ? 'selected' : ''}`}
                    onClick={() => onSelectTicket(ticket)}
                >
                    <div className="ticket-card-header">
                        <span className="ticket-id">{ticket.ticket_id}</span>
                        {/* A helper function would convert created_at to "2h ago" here */}
                        <span className="ticket-time">
                            {new Date(ticket.created_at).toLocaleDateString()}
                        </span>
                    </div>
                    
                    <div className="ticket-category">{ticket.category}</div>
                    
                    <div className="ticket-location">
                        📍 {ticket.barangay ? `${ticket.barangay}, ` : ''}{ticket.municipality}
                    </div>

                    <div style={{ marginTop: '5px' }}>
                        <span className={`status-tag ${ticket.status.toLowerCase()}`}>
                            {ticket.status}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default TicketListPane;
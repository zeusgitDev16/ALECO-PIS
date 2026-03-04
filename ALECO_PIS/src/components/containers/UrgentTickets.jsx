import React from 'react';
import '../../CSS/UrgentTickets.css';


const UrgentTickets = ({ tickets, onSelectTicket }) => {
    // 1. FILTER LOGIC: Safely check for 1 or true (depending on how your MySQL driver parses TINYINT)
    const urgentList = tickets.filter(ticket => ticket.is_urgent === 1 || ticket.is_urgent === true);

    // 2. HIDE IF EMPTY: If there are no urgent tickets, don't render the section at all
    if (!urgentList || urgentList.length === 0) {
        return null; 
    }

    // 3. RENDER THE URGENT BRICK
    return (
        <div className="urgent-tickets-wrapper">
            <div className="urgent-section-header">
                <span className="urgent-alert-icon">🚨</span>
                <h3 className="urgent-title">Action Required: Urgent Tickets ({urgentList.length})</h3>
            </div>
            
            {/* Reuses your existing high-density grid structure but adds an 'urgent-card' modifier */}
            <div className="ticket-grid-wrapper urgent-grid">
                {urgentList.map(ticket => (
                    <div 
                        key={ticket.ticket_id} 
                        className="ticket-card-container urgent-card"
                        onClick={() => onSelectTicket(ticket)}
                    >

                        {/* 1. Centered Red Category Banner */}
                         <div className="ticket-category-banner urgent-banner">
                             {ticket.category}
                        </div>

                        {/* Row 1: ID & Date */}
                        <div className="card-header-row">
                            <span className="ticket-id-bold text-red-glow">{ticket.ticket_id}</span>
                           <span className="ticket-date-label">
                             {new Date(ticket.created_at).toLocaleDateString('en-PH', { 
                                 month: 'short', day: 'numeric', year: 'numeric' 
                          })}
                            </span>
                        </div>

                        {/* Row 2: Content Body */}
                        <div className="card-body-content">
                            <p className="concern-text-highlight">{ticket.concern}</p>
                        </div>

                        {/* Row 3: Metadata with Horizontal Scroll */}
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
        </div>
    );
};

export default UrgentTickets;
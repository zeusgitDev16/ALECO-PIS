import React from 'react';
import { formatToPhilippineDate } from '../../utils/dateUtils';
import '../../CSS/UrgentTickets.css';

const UrgentTickets = ({ tickets, onSelectTicket, selectedIds, onToggleSelect }) => {
    const urgentList = tickets.filter(ticket => ticket.is_urgent === 1 || ticket.is_urgent === true);

    if (!urgentList || urgentList.length === 0) {
        return null;
    }

    return (
        <div className="urgent-tickets-wrapper">
            <div className="urgent-section-header">
                <span className="urgent-alert-icon">🚨</span>
                <h3 className="urgent-title">Action Required: Urgent Tickets ({urgentList.length})</h3>
            </div>
            
            <div className="ticket-grid-wrapper urgent-grid">
                {urgentList.map(ticket => (
                    <div 
                        key={ticket.ticket_id} 
                        className="ticket-card-container urgent-card"
                        onClick={() => onSelectTicket(ticket)}
                    >
                        <div className="ticket-category-banner urgent-banner">
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
                            <span className="ticket-id-bold text-red-glow">{ticket.ticket_id}</span>
                            <span className="ticket-date-label">
                                {formatToPhilippineDate(ticket.created_at)}
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
                                    {ticket.barangay ? `Brgy ${ticket.barangay}, ${ticket.municipality}` : ticket.address}
                                </span>
                            </div>
                            
                            <span className={`status-pill-solid ${ticket.status ? ticket.status.toLowerCase().replace(/\s/g, '') : 'pending'}`}>
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

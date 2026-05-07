import React from 'react';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import '../../CSS/TicketDashboard.css';
import TicketGridCard from './TicketGridCard';
import TicketGridVirtualized, { VIRTUALIZATION_THRESHOLD } from './TicketGridVirtualized';

const TicketListPane = ({ tickets, isLoading, selectedTicket, onSelectTicket, selectedIds, onToggleSelect, includeUrgent = false }) => {
    if (isLoading) {
        return (
            <div className="ticket-list-pane-wrapper">
                <div className="ticket-grid-wrapper">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="ticket-card-container skeleton-loading">
                            <div className="ticket-category-banner">
                                <input
                                    type="checkbox"
                                    className="ticket-bulk-checkbox"
                                    disabled
                                />
                                <span className="banner-category-text"><Skeleton width={100} height={16} /></span>
                            </div>
                            <div className="card-header-row">
                                <span className="ticket-id-bold"><Skeleton width={100} height={20} /></span>
                                <span className="ticket-date-label"><Skeleton width={100} height={14} /></span>
                            </div>
                            <div className="card-body-content">
                                <p className="concern-text-highlight"><Skeleton width="100%" height={40} /></p>
                            </div>
                            <div className="card-footer-metadata">
                                <div className="location-scroll-wrapper">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-secondary)' }}>
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                        <circle cx="12" cy="10" r="3" />
                                    </svg>
                                    <span className="location-text-full"><Skeleton width={150} height={14} /></span>
                                </div>
                                <span className="status-pill-solid"><Skeleton width={80} height={20} /></span>
                            </div>
                        </div>
                    ))}
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

    const normalTickets = includeUrgent
        ? tickets
        : tickets.filter(ticket => ticket.is_urgent !== 1 && ticket.is_urgent !== true);

    if (normalTickets.length === 0) {
        return (
            <div className="ticket-list-pane-wrapper">
                <div className="ticket-list-status">
                    <p>All clear! No standard tickets right now.</p>
                </div>
            </div>
        );
    }

    const useVirtualized = normalTickets.length > VIRTUALIZATION_THRESHOLD;

    if (useVirtualized) {
        return (
            <div className="ticket-list-pane-wrapper">
                <TicketGridVirtualized
                    tickets={normalTickets}
                    selectedTicket={selectedTicket}
                    onSelectTicket={onSelectTicket}
                    selectedIds={selectedIds}
                    onToggleSelect={onToggleSelect}
                />
            </div>
        );
    }

    return (
        <div className="ticket-list-pane-wrapper">
            <div className="ticket-grid-wrapper">
                {normalTickets.map(ticket => (
                    <TicketGridCard
                        key={ticket.ticket_id}
                        ticket={ticket}
                        isSelected={selectedTicket?.ticket_id === ticket.ticket_id}
                        isChecked={selectedIds?.includes(ticket.ticket_id)}
                        onSelectTicket={onSelectTicket}
                        onToggleSelect={onToggleSelect}
                    />
                ))}
            </div>
        </div>
    );
};

export default TicketListPane;

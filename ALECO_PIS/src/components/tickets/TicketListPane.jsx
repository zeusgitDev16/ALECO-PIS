import React from 'react';
import '../../CSS/TicketDashboard.css';
import TicketGridCard from './TicketGridCard';
import TicketGridVirtualized, { VIRTUALIZATION_THRESHOLD } from './TicketGridVirtualized';

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

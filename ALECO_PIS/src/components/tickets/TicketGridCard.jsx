import React from 'react';
import { formatToPhilippineDate } from '../../utils/dateUtils';
import { formatTicketStatusLabel } from '../../utils/ticketStatusDisplay';

/**
 * TicketGridCard - Single ticket card for grid view.
 * Extracted for reuse in both standard and virtualized grids.
 */
const TicketGridCard = ({ ticket, isSelected, isChecked, onSelectTicket, onToggleSelect }) => {
    const isGroupMaster = ticket.ticket_id?.startsWith('GROUP-');

    return (
        <div
            className={`ticket-card-container ${isGroupMaster ? 'ticket-card-group' : ''} ${isSelected ? 'selected' : ''}`}
            onClick={() => onSelectTicket(ticket)}
        >
            <div className="ticket-category-banner">
                <input
                    type="checkbox"
                    className="ticket-bulk-checkbox"
                    checked={isChecked}
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
                {isGroupMaster && (ticket.child_count ?? 0) > 0 && (
                    <span className="group-badge group-badge-parent" title={`${ticket.child_count} tickets in group`}>
                        {ticket.child_count} ticket{(ticket.child_count ?? 0) !== 1 ? 's' : ''}
                    </span>
                )}
                {!isGroupMaster && ticket.parent_ticket_id && (
                    <span className="group-badge" title={`Part of group ${ticket.parent_ticket_id}`}>
                        Part of {ticket.parent_ticket_id}
                    </span>
                )}
                <span className="ticket-date-label">
                    {formatToPhilippineDate(ticket.created_at)}
                </span>
            </div>

            <div className="card-body-content">
                <p className="concern-text-highlight">
                    {isGroupMaster ? (ticket.address || ticket.concern) : ticket.concern}
                </p>
            </div>

            <div className="card-footer-metadata">
                <div className="location-scroll-wrapper">
                    <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ color: 'var(--text-secondary)' }}
                    >
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    <span className="location-text-full">
                        {isGroupMaster
                            ? (ticket.municipality ? `${ticket.municipality}, ${ticket.district || 'Albay'}` : ticket.address || '—')
                            : (ticket.municipality ? `${ticket.municipality}, ${ticket.district || 'Albay'}` : ticket.address || 'Location not specified')}
                    </span>
                </div>

                <span className={`status-pill-solid ${ticket.status ? ticket.status.toLowerCase().replace(/\s/g, '') : 'pending'}`}>
                    {formatTicketStatusLabel(ticket.status) || 'Pending'}
                </span>
            </div>
        </div>
    );
};

export default TicketGridCard;

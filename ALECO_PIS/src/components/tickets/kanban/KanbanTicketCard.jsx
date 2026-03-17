import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import '../../../CSS/TicketKanban.css';

/**
 * KanbanTicketCard - Compact draggable ticket card for Kanban view
 * Memoized to prevent unnecessary re-renders
 */
const KanbanTicketCard = React.memo(({ ticket, onClick, isSelected, isChecked, onToggleSelect }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: ticket.ticket_id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1
    };

    const fullName = `${ticket.first_name || ''} ${ticket.last_name || ''}`.trim();
    const location = ticket.municipality
        ? `${ticket.municipality}, ${ticket.district || 'Albay'}`
        : ticket.address || 'N/A';

    // Calculate time ago
    const createdDate = new Date(ticket.created_at);
    const now = new Date();
    const diffMs = now - createdDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    let timeAgo;
    if (diffMins < 60) {
        timeAgo = `${diffMins}m ago`;
    } else if (diffHours < 24) {
        timeAgo = `${diffHours}h ago`;
    } else {
        timeAgo = `${diffDays}d ago`;
    }

    const isUrgent = ticket.is_urgent === 1 || ticket.is_urgent === true;
    const concernShort = ticket.concern && ticket.concern.length > 50
        ? `${ticket.concern.substring(0, 50)}...`
        : ticket.concern || 'No description';

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`kanban-ticket-card ${isUrgent ? 'urgent' : ''} ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
            onClick={() => onClick && onClick(ticket)}
            {...attributes}
        >
            {/* Header: Ticket ID + Category + Checkbox */}
            <div className="kanban-card-header">
                <div className="kanban-card-id">
                    {onToggleSelect && (
                        <input
                            type="checkbox"
                            className="kanban-bulk-checkbox"
                            checked={isChecked || false}
                            onChange={() => {}}
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleSelect(ticket.ticket_id);
                            }}
                            title="Select for bulk action"
                        />
                    )}
                    {isUrgent && <span className="urgent-indicator">🚨</span>}
                    <span className={isUrgent ? 'urgent-text' : ''}>{ticket.ticket_id}</span>
                    {ticket.parent_ticket_id && (
                        <span className="group-badge" title={`Part of group ${ticket.parent_ticket_id}`}>
                            Part of {ticket.parent_ticket_id}
                        </span>
                    )}
                </div>
                <div className="kanban-card-category" {...listeners} style={{ cursor: 'grab' }}>
                    {ticket.category}
                </div>
            </div>

            {/* Body: Name + Concern */}
            <div className="kanban-card-body">
                <div className="kanban-card-name">{fullName || 'N/A'}</div>
                <div className="kanban-card-concern" title={ticket.concern}>
                    {concernShort}
                </div>
            </div>

            {/* Footer: Location + Time */}
            <div className="kanban-card-footer">
                <div className="kanban-card-location" title={location}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    <span>{location.length > 20 ? `${location.substring(0, 20)}...` : location}</span>
                </div>
                <div className="kanban-card-time">⏰ {timeAgo}</div>
            </div>

            {/* Optional: Crew Info (for Ongoing status) */}
            {ticket.crew_name && (
                <div className="kanban-card-crew">
                    👷 {ticket.crew_name}
                </div>
            )}
        </div>
    );
}, (prevProps, nextProps) => {
    // Only re-render if these specific properties change
    return (
        prevProps.ticket.ticket_id === nextProps.ticket.ticket_id &&
        prevProps.ticket.status === nextProps.ticket.status &&
        prevProps.ticket.is_urgent === nextProps.ticket.is_urgent &&
        prevProps.ticket.parent_ticket_id === nextProps.ticket.parent_ticket_id &&
        prevProps.isSelected === nextProps.isSelected &&
        prevProps.isChecked === nextProps.isChecked
    );
});

KanbanTicketCard.displayName = 'KanbanTicketCard';

export default KanbanTicketCard;


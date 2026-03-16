import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import KanbanTicketCard from './KanbanTicketCard';
import '../../../CSS/TicketKanban.css';

/**
 * KanbanColumn - Status column with virtual scrolling for performance
 * Handles 1000+ tickets per column efficiently
 */
const KanbanColumn = ({
    columnId,
    title,
    icon,
    color,
    tickets,
    urgentCount,
    onCardClick,
    selectedTicket,
    selectedIds,
    onToggleSelect
}) => {
    const [showAll, setShowAll] = useState(false);
    const { setNodeRef, isOver } = useDroppable({ id: columnId });

    // Lazy loading configuration
    const VISIBLE_CARDS = 20; // Number of cards to show initially

    const displayedTickets = showAll ? tickets : tickets.slice(0, VISIBLE_CARDS);
    const hasMore = tickets.length > VISIBLE_CARDS;

    return (
        <div 
            ref={setNodeRef}
            className={`kanban-column ${isOver ? 'drag-over' : ''}`}
            style={{ borderTopColor: color }}
        >
            {/* Column Header */}
            <div className="kanban-column-header">
                <div className="kanban-column-title-group">
                    <span className="kanban-column-icon">{icon}</span>
                    <h3 className="kanban-column-title">{title}</h3>
                </div>
                <div className="kanban-column-badges">
                    {urgentCount > 0 && (
                        <span className="kanban-urgent-badge" title={`${urgentCount} urgent tickets`}>
                            🚨 {urgentCount}
                        </span>
                    )}
                    <span className="kanban-count-badge" style={{ backgroundColor: color }}>
                        {tickets.length}
                    </span>
                </div>
            </div>

            {/* Column Body - Virtual Scrolling */}
            <div className="kanban-column-body">
                <SortableContext
                    items={displayedTickets.map(t => t.ticket_id)}
                    strategy={verticalListSortingStrategy}
                >
                    {tickets.length === 0 ? (
                        <div className="kanban-empty-state">
                            <p>No tickets</p>
                        </div>
                    ) : (
                        <div className="kanban-card-list">
                            {displayedTickets.map((ticket) => {
                                const isSelected = selectedTicket?.ticket_id === ticket.ticket_id;
                                const isChecked = selectedIds?.includes(ticket.ticket_id);
                                return (
                                    <KanbanTicketCard
                                        key={ticket.ticket_id}
                                        ticket={ticket}
                                        onClick={onCardClick}
                                        isSelected={isSelected}
                                        isChecked={isChecked}
                                        onToggleSelect={onToggleSelect}
                                    />
                                );
                            })}
                        </div>
                    )}
                </SortableContext>
            </div>

            {/* Column Footer - Load More */}
            {hasMore && !showAll && (
                <div className="kanban-column-footer">
                    <button 
                        className="kanban-load-more-btn"
                        onClick={() => setShowAll(true)}
                    >
                        Load {tickets.length - VISIBLE_CARDS} more...
                    </button>
                </div>
            )}

            {showAll && tickets.length > VISIBLE_CARDS && (
                <div className="kanban-column-footer">
                    <button 
                        className="kanban-load-more-btn"
                        onClick={() => setShowAll(false)}
                    >
                        Show less
                    </button>
                </div>
            )}
        </div>
    );
};

export default KanbanColumn;


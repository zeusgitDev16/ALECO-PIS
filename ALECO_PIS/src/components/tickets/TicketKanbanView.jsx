import React, { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { DndContext, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import KanbanColumn from './kanban/KanbanColumn';
import KanbanTicketCard from './kanban/KanbanTicketCard';
import { groupTicketsByStatus, getColumnStats, getColumnConfig } from '../../utils/kanbanHelpers';
import '../../CSS/TicketKanban.css';

/**
 * TicketKanbanView - Main Kanban board component
 * Handles drag-and-drop, status updates, and 10,000+ ticket performance
 */
const TicketKanbanView = ({ tickets, isLoading, selectedTicket, onSelectTicket, onUpdateTicket, selectedIds, onToggleSelect }) => {
    const [activeId, setActiveId] = useState(null);

    // Configure drag sensors (mouse/touch)
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // 8px movement required to start drag
            },
        })
    );

    // All useMemo hooks MUST be before any early returns (Rules of Hooks)
    const groupedTickets = useMemo(() => groupTicketsByStatus(tickets || []), [tickets]);
    const columnStats = useMemo(() => getColumnStats(tickets || []), [tickets]);
    const columnConfig = getColumnConfig();
    const activeTicket = useMemo(() => {
        if (!activeId) return null;
        return (tickets || []).find(t => t.ticket_id === activeId);
    }, [activeId, tickets]);

    if (isLoading) {
        return (
            <div className="kanban-view-container">
                <div className="kanban-board">
                    {/* Pending Column Skeleton */}
                    <div className="kanban-column">
                        <div className="kanban-column-header">
                            <span className="kanban-column-icon">{columnConfig.pending.icon}</span>
                            <h3 className="kanban-column-title">{columnConfig.pending.title} <Skeleton width={30} height={20} inline /></h3>
                        </div>
                        <div className="kanban-column-scroll">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="kanban-ticket-card skeleton-loading">
                                    <div className="kanban-card-header">
                                        <div className="kanban-card-id">
                                            <input type="checkbox" className="kanban-bulk-checkbox" disabled />
                                            <span><Skeleton width={80} height={16} /></span>
                                        </div>
                                        <div className="kanban-card-category">
                                            <Skeleton width={60} height={14} />
                                        </div>
                                    </div>
                                    <div className="kanban-card-body">
                                        <div className="kanban-card-name"><Skeleton width={100} height={16} /></div>
                                        <div className="kanban-card-concern"><Skeleton width="100%" height={24} /></div>
                                    </div>
                                    <div className="kanban-card-footer">
                                        <div className="kanban-card-location">
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                                <circle cx="12" cy="10" r="3" />
                                            </svg>
                                            <span><Skeleton width={80} height={14} /></span>
                                        </div>
                                        <div className="kanban-card-footer-right">
                                            <span className="status-badge"><Skeleton width={60} height={16} /></span>
                                            <span className="kanban-card-time"><Skeleton width={40} height={14} /></span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Ongoing Column Skeleton */}
                    <div className="kanban-column">
                        <div className="kanban-column-header">
                            <span className="kanban-column-icon">{columnConfig.ongoing.icon}</span>
                            <h3 className="kanban-column-title">{columnConfig.ongoing.title} <Skeleton width={30} height={20} inline /></h3>
                        </div>
                        <div className="kanban-column-scroll">
                            {[1, 2].map((i) => (
                                <div key={i} className="kanban-ticket-card skeleton-loading">
                                    <div className="kanban-card-header">
                                        <div className="kanban-card-id">
                                            <input type="checkbox" className="kanban-bulk-checkbox" disabled />
                                            <span><Skeleton width={80} height={16} /></span>
                                        </div>
                                        <div className="kanban-card-category">
                                            <Skeleton width={60} height={14} />
                                        </div>
                                    </div>
                                    <div className="kanban-card-body">
                                        <div className="kanban-card-name"><Skeleton width={100} height={16} /></div>
                                        <div className="kanban-card-concern"><Skeleton width="100%" height={24} /></div>
                                    </div>
                                    <div className="kanban-card-footer">
                                        <div className="kanban-card-location">
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                                <circle cx="12" cy="10" r="3" />
                                            </svg>
                                            <span><Skeleton width={80} height={14} /></span>
                                        </div>
                                        <div className="kanban-card-footer-right">
                                            <span className="status-badge"><Skeleton width={60} height={16} /></span>
                                            <span className="kanban-card-time"><Skeleton width={40} height={14} /></span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Restored Column Skeleton */}
                    <div className="kanban-column">
                        <div className="kanban-column-header">
                            <span className="kanban-column-icon">{columnConfig.restored.icon}</span>
                            <h3 className="kanban-column-title">{columnConfig.restored.title} <Skeleton width={30} height={20} inline /></h3>
                        </div>
                        <div className="kanban-column-scroll">
                            {[1, 2].map((i) => (
                                <div key={i} className="kanban-ticket-card skeleton-loading">
                                    <div className="kanban-card-header">
                                        <div className="kanban-card-id">
                                            <input type="checkbox" className="kanban-bulk-checkbox" disabled />
                                            <span><Skeleton width={80} height={16} /></span>
                                        </div>
                                        <div className="kanban-card-category">
                                            <Skeleton width={60} height={14} />
                                        </div>
                                    </div>
                                    <div className="kanban-card-body">
                                        <div className="kanban-card-name"><Skeleton width={100} height={16} /></div>
                                        <div className="kanban-card-concern"><Skeleton width="100%" height={24} /></div>
                                    </div>
                                    <div className="kanban-card-footer">
                                        <div className="kanban-card-location">
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                                <circle cx="12" cy="10" r="3" />
                                            </svg>
                                            <span><Skeleton width={80} height={14} /></span>
                                        </div>
                                        <div className="kanban-card-footer-right">
                                            <span className="status-badge"><Skeleton width={60} height={16} /></span>
                                            <span className="kanban-card-time"><Skeleton width={40} height={14} /></span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Unresolved Column Skeleton */}
                    <div className="kanban-column">
                        <div className="kanban-column-header">
                            <span className="kanban-column-icon">{columnConfig.unresolved.icon}</span>
                            <h3 className="kanban-column-title">{columnConfig.unresolved.title} <Skeleton width={30} height={20} inline /></h3>
                        </div>
                        <div className="kanban-column-scroll">
                            {[1].map((i) => (
                                <div key={i} className="kanban-ticket-card skeleton-loading">
                                    <div className="kanban-card-header">
                                        <div className="kanban-card-id">
                                            <input type="checkbox" className="kanban-bulk-checkbox" disabled />
                                            <span><Skeleton width={80} height={16} /></span>
                                        </div>
                                        <div className="kanban-card-category">
                                            <Skeleton width={60} height={14} />
                                        </div>
                                    </div>
                                    <div className="kanban-card-body">
                                        <div className="kanban-card-name"><Skeleton width={100} height={16} /></div>
                                        <div className="kanban-card-concern"><Skeleton width="100%" height={24} /></div>
                                    </div>
                                    <div className="kanban-card-footer">
                                        <div className="kanban-card-location">
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                                <circle cx="12" cy="10" r="3" />
                                            </svg>
                                            <span><Skeleton width={80} height={14} /></span>
                                        </div>
                                        <div className="kanban-card-footer-right">
                                            <span className="status-badge"><Skeleton width={60} height={16} /></span>
                                            <span className="kanban-card-time"><Skeleton width={40} height={14} /></span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* No Fault Found Column Skeleton */}
                    <div className="kanban-column">
                        <div className="kanban-column-header">
                            <span className="kanban-column-icon">{columnConfig.nofaultfound.icon}</span>
                            <h3 className="kanban-column-title">{columnConfig.nofaultfound.title} <Skeleton width={30} height={20} inline /></h3>
                        </div>
                        <div className="kanban-column-scroll">
                            {[1].map((i) => (
                                <div key={i} className="kanban-ticket-card skeleton-loading">
                                    <div className="kanban-card-header">
                                        <div className="kanban-card-id">
                                            <input type="checkbox" className="kanban-bulk-checkbox" disabled />
                                            <span><Skeleton width={80} height={16} /></span>
                                        </div>
                                        <div className="kanban-card-category">
                                            <Skeleton width={60} height={14} />
                                        </div>
                                    </div>
                                    <div className="kanban-card-body">
                                        <div className="kanban-card-name"><Skeleton width={100} height={16} /></div>
                                        <div className="kanban-card-concern"><Skeleton width="100%" height={24} /></div>
                                    </div>
                                    <div className="kanban-card-footer">
                                        <div className="kanban-card-location">
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                                <circle cx="12" cy="10" r="3" />
                                            </svg>
                                            <span><Skeleton width={80} height={14} /></span>
                                        </div>
                                        <div className="kanban-card-footer-right">
                                            <span className="status-badge"><Skeleton width={60} height={16} /></span>
                                            <span className="kanban-card-time"><Skeleton width={40} height={14} /></span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Access Denied Column Skeleton */}
                    <div className="kanban-column">
                        <div className="kanban-column-header">
                            <span className="kanban-column-icon">{columnConfig.accessdenied.icon}</span>
                            <h3 className="kanban-column-title">{columnConfig.accessdenied.title} <Skeleton width={30} height={20} inline /></h3>
                        </div>
                        <div className="kanban-column-scroll">
                            {[1].map((i) => (
                                <div key={i} className="kanban-ticket-card skeleton-loading">
                                    <div className="kanban-card-header">
                                        <div className="kanban-card-id">
                                            <input type="checkbox" className="kanban-bulk-checkbox" disabled />
                                            <span><Skeleton width={80} height={16} /></span>
                                        </div>
                                        <div className="kanban-card-category">
                                            <Skeleton width={60} height={14} />
                                        </div>
                                    </div>
                                    <div className="kanban-card-body">
                                        <div className="kanban-card-name"><Skeleton width={100} height={16} /></div>
                                        <div className="kanban-card-concern"><Skeleton width="100%" height={24} /></div>
                                    </div>
                                    <div className="kanban-card-footer">
                                        <div className="kanban-card-location">
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                                <circle cx="12" cy="10" r="3" />
                                            </svg>
                                            <span><Skeleton width={80} height={14} /></span>
                                        </div>
                                        <div className="kanban-card-footer-right">
                                            <span className="status-badge"><Skeleton width={60} height={16} /></span>
                                            <span className="kanban-card-time"><Skeleton width={40} height={14} /></span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    /**
     * Handle drag start
     */
    const handleDragStart = (event) => {
        setActiveId(event.active.id);
    };

    /**
     * Handle drag end - Update ticket status
     */
    const handleDragEnd = async (event) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over || active.id === over.id) return;

        const ticketId = active.id;
        const newStatus = over.id; // Column ID = Status name

        // Find the ticket being moved
        const ticket = tickets.find(t => t.ticket_id === ticketId);
        if (!ticket) return;

        // Prevent moving to the same status
        if (ticket.status === newStatus) return;

        const targetStatusEarly = newStatus.toLowerCase();
        // Ongoing + On Hold share the "In progress" column (id: ongoing) — not a status change
        if (ticket.status === 'OnHold' && targetStatusEarly === 'ongoing') return;

        // Validate status transition
        const validTransitions = {
            pending: ['ongoing', 'unresolved'],
            ongoing: ['restored', 'unresolved', 'nofaultfound', 'accessdenied'],
            onhold: ['restored', 'unresolved', 'nofaultfound', 'accessdenied'],
            restored: [],
            unresolved: ['pending', 'ongoing'],
            nofaultfound: [],
            accessdenied: []
        };

        const currentStatus = (ticket.status || '').toLowerCase().replace(/\s/g, '');
        const targetStatus = newStatus.toLowerCase();

        if (!validTransitions[currentStatus]?.includes(targetStatus)) {
            toast.warning(`Cannot move ticket from ${ticket.status} to ${newStatus}`);
            return;
        }

        // P0: Block Pending→Ongoing drag - dispatch requires crew/ETA via detail pane
        if (currentStatus === 'pending' && targetStatus === 'ongoing') {
            toast.info('Use "Start Resolution" in the ticket detail pane to dispatch a crew.');
            if (onSelectTicket) onSelectTicket(ticket);
            return;
        }

        // Map column ID to backend status (proper casing)
        const statusMap = {
            pending: 'Pending',
            ongoing: 'Ongoing',
            restored: 'Restored',
            unresolved: 'Unresolved',
            nofaultfound: 'NoFaultFound',
            accessdenied: 'AccessDenied',
            onhold: 'OnHold'
        };
        const capitalizedStatus = statusMap[targetStatus] || newStatus;

        console.log(`🔄 Moving ticket ${ticketId} from ${ticket.status} to ${capitalizedStatus}`);

        // Call parent update handler
        if (onUpdateTicket) {
            onUpdateTicket(ticketId, capitalizedStatus);
        }
    };

    /**
     * Handle drag cancel
     */
    const handleDragCancel = () => {
        setActiveId(null);
    };

    return (
        <div className="kanban-view-container">
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
            >
                <div className="kanban-board">
                    {/* Pending Column */}
                    <KanbanColumn
                        columnId="pending"
                        title={columnConfig.pending.title}
                        icon={columnConfig.pending.icon}
                        color={columnConfig.pending.color}
                        tickets={groupedTickets.pending}
                        urgentCount={columnStats.pending.urgent}
                        onCardClick={onSelectTicket}
                        selectedTicket={selectedTicket}
                        selectedIds={selectedIds}
                        onToggleSelect={onToggleSelect}
                    />

                    {/* Ongoing Column */}
                    <KanbanColumn
                        columnId="ongoing"
                        title={columnConfig.ongoing.title}
                        icon={columnConfig.ongoing.icon}
                        color={columnConfig.ongoing.color}
                        tickets={groupedTickets.ongoing}
                        urgentCount={columnStats.ongoing.urgent}
                        onCardClick={onSelectTicket}
                        selectedTicket={selectedTicket}
                        selectedIds={selectedIds}
                        onToggleSelect={onToggleSelect}
                    />

                    {/* Restored Column */}
                    <KanbanColumn
                        columnId="restored"
                        title={columnConfig.restored.title}
                        icon={columnConfig.restored.icon}
                        color={columnConfig.restored.color}
                        tickets={groupedTickets.restored}
                        urgentCount={columnStats.restored.urgent}
                        onCardClick={onSelectTicket}
                        selectedTicket={selectedTicket}
                        selectedIds={selectedIds}
                        onToggleSelect={onToggleSelect}
                    />

                    {/* Unresolved Column */}
                    <KanbanColumn
                        columnId="unresolved"
                        title={columnConfig.unresolved.title}
                        icon={columnConfig.unresolved.icon}
                        color={columnConfig.unresolved.color}
                        tickets={groupedTickets.unresolved}
                        urgentCount={columnStats.unresolved.urgent}
                        onCardClick={onSelectTicket}
                        selectedTicket={selectedTicket}
                        selectedIds={selectedIds}
                        onToggleSelect={onToggleSelect}
                    />

                    {/* No Fault Found Column */}
                    <KanbanColumn
                        columnId="nofaultfound"
                        title={columnConfig.nofaultfound.title}
                        icon={columnConfig.nofaultfound.icon}
                        color={columnConfig.nofaultfound.color}
                        tickets={groupedTickets.nofaultfound}
                        urgentCount={columnStats.nofaultfound.urgent}
                        onCardClick={onSelectTicket}
                        selectedTicket={selectedTicket}
                        selectedIds={selectedIds}
                        onToggleSelect={onToggleSelect}
                    />

                    {/* Access Denied Column */}
                    <KanbanColumn
                        columnId="accessdenied"
                        title={columnConfig.accessdenied.title}
                        icon={columnConfig.accessdenied.icon}
                        color={columnConfig.accessdenied.color}
                        tickets={groupedTickets.accessdenied}
                        urgentCount={columnStats.accessdenied.urgent}
                        onCardClick={onSelectTicket}
                        selectedTicket={selectedTicket}
                        selectedIds={selectedIds}
                        onToggleSelect={onToggleSelect}
                    />
                </div>

                {/* Drag Overlay - Shows card being dragged */}
                <DragOverlay>
                    {activeTicket ? (
                        <KanbanTicketCard ticket={activeTicket} isDragging />
                    ) : null}
                </DragOverlay>
            </DndContext>
        </div>
    );
};

export default TicketKanbanView;


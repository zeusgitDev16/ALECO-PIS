import React, { useState, useRef, useEffect } from 'react';
import IssueCategoryDropdown from '../dropdowns/IssueCategoryDropdown';
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
    arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import '../../CSS/GroupIncidentModal.css';
import useDraggable from '../../utils/useDraggable';

/** Sortable ticket row for routing batch - supports drag to reorder */
const SortableTicketRow = ({ ticket, index, groupType, moveTicket, totalCount }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: ticket.ticket_id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
    };

    const location = `${ticket.barangay || ticket.address || '—'}, ${ticket.municipality || '—'}`;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group-modal-ticket-row ${isDragging ? 'dragging' : ''}`}
        >
            <div className="group-modal-ticket-row-inner">
                {groupType === 'routing_batch' && (
                    <div className="group-modal-ticket-drag-handle" {...attributes} {...listeners} title="Drag to reorder">
                        <span className="drag-handle-icon">⋮⋮</span>
                        <span className="visit-order-badge">{index + 1}</span>
                    </div>
                )}
                <div className="group-modal-ticket-info">
                    <span className="group-modal-ticket-id">{ticket.ticket_id}</span>
                    <span className="group-modal-ticket-meta">{ticket.category}{ticket.status ? ` · ${ticket.status}` : ''}</span>
                </div>
                <div className="group-modal-ticket-location" title={location}>
                    <span className="location-icon">📍</span>
                    {location.length > 35 ? `${location.slice(0, 35)}…` : location}
                </div>
            </div>
            {groupType === 'routing_batch' && (
                <div className="group-modal-ticket-arrows">
                    <button
                        type="button"
                        className="group-modal-arrow-btn"
                        onClick={() => moveTicket(index, -1)}
                        disabled={index === 0}
                        title="Move up"
                    >
                        ▲
                    </button>
                    <button
                        type="button"
                        className="group-modal-arrow-btn"
                        onClick={() => moveTicket(index, 1)}
                        disabled={index >= totalCount - 1}
                        title="Move down"
                    >
                        ▼
                    </button>
                </div>
            )}
        </div>
    );
};

const GroupIncidentModal = ({ isOpen, onClose, selectedTickets, onSubmit }) => {
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('');
    const [remarks, setRemarks] = useState('');
    const [groupType, setGroupType] = useState('similar_incident');
    const [orderedTickets, setOrderedTickets] = useState([]);

    const modalRef = useRef(null);
    const { x, y, onStart } = useDraggable();

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 },
        })
    );

    useEffect(() => {
        if (isOpen && selectedTickets?.length) {
            setOrderedTickets([...selectedTickets]);
            setGroupType('similar_incident');

            const first = selectedTickets[0];
            const sameBarangay = selectedTickets.every(t => (t.barangay || '').trim() === (first.barangay || '').trim());
            const sameCategory = selectedTickets.every(t => (t.category || '').trim() === (first.category || '').trim());
            if (sameBarangay && sameCategory && first.barangay && first.category) {
                const suggestedTitle = `${first.category} - ${first.barangay}, ${first.municipality || ''}`.trim();
                setTitle(suggestedTitle);
                setCategory(first.category);
            } else {
                setTitle('');
                setCategory('');
            }
        }
    }, [isOpen, selectedTickets]);

    const moveTicket = (index, direction) => {
        const newOrder = [...orderedTickets];
        const target = index + direction;
        if (target < 0 || target >= newOrder.length) return;
        [newOrder[index], newOrder[target]] = [newOrder[target], newOrder[index]];
        setOrderedTickets(newOrder);
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = orderedTickets.findIndex(t => t.ticket_id === active.id);
        const newIndex = orderedTickets.findIndex(t => t.ticket_id === over.id);
        if (oldIndex === -1 || newIndex === -1) return;

        setOrderedTickets(arrayMove(orderedTickets, oldIndex, newIndex));
    };

    if (!isOpen) return null;

    const displayTickets = groupType === 'routing_batch' ? orderedTickets : (selectedTickets || []);
    const ticketIds = (groupType === 'routing_batch' ? orderedTickets : selectedTickets || []).map(t => t.ticket_id);
    const visitOrder = groupType === 'routing_batch' ? ticketIds : undefined;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({ title, category, remarks, ticketIds, group_type: groupType, visit_order: visitOrder });
    };

    const ticketListContent = groupType === 'routing_batch' ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={ticketIds} strategy={verticalListSortingStrategy}>
                {displayTickets.map((ticket, index) => (
                    <SortableTicketRow
                        key={ticket.ticket_id}
                        ticket={ticket}
                        index={index}
                        groupType={groupType}
                        moveTicket={moveTicket}
                        totalCount={displayTickets.length}
                    />
                ))}
            </SortableContext>
        </DndContext>
    ) : (
        displayTickets.map((ticket, index) => (
            <div key={ticket.ticket_id} className="group-modal-ticket-row">
                <div className="group-modal-ticket-row-inner">
                    <div className="group-modal-ticket-info">
                        <span className="group-modal-ticket-id">{ticket.ticket_id}</span>
                        <span className="group-modal-ticket-meta">{ticket.category}{ticket.status ? ` · ${ticket.status}` : ''}</span>
                    </div>
                    <div className="group-modal-ticket-location" title={`${ticket.barangay || ticket.address || '—'}, ${ticket.municipality || '—'}`}>
                        <span className="location-icon">📍</span>
                        {`${ticket.barangay || ticket.address || '—'}, ${ticket.municipality || '—'}`}
                    </div>
                </div>
            </div>
        ))
    );

    return (
        <div className="group-modal-overlay" onClick={onClose}>
            <div
                ref={modalRef}
                className="group-modal-content"
                onClick={(e) => e.stopPropagation()}
                style={{ transform: `translate(${x}px, ${y}px)` }}
            >
                <button className="group-modal-close-btn" onClick={onClose} aria-label="Close">×</button>

                {/* Header - fixed, never scrolls */}
                <div
                    className="group-modal-header-handle"
                    onMouseDown={onStart}
                    onTouchStart={onStart}
                >
                    <span className="group-modal-header-grip">⋮⋮</span>
                    <div>
                        <h2 className="group-modal-title">Group {selectedTickets?.length || 0} Tickets</h2>
                        <p className="group-modal-desc">Link selected tickets under one master incident.</p>
                    </div>
                </div>

                {/* Scrollable middle only (same spine as Ticket Detail Pane) */}
                <div className="group-modal-scroll-outer">
                    <div className="group-modal-body-scroll">
                        <div className="group-modal-body">
                            <div className="group-modal-section">
                                <label className="group-modal-label">Group Type</label>
                                <div className="group-modal-type-tabs">
                                    <button
                                        type="button"
                                        className={`group-modal-type-tab ${groupType === 'similar_incident' ? 'active' : ''}`}
                                        onClick={() => setGroupType('similar_incident')}
                                    >
                                        <span className="tab-title">Similar Incident</span>
                                        <span className="tab-desc">Same area, one crew</span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`group-modal-type-tab ${groupType === 'routing_batch' ? 'active' : ''}`}
                                        onClick={() => setGroupType('routing_batch')}
                                    >
                                        <span className="tab-title">Routing Batch</span>
                                        <span className="tab-desc">Visit in order</span>
                                    </button>
                                </div>
                            </div>

                            <div className="group-modal-section">
                                <label className="group-modal-label">
                                    {groupType === 'routing_batch' ? 'Visit order — drag to reorder' : 'Selected tickets'}
                                </label>
                                <div className="group-modal-ticket-list">
                                    {ticketListContent}
                                </div>
                            </div>

                            <form id="group-modal-form" onSubmit={handleSubmit} className="group-modal-form">
                                <div className="group-modal-field group-modal-category-field">
                                    <label className="group-modal-label">Master Category</label>
                                    <IssueCategoryDropdown
                                        value={category}
                                        onChange={(val) => setCategory(val)}
                                        isFilter={false}
                                        layoutMode="form"
                                    />
                                </div>

                                <div className="group-modal-field">
                                    <label className="group-modal-label">Incident Title / Location</label>
                                    <input
                                        type="text"
                                        className="group-modal-input"
                                        placeholder="e.g., Blown 50kVA Transformer - Brgy Rawis"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="group-modal-field">
                                    <label className="group-modal-label">Remarks</label>
                                    <textarea
                                        className="group-modal-textarea"
                                        placeholder="Optional notes"
                                        value={remarks}
                                        onChange={(e) => setRemarks(e.target.value)}
                                    />
                                </div>
                            </form>
                        </div>
                    </div>
                </div>

                {/* Action footer - fixed, never scrolls (same as Ticket Detail Pane action-footer) */}
                <div className="group-modal-actions">
                    <button type="button" className="group-modal-btn group-modal-btn-cancel" onClick={onClose}>
                        Cancel
                    </button>
                    <button type="submit" form="group-modal-form" className="group-modal-btn group-modal-btn-submit">
                        Confirm & Group
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GroupIncidentModal;

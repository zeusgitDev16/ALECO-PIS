import React, { useState, useRef, useEffect } from 'react';
import AdminLayout from './AdminLayout';
import '../CSS/TicketMain.css'; 
import useTickets from '../utils/useTickets';
import UrgentTickets from './containers/UrgentTickets';
import useDraggable from '../utils/useDraggable';
import CoverageMap from './CoverageMap';
import MapButton from './buttons/MapButton';
import TicketFilterBar from './tickets/TicketFilterBar';
import TicketListPane from './tickets/TicketListPane';
import TicketDetailPane from './tickets/TicketDetailPane';
import GroupIncidentModal from './tickets/GroupIncidentModal';
import TicketLayoutPicker from './tickets/TicketLayoutPicker';

const AdminTickets = () => {
    const { tickets, loading: isLoading, error, filters, setFilters } = useTickets();
    
    const [viewMode, setViewMode] = useState('grid');
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [isMapOpen, setIsMapOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [availableCrews, setAvailableCrews] = useState([]);

    useEffect(() => {
        const fetchCrews = async () => {
            try {
                const response = await fetch('http://localhost:5000/api/crews/list');
                const data = await response.json();
                if (Array.isArray(data)) {
                    setAvailableCrews(data);
                }
            } catch (error) {
                console.error("❌ Failed to load crews:", error);
            }
        };
        fetchCrews();
    }, []);

    const toggleTicketSelection = (id) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const handleUpdateTicket = async (ticketId, newStatus, dispatchData = null) => {
        try {
            if (newStatus === 'Ongoing' && dispatchData) {
                const response = await fetch(`http://localhost:5000/api/tickets/${ticketId}/dispatch`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dispatchData)
                });
                
                const data = await response.json();

                if (response.ok && data.success) {
                    alert(`ALECO System: Crew successfully dispatched for Ticket ${ticketId}. SMS notifications sent.`);
                    window.location.reload();
                } else {
                    alert("Dispatch failed: " + data.message);
                }
            } 
            else if (newStatus === 'Restored') {
                console.log("Manually restoring ticket...");
            }
        } catch (error) {
            console.error("Network error: ", error);
        }
    };

    const handleLayoutChange = (newMode) => {
        if (newMode === 'map') {
            setIsMapOpen(true);
        } else {
            setViewMode(newMode);
        }
    };

    const activeTab = filters.tab;
    const setActiveTab = (newTab) => setFilters(prev => ({ ...prev, tab: newTab }));
    const barRef = useRef(null);
    const { x, y, onStart } = useDraggable(barRef);

    return (
        <AdminLayout activePage="tickets">
            <div className="tickets-page-container">
                
                {/* HEADER */}
                <div className="tickets-header">
                    <div className="header-text">
                        <h2>Support Tickets</h2>
                        <p>Track and resolve user reported issues.</p>
                    </div>
                    <MapButton onClick={() => setIsMapOpen(true)} />
                </div>

                {/* ERROR BANNER */}
                {error && (
                    <div className="error-banner">
                        {error}
                    </div>
                )}

                {/* FILTER BAR */}
                <TicketFilterBar 
                    activeTab={activeTab} 
                    setActiveTab={setActiveTab} 
                    filters={filters} 
                    setFilters={setFilters} 
                    tickets={tickets} 
                    selectedIds={selectedIds} 
                    setSelectedIds={setSelectedIds}
                />

                {/* LAYOUT PICKER */}
                <TicketLayoutPicker 
                    activeLayout={viewMode}
                    onLayoutChange={handleLayoutChange}
                />

                {/* CONTENT AREA */}
                <div className="tickets-content-area">
                    
                    {/* GRID VIEW */}
                    {viewMode === 'grid' && (
                        <>
                            <UrgentTickets 
                                tickets={tickets} 
                                onSelectTicket={setSelectedTicket} 
                                selectedIds={selectedIds} 
                                onToggleSelect={toggleTicketSelection}
                            />

                            <div className="separator">
                                <p>Regular Tickets:</p>
                            </div>

                            <TicketListPane 
                                tickets={tickets} 
                                isLoading={isLoading}
                                selectedTicket={selectedTicket} 
                                onSelectTicket={setSelectedTicket} 
                                selectedIds={selectedIds} 
                                onToggleSelect={toggleTicketSelection}
                            />
                        </>
                    )}

                    {/* TABLE VIEW */}
                    {viewMode === 'table' && (
                        <div className="placeholder-view">
                            <h3>📊 Table View</h3>
                            <p>Coming Soon: Compact table layout for bulk operations</p>
                            <p className="ticket-count">Showing {tickets.length} tickets</p>
                        </div>
                    )}

                    {/* KANBAN VIEW */}
                    {viewMode === 'kanban' && (
                        <div className="placeholder-view">
                            <h3>🗂️ Kanban View</h3>
                            <p>Coming Soon: Drag-and-drop workflow columns</p>
                            <p className="ticket-count">Showing {tickets.length} tickets</p>
                        </div>
                    )}
                </div>
            </div>

            {/* MODALS */}
            <TicketDetailPane 
                ticket={selectedTicket} 
                onClose={() => setSelectedTicket(null)}
                onUpdateTicket={handleUpdateTicket}
                crews={availableCrews}
            />

            {selectedIds.length > 0 && (
                <div 
                    ref={barRef}
                    className="bulk-action-bar-floating"
                    onMouseDown={onStart}    
                    onTouchStart={onStart}   
                    style={{
                        transform: `translate(calc(-50% + ${x}px), ${y}px)`,
                        cursor: 'grab',
                        touchAction: 'none' 
                    }}
                >
                    <div className="bulk-bar-content">
                        <div className="drag-grip-indicator" title="Drag to move">⋮⋮</div>
                        <span className="bulk-selection-count">
                            <span className="count-badge">{selectedIds.length}</span> 
                            Tickets Selected
                        </span>
                        <div className="bulk-action-buttons">
                            <button 
                                className="btn-bulk-action btn-group"
                                onClick={() => setIsGroupModalOpen(true)}
                            >
                                🔗 Group as Incident
                            </button>
                            <button className="btn-bulk-action btn-resolve">
                                ✅ Resolve Selected
                            </button>
                            <button 
                                className="btn-bulk-action btn-cancel" 
                                onClick={() => setSelectedIds([])}
                            >
                                ✖ Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <CoverageMap 
                isOpen={isMapOpen} 
                onClose={() => setIsMapOpen(false)} 
                tickets={tickets}
            />

            <GroupIncidentModal 
                isOpen={isGroupModalOpen}
                onClose={() => setIsGroupModalOpen(false)}
                selectedTickets={tickets.filter(t => selectedIds.includes(t.ticket_id))}
                onGroupCreated={() => {
                    setIsGroupModalOpen(false);
                    setSelectedIds([]);
                }}
            />
        </AdminLayout>
    );
};

export default AdminTickets;

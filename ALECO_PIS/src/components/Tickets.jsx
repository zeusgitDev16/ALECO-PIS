import React, { useState, useRef, useEffect } from 'react';
import AdminLayout from './AdminLayout';
import '../CSS/AdminPageLayout.css';
import '../CSS/TicketsPage.css'; // ✅ NEW ISOLATED CSS
import '../CSS/TicketMain.css'; // ✅ BULK ACTION BAR STYLES
import useTickets from '../utils/useTickets';
import { useRecentOpenedTickets } from '../utils/useRecentOpenedTickets';
import UrgentTickets from './containers/UrgentTickets';
import RecentOpenedTickets from './containers/RecentOpenedTickets';
import useDraggable from '../utils/useDraggable';
import CoverageMap from './CoverageMap';
import MapButton from './buttons/MapButton';
import TicketFilterBar from './tickets/TicketFilterBar';
import TicketListPane from './tickets/TicketListPane';
import TicketDetailPane from './tickets/TicketDetailPane';
import GroupIncidentModal from './tickets/GroupIncidentModal';
import TicketLayoutPicker from './tickets/TicketLayoutPicker';
import TicketFilterLayoutWrapper from './tickets/TicketFilterLayoutWrapper';
import TicketTableView from './tickets/TicketTableView';
import TicketKanbanView from './tickets/TicketKanbanView';

const AdminTickets = () => {
    const { tickets, loading: isLoading, error, filters, setFilters, refetch } = useTickets();
    
    const [viewMode, setViewMode] = useState('grid');
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [isMapOpen, setIsMapOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [availableCrews, setAvailableCrews] = useState([]);
    const { addOpened, recentIds, timeRange, setTimeRange, isCollapsed, setIsCollapsed } = useRecentOpenedTickets();

    const handleSelectTicket = (ticket) => {
        setSelectedTicket(ticket);
        if (ticket?.ticket_id) addOpened(ticket.ticket_id);
    };

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

    // Debug: Log when selectedIds changes
    useEffect(() => {
        console.log('🎯 Selected IDs changed:', selectedIds);
        console.log('🎯 Bulk bar should show:', selectedIds.length > 0);
    }, [selectedIds]);

    const toggleTicketSelection = (id) => {
        console.log('🔘 Checkbox clicked for ticket:', id);
        setSelectedIds(prev => {
            const newSelection = prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id];
            console.log('📋 Selected IDs updated:', newSelection);
            return newSelection;
        });
    };

    const getActiveFiltersCount = () => {
        let count = 0;
        if (filters.searchQuery) count++;
        if (filters.category) count++;
        if (filters.district) count++;
        if (filters.municipality) count++;
        if (filters.datePreset) count++;
        if (filters.isNew) count++;
        if (filters.isUrgent) count++;
        if (filters.status) count++;
        if (filters.groupFilter && filters.groupFilter !== 'all') count++;
        return count;
    };

    const handleDispatchGroup = async (mainTicketId, dispatchData) => {
        try {
            const body = { ...dispatchData, ...getActor() };
            const response = await fetch(`http://localhost:5000/api/tickets/group/${mainTicketId}/dispatch`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await response.json();
            if (response.ok && data.success) {
                alert(`ALECO System: ${data.message}`);
                refetch();
            } else {
                alert('Group dispatch failed: ' + (data.message || 'Unknown error'));
            }
        } catch (error) {
            console.error('Group dispatch error:', error);
            alert('Failed to dispatch group. Please try again.');
        }
    };

    const handleUngroup = async (mainTicketId) => {
        if (!confirm('Dissolve this group? All tickets will become standalone.')) return;
        try {
            const response = await fetch(`http://localhost:5000/api/tickets/group/${mainTicketId}/ungroup`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            if (response.ok && data.success) {
                alert(`ALECO System: ${data.message}`);
                setSelectedTicket(null);
                refetch();
            } else {
                alert('Ungroup failed: ' + (data.message || 'Unknown error'));
            }
        } catch (error) {
            console.error('Ungroup error:', error);
            alert('Failed to ungroup. Please try again.');
        }
    };

    const getActor = () => ({
        actor_email: localStorage.getItem('userEmail') || null,
        actor_name: localStorage.getItem('userName') || null
    });

    const handlePutHold = async (ticketId, holdData) => {
        try {
            const body = { ...holdData, ...getActor() };
            const response = await fetch(`http://localhost:5000/api/tickets/${ticketId}/hold`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await response.json();
            if (response.ok && data.success) {
                alert(`ALECO System: Ticket ${ticketId} put on hold.`);
                refetch();
            } else {
                alert('Hold failed: ' + (data.message || 'Unknown error'));
            }
        } catch (error) {
            console.error('Hold error:', error);
            alert('Failed to put ticket on hold. Please try again.');
        }
    };

    const handleUpdateTicket = async (ticketId, newStatus, dispatchData = null) => {
        try {
            if (newStatus === 'Ongoing' && dispatchData) {
                const body = { ...dispatchData, ...getActor() };
                const response = await fetch(`http://localhost:5000/api/tickets/${ticketId}/dispatch`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    alert(`ALECO System: Crew successfully dispatched for Ticket ${ticketId}. SMS notifications sent.`);
                    refetch();
                } else {
                    alert("Dispatch failed: " + data.message);
                }
            }
            else if (['Restored', 'Unresolved', 'NoFaultFound', 'AccessDenied'].includes(newStatus)) {
                const isGroupMaster = ticketId?.startsWith('GROUP-');
                const url = isGroupMaster
                    ? `http://localhost:5000/api/tickets/group/${ticketId}/status`
                    : `http://localhost:5000/api/${ticketId}/status`; // legacy single-ticket route

                const response = await fetch(url, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: newStatus, ...getActor() })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    alert(`ALECO System: ${isGroupMaster ? 'Group' : 'Ticket'} ${ticketId} marked as ${newStatus}.`);
                    refetch();
                } else {
                    alert("Status update failed: " + data.message);
                }
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

    const handleBulkResolve = async () => {
        if (selectedIds.length === 0) {
            alert('No tickets selected');
            return;
        }

        const confirmed = window.confirm(
            `Are you sure you want to mark ${selectedIds.length} ticket(s) as Restored?`
        );

        if (!confirmed) return;

        try {
            const groupMasters = selectedIds.filter(id => id?.startsWith('GROUP-'));
            const regularTickets = selectedIds.filter(id => !id?.startsWith('GROUP-'));

            for (const mainTicketId of groupMasters) {
                const response = await fetch(`http://localhost:5000/api/tickets/group/${mainTicketId}/status`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'Restored', ...getActor() })
                });
                const data = await response.json();
                if (!response.ok || !data.success) {
                    alert(`Failed to restore group ${mainTicketId}: ${data.message}`);
                    return;
                }
            }

            if (regularTickets.length > 0) {
                const response = await fetch('http://localhost:5000/api/tickets/bulk/restore', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ticketIds: regularTickets, ...getActor() })
                });

                const data = await response.json();

                if (!response.ok || !data.success) {
                    alert(`❌ Failed: ${data.message}`);
                    return;
                }
            }

            alert(`✅ ${groupMasters.length + regularTickets.length} ticket(s) marked as Restored.`);
            setSelectedIds([]);
            refetch();
        } catch (error) {
            console.error('❌ Error bulk restoring tickets:', error);
            alert('Failed to restore tickets. Please try again.');
        }
    };

    const barRef = useRef(null);
    const { x, y, onStart } = useDraggable(barRef);

    return (
        <AdminLayout activePage="tickets">
            <div className="admin-page-container">
                
                {/* ✅ STANDARD HEADER (LIKE PERSONNELMANAGEMENT.JSX) */}
                <div className="dashboard-header-flex">
                    <div className="header-text-group">
                        <h2 className="header-title">Support Tickets</h2>
                        <p className="header-subtitle">Track and resolve user reported issues.</p>
                    </div>
                    <MapButton onClick={() => setIsMapOpen(true)} />
                </div>

                {error && (
                    <div className="error-banner">
                        {error}
                    </div>
                )}

                {/* ✅ COLLAPSIBLE FILTER & LAYOUT WRAPPER */}
                <TicketFilterLayoutWrapper activeFiltersCount={getActiveFiltersCount()}>
                    {/* ✅ LEGO BRICK: Filter Bar */}
                    <TicketFilterBar
                        filters={filters}
                        setFilters={setFilters}
                        tickets={tickets}
                        selectedIds={selectedIds}
                        setSelectedIds={setSelectedIds}
                    />

                    {/* ✅ LEGO BRICK: Layout Picker */}
                    <TicketLayoutPicker
                        activeLayout={viewMode}
                        onLayoutChange={handleLayoutChange}
                    />
                </TicketFilterLayoutWrapper>

                {/* ✅ LEGO BRICK: Content Widget (WITH SCROLL) */}
                <div className="dashboard-widget main-content-card">
                    {viewMode === 'grid' && (
                        <>
                            <UrgentTickets 
                                tickets={tickets} 
                                onSelectTicket={handleSelectTicket} 
                                selectedIds={selectedIds} 
                                onToggleSelect={toggleTicketSelection}
                            />

                            <div className="separator">
                                <p><span>📋</span> Regular Tickets:</p>
                            </div>

                            <TicketListPane 
                                tickets={tickets} 
                                isLoading={isLoading}
                                selectedTicket={selectedTicket} 
                                onSelectTicket={handleSelectTicket} 
                                selectedIds={selectedIds} 
                                onToggleSelect={toggleTicketSelection}
                            />

                            <RecentOpenedTickets
                                layout="grid"
                                tickets={tickets}
                                recentIds={recentIds}
                                timeRange={timeRange}
                                onTimeRangeChange={setTimeRange}
                                selectedTicket={selectedTicket}
                                onSelectTicket={handleSelectTicket}
                                selectedIds={selectedIds}
                                onToggleSelect={toggleTicketSelection}
                                isCollapsed={isCollapsed}
                                onToggleCollapse={() => setIsCollapsed(v => !v)}
                            />
                        </>
                    )}

                    {viewMode === 'table' && (
                        <>
                            <TicketTableView
                                tickets={tickets}
                                selectedTicket={selectedTicket}
                                onSelectTicket={handleSelectTicket}
                                selectedIds={selectedIds}
                                onToggleSelect={toggleTicketSelection}
                            />
                            <RecentOpenedTickets
                                layout="table"
                                tickets={tickets}
                                recentIds={recentIds}
                                timeRange={timeRange}
                                onTimeRangeChange={setTimeRange}
                                selectedTicket={selectedTicket}
                                onSelectTicket={handleSelectTicket}
                                selectedIds={selectedIds}
                                onToggleSelect={toggleTicketSelection}
                                isCollapsed={isCollapsed}
                                onToggleCollapse={() => setIsCollapsed(v => !v)}
                            />
                        </>
                    )}

                    {viewMode === 'kanban' && (
                        <>
                            <TicketKanbanView
                                tickets={tickets}
                                selectedTicket={selectedTicket}
                                onSelectTicket={handleSelectTicket}
                                onUpdateTicket={handleUpdateTicket}
                                selectedIds={selectedIds}
                                onToggleSelect={toggleTicketSelection}
                            />
                            <RecentOpenedTickets
                                layout="kanban"
                                tickets={tickets}
                                recentIds={recentIds}
                                timeRange={timeRange}
                                onTimeRangeChange={setTimeRange}
                                selectedTicket={selectedTicket}
                                onSelectTicket={handleSelectTicket}
                                selectedIds={selectedIds}
                                onToggleSelect={toggleTicketSelection}
                                isCollapsed={isCollapsed}
                                onToggleCollapse={() => setIsCollapsed(v => !v)}
                            />
                        </>
                    )}
                </div>
            </div>

            {/* ✅ MODALS (OUTSIDE SCROLL CONTAINER) */}
            <TicketDetailPane 
                ticket={selectedTicket} 
                onClose={() => setSelectedTicket(null)}
                onUpdateTicket={handleUpdateTicket}
                onPutHold={handlePutHold}
                onDispatchGroup={handleDispatchGroup}
                onUngroup={handleUngroup}
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
                                Group
                            </button>
                            <button
                                className="btn-bulk-action btn-resolve"
                                onClick={handleBulkResolve}
                            >
                                Restore
                            </button>
                            <button
                                className="btn-bulk-action btn-cancel"
                                onClick={() => setSelectedIds([])}
                                title="Cancel selection"
                            >
                                ✕
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
                selectedTickets={tickets.filter(t => selectedIds.includes(t.ticket_id) && !t.ticket_id?.startsWith('GROUP-'))}
                onSubmit={async (groupData) => {
                    try {
                        const response = await fetch('http://localhost:5000/api/tickets/group/create', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(groupData)
                        });

                        const data = await response.json();

                        if (response.ok && data.success) {
                            alert(`✅ Success! ${data.message}\n\nMain Ticket ID: ${data.mainTicketId}`);
                            setIsGroupModalOpen(false);
                            setSelectedIds([]);
                            refetch();
                        } else {
                            alert(`❌ Failed to create group: ${data.message}`);
                        }
                    } catch (error) {
                        console.error('❌ Error creating ticket group:', error);
                        alert('Failed to create ticket group. Please try again.');
                    }
                }}
            />
        </AdminLayout>
    );
};

export default AdminTickets;

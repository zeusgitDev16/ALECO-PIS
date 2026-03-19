import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'react-toastify';
import { apiUrl } from '../utils/api';
import AdminLayout from './AdminLayout';
import '../CSS/AdminPageLayout.css';
import '../CSS/TicketsPage.css';
import '../CSS/TicketDualPaneLayout.css';
import '../CSS/TicketFilterSidebar.css';
import '../CSS/TicketSelectAllBar.css';
import '../CSS/TicketFilterDrawer.css';
import '../CSS/TicketMain.css';
import useTickets from '../utils/useTickets';
import { useRecentOpenedTickets } from '../utils/useRecentOpenedTickets';
import UrgentTickets from './containers/UrgentTickets';
import RecentOpenedTickets from './containers/RecentOpenedTickets';
import useDraggable from '../utils/useDraggable';
import CoverageMap from './CoverageMap';
import TicketFilterSidebar from './tickets/TicketFilterSidebar';
import TicketFilterBar from './tickets/TicketFilterBar';
import TicketFilterDrawer from './tickets/TicketFilterDrawer';
import TicketSelectAllBar from './tickets/TicketSelectAllBar';
import TicketListPane from './tickets/TicketListPane';
import TicketDetailPane from './tickets/TicketDetailPane';
import GroupIncidentModal from './tickets/GroupIncidentModal';
import TicketLayoutPicker from './tickets/TicketLayoutPicker';
import TicketDualPaneLayout from './tickets/TicketDualPaneLayout';
import TicketTableView from './tickets/TicketTableView';
import TicketKanbanView from './tickets/TicketKanbanView';
import ConfirmModal from './tickets/ConfirmModal';

const AdminTickets = () => {
    const { tickets, loading: isLoading, error, filters, setFilters, refetch } = useTickets();
    
    const [viewMode, setViewMode] = useState('grid');
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [isMapOpen, setIsMapOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [availableCrews, setAvailableCrews] = useState([]);
    const [confirmState, setConfirmState] = useState({ open: false, type: null, payload: null });
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        const saved = localStorage.getItem('ticketFilterSidebarCollapsed');
        return saved === 'true';
    });
    const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
    const { addOpened, recentIds, timeRange, setTimeRange, isCollapsed, setIsCollapsed } = useRecentOpenedTickets();

    useEffect(() => {
        localStorage.setItem('ticketFilterSidebarCollapsed', String(sidebarCollapsed));
    }, [sidebarCollapsed]);

    const handleSelectTicket = (ticket) => {
        setSelectedTicket(ticket);
        if (ticket?.ticket_id) addOpened(ticket.ticket_id);
    };

    useEffect(() => {
        const fetchCrews = async () => {
            try {
                const response = await fetch(apiUrl('/api/crews/list'));
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
            const response = await fetch(apiUrl(`/api/tickets/group/${mainTicketId}/dispatch`), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await response.json();
            if (response.ok && data.success) {
                toast.success(`ALECO System: ${data.message}`);
                refetch();
            } else {
                toast.error('Group dispatch failed: ' + (data.message || 'Unknown error'));
            }
        } catch (error) {
            console.error('Group dispatch error:', error);
            toast.error('Failed to dispatch group. Please try again.');
        }
    };

    const executeUngroup = async (mainTicketId) => {
        try {
            const response = await fetch(apiUrl(`/api/tickets/group/${mainTicketId}/ungroup`), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            if (response.ok && data.success) {
                toast.success(`ALECO System: ${data.message}`);
                setSelectedTicket(null);
                refetch();
            } else {
                toast.error('Ungroup failed: ' + (data.message || 'Unknown error'));
            }
        } catch (error) {
            console.error('Ungroup error:', error);
            toast.error('Failed to ungroup. Please try again.');
        }
    };

    const getActor = () => ({
        actor_email: localStorage.getItem('userEmail') || null,
        actor_name: localStorage.getItem('userName') || null
    });

    const handleDeleteTicket = async (ticketId) => {
        try {
            const response = await fetch(apiUrl(`/api/tickets/${ticketId}`), {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(getActor())
            });
            const data = await response.json();
            if (response.ok && data.success) {
                toast.success(`Ticket ${ticketId} deleted.`);
                setSelectedTicket(null);
                refetch();
            } else {
                toast.error(data.message || 'Failed to delete ticket.');
            }
        } catch (error) {
            console.error('Delete ticket error:', error);
            toast.error('Failed to delete ticket. Please try again.');
        }
    };

    const handlePutHold = async (ticketId, holdData) => {
        try {
            const body = { ...holdData, ...getActor() };
            const response = await fetch(apiUrl(`/api/tickets/${ticketId}/hold`), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await response.json();
            if (response.ok && data.success) {
                toast.success(`ALECO System: Ticket ${ticketId} put on hold.`);
                refetch();
            } else {
                toast.error('Hold failed: ' + (data.message || 'Unknown error'));
            }
        } catch (error) {
            console.error('Hold error:', error);
            toast.error('Failed to put ticket on hold. Please try again.');
        }
    };

    const handleUpdateTicket = async (ticketId, newStatus, dispatchData = null) => {
        try {
            if (newStatus === 'Ongoing' && dispatchData) {
                const body = { ...dispatchData, ...getActor() };
                const response = await fetch(apiUrl(`/api/tickets/${ticketId}/dispatch`), {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    toast.success(`ALECO System: Crew successfully dispatched for Ticket ${ticketId}. SMS notifications sent.`);
                    refetch();
                } else {
                    toast.error("Dispatch failed: " + data.message);
                }
            }
            else if (['Pending', 'Restored', 'Unresolved', 'NoFaultFound', 'AccessDenied'].includes(newStatus)) {
                const isGroupMaster = ticketId?.startsWith('GROUP-');
                const url = isGroupMaster
                    ? apiUrl(`/api/tickets/group/${ticketId}/status`)
                    : apiUrl(`/api/tickets/${ticketId}/status`);

                const response = await fetch(url, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: newStatus, ...getActor() })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    const msg = newStatus === 'Pending'
                        ? `ALECO System: ${isGroupMaster ? 'Group' : 'Ticket'} ${ticketId} reverted to Pending. You can start resolution again.`
                        : `ALECO System: ${isGroupMaster ? 'Group' : 'Ticket'} ${ticketId} marked as ${newStatus}.`;
                    toast.success(msg);
                    refetch();
                } else {
                    toast.error("Status update failed: " + data.message);
                }
            }
        } catch (error) {
            console.error("Network error: ", error);
            toast.error("Network error. Please try again.");
        }
    };

    const handleLayoutChange = (newMode) => {
        if (newMode === 'map') {
            setIsMapOpen(true);
        } else {
            setViewMode(newMode);
        }
    };

    const handleBulkResolve = () => {
        if (selectedIds.length === 0) {
            toast.warning('No tickets selected');
            return;
        }
        setConfirmState({ open: true, type: 'bulkRestore', payload: null });
    };

    const executeBulkResolve = async () => {
        try {
            const groupMasters = selectedIds.filter(id => id?.startsWith('GROUP-'));
            const regularTickets = selectedIds.filter(id => !id?.startsWith('GROUP-'));

            for (const mainTicketId of groupMasters) {
                const response = await fetch(apiUrl(`/api/tickets/group/${mainTicketId}/status`), {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'Restored', ...getActor() })
                });
                const data = await response.json();
                if (!response.ok || !data.success) {
                    toast.error(`Failed to restore group ${mainTicketId}: ${data.message}`);
                    return;
                }
            }

            if (regularTickets.length > 0) {
                const response = await fetch(apiUrl('/api/tickets/bulk/restore'), {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ticketIds: regularTickets, ...getActor() })
                });

                const data = await response.json();

                if (!response.ok || !data.success) {
                    toast.error(`Failed: ${data.message}`);
                    return;
                }
            }

            toast.success(`${groupMasters.length + regularTickets.length} ticket(s) marked as Restored.`);
            setSelectedIds([]);
            refetch();
        } catch (error) {
            console.error('❌ Error bulk restoring tickets:', error);
            toast.error('Failed to restore tickets. Please try again.');
        }
        setConfirmState({ open: false, type: null, payload: null });
    };

    const handleConfirmBulkRestore = () => {
        executeBulkResolve();
    };

    const barRef = useRef(null);
    const { x, y, onStart } = useDraggable(barRef);

    return (
        <AdminLayout activePage="tickets">
            <div className="admin-page-container tickets-page-container">
                
                {/* ✅ STANDARD HEADER (LIKE PERSONNELMANAGEMENT.JSX) */}
                <div className="dashboard-header-flex">
                    <div className="header-text-group">
                        <h2 className="header-title">Support Tickets</h2>
                        <p className="header-subtitle">Track and resolve user reported issues.</p>
                    </div>
                </div>

                {error && (
                    <div className="error-banner">
                        {error}
                    </div>
                )}

                {/* ✅ DUAL-PANE: Filters (left) + Content (right) */}
                <TicketDualPaneLayout
                    leftPaneCollapsed={sidebarCollapsed}
                    leftPane={
                        <TicketFilterSidebar
                            filters={filters}
                            setFilters={setFilters}
                            tickets={tickets}
                            selectedIds={selectedIds}
                            setSelectedIds={setSelectedIds}
                            isCollapsed={sidebarCollapsed}
                            onToggleCollapse={() => setSidebarCollapsed(v => !v)}
                        />
                    }
                    layoutPicker={
                        <TicketLayoutPicker
                            activeLayout={viewMode}
                            onLayoutChange={handleLayoutChange}
                            filterButton={
                                <button
                                    type="button"
                                    className="ticket-filter-inline-btn"
                                    onClick={() => setFilterDrawerOpen(true)}
                                    aria-label="Open filters"
                                    title="Filters"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                                    </svg>
                                    {getActiveFiltersCount() > 0 && (
                                        <span className="ticket-filter-inline-badge">{getActiveFiltersCount()}</span>
                                    )}
                                </button>
                            }
                        />
                    }
                    selectAllBar={
                        <TicketSelectAllBar
                            tickets={tickets}
                            selectedIds={selectedIds}
                            setSelectedIds={setSelectedIds}
                        />
                    }
                    rightPane={
                <>
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
                </>
                    }
                />
            </div>

            {/* ✅ MODALS (OUTSIDE SCROLL CONTAINER) */}
            <TicketDetailPane 
                ticket={selectedTicket} 
                onClose={() => setSelectedTicket(null)}
                onUpdateTicket={handleUpdateTicket}
                onPutHold={handlePutHold}
                onDispatchGroup={handleDispatchGroup}
                onUngroup={executeUngroup}
                onDeleteTicket={handleDeleteTicket}
                onRefetch={refetch}
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
                                onClick={() => handleBulkResolve()}
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

            {confirmState.type === 'bulkRestore' && (
                <ConfirmModal
                    isOpen={confirmState.open}
                    onClose={() => setConfirmState({ open: false, type: null, payload: null })}
                    onConfirm={handleConfirmBulkRestore}
                    title="Bulk Restore"
                    message={`Mark ${selectedIds.length} ticket(s) as Restored?`}
                    confirmLabel="Restore"
                    cancelLabel="Cancel"
                />
            )}

            <TicketFilterDrawer
                isOpen={filterDrawerOpen}
                onClose={() => setFilterDrawerOpen(false)}
            >
                <TicketFilterBar
                    filters={filters}
                    setFilters={setFilters}
                    tickets={tickets}
                    selectedIds={selectedIds}
                    setSelectedIds={setSelectedIds}
                />
            </TicketFilterDrawer>

            <GroupIncidentModal
                isOpen={isGroupModalOpen}
                onClose={() => setIsGroupModalOpen(false)}
                selectedTickets={tickets.filter(t => selectedIds.includes(t.ticket_id) && !t.ticket_id?.startsWith('GROUP-'))}
                onSubmit={async (groupData) => {
                    try {
                        const response = await fetch(apiUrl('/api/tickets/group/create'), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(groupData)
                        });

                        const data = await response.json();

                        if (response.ok && data.success) {
                            toast.success(`Success! ${data.message} Main Ticket ID: ${data.mainTicketId}`);
                            setIsGroupModalOpen(false);
                            setSelectedIds([]);
                            refetch();
                        } else {
                            toast.error(`Failed to create group: ${data.message}`);
                        }
                    } catch (error) {
                        console.error('❌ Error creating ticket group:', error);
                        toast.error('Failed to create ticket group. Please try again.');
                    }
                }}
            />
        </AdminLayout>
    );
};

export default AdminTickets;

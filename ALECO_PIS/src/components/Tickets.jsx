import React, { useState, useRef} from 'react';
import AdminLayout from './AdminLayout';
import '../CSS/TicketMain.css'; 
import useTickets from '../utils/useTickets';
import UrgentTickets from './containers/UrgentTickets';
import useDraggable from '../utils/useDraggable';


// Importing the Lego Bricks
import TicketFilterBar from './tickets/TicketFilterBar';
import TicketListPane from './tickets/TicketListPane';
import TicketDetailPane from './tickets/TicketDetailPane';
import GroupIncidentModal from './tickets/GroupIncidentModal';


const AdminTickets = () => {
    // --- 1. Custom Hook Integration (The Engine) ---
    // We replace the old manual state and fetch logic entirely with this single line.
    // It automatically provides the tickets, the loading state, and the comprehensive filter object.
    const { tickets, loading: isLoading, error, filters, setFilters } = useTickets();
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    // --- 2. Master State (UI Only) ---
    // We only need to track which ticket the admin clicked on.
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [selectedIds, setSelectedIds] = useState([]);

    const toggleTicketSelection = (id) => {
    setSelectedIds(prev => 
        prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
};

    // --- 3. Wrapper Functions for Compatibility ---
    // The existing TicketFilterBar expects `activeTab` and `setActiveTab` separately.
    // We map these directly to our new filters state to keep the UI perfectly idempotent.
    const activeTab = filters.tab;
    const setActiveTab = (newTab) => setFilters(prev => ({ ...prev, tab: newTab }));
    const barRef = useRef(null);
    const { x, y, onStart } = useDraggable(barRef);

    // --- 4. Render Layout ---
    return (
        <AdminLayout activePage="tickets">
            {/* Page Header */}
            <div className="dashboard-header ticket-dashboard-header">
                <h2 className="header-title ticket-header-title">Support Tickets</h2>
                <p className="header-subtitle ticket-header-subtitle">Track and resolve user reported issues.</p>
            </div>

            {/* Error Banner (Optional, but good UX if the database connection fails) */}
            {error && (
                <div style={{ padding: '10px', backgroundColor: '#f8d7da', color: '#721c24', borderRadius: '4px', marginBottom: '10px' }}>
                    {error}
                </div>
            )}

            {/* Content Area */}
            <div className="dashboard-widget ticket-dashboard-widget">
                
                {/* BRICK 1: The Filter Engine */}
                
                <TicketFilterBar 
                    activeTab={activeTab} 
                    setActiveTab={setActiveTab} 
                    filters={filters} 
                    setFilters={setFilters} 

                    tickets={tickets} 
                    selectedIds={selectedIds} 
                    setSelectedIds={setSelectedIds}
            />

                {/* THE SINGLE POOL WORKSPACE */}
                <div style={{ marginTop: 'clamp(10px, 2vw, 20px)' }}>

                     <UrgentTickets 
                        tickets={tickets} 
                        onSelectTicket={setSelectedTicket} 
                        selectedIds={selectedIds} 
                        onToggleSelect={toggleTicketSelection}
                    />

                    <div className="separator">
                        <p style={{}}>Regular Tickets:</p>
                    </div>


                    {/* BRICK 2: Master List Wrapper (Takes 100% width now) */}
                    <div style={{
                        backgroundColor: 'var(--bg-card)', 
                        borderRadius: '8px', 
                        overflowY: 'auto',
                        boxShadow: '0 4px 6px var(--shadow-color-dark)',
                        border: '1px solid var(--bg-body)',
                        height: 'calc(100vh - 250px)',
                        minHeight: '400px'
                    }}>
                        <TicketListPane 
                            tickets={tickets} 
                            isLoading={isLoading}
                            selectedTicket={selectedTicket} 
                            onSelectTicket={setSelectedTicket} 
                            selectedIds={selectedIds} 
                            onToggleSelect={toggleTicketSelection}
                        />
                        
                    </div>

                </div>
            </div>

            {/* BRICK 3: Modal Detail View (Renders over everything if a ticket is selected) */}
            <TicketDetailPane 
                ticket={selectedTicket} 
                onClose={() => setSelectedTicket(null)}
                onUpdateTicket={(ticketId, newStatus) => {
                    // Update specific ticket logic here (We will tackle this next if you want!)
                }}

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
        {/* WE REMOVED THE onMouseDown={e => e.stopPropagation()} FROM HERE! */}
        <div className="bulk-bar-content">
             
             {/* THE NEW VISUAL DRAG INDICATOR (GRIP) */}
             <div className="drag-grip-indicator" title="Drag to move">
                 ⋮⋮
             </div>

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
         <GroupIncidentModal 
    isOpen={isGroupModalOpen}
    onClose={() => setIsGroupModalOpen(false)}
    
    /* THE FIX: We map the selectedIds back to their full ticket objects */
    selectedTickets={tickets.filter(t => selectedIds.includes(t.ticket_id))}
    
    onSubmit={(incidentData) => {
        console.log("Ready to send to database:", incidentData);
        // API logic goes here!
        setIsGroupModalOpen(false);
        setSelectedIds([]); 
    }}
/>

        </AdminLayout>
    );
};

export default AdminTickets;
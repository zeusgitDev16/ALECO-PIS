import React, { useState } from 'react';
import AdminLayout from './AdminLayout';
import '../CSS/TicketMain.css'; 
import useTickets from '../utils/useTickets';
import UrgentTickets from './containers/UrgentTickets';


// Importing the Lego Bricks
import TicketFilterBar from './tickets/TicketFilterBar';
import TicketListPane from './tickets/TicketListPane';
import TicketDetailPane from './tickets/TicketDetailPane';

const AdminTickets = () => {
    // --- 1. Custom Hook Integration (The Engine) ---
    // We replace the old manual state and fetch logic entirely with this single line.
    // It automatically provides the tickets, the loading state, and the comprehensive filter object.
    const { tickets, loading: isLoading, error, filters, setFilters } = useTickets();

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

        </AdminLayout>
    );
};

export default AdminTickets;
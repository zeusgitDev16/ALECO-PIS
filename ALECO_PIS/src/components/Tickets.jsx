import React, { useState, useEffect } from 'react';
import AdminLayout from './AdminLayout';
import '../CSS/TicketMain.css'; 

// Importing the Lego Bricks
import TicketFilterBar from './tickets/TicketFilterBar';
import TicketListPane from './tickets/TicketListPane';
import TicketDetailPane from './tickets/TicketDetailPane';

const AdminTickets = () => {
    // --- 1. Master State ---
    const [tickets, setTickets] = useState([]);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // --- 2. Filter & Tab State ---
    const [activeTab, setActiveTab] = useState('Open'); 
    const [filters, setFilters] = useState({
        searchQuery: '',
        municipality: '',
        category: ''
    });

    // --- 3. Backend Fetch Logic ---
    useEffect(() => {
        const fetchTickets = async () => {
            setIsLoading(true);
            try {
                // Placeholder for actual fetch call
            } catch (error) {
                console.error("Failed to fetch tickets:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTickets();
    }, [activeTab, filters]);

    // --- 4. Render Layout ---
    return (
        <AdminLayout activePage="tickets">
            {/* Page Header */}
            <div className="dashboard-header ticket-dashboard-header">
                <h2 className="header-title ticket-header-title">Support Tickets</h2>
                <p className="header-subtitle ticket-header-subtitle">Track and resolve user reported issues.</p>
            </div>

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
                        />
                    </div>

                </div>
            </div>

            {/* BRICK 3: Modal Detail View (Renders over everything if a ticket is selected) */}
            <TicketDetailPane 
                ticket={selectedTicket} 
                onClose={() => setSelectedTicket(null)}
                onUpdateTicket={(ticketId, newStatus) => {
                    // Update specific ticket logic here
                }}
            />

        </AdminLayout>
    );
};

export default AdminTickets;
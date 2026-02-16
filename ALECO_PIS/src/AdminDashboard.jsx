import React from 'react';
import AdminSidebar from './components/AdminSidebar';

const AdminDashboard = () => {
    return (
        <div style={{ 
            display: 'flex',       /* This "rows" them together */
            minHeight: '100vh',    /* Forces full screen height */
            backgroundColor: 'var(--bg-body)' /* Ensures consistent background */
        }}>
            
            {/* 1. Sidebar (Now a solid column) */}
            <AdminSidebar />

            {/* 2. Main Content Area */}
            {/* flex: 1 makes this take up ALL remaining width automatically */}
            <div style={{ 
                flex: 1, 
                padding: '40px',       /* Spacing inside the content area */
                overflowY: 'auto',     /* Allows content to scroll independently if needed */
                color: 'var(--text-header)' 
            }}>
                
                <header style={{ marginBottom: '30px' }}>
                    <h1 style={{ margin: 0 }}>ALECO Admin Dashboard</h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '10px' }}>
                        Welcome back, Admin-alecoDev. System status is stable.
                    </p>
                </header>
                
                {/* Dashboard Widgets / Content */}
                <div style={{ 
                    marginTop: '20px', 
                    padding: '50px', 
                    border: '2px dashed var(--text-secondary)', 
                    borderRadius: '12px',
                    backgroundColor: 'rgba(128, 128, 128, 0.05)',
                    textAlign: 'center' 
                }}>
                    <h3>Incident Reports will appear here</h3>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Select "Incidents" from the sidebar to view active tickets.
                    </p>
                </div>

            </div>
        </div>
    );
};

export default AdminDashboard;
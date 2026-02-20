import React from 'react';
import AdminLayout from './components/AdminLayout';
import './CSS/Dashboard.css';

const AdminDashboard = () => {
    return (
    <AdminLayout activePage="home">
                <header className="dashboard-header">
                    <h1 className="header-title">Admin Dashboard</h1>
                    <p className="header-subtitle">
                        Welcome back, Admin-alecoDev. System status is stable.
                    </p>
                </header>
                
                {/* Dashboard Widgets / Content */}
                <div className="dashboard-widget">
                    <h3>Incident Reports will appear here</h3>
                    <p className="widget-text">
                        Select "Incidents" from the sidebar to view active tickets.
                    </p>
                </div>
    </AdminLayout>
    );
};

export default AdminDashboard;
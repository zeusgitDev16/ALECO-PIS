import React from 'react';
import AdminLayout from './components/AdminLayout';
import './CSS/AdminPageLayout.css';

const AdminDashboard = () => {
    return (
        <AdminLayout activePage="home">
            <div className="admin-page-container">
                {/* Page Header */}
                <div className="dashboard-header-flex">
                    <div className="header-text-group">
                        <h2 className="header-title">Admin Dashboard</h2>
                        <p className="header-subtitle">
                            Welcome back, Admin-alecoDev. System status is stable.
                        </p>
                    </div>
                </div>

                {/* Main Content Card */}
                <div className="main-content-card">
                    <div className="placeholder-content">
                        <h3>Incident Reports will appear here</h3>
                        <p className="widget-text">
                            Select "Incidents" from the sidebar to view active tickets.
                        </p>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
};

export default AdminDashboard;
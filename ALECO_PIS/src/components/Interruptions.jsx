import React from 'react';
import AdminLayout from './AdminLayout';
import '../CSS/AdminPageLayout.css';
import '../CSS/Buttons.css';

const AdminInterruptions = () => {
  return (
    <AdminLayout activePage="interruptions">
      <div className="admin-page-container">
        {/* Page Header */}
        <div className="dashboard-header-flex">
          <div className="header-text-group">
            <h2 className="header-title">Power Interruptions</h2>
            <p className="header-subtitle">Manage scheduled and unscheduled power interruptions.</p>
          </div>
          <button className="btn-add-purple">+ Create New Post</button>
        </div>

        {/* Main Content Card */}
        <div className="main-content-card">
          <div className="placeholder-content">
            <h3>Recent Interruptions</h3>
            <p className="widget-text">
              Interruption logs will be displayed here.
            </p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminInterruptions;
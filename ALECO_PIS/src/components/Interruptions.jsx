import React from 'react';
import AdminLayout from './AdminLayout';

const AdminInterruptions = () => {
  return (
    <AdminLayout activePage="interruptions">
        <div className="dashboard-header">
          <h2 className="header-title">Power Interruptions</h2>
          <p className="header-subtitle">Manage scheduled and unscheduled power interruptions.</p>
        </div>

        {/* Content Area */}
        <div className="dashboard-widget">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h4 style={{ margin: 0 }}>Recent Interruptions</h4>
            <button className="main-login-btn" style={{ padding: '8px 16px' }}>+ Create New Post</button>
          </div>
          
          <div className="widget-text">
            {/* Placeholder for Table */}
            <div style={{ padding: '40px', border: '1px dashed var(--text-secondary)', borderRadius: '8px' }}>
              Interruption logs will be displayed here.
            </div>
          </div>
        </div>
    </AdminLayout>
  );
};

export default AdminInterruptions;
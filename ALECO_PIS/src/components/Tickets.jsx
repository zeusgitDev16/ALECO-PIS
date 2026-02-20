import React from 'react';
import AdminLayout from './AdminLayout';

const AdminTickets = () => {
  return (
    <AdminLayout activePage="tickets">
          {/* Page Header */}
          <div className="dashboard-header">
            <h2 className="header-title">Support Tickets</h2>
            <p className="header-subtitle">Track and resolve user reported issues.</p>
          </div>

          {/* Content Area */}
          <div className="dashboard-widget">
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <button className="main-login-btn" style={{ padding: '8px 16px' }}>Open</button>
              <button className="main-login-btn" style={{ padding: '8px 16px', backgroundColor: 'transparent', border: '1px solid var(--text-secondary)', color: 'var(--text-secondary)' }}>Closed</button>
            </div>
            
            <div className="widget-text">
              {/* Placeholder for Table */}
              <div style={{ padding: '40px', border: '1px dashed var(--text-secondary)', borderRadius: '8px' }}>
                Ticket list will be displayed here.
              </div>
            </div>
          </div>
    </AdminLayout>
  );
};

export default AdminTickets;
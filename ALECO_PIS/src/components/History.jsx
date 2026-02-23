import React from 'react';
import AdminLayout from './AdminLayout';


const AdminHistory = () => {
  return (
    <AdminLayout activePage="history">
        <div className="dashboard-header">
          <h2 className="header-title">History Logs</h2>
          <p className="header-subtitle">View system activity and audit trails.</p>
        </div>

        {/* Content Area */}
        <div className="dashboard-widget">
          <div className="widget-text">
            <div style={{ padding: '40px', border: '1px dashed var(--text-secondary)', borderRadius: '8px' }}>
              History logs will be displayed here.
            </div>
          </div>
        </div>
    </AdminLayout>
  );
};

export default AdminHistory;
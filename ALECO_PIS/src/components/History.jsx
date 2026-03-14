import React from 'react';
import AdminLayout from './AdminLayout';
import '../CSS/AdminPageLayout.css';


const AdminHistory = () => {
  return (
    <AdminLayout activePage="history">
      <div className="admin-page-container">
        {/* Page Header */}
        <div className="dashboard-header-flex">
          <div className="header-text-group">
            <h2 className="header-title">History Logs</h2>
            <p className="header-subtitle">View system activity and audit trails.</p>
          </div>
        </div>

        {/* Main Content Card */}
        <div className="main-content-card">
          <div className="placeholder-content">
            <h3>History Logs</h3>
            <p className="widget-text">
              History logs will be displayed here.
            </p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminHistory;
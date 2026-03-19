import React, { useState } from 'react';
import AdminLayout from './AdminLayout';
import InviteNewUsers from './containers/InviteNewUsers';
import AllUsers from './containers/AllUsers';
import '../CSS/AdminPageLayout.css';

const AdminUsers = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUserInvited = () => {
    setRefreshKey((k) => k + 1);
  };

  return (
    <AdminLayout activePage="users">
      <div className="admin-page-container">
        {/* Page Header */}
        <div className="dashboard-header-flex">
          <div className="header-text-group">
            <h2 className="header-title">User Management</h2>
            <p className="header-subtitle">View and manage system users, roles, and permissions.</p>
          </div>
        </div>

        {/* Main Content Card (Scrollable) */}
        <div className="main-content-card">
          {/* Invitation System Container */}
          <InviteNewUsers onUserInvited={handleUserInvited} />

          {/* Content Area */}
          <AllUsers refreshKey={refreshKey} />
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminUsers;

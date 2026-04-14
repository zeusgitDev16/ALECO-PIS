import React, { useState } from 'react';
import AdminLayout from './AdminLayout';
import InviteNewUsers from './containers/InviteNewUsers';
import AllUsers from './containers/AllUsers';
import UsersLayoutPicker from './users/UsersLayoutPicker';
import '../CSS/AdminPageLayout.css';
import '../CSS/UsersUIScale.css';
import '../CSS/UsersDashboard.css';

const AdminUsers = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [usersLayout, setUsersLayout] = useState('compact');

  const handleUserInvited = () => {
    setRefreshKey((k) => k + 1);
  };

  return (
    <AdminLayout activePage="users">
      <div className="admin-page-container users-page-container">
        {/* Page Header */}
        <div className="dashboard-header-flex users-page-header-row">
          <div className="header-text-group">
            <h2 className="header-title">User Management</h2>
            <p className="header-subtitle">View and manage system users, roles, and permissions.</p>
          </div>
          <UsersLayoutPicker activeLayout={usersLayout} onLayoutChange={setUsersLayout} />
        </div>

        {/* Main Content Card (Scrollable) */}
        <div className="main-content-card users-main-content">
          {/* Invitation System Container */}
          <InviteNewUsers onUserInvited={handleUserInvited} />

          {/* Content Area */}
          <AllUsers refreshKey={refreshKey} layout={usersLayout} />
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminUsers;

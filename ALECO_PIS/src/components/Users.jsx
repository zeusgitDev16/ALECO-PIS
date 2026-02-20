import React, { useState } from 'react';
import AdminLayout from './AdminLayout';
import InviteNewUsers from './containers/InviteNewUsers';
import AllUsers from './containers/AllUsers';

// Define roles globally to avoid "magic strings"
const USER_ROLES = {
  EMPLOYEE: 'employee',
  ADMIN: 'admin'
};

const AdminUsers = () => {
  // Mock Database of Users
  const [usersList, setUsersList] = useState([
    { id: 1, email: 'admin@aleco.com', role: USER_ROLES.ADMIN, code: 'Used', status: 'Active' },
    { id: 2, email: 'staff@aleco.com', role: USER_ROLES.EMPLOYEE, code: 'Used', status: 'Active' }
  ]);

  const handleUserInvited = (newUser) => {
    setUsersList([newUser, ...usersList]);
  };

  return (
    <AdminLayout activePage="users">
        {/* Page Header */}
        <div className="dashboard-header">
          <h2 className="header-title">User Management</h2>
          <p className="header-subtitle">View and manage system users, roles, and permissions.</p>
        </div>

        {/* Invitation System Container */}
        <InviteNewUsers onUserInvited={handleUserInvited} />

        {/* Content Area */}
        <AllUsers users={usersList} />
    </AdminLayout>
  );
};

export default AdminUsers;

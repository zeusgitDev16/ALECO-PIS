import React, { useState, useEffect } from 'react';
import { apiUrl } from '../../utils/api';
import { USER_ROLES } from '../../constants/userRoles';
import UserAvatar from './UserAvatar';
import UserAccountActionModal from '../users/UserAccountActionModal';
import '../../CSS/AllUsers.css';

const isActiveStatus = (user) => user.status === 'Active';

const AllUsers = ({ refreshKey = 0, layout = 'compact' }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [accountActionUser, setAccountActionUser] = useState(null);

  const fetchUsers = async () => {
    try {
      const response = await fetch(apiUrl('/api/users'));
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [refreshKey]);

  const filteredUsers = users.filter((user) => {
    const searchTerm = searchQuery.toLowerCase();
    return (
      (user.name && user.name.toLowerCase().includes(searchTerm)) ||
      (user.email && user.email.toLowerCase().includes(searchTerm))
    );
  });

  const activeUsers = filteredUsers.filter(isActiveStatus);
  const inactiveUsers = filteredUsers.filter((u) => !isActiveStatus(u));

  const openAccountActionModal = (user) => {
    const currentAdminEmail = localStorage.getItem('userEmail');
    if (user.email === currentAdminEmail) {
      alert('Safety Error: You cannot disable your own administrator account.');
      return;
    }
    setAccountActionUser(user);
  };

  const executeToggleStatus = async (user) => {
    const currentAdminEmail = localStorage.getItem('userEmail');
    const response = await fetch(apiUrl('/api/users/toggle-status'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: user.id,
        currentStatus: user.status,
        requesterEmail: currentAdminEmail
      })
    });

    if (!response.ok) {
      let message = 'Failed to update status.';
      try {
        const errorData = await response.json();
        if (errorData.error) message = errorData.error;
      } catch {
        /* ignore */
      }
      throw new Error(message);
    }
    await fetchUsers();
  };

  const emptyMessage = searchQuery
    ? `No users matching "${searchQuery}"`
    : 'No registered users found in the database.';

  const renderRoleStatus = (user) => (
    <div className="users-user-card-badges">
      <span className={`role-badge ${user.role === USER_ROLES.ADMIN ? 'admin' : 'employee'}`}>
        {user.role}
      </span>
      <span
        className={`users-user-card-status ${isActiveStatus(user) ? 'users-user-card-status--active' : 'users-user-card-status--inactive'}`}
      >
        {user.status}
      </span>
    </div>
  );

  const renderUserCard = (user) => (
    <article key={user.id} className="users-user-card">
      <div className="users-user-card-top">
        <div className="users-user-card-avatar-wrap">
          <UserAvatar
            user={user}
            imgClassName="users-user-card-avatar users-user-card-avatar--photo"
            fallbackClassName="users-user-card-avatar users-user-card-avatar--fallback"
          />
        </div>
        <div className="users-user-card-text">
          <div className="users-user-card-name">{user.name || 'N/A'}</div>
          <div className="users-user-card-email">{user.email}</div>
        </div>
      </div>
      <div className="users-user-card-meta">{renderRoleStatus(user)}</div>
      <div className="users-user-card-actions">
        <button type="button" className="action-btn-toggle" onClick={() => openAccountActionModal(user)}>
          {isActiveStatus(user) ? 'Disable' : 'Enable'}
        </button>
      </div>
    </article>
  );

  const renderCompactTable = () => (
    <div className="users-table-container users-table-container--compact">
      <table className="users-table">
        <thead>
          <tr>
            <th className="users-th-avatar" scope="col" aria-label="Profile" />
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Account Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredUsers.length > 0 ? (
            filteredUsers.map((user) => (
              <tr key={user.id}>
                <td className="users-td-avatar">
                  <UserAvatar
                    user={user}
                    imgClassName="users-table-avatar-img"
                    fallbackClassName="users-table-avatar-fallback"
                  />
                </td>
                <td className="user-name">{user.name || 'N/A'}</td>
                <td className="user-email">{user.email}</td>
                <td>
                  <span className={`role-badge ${user.role === USER_ROLES.ADMIN ? 'admin' : 'employee'}`}>
                    {user.role}
                  </span>
                </td>
                <td>
                  <span className={`status-dot ${isActiveStatus(user) ? 'active' : 'disabled'}`}>
                    ● {user.status}
                  </span>
                </td>
                <td>
                  <button type="button" className="action-btn-toggle" onClick={() => openAccountActionModal(user)}>
                    {isActiveStatus(user) ? 'Disable' : 'Enable'}
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="6" className="users-table-empty">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderCardGrid = () => (
    <div className="users-card-grid">
      {filteredUsers.length > 0 ? (
        filteredUsers.map((user) => renderUserCard(user))
      ) : (
        <div className="users-layout-empty">{emptyMessage}</div>
      )}
    </div>
  );

  const renderWorkflow = () => (
    <div className="users-workflow-board">
      <div className="users-workflow-column">
        <h5 className="users-workflow-column-title">Active</h5>
        <div className="users-workflow-column-scroll">
          {activeUsers.length > 0 ? (
            activeUsers.map((user) => renderUserCard(user))
          ) : (
            <p className="users-workflow-empty">{searchQuery ? 'No matches' : 'No active users'}</p>
          )}
        </div>
      </div>
      <div className="users-workflow-column">
        <h5 className="users-workflow-column-title">Inactive</h5>
        <div className="users-workflow-column-scroll">
          {inactiveUsers.length > 0 ? (
            inactiveUsers.map((user) => renderUserCard(user))
          ) : (
            <p className="users-workflow-empty">{searchQuery ? 'No matches' : 'No inactive users'}</p>
          )}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="dashboard-widget users-all-widget users-all-widget--loading">
        <p className="loading-text">Loading ALECO PIS Users...</p>
      </div>
    );
  }

  return (
    <>
      <div className="dashboard-widget users-all-widget">
        <div className="users-widget-header">
          <h4 className="users-widget-title">All Registered Users</h4>
          <div className="table-search-container">
            <input
              type="text"
              placeholder="Search by name or email..."
              className="table-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="widget-text">
          {layout === 'compact' && renderCompactTable()}
          {layout === 'card' && renderCardGrid()}
          {layout === 'workflow' && renderWorkflow()}
        </div>
      </div>

      <UserAccountActionModal
        isOpen={!!accountActionUser}
        user={accountActionUser}
        onClose={() => setAccountActionUser(null)}
        onValidatedConfirm={() => executeToggleStatus(accountActionUser)}
      />
    </>
  );
};

export default AllUsers;

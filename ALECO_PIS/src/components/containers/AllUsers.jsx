import React, { useState, useEffect } from 'react';
import { apiUrl } from '../../utils/api';
import { authFetch } from '../../utils/authFetch';
import { authMutation } from '../../utils/authMutation';
import { REALTIME_MODULES } from '../../constants/realtimeModules';
import { matchesRealtimeModule } from '../../utils/realtimeModules';
import { USER_ROLES } from '../../constants/userRoles';
import UserAvatar from './UserAvatar';
import UserAccountActionModal from '../users/UserAccountActionModal';
import '../../CSS/AllUsers.css';

const isActiveStatus = (user) => user.status === 'Active';

const AllUsers = ({ refreshKey = 0, layout = 'compact', showPendingInvites = true }) => {
  const [users, setUsers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [accountActionUser, setAccountActionUser] = useState(null);
  const currentRole = String(localStorage.getItem('userRole') || USER_ROLES.EMPLOYEE).toLowerCase();
  const canManageUsers = currentRole === USER_ROLES.ADMIN;
  const [loadError, setLoadError] = useState('');

  const fetchData = async () => {
    setLoadError('');
    try {
      const [usersRes, invitesRes] = await Promise.all([
        authFetch(apiUrl('/api/users')),
        authFetch(apiUrl('/api/invites/pending'))
      ]);
      const [usersData, invitesData] = await Promise.all([
        usersRes.json(),
        invitesRes.json()
      ]);
      const nextUsers = Array.isArray(usersData) ? usersData : [];
      const nextInvites = Array.isArray(invitesData) ? invitesData : [];
      setUsers(nextUsers);
      setPendingInvites(nextInvites);

      if (!Array.isArray(usersData) || !Array.isArray(invitesData)) {
        setLoadError('Some user data is unavailable for this account.');
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      setUsers([]);
      setPendingInvites([]);
      setLoadError('Unable to load user data right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [refreshKey]);

  useEffect(() => {
    const onRealtimeChange = (ev) => {
      if (matchesRealtimeModule(ev?.detail?.module, REALTIME_MODULES.USERS, REALTIME_MODULES.SYSTEM)) {
        fetchData();
      }
    };
    window.addEventListener('aleco:realtime-change', onRealtimeChange);
    return () => window.removeEventListener('aleco:realtime-change', onRealtimeChange);
  }, []);

  const filteredUsers = (Array.isArray(users) ? users : []).filter((user) => {
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
    const result = await authMutation(apiUrl('/api/users/toggle-status'), {
      method: 'POST',
      body: {
        id: user.id,
        currentStatus: user.status,
        requesterEmail: currentAdminEmail
      },
      emitRealtime: { module: REALTIME_MODULES.USERS },
    });

    if (!result.ok) {
      const errorData = result.data || {};
      const message = errorData.error || errorData.message || 'Failed to update status.';
      throw new Error(message);
    }
    await fetchData();
  };

  const emptyMessage = searchQuery
    ? `No users matching "${searchQuery}"`
    : 'No registered users found in the database.';

  const filteredPendingInvites = (Array.isArray(pendingInvites) ? pendingInvites : []).filter((invite) => {
    return invite.email && invite.email.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const renderPendingSection = () => (
    <div className="dashboard-widget users-pending-widget">
      <div className="users-widget-header">
        <h4 className="users-widget-title">Pending Account Invitations</h4>
      </div>
      <div className="widget-text">
        <div className="users-table-container users-table-container--compact">
          <table className="users-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role Assigned</th>
                <th>Invitation Code</th>
                <th>Sent At</th>
              </tr>
            </thead>
            <tbody>
              {filteredPendingInvites.length > 0 ? (
                filteredPendingInvites.map((invite, index) => (
                  <tr key={index}>
                    <td className="user-email">{invite.email}</td>
                    <td>
                      <span className={`role-badge ${invite.role_assigned === USER_ROLES.ADMIN ? 'admin' : 'employee'}`}>
                        {invite.role_assigned}
                      </span>
                    </td>
                    <td className="user-code">
                      <code className="invite-code-pill">{invite.code}</code>
                    </td>
                    <td className="sent-at">
                      {(() => {
                        const d = new Date(invite.created_at);
                        const datePart = d.toLocaleDateString('en-US', { 
                          month: 'long', 
                          day: 'numeric', 
                          year: 'numeric',
                          timeZone: 'Asia/Manila' 
                        });
                        const timePart = d.toLocaleTimeString('en-US', { 
                          hour: 'numeric', 
                          minute: '2-digit', 
                          hour12: true,
                          timeZone: 'Asia/Manila' 
                        });
                        return `${datePart} at ${timePart.toLowerCase()}`;
                      })()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="users-table-empty">
                    {searchQuery ? `No pending invitations matching "${searchQuery}"` : 'No pending invitations found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

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
      {canManageUsers ? (
        <div className="users-user-card-actions">
          <button type="button" className="action-btn-toggle" onClick={() => openAccountActionModal(user)}>
            {isActiveStatus(user) ? 'Disable' : 'Enable'}
          </button>
        </div>
      ) : null}
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
            {canManageUsers ? <th>Actions</th> : null}
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
                {canManageUsers ? (
                  <td>
                    <button type="button" className="action-btn-toggle" onClick={() => openAccountActionModal(user)}>
                      {isActiveStatus(user) ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                ) : null}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={canManageUsers ? 6 : 5} className="users-table-empty">
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
        {loadError && (
          <p className="users-load-warning" role="status" aria-live="polite">
            {loadError}
          </p>
        )}

        <div className="widget-text">
          {layout === 'compact' && renderCompactTable()}
          {layout === 'card' && renderCardGrid()}
          {layout === 'workflow' && renderWorkflow()}
        </div>
      </div>

      {showPendingInvites ? renderPendingSection() : null}

      {canManageUsers ? (
        <UserAccountActionModal
          isOpen={!!accountActionUser}
          user={accountActionUser}
          onClose={() => setAccountActionUser(null)}
          onValidatedConfirm={() => executeToggleStatus(accountActionUser)}
        />
      ) : null}
    </>
  );
};

export default AllUsers;

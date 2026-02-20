import React from 'react';
import '../../CSS/AllUsers.css';

const USER_ROLES = {
  EMPLOYEE: 'employee',
  ADMIN: 'admin'
};

const AllUsers = ({ users }) => {
  return (
    <div className="dashboard-widget">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h4 style={{ margin: 0 }}>All Users</h4>
      </div>
      
      <div className="widget-text">
        <div className="users-table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Code / Status</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="user-email">{user.email}</td>
                  <td>
                    <span className={`role-badge ${user.role === USER_ROLES.ADMIN ? 'admin' : 'employee'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="user-code">{user.code}</td>
                  <td>
                    <span className={`status-dot ${user.status === 'Active' ? 'active' : ''}`}>
                      ● {user.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AllUsers;
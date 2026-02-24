import React, { useState, useEffect } from 'react';
import '../../CSS/AllUsers.css';

const USER_ROLES = {
  EMPLOYEE: 'employee',
  ADMIN: 'admin'
};

const AllUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Fetch users from the database on mount
  const fetchUsers = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/users');
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error("Error loading users:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // 2. Handle the Enable/Disable toggle with Safety Measures
  const handleToggleStatus = async (user) => {
    const currentAdminEmail = localStorage.getItem('userEmail'); // The email of the person logged in

    // SAFETY PROCEDURE 2: Self-Preservation Check
    // Prevents an Admin from accidentally locking their own account
    if (user.email === currentAdminEmail) {
      alert("Safety Error: You cannot disable your own administrator account. This prevents accidental lockouts.");
      return;
    }

    const action = user.status === 'Active' ? 'DISABLE' : 'ENABLE';

    // SAFETY PROCEDURE 1: Typed Confirmation
    // Requires the admin to type the target email exactly to proceed
    const confirmation = window.prompt(
      `To ${action} ${user.name || user.email}, please type the exact email of the user to confirm:`
    );

    if (confirmation !== user.email) {
      alert("Action Cancelled: The email entered does not match the target account.");
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/users/toggle-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: user.id, 
          currentStatus: user.status,
          requesterEmail: currentAdminEmail // Passed for backend verification
        })
      });

      if (response.ok) {
        // Refresh the list after the change
        fetchUsers();
      } else {
        const errorData = await response.json();
        alert(errorData.error || "Failed to update status.");
      }
    } catch (error) {
      console.error("Toggle failed:", error);
    }
  };

  if (loading) return <div className="loading-text">Loading ALECO PIS Users...</div>;

  return (
    <div className="dashboard-widget">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h4 style={{ margin: 0 }}>All Registered Users</h4>
      </div>
      
      <div className="widget-text">
        <div className="users-table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Account Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length > 0 ? (
                users.map((user) => (
                  <tr key={user.id}>
                    <td className="user-name">{user.name || 'N/A'}</td>
                    <td className="user-email">{user.email}</td>
                    <td>
                      <span className={`role-badge ${user.role === USER_ROLES.ADMIN ? 'admin' : 'employee'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td>
                      <span className={`status-dot ${user.status === 'Active' ? 'active' : 'disabled'}`}>
                        ● {user.status}
                      </span>
                    </td>
                    <td>
                      <button 
                        className="action-btn-toggle" 
                        // Updated to pass the full user object for safety checks
                        onClick={() => handleToggleStatus(user)}
                      >
                        {user.status === 'Active' ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>
                    No registered users found in the database.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AllUsers;
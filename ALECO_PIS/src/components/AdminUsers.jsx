import React, { useState } from 'react';
import AdminSidebar from './AdminSidebar';
import '../CSS/AdminDashboard.css';

const AdminUsers = () => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('employee');
  const [invitationCode, setInvitationCode] = useState('');
  const [emailValid, setEmailValid] = useState(null);

  const handleGenerateCode = (e) => {
    e.preventDefault();
    // Generate a random 12-digit number
    const code = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    setInvitationCode(code);
    
    // In a real scenario, this is where you would make a POST request to your backend
    // await api.post('/invitations', { email, role, code });
    console.log(`Invitation generated for ${email} [${role}]: ${code}`);
  };

  const handleClear = () => {
    setEmail('');
    setRole('employee');
    setInvitationCode('');
    setEmailValid(null);
  };

  const handleEmailChange = (e) => {
    const val = e.target.value;
    setEmail(val);

    if (val.trim() === '') {
      setEmailValid(null);
    } else {
      // Validate email format (supports standard emails and gmail)
      const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
      setEmailValid(isValid);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(invitationCode);
    alert("Code copied to clipboard!");
  };

  return (
    <div className="admin-dashboard-container">
      <AdminSidebar activePage="users" />
      
      <div className="admin-main-wrapper">
        {/* Top Navigation */}
        <header className="admin-top-nav">
          <div className="search-container">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="20" 
              height="20" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className="search-icon"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input type="text" className="search-input" placeholder="Search..." />
          </div>
          
          <div className="action-icons">
            <button className="icon-btn" title="Notifications">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
            </button>
            <button className="icon-btn" title="Inbox">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
            </button>
            <button className="icon-btn" title="Settings">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            </button>
          </div>
        </header>

        <div className="admin-content">
        {/* Page Header */}
        <div className="dashboard-header">
          <h2 className="header-title">User Management</h2>
          <p className="header-subtitle">View and manage system users, roles, and permissions.</p>
        </div>

        {/* Invitation System Container */}
        <div className="dashboard-widget" style={{ marginBottom: '30px' }}>
          <h4 style={{ marginTop: 0, marginBottom: '20px' }}>Invite New User</h4>
          
          {!invitationCode ? (
            <form onSubmit={handleGenerateCode} className="invite-form">
              <div className="form-group">
                <label>Email Address</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={handleEmailChange}
                    placeholder="Enter user email"
                    className="form-input"
                    style={{ 
                      paddingRight: '40px',
                      borderColor: emailValid === true ? '#2e7d32' : emailValid === false ? '#d32f2f' : ''
                    }}
                  />
                  {emailValid === true && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2e7d32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}>
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  )}
                  {emailValid === false && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d32f2f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}>
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  )}
                </div>
              </div>
              
              <div className="form-group">
                <label>Role</label>
                <select 
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="form-input"
                >
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <button 
                type="submit"
                className="main-login-btn invite-btn"
                disabled={!emailValid}
                style={{ opacity: !emailValid ? 0.6 : 1, cursor: !emailValid ? 'not-allowed' : 'pointer' }}
              >
                Generate Code
              </button>
            </form>
          ) : (
            <div style={{ 
              backgroundColor: 'rgba(46, 125, 50, 0.1)', 
              padding: '20px', 
              borderRadius: '8px',
              border: '1px solid rgba(46, 125, 50, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '20px'
            }}>
              <div>
                <p style={{ margin: '0 0 5px 0', fontSize: '0.9rem', color: 'var(--text-main)' }}>Invitation Code for <strong>{email}</strong> ({role})</p>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--text-header)' }}>
                  {invitationCode}
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={copyToClipboard} className="main-login-btn" style={{ padding: '8px 16px' }}>
                  Copy Code
                </button>
                <button onClick={handleClear} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--text-secondary)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text-header)' }}>
                  Done
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="dashboard-widget">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h4 style={{ margin: 0 }}>All Users</h4>
          </div>
          
          <div className="widget-text">
            {/* Placeholder for Table */}
            <div style={{ padding: '40px', border: '1px dashed var(--text-secondary)', borderRadius: '8px' }}>
              User data table will be displayed here.
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

export default AdminUsers;

import React, { useState, useEffect } from 'react';
import API from '../../api/axiosConfig'; 
import '../../CSS/InviteNewUsers.css';

const USER_ROLES = {
  EMPLOYEE: 'employee',
  ADMIN: 'admin'
};

const InviteNewUsers = ({ onUserInvited }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState(USER_ROLES.EMPLOYEE);
  const [invitationCode, setInvitationCode] = useState('');
  const [emailValid, setEmailValid] = useState(null);
  
  const [userStatus, setUserStatus] = useState('new'); // Can be 'new', 'pending', or 'registered'

  // Real-time database check with a 500ms debounce
  useEffect(() => {
    if (emailValid && email.trim() !== '') {
      const delayDebounceFn = setTimeout(async () => {
        try {
          const response = await API.post('/api/check-email', { email });
          
         if (response.data.status === 'registered') {
            setUserStatus('registered'); 
            setRole(response.data.role); // <-- NEW: Automatically snap dropdown to current role

          } else if (response.data.status === 'pending') {
            setUserStatus('pending'); 
            setRole(response.data.role); // <-- NEW: Snap dropdown to their pending role

          } else {
            setUserStatus('new'); 
            setRole(USER_ROLES.EMPLOYEE); // <-- NEW: Reset to default Employee if it's a new email
          }
        } catch (error) {
          console.error("Database Check Error:", error);
        }
      }, 500);

      return () => clearTimeout(delayDebounceFn);
    } else {
      setUserStatus('new'); // FIXED: Replaced leftover setIsPending
    }
  }, [email, emailValid]);

  const handleGenerateCode = async (e) => { 
    e.preventDefault();
    const code = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    
    const newUser = {
      email: email,
      role: role,
      code: code
    };

    try {
      const response = await API.post('/api/invite', newUser);

      if (response.status === 200) {
        
        // NEW LOGIC: Check if it was just a role update
        if (response.data.action === 'role_updated') {
          alert(`Success! ${email} has been updated to ${role}.`);
          handleClear(); // Clear form, do NOT show the 12-digit code screen
        } else {
          // Standard logic for 'new' or 'pending' users
          setInvitationCode(code);
          
          if (onUserInvited) {
            onUserInvited({ ...newUser, id: Date.now(), status: 'Pending' });
          }
        }
      }
    } catch (error) {
      console.error("Global Hub Error:", error);
      alert("Communication failed. Is the Node.js office open?");
    }
  };

  const handleSendEmail = async () => {
    try {
      const response = await API.post('/api/send-email', {
        email: email,
        code: invitationCode
      });

      if (response.status === 200) {
        alert(`Email successfully sent to ${email}!`);
      }
    } catch (error) {
      console.error("Email Error:", error);
      alert("The mailman failed to deliver the message. Check the server console.");
    }
  };

  const handleClear = () => {
    setEmail('');
    setRole(USER_ROLES.EMPLOYEE);
    setInvitationCode('');
    setEmailValid(null);
    setUserStatus('new'); // FIXED: Replaced leftover setIsPending
  };

  const handleEmailChange = (e) => {
    const val = e.target.value;
    setEmail(val);
    
    // Reset status immediately when they start typing a new email
    setUserStatus('new'); // FIXED: Replaced leftover setIsPending

    if (val.trim() === '') {
      setEmailValid(null);
    } else {
      const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
      setEmailValid(isValid);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(invitationCode);
    alert("Code copied to clipboard!");
  };

  return (
    <div className="dashboard-widget" style={{ marginBottom: '30px' }}>
      <h4 style={{ marginTop: 0, marginBottom: '20px' }}>Invite / Manage User</h4>
      
      {!invitationCode ? (
        <form onSubmit={handleGenerateCode} className="invite-form">
          <div className="form-group">
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
              <label style={{ margin: 0 }}>Email Address</label>
              
              {/* ORANGE INDICATOR: Pending */}
              {userStatus === 'pending' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f57c00', fontSize: '10px', fontWeight: 'bold' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f57c00" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                  <span>Pending invite found. New code will overwrite.</span>
                </div>
              )}

              {/* BLUE INDICATOR: Registered */}
              {userStatus === 'registered' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#1976d2', fontSize: '10px', fontWeight: 'bold' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1976d2" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                  <span>User registered. Will update role directly.</span>
                </div>
              )}
            </div>

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
                  // DYNAMIC BORDER: Green if new, Orange if pending, Blue if registered, Red if invalid
                  borderColor: emailValid === true 
                    ? (userStatus === 'pending' ? '#f57c00' : userStatus === 'registered' ? '#1976d2' : '#2e7d32') 
                    : emailValid === false ? '#d32f2f' : ''
                }}
              />
              {/* Valid, New Email -> Green Check */}
              {emailValid === true && userStatus === 'new' && (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2e7d32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}>
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              )}
              {/* Invalid Format -> Red X */}
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
              <option value={USER_ROLES.EMPLOYEE}>Employee</option>
              <option value={USER_ROLES.ADMIN}>Admin</option>
            </select>
          </div>

          <button 
            type="submit"
            className="main-login-btn invite-btn"
            disabled={!emailValid}
            style={{ opacity: !emailValid ? 0.6 : 1, cursor: !emailValid ? 'not-allowed' : 'pointer' }}
          >
            {userStatus === 'registered' ? 'Update Role' : (userStatus === 'pending' ? 'Re-Generate Code' : 'Generate Code')}
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
          <p style={{ margin: '0 0 5px 0', fontSize: '0.9rem', color: 'var(--text-main)' }}>
            Invitation Code for <strong>{email}</strong> ({role})
          </p>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ 
              fontSize: '1.5rem', 
              fontWeight: 'bold', 
              fontFamily: 'monospace', 
              color: 'var(--text-header)' 
            }}>
              {invitationCode}
            </div>

            <button 
              onClick={copyToClipboard} 
              title="Copy to clipboard"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
                color: 'var(--text-secondary)',
                transition: 'color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-header)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
        </div>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleSendEmail} className="main-login-btn" style={{ padding: '8px 16px' }}>
              send
            </button>
            <button onClick={handleClear} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--text-secondary)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text-header)' }}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InviteNewUsers;
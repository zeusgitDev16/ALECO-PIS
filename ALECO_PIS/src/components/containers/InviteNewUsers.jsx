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
  const [errorMessage, setErrorMessage] = useState('');

  // NEW: Real-time database check with a 500ms debounce
  useEffect(() => {
    if (emailValid && email.trim() !== '') {
      const delayDebounceFn = setTimeout(async () => {
        try {
          // Asks your Node.js server to check the Aiven MySQL database
          const response = await API.post('/api/check-email', { email });
          
          if (response.data.exists) {
            setErrorMessage('Account already exists in the system');
          } else {
            setErrorMessage('');
          }
        } catch (error) {
          console.error("Database Check Error:", error);
        }
      }, 500); // Waits 500ms after the user stops typing

      return () => clearTimeout(delayDebounceFn);
    } else {
      setErrorMessage('');
    }
  }, [email, emailValid]);

  const handleGenerateCode = async (e) => { 
    e.preventDefault();
    setErrorMessage('');
    const code = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    
    const newUser = {
      email: email,
      role: role,
      code: code
    };

    try {
      const response = await API.post('/api/invite', newUser);

      if (response.status === 200) {
        setInvitationCode(code);
        
        if (onUserInvited) {
          onUserInvited({ ...newUser, id: Date.now(), status: 'Pending' });
        }
      }
    } catch (error) {
     if (error.response && error.response.status === 409) {
          setErrorMessage('Account already exists in the system');
      } else {
          console.error("Global Hub Error:", error);
          alert("Communication failed. Is the Node.js office open?");
      }
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
    setErrorMessage('');
  };

  const handleEmailChange = (e) => {
    const val = e.target.value;
    setEmail(val);
    
    // We remove setErrorMessage('') from here because useEffect handles it now!

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
      <h4 style={{ marginTop: 0, marginBottom: '20px' }}>Invite New User</h4>
      
      {!invitationCode ? (
        <form onSubmit={handleGenerateCode} className="invite-form">
          <div className="form-group">
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
              <label style={{ margin: 0 }}>Email Address</label>
              
              {errorMessage && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#d32f2f', fontSize: '8px', fontWeight: 'bold' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#d32f2f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  <span>{errorMessage}</span>
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
                  borderColor: emailValid === true ? (errorMessage ? '#d32f2f' : '#2e7d32') : emailValid === false ? '#d32f2f' : ''
                }}
              />
              {emailValid === true && !errorMessage && (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2e7d32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}>
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              )}
              {(emailValid === false || errorMessage) && (
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
            disabled={!emailValid || errorMessage}
            style={{ opacity: (!emailValid || errorMessage) ? 0.6 : 1, cursor: (!emailValid || errorMessage) ? 'not-allowed' : 'pointer' }}
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
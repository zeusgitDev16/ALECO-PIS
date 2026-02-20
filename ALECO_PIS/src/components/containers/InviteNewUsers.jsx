import React, { useState } from 'react';
import API from '../../api/axiosConfig'; // Using the Global Hub instead of raw axios
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

  const handleGenerateCode = async (e) => { 
    e.preventDefault();
    const code = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    
    const newUser = {
      email: email,
      role: role,
      code: code
    };

    try {
      // Clean and simple: only the mailbox name is needed
      // The Hub handles the 'http://localhost:5000' automatically
      const response = await API.post('/api/invite', newUser);

      if (response.status === 200) {
        setInvitationCode(code);
        
        if (onUserInvited) {
          onUserInvited({ ...newUser, id: Date.now(), status: 'Pending' });
        }
      }
    } catch (error) {
      console.error("Global Hub Error:", error);
      alert("Communication failed. Is the Node.js office open?");
    }
  };

  const handleClear = () => {
    setEmail('');
    setRole(USER_ROLES.EMPLOYEE);
    setInvitationCode('');
    setEmailValid(null);
  };

  const handleEmailChange = (e) => {
    const val = e.target.value;
    setEmail(val);

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
  );
};

export default InviteNewUsers;
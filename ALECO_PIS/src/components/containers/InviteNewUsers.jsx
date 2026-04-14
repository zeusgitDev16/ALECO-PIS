import React, { useState, useEffect } from 'react';
import API from '../../api/axiosConfig'; 
import { USER_ROLES } from '../../constants/userRoles';
import '../../CSS/InviteNewUsers.css';

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
          if (onUserInvited) onUserInvited();
        } else {
          // Standard logic for 'new' or 'pending' users
          setInvitationCode(code);
          
          if (onUserInvited) onUserInvited();
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

  const emailBorderColor =
    emailValid === true
      ? userStatus === 'pending'
        ? '#f57c00'
        : userStatus === 'registered'
          ? '#1976d2'
          : '#2e7d32'
      : emailValid === false
        ? '#d32f2f'
        : undefined;

  return (
    <div className="dashboard-widget users-invite-widget">
      <div className="users-invite-panel-head">
        <div className="users-invite-panel-icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </svg>
        </div>
        <div className="users-invite-panel-titles">
          <h4 className="users-invite-heading">Invite / Manage User</h4>
          <p className="users-invite-subtitle">Generate invitation codes, send email, or update roles for existing accounts.</p>
        </div>
      </div>

      {!invitationCode ? (
        <form onSubmit={handleGenerateCode} className="invite-form">
          <div className="form-group users-invite-email-group">
            <div className="users-invite-email-label-row">
              <label htmlFor="users-invite-email">Email Address</label>
            </div>

            {userStatus === 'pending' && (
              <div className="users-invite-status-banner users-invite-status--pending" role="status">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#f57c00" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                <span>Pending invite found. Generating a new code will overwrite the previous one.</span>
              </div>
            )}

            {userStatus === 'registered' && (
              <div className="users-invite-status-banner users-invite-status--registered" role="status">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#1976d2" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                <span>This email is already registered. Submit will update their role only (no new invite code).</span>
              </div>
            )}

            <div className="users-invite-input-wrap">
              <input
                id="users-invite-email"
                type="email"
                required
                value={email}
                onChange={handleEmailChange}
                placeholder="Enter user email"
                className="form-input"
                style={emailBorderColor ? { borderColor: emailBorderColor } : undefined}
              />
              {emailValid === true && userStatus === 'new' && (
                <svg
                  className="users-invite-input-icon"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#2e7d32"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              )}
              {emailValid === false && (
                <svg
                  className="users-invite-input-icon"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#d32f2f"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              )}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="users-invite-role">Role</label>
            <select id="users-invite-role" value={role} onChange={(e) => setRole(e.target.value)} className="form-input">
              <option value={USER_ROLES.EMPLOYEE}>Employee</option>
              <option value={USER_ROLES.ADMIN}>Admin</option>
            </select>
          </div>

          <button type="submit" className="main-login-btn invite-btn" disabled={!emailValid}>
            {userStatus === 'registered' ? 'Update Role' : userStatus === 'pending' ? 'Re-Generate Code' : 'Generate Code'}
          </button>
        </form>
      ) : (
        <div className="users-invite-success">
          <div>
            <p className="users-invite-success-lead">
              Invitation Code for <strong>{email}</strong> ({role})
            </p>

            <div className="users-invite-code-row">
              <div className="users-invite-code">{invitationCode}</div>

              <button type="button" onClick={copyToClipboard} title="Copy to clipboard" className="users-invite-copy-btn">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>
          </div>

          <div className="users-invite-actions">
            <button type="button" onClick={handleSendEmail} className="main-login-btn">
              send
            </button>
            <button type="button" onClick={handleClear} className="users-invite-btn-secondary">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InviteNewUsers;
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaEdit, FaSave, FaLock, FaHistory, FaLink, FaExternalLinkAlt } from 'react-icons/fa';
import { apiUrl } from '../../utils/api';
import { clearLocalStoragePreservingPreferences } from '../../utils/clearLocalStoragePreservingPreferences';
import { getSafeHttpUrl, getSafeResourceUrl } from '../../utils/safeUrl';
import '../../CSS/ProfilePage.css';

// --- Helpers ---
const TICKET_ACTION_LABELS = {
  status_change: 'Changed ticket status',
  hold:          'Put ticket on hold',
  dispatch:      'Dispatched crew',
  resolve:       'Resolved ticket',
  reopen:        'Reopened ticket',
  create:        'Created ticket',
  delete:        'Deleted ticket',
  assign:        'Assigned ticket',
  update:        'Updated ticket',
};

const B2B_ACTION_LABELS = {
  send:          'Sent B2B message',
  draft:         'Saved B2B draft',
  delete:        'Deleted B2B message',
  archive:       'Archived B2B message',
  resend:        'Resent B2B message',
  send_batch:    'Sent B2B batch',
};

const PERSONNEL_ACTION_LABELS = {
  add_crew:       'Added crew',
  update_crew:    'Updated crew',
  delete_crew:    'Deleted crew',
  add_lineman:    'Registered lineman',
  update_lineman: 'Updated lineman',
  delete_lineman: 'Removed lineman',
};

const CATEGORY_STYLES = {
  ticket:       { label: 'Ticket',       bg: 'rgba(59,130,246,0.12)',  color: '#3b82f6' },
  b2b:          { label: 'B2B Mail',     bg: 'rgba(168,85,247,0.12)', color: '#a855f7' },
  interruption: { label: 'Interruption', bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  personnel:    { label: 'Personnel',    bg: 'rgba(34,197,94,0.12)',  color: '#22c55e' },
};

function formatActionLabel(category, action, fromStatus, toStatus) {
  if (category === 'ticket') {
    const base = TICKET_ACTION_LABELS[action] || action.replace(/_/g, ' ');
    if (action === 'status_change' && fromStatus && toStatus) {
      return `${base}: ${fromStatus} → ${toStatus}`;
    }
    return base;
  }
  if (category === 'b2b') {
    return B2B_ACTION_LABELS[action] || action.replace(/_/g, ' ');
  }
  if (category === 'interruption') {
    return 'Updated interruption report';
  }
  if (category === 'personnel') {
    return PERSONNEL_ACTION_LABELS[action] || action.replace(/_/g, ' ');
  }
  return action.replace(/_/g, ' ');
}

function formatPhilippineTime(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('en-PH', {
      timeZone: 'Asia/Manila',
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  } catch {
    return dateStr;
  }
}

// --- Component ---
const ProfilePage = () => {
  const navigate = useNavigate();

  const [isEditing, setIsEditing]       = useState(false);
  const [isSaving, setIsSaving]         = useState(false);
  const [isLoading, setIsLoading]       = useState(true);
  const [showImageModal, setShowImageModal] = useState(false);

  // Change-password modal state
  const [showPwModal, setShowPwModal]   = useState(false);
  const [pwStep, setPwStep]             = useState(1);
  const [pwCode, setPwCode]             = useState('');
  const [pwNew, setPwNew]               = useState('');
  const [pwConfirm, setPwConfirm]       = useState('');
  const [pwLoading, setPwLoading]       = useState(false);

  // Activity logs
  const [activityLogs, setActivityLogs] = useState([]);
  const [logsLoading, setLogsLoading]   = useState(true);

  const [userData, setUserData] = useState({
    name:       localStorage.getItem('userName')       || 'User',
    email:      localStorage.getItem('userEmail')      || '',
    role:       (localStorage.getItem('userRole')      || 'admin').toLowerCase(),
    pic:        localStorage.getItem('googleProfilePic') || '',
    auth_method: null,
    bio:        '',
    address:    '',
    phone:      '',
    social_url: '',
    created_at: null,
  });

  // --- Fetch profile from DB on mount ---
  const fetchProfile = useCallback(async () => {
    const email = localStorage.getItem('userEmail');
    if (!email) { setIsLoading(false); return; }
    try {
      const res = await fetch(apiUrl(`/api/users/profile?email=${encodeURIComponent(email)}`));
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      setUserData({
        name:        data.name        || localStorage.getItem('userName') || 'User',
        email:       data.email       || email,
        role:        (data.role       || 'admin').toLowerCase(),
        pic:         data.profile_pic || localStorage.getItem('googleProfilePic') || '',
        auth_method: data.auth_method || null,
        bio:         data.bio         || '',
        address:     data.address     || '',
        phone:       data.phone       || '',
        social_url:  data.social_url  || '',
        created_at:  data.created_at  || null,
      });
    } catch {
      // fall back to localStorage values already in state
    } finally {
      setIsLoading(false);
    }
  }, []);

  // --- Fetch activity logs from DB on mount ---
  const fetchActivity = useCallback(async () => {
    const email = localStorage.getItem('userEmail');
    if (!email) { setLogsLoading(false); return; }
    try {
      const res = await fetch(apiUrl(`/api/users/activity?email=${encodeURIComponent(email)}`));
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      setActivityLogs(Array.isArray(data) ? data : []);
    } catch {
      setActivityLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
    fetchActivity();
  }, [fetchProfile, fetchActivity]);

  // --- Save profile ---
  const handleSaveProfile = async () => {
    if (!isEditing) { setIsEditing(true); return; }
    setIsSaving(true);
    try {
      const res = await fetch(apiUrl('/api/users/profile'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:      userData.email,
          name:       userData.name,
          bio:        userData.bio,
          phone:      userData.phone,
          address:    userData.address,
          social_url: userData.social_url,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Failed to save profile.');
        return;
      }
      localStorage.setItem('userName', userData.name);
      setIsEditing(false);
    } catch {
      alert('Network error. Profile could not be saved.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    fetchProfile();
  };

  // --- Change Password: Step 1 — send reset code ---
  const handleSendResetCode = async (e) => {
    e.preventDefault();
    setPwLoading(true);
    try {
      const res = await fetch(apiUrl('/api/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userData.email }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Failed to send reset code.');
        return;
      }
      setPwStep(2);
    } catch {
      alert('Network error. Could not send reset code.');
    } finally {
      setPwLoading(false);
    }
  };

  // --- Change Password: Step 2 — submit new password ---
  const handleConfirmReset = async (e) => {
    e.preventDefault();
    if (pwNew !== pwConfirm) { alert('Passwords do not match.'); return; }
    if (pwNew.length < 8)   { alert('Password must be at least 8 characters.'); return; }
    setPwLoading(true);
    try {
      const res = await fetch(apiUrl('/api/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userData.email, code: pwCode, newPassword: pwNew }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Reset failed.');
        return;
      }
      alert('Password changed successfully. You will be logged out.');
      setShowPwModal(false);
      clearLocalStoragePreservingPreferences();
      navigate('/');
    } catch {
      alert('Network error. Could not reset password.');
    } finally {
      setPwLoading(false);
    }
  };

  const closePwModal = () => {
    setShowPwModal(false);
    setPwStep(1);
    setPwCode('');
    setPwNew('');
    setPwConfirm('');
  };

  const isPasswordUser = userData.auth_method === 'password';

  if (isLoading) {
    return (
      <div className="profile-main-container">
        <p style={{ color: 'var(--color-text-muted)', padding: '40px' }}>Loading profile…</p>
      </div>
    );
  }

  const safeProfilePicSrc = userData.pic
    ? getSafeResourceUrl(userData.pic.replace(/=s\d+(-c)?/g, '=s1024-c'))
    : null;
  const safeSocialHref = getSafeHttpUrl(userData.social_url);

  return (
    <div className="profile-main-container">
      <header className="profile-header-text">
        <h1>Profile</h1>
        <p>View and manage your ALECO-PIS account details here.</p>
      </header>

      <div className="profile-grid-layout">
        {/* LEFT COLUMN: Overview Card */}
        <div className="profile-card sidebar-card">
          <div className="avatar-section">
            <div
              className={`avatar-ring role-${userData.role}`}
              onClick={() => safeProfilePicSrc && setShowImageModal(true)}
              title={safeProfilePicSrc ? 'Click to view full image' : undefined}
              style={safeProfilePicSrc ? undefined : { cursor: 'default' }}
            >
              <img
                src={safeProfilePicSrc ?? ''}
                alt="Profile"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
          <div className="user-intro">
            {isEditing ? (
              <input
                className="edit-input-field"
                value={userData.name}
                onChange={(e) => setUserData({ ...userData, name: e.target.value })}
              />
            ) : <h2>{userData.name}</h2>}
            <span className={`role-pill ${userData.role}`}>{userData.role.toUpperCase()}</span>
            {userData.created_at && (
              <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '8px' }}>
                Member since {formatPhilippineTime(userData.created_at).split(',')[0]}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="edit-profile-btn" onClick={handleSaveProfile} disabled={isSaving}>
              {isSaving ? 'Saving…' : isEditing ? <><FaSave /> Save</> : <><FaEdit /> Edit Profile</>}
            </button>
            {isEditing && (
              <button className="edit-profile-btn" onClick={handleCancelEdit}
                style={{ background: 'transparent', border: '1px solid var(--color-text-muted)', color: 'var(--color-text-muted)' }}>
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Account Details */}
        <div className="profile-card details-card">
          <div className="details-header-row">
            <h3>Account Details</h3>
            <span className="online-indicator"></span>
          </div>

          <div className="info-details-grid">
            <div className="info-group" style={{ gridColumn: 'span 2' }}>
              <label>Bio</label>
              {isEditing ? (
                <textarea
                  className="edit-input-field"
                  value={userData.bio}
                  placeholder="Write a short bio…"
                  onChange={(e) => setUserData({ ...userData, bio: e.target.value })}
                />
              ) : <p>{userData.bio || '—'}</p>}
            </div>

            <div className="info-group">
              <label>My Email</label>
              <p>{userData.email}</p>
            </div>

            <div className="info-group">
              <label>Phone Number</label>
              {isEditing ? (
                <input
                  className="edit-input-field"
                  value={userData.phone}
                  placeholder="+63 000 000 0000"
                  onChange={(e) => setUserData({ ...userData, phone: e.target.value })}
                />
              ) : <p>{userData.phone || '—'}</p>}
            </div>

            <div className="info-group" style={{ gridColumn: 'span 2' }}>
              <label>My Address</label>
              {isEditing ? (
                <input
                  className="edit-input-field"
                  value={userData.address}
                  placeholder="City, Province"
                  onChange={(e) => setUserData({ ...userData, address: e.target.value })}
                />
              ) : <p>{userData.address || '—'}</p>}
            </div>

            <div className="info-group">
              <label><FaLock /> Security</label>
              {isPasswordUser ? (
                <button
                  type="button"
                  className="change-pass-btn"
                  onClick={() => setShowPwModal(true)}
                >
                  Change Password
                </button>
              ) : (
                <button type="button" className="change-pass-btn" disabled
                  style={{ opacity: 0.5, cursor: 'not-allowed' }}
                  title="Your account is managed via Google sign-in"
                >
                  Managed via Google
                </button>
              )}
            </div>
          </div>
        </div>

        {/* CONNECT CARD */}
        <div className="profile-card social-media-container">
          <h3><FaLink /> Connect</h3>
          <div className="social-links-flex">
            <div className="social-item">
              <FaLink className="social-icon" />
              {isEditing ? (
                <input
                  className="edit-input-field"
                  style={{ marginLeft: '12px', flex: 1 }}
                  value={userData.social_url}
                  placeholder="https://linkedin.com/in/yourprofile"
                  onChange={(e) => setUserData({ ...userData, social_url: e.target.value })}
                />
              ) : userData.social_url ? (
                safeSocialHref ? (
                <a
                  href={safeSocialHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-text"
                  style={{ marginLeft: '12px', color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {userData.social_url.replace(/^https?:\/\//, '')}
                  <FaExternalLinkAlt style={{ fontSize: '0.7rem', opacity: 0.6 }} />
                </a>
                ) : (
                  <span className="social-text" style={{ marginLeft: '12px', color: 'var(--color-text-muted)' }} title="Only http(s) links are allowed">
                    Invalid link (use https://…)
                  </span>
                )
              ) : (
                <span className="social-text" style={{ marginLeft: '12px', color: 'var(--color-text-muted)' }}>
                  No link added
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ACTIVITY LOGS CARD */}
        <div className="profile-card activity-logs-container">
          <h3><FaHistory /> Activity Logs</h3>
          {logsLoading ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Loading…</p>
          ) : activityLogs.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>No activity recorded yet.</p>
          ) : (
            <ul className="activity-log-list">
              {activityLogs.map((log, i) => {
                const cat = CATEGORY_STYLES[log.category] || { label: log.category, bg: 'rgba(128,128,128,0.1)', color: 'var(--color-text-muted)' };
                return (
                  <li key={i} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                      <span style={{
                        fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px',
                        borderRadius: '10px', background: cat.bg, color: cat.color,
                        flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em',
                      }}>
                        {cat.label}
                      </span>
                      <span style={{ flex: 1 }}>
                        {formatActionLabel(log.category, log.action, log.from_status, log.to_status)}
                        {log.reference_id && (
                          <span style={{ fontSize: '0.75em', color: 'var(--color-text-muted)', marginLeft: '6px' }}>
                            #{log.reference_id}
                          </span>
                        )}
                      </span>
                    </div>
                    {log.detail && (
                      <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', paddingLeft: '4px' }}>
                        {log.detail}
                      </span>
                    )}
                    <small style={{ alignSelf: 'flex-end' }}>{formatPhilippineTime(log.created_at)}</small>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* FULL SCREEN IMAGE MODAL */}
      {showImageModal && safeProfilePicSrc && (
        <div className="profile-image-modal" onClick={() => setShowImageModal(false)}>
          <img
            src={safeProfilePicSrc}
            alt="Full Profile View"
            referrerPolicy="no-referrer"
          />
        </div>
      )}

      {/* CHANGE PASSWORD MODAL */}
      {showPwModal && (
        <div className="profile-image-modal"
          style={{ alignItems: 'center', cursor: 'default' }}
          onClick={(e) => { if (e.target === e.currentTarget) closePwModal(); }}
        >
          <div onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-profile-card)',
              border: '1px solid var(--card-border)',
              borderRadius: '16px',
              padding: '32px',
              width: '100%',
              maxWidth: '420px',
              color: 'var(--color-text-main)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            }}
          >
            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem' }}>
              {pwStep === 1 ? 'Change Password' : 'Enter Reset Code'}
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '20px' }}>
              {pwStep === 1
                ? `A reset code will be sent to ${userData.email}`
                : `Enter the 8-character code sent to ${userData.email}`}
            </p>

            {pwStep === 1 ? (
              <form onSubmit={handleSendResetCode} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button className="edit-profile-btn" type="submit" disabled={pwLoading}
                  style={{ width: '100%', justifyContent: 'center' }}>
                  {pwLoading ? 'Sending…' : 'Send Reset Code'}
                </button>
                <button type="button" className="change-pass-btn" onClick={closePwModal}>Cancel</button>
              </form>
            ) : (
              <form onSubmit={handleConfirmReset} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input
                  className="edit-input-field"
                  type="text"
                  placeholder="8-character code"
                  maxLength={8}
                  value={pwCode}
                  onChange={(e) => setPwCode(e.target.value)}
                  required
                />
                <input
                  className="edit-input-field"
                  type="password"
                  placeholder="New password (min 8 chars)"
                  value={pwNew}
                  onChange={(e) => setPwNew(e.target.value)}
                  required
                />
                <input
                  className="edit-input-field"
                  type="password"
                  placeholder="Confirm new password"
                  value={pwConfirm}
                  onChange={(e) => setPwConfirm(e.target.value)}
                  required
                />
                <button className="edit-profile-btn" type="submit" disabled={pwLoading}
                  style={{ width: '100%', justifyContent: 'center' }}>
                  {pwLoading ? 'Saving…' : 'Set New Password'}
                </button>
                <button type="button" className="change-pass-btn" onClick={closePwModal}>Cancel</button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
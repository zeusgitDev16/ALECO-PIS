import React, { useState, useEffect, useCallback } from 'react';
import {
  FaHistory, FaLink, FaExternalLinkAlt,
  FaFacebook, FaInstagram, FaLinkedin, FaGithub, FaGlobe, FaYoutube, FaTiktok,
} from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import { apiUrl } from '../../utils/api';
import { authFetch } from '../../utils/authFetch';
import { getSafeHttpUrl, getSafeResourceUrl } from '../../utils/safeUrl';
import '../../CSS/UserProfileViewModal.css';

const SOCIAL_PLATFORMS = [
  { value: 'Facebook',  icon: FaFacebook },
  { value: 'Instagram', icon: FaInstagram },
  { value: 'LinkedIn',  icon: FaLinkedin },
  { value: 'GitHub',    icon: FaGithub },
  { value: 'X',         icon: FaXTwitter },
  { value: 'YouTube',   icon: FaYoutube },
  { value: 'TikTok',    icon: FaTiktok },
  { value: 'Website',   icon: FaGlobe },
];

const CATEGORY_STYLES = {
  ticket:       { label: 'Ticket',       bg: 'rgba(59,130,246,0.12)',  color: '#3b82f6' },
  b2b:          { label: 'B2B Mail',     bg: 'rgba(168,85,247,0.12)', color: '#a855f7' },
  interruption: { label: 'Interruption', bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  personnel:    { label: 'Personnel',    bg: 'rgba(34,197,94,0.12)',  color: '#22c55e' },
};

const TICKET_ACTION_LABELS = {
  status_change: 'Changed ticket status', hold: 'Put ticket on hold',
  dispatch: 'Dispatched crew', resolve: 'Resolved ticket',
  reopen: 'Reopened ticket', create: 'Created ticket',
  delete: 'Deleted ticket', assign: 'Assigned ticket', update: 'Updated ticket',
};
const B2B_ACTION_LABELS = {
  send: 'Sent B2B message', draft: 'Saved draft', delete: 'Deleted message',
  archive: 'Archived message', resend: 'Resent message', send_batch: 'Sent batch',
};
const PERSONNEL_ACTION_LABELS = {
  add_crew: 'Added crew', update_crew: 'Updated crew', delete_crew: 'Deleted crew',
  add_lineman: 'Registered lineman', update_lineman: 'Updated lineman', delete_lineman: 'Removed lineman',
};

function formatActionLabel(category, action, fromStatus, toStatus) {
  if (category === 'ticket') {
    const base = TICKET_ACTION_LABELS[action] || action.replace(/_/g, ' ');
    if (action === 'status_change' && fromStatus && toStatus) return `${base}: ${fromStatus} → ${toStatus}`;
    return base;
  }
  if (category === 'b2b') return B2B_ACTION_LABELS[action] || action.replace(/_/g, ' ');
  if (category === 'interruption') return 'Updated interruption report';
  if (category === 'personnel') return PERSONNEL_ACTION_LABELS[action] || action.replace(/_/g, ' ');
  return action.replace(/_/g, ' ');
}

function formatPhilTime(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('en-PH', {
      timeZone: 'Asia/Manila', month: 'short', day: 'numeric',
      year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
    });
  } catch { return dateStr; }
}

const defaultAvatar = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';

const UserProfileViewModal = ({ email, onClose }) => {
  const [profile, setProfile]     = useState(null);
  const [activity, setActivity]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [actLoading, setActLoading] = useState(true);
  const [showBigAvatar, setShowBigAvatar] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!email) return;
    try {
      const r = await authFetch(apiUrl(`/api/users/profile?email=${encodeURIComponent(email)}`));
      if (!r.ok) throw new Error();
      const d = await r.json();
      setProfile(d);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [email]);

  const fetchActivity = useCallback(async () => {
    if (!email) return;
    try {
      const r = await authFetch(apiUrl(`/api/users/activity?email=${encodeURIComponent(email)}`));
      if (!r.ok) throw new Error();
      const d = await r.json();
      setActivity(Array.isArray(d) ? d : []);
    } catch {
      setActivity([]);
    } finally {
      setActLoading(false);
    }
  }, [email]);

  useEffect(() => {
    fetchProfile();
    fetchActivity();
  }, [fetchProfile, fetchActivity]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const role = (profile?.role || 'employee').toLowerCase();
  const safePic = profile?.profile_pic
    ? getSafeResourceUrl(profile.profile_pic.replace(/=s\d+(-c)?/g, '=s1024-c'))
    : null;

  const socialLinks = (() => {
    try {
      const raw = profile?.social_url;
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((x) => x?.url);
    } catch { /* not JSON */ }
    if (typeof profile?.social_url === 'string' && profile.social_url.trim()) {
      return [{ platform: 'Website', url: profile.social_url.trim() }];
    }
    return [];
  })();

  return (
    <div className="upvm-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="upvm-panel" role="dialog" aria-modal="true" aria-label="User profile">

        {/* Header */}
        <div className="upvm-header">
          <span className="upvm-header__title">User Profile</span>
          <button type="button" className="upvm-close-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        {loading ? (
          <div className="upvm-loading">
            <span className="upvm-spinner" />
            Loading profile…
          </div>
        ) : !profile ? (
          <div className="upvm-loading upvm-error">Could not load profile for <strong>{email}</strong>.</div>
        ) : (
          <div className="upvm-body">
            {/* Avatar + identity */}
            <div className="upvm-sidebar">
              <div
                className={`upvm-avatar-ring upvm-role-${role}`}
                onClick={() => safePic && setShowBigAvatar(true)}
                title={safePic ? 'Click to enlarge' : undefined}
                style={safePic ? undefined : { cursor: 'default' }}
              >
                <img
                  src={safePic ?? defaultAvatar}
                  alt={profile.name || email}
                  referrerPolicy="no-referrer"
                  onError={(e) => { e.target.src = defaultAvatar; }}
                />
              </div>
              <div className="upvm-identity">
                <h2 className="upvm-name">{profile.name || '—'}</h2>
                <span className={`upvm-role-pill upvm-role-pill--${role}`}>{role.toUpperCase()}</span>
                {profile.created_at && (
                  <p className="upvm-since">
                    Member since {formatPhilTime(profile.created_at).split(',')[0]}
                  </p>
                )}
              </div>

              {/* Connect — below identity, matches ProfilePage layout */}
              <div className="upvm-sidebar-connect">
                <p className="upvm-sidebar-connect__title"><FaLink style={{ marginRight: 5 }} />Connect</p>
                {socialLinks.length === 0 ? (
                  <p className="upvm-muted">No links added yet.</p>
                ) : (
                  <div className="upvm-social-list">
                    {socialLinks.map((row, i) => {
                      const Icon = SOCIAL_PLATFORMS.find((x) => x.value === row.platform)?.icon || FaGlobe;
                      const href = getSafeHttpUrl(row.url);
                      return (
                        <div key={i} className="upvm-social-item">
                          <Icon className="upvm-social-icon" />
                          {href ? (
                            <a href={href} target="_blank" rel="noopener noreferrer" className="upvm-social-link">
                              {String(row.url).replace(/^https?:\/\//, '')}
                              <FaExternalLinkAlt style={{ fontSize: '0.65rem', opacity: 0.6, marginLeft: 4 }} />
                            </a>
                          ) : (
                            <span className="upvm-social-invalid">Invalid link</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Details */}
            <div className="upvm-details">
              <div className="upvm-card">
                <h3 className="upvm-card__title">Account Details</h3>
                <div className="upvm-info-grid">
                  {profile.bio && (
                    <div className="upvm-info-group upvm-span2">
                      <label>Bio</label>
                      <p>{profile.bio}</p>
                    </div>
                  )}
                  <div className="upvm-info-group">
                    <label>Email</label>
                    <p>{profile.email}</p>
                  </div>
                  <div className="upvm-info-group">
                    <label>Phone</label>
                    <p>{profile.phone || '—'}</p>
                  </div>
                  <div className="upvm-info-group upvm-span2">
                    <label>Address</label>
                    <p>{profile.address || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Activity logs */}
              <div className="upvm-card">
                <h3 className="upvm-card__title"><FaHistory style={{ marginRight: 6 }} />Activity Logs</h3>
                {actLoading ? (
                  <p className="upvm-muted">Loading…</p>
                ) : activity.length === 0 ? (
                  <p className="upvm-muted">No activity recorded yet.</p>
                ) : (
                  <div className="upvm-activity-scroll">
                    <ul className="upvm-activity-list">
                      {activity.map((log, i) => {
                        const cat = CATEGORY_STYLES[log.category] || { label: log.category, bg: 'rgba(128,128,128,0.1)', color: 'var(--text-secondary)' };
                        return (
                          <li key={i} className="upvm-activity-item">
                            <div className="upvm-activity-row">
                              <span className="upvm-activity-badge" style={{ background: cat.bg, color: cat.color }}>
                                {cat.label}
                              </span>
                              <span className="upvm-activity-action">
                                {formatActionLabel(log.category, log.action, log.from_status, log.to_status)}
                                {log.reference_id && (
                                  <span className="upvm-activity-ref">#{log.reference_id}</span>
                                )}
                              </span>
                            </div>
                            {log.detail && <span className="upvm-activity-detail">{log.detail}</span>}
                            <small className="upvm-activity-time">{formatPhilTime(log.created_at)}</small>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Full-size avatar */}
      {showBigAvatar && safePic && (
        <div className="upvm-bigavatar-overlay" onClick={() => setShowBigAvatar(false)}>
          <img src={safePic} alt="Full profile" referrerPolicy="no-referrer" />
        </div>
      )}
    </div>
  );
};

export default UserProfileViewModal;

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiUrl } from '../../utils/api';
import { authFetch } from '../../utils/authFetch';
import { clearLocalStoragePreservingPreferences } from '../../utils/clearLocalStoragePreservingPreferences';
import { useTheme } from '../../context/ThemeContext';
import { getSafeResourceUrl } from '../../utils/safeUrl';
import ThemeIconButton from '../buttons/ThemeIconButton';
import '../../CSS/SearchBarGlobal.css';

const NOTIFICATION_TABS = [
  { id: 'user', label: 'User' },
  { id: 'personnel', label: 'Personnel' },
  { id: 'b2b-mail', label: 'B2B mail' },
  { id: 'tickets', label: 'Tickets' },
  { id: 'interruptions', label: 'Interruptions' },
  { id: 'memo', label: 'Memo' },
  { id: 'system', label: 'System' },
];

const USER_EVENT_LABELS = {
  user_invited: 'Invited',
  user_disabled: 'Disabled',
  user_registered: 'Registered',
};

const PERSONNEL_EVENT_LABELS = {
  crew_created: 'Crew created',
  crew_deleted: 'Crew deleted',
  lineman_created: 'Lineman added',
  lineman_deleted: 'Lineman removed',
};

const B2B_MAIL_EVENT_LABELS = {
  b2b_contact_created: 'Contact created',
  b2b_contact_edited: 'Contact edited',
  b2b_contact_disabled: 'Contact disabled',
  b2b_message_sent: 'Message sent',
  b2b_reply_fetched: 'Reply fetched',
};

const TICKETS_EVENT_LABELS = {
  ticket_submitted_report: 'New report',
  ticket_status_changed: 'Status changed',
  ticket_deleted: 'Ticket deleted',
};

const INTERRUPTIONS_EVENT_LABELS = {
  interruption_created_scheduled: 'Scheduled advisory',
  interruption_created_emergency: 'Emergency advisory',
  interruption_created_ngc_scheduled: 'NGCP scheduled advisory',
  interruption_created_unscheduled: 'Emergency advisory (legacy)',
  interruption_archived: 'Archived',
  interruption_type_changed: 'Type changed',
  interruption_status_changed: 'Status changed',
};

const MEMO_EVENT_LABELS = {
  memo_created: 'Memo created',
  memo_updated: 'Memo updated',
  memo_closed: 'Memo closed',
  memo_deleted: 'Memo deleted',
};

function emptyNotificationCounts() {
  const o = {};
  NOTIFICATION_TABS.forEach((t) => {
    o[t.id] = 0;
  });
  return o;
}

function formatNotificationTime(createdAt) {
  if (!createdAt) return '';
  try {
    const d = new Date(createdAt);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '';
  }
}

const TAB_LABEL_BY_ID = Object.fromEntries(NOTIFICATION_TABS.map((t) => [t.id, t.label]));

const EVENT_LABEL_MAPS = {
  user: USER_EVENT_LABELS,
  personnel: PERSONNEL_EVENT_LABELS,
  'b2b-mail': B2B_MAIL_EVENT_LABELS,
  tickets: TICKETS_EVENT_LABELS,
  interruptions: INTERRUPTIONS_EVENT_LABELS,
  memo: MEMO_EVENT_LABELS,
  system: {},
};

function eventLabelForTab(tabId, kind) {
  const m = EVENT_LABEL_MAPS[tabId];
  return (m && m[kind]) || kind;
}

// 1. Accept the toggleSidebar prop from AdminLayout
const SearchBarGlobal = ({ toggleSidebar }) => {
  const { theme, toggleTheme } = useTheme();
  const defaultAvatar =
    'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
  const [profilePic, setProfilePic] = useState(defaultAvatar);
  const [role, setRole] = useState('employee');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notificationTab, setNotificationTab] = useState(NOTIFICATION_TABS[0].id);
  const [userNotifications, setUserNotifications] = useState([]);
  const [userNotificationsLoading, setUserNotificationsLoading] = useState(false);
  const [personnelNotifications, setPersonnelNotifications] = useState([]);
  const [personnelNotificationsLoading, setPersonnelNotificationsLoading] = useState(false);
  const [b2bMailNotifications, setB2bMailNotifications] = useState([]);
  const [b2bMailNotificationsLoading, setB2bMailNotificationsLoading] = useState(false);
  const [ticketsNotifications, setTicketsNotifications] = useState([]);
  const [ticketsNotificationsLoading, setTicketsNotificationsLoading] = useState(false);
  const [interruptionsNotifications, setInterruptionsNotifications] = useState([]);
  const [interruptionsNotificationsLoading, setInterruptionsNotificationsLoading] = useState(false);
  const [memoNotifications, setMemoNotifications] = useState([]);
  const [memoNotificationsLoading, setMemoNotificationsLoading] = useState(false);
  const [notificationCounts, setNotificationCounts] = useState(emptyNotificationCounts);
  const [notificationListVersion, setNotificationListVersion] = useState(0);
  const [markAllReadLoading, setMarkAllReadLoading] = useState(false);
  const [notificationDetail, setNotificationDetail] = useState(null);
  const [markOneReadLoadingId, setMarkOneReadLoadingId] = useState(null);
  const notificationsRef = useRef(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  // Secure feature state for global logout
  const [logoutAllDevices, setLogoutAllDevices] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    const updateProfile = () => {
      const storedPic = localStorage.getItem('googleProfilePic');
      const storedRole = localStorage.getItem('userRole'); 
      
      if (storedPic && storedPic !== 'null' && storedPic !== 'undefined') {
        setProfilePic(storedPic);
      } else {
        setProfilePic(defaultAvatar);
      }

      if (storedRole) {
        setRole(storedRole.toLowerCase());
      } else {
        setRole('employee');
      }
    };

    updateProfile();
    window.addEventListener('storage', updateProfile);
    return () => window.removeEventListener('storage', updateProfile);
  }, []);

  // Add/remove class to body when logout or notification detail modal is open (z-index stacking)
  useEffect(() => {
    if (showLogoutConfirm || notificationDetail) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showLogoutConfirm, notificationDetail]);

  useEffect(() => {
    if (!isNotificationsOpen) return undefined;
    const onMouseDown = (e) => {
      if (notificationsRef.current && !notificationsRef.current.contains(e.target)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [isNotificationsOpen]);

  const fetchNotificationCounts = useCallback(() => {
    authFetch(apiUrl('/api/notifications/counts'))
      .then((r) => r.json())
      .then((j) => {
        if (!j.success || !j.counts || typeof j.counts !== 'object') return;
        setNotificationCounts({ ...emptyNotificationCounts(), ...j.counts });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (role !== 'admin') {
      setNotificationCounts(emptyNotificationCounts());
      return undefined;
    }
    fetchNotificationCounts();
  }, [role, fetchNotificationCounts]);

  useEffect(() => {
    if (!isNotificationsOpen || role !== 'admin') return undefined;
    fetchNotificationCounts();
  }, [isNotificationsOpen, role, fetchNotificationCounts]);

  const notificationTotal = useMemo(
    () => NOTIFICATION_TABS.reduce((sum, t) => sum + (Number(notificationCounts[t.id]) || 0), 0),
    [notificationCounts]
  );

  const handleMarkAllNotificationsRead = useCallback(async () => {
    if (role !== 'admin') return;
    setMarkAllReadLoading(true);
    try {
      const r = await authFetch(apiUrl('/api/notifications/mark-all-read'), { method: 'POST' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.success) return;
      fetchNotificationCounts();
      setNotificationListVersion((v) => v + 1);
    } finally {
      setMarkAllReadLoading(false);
    }
  }, [role, fetchNotificationCounts]);

  const removeNotificationFromList = useCallback((tabId, notificationId) => {
    const id = Number(notificationId);
    const drop = (prev) => prev.filter((x) => Number(x.id) !== id);
    switch (tabId) {
      case 'user':
        setUserNotifications(drop);
        break;
      case 'personnel':
        setPersonnelNotifications(drop);
        break;
      case 'b2b-mail':
        setB2bMailNotifications(drop);
        break;
      case 'tickets':
        setTicketsNotifications(drop);
        break;
      case 'interruptions':
        setInterruptionsNotifications(drop);
        break;
      case 'memo':
        setMemoNotifications(drop);
        break;
      default:
        break;
    }
  }, []);

  const handleNotificationRowActivate = useCallback(
    (n, tabId) => {
      if (role !== 'admin') return;
      setNotificationDetail({ n, tabId });
    },
    [role]
  );

  const handleNotificationRowKeyDown = useCallback(
    (e, n, tabId) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleNotificationRowActivate(n, tabId);
      }
    },
    [handleNotificationRowActivate]
  );

  const handleMarkSingleNotificationRead = useCallback(async () => {
    if (!notificationDetail || role !== 'admin') return;
    const id = notificationDetail.n?.id;
    if (id == null) return;
    setMarkOneReadLoadingId(id);
    try {
      const r = await authFetch(apiUrl(`/api/notifications/${id}/read`), { method: 'PATCH' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.success) return;
      removeNotificationFromList(notificationDetail.tabId, id);
      fetchNotificationCounts();
      setNotificationDetail(null);
    } finally {
      setMarkOneReadLoadingId(null);
    }
  }, [notificationDetail, role, removeNotificationFromList, fetchNotificationCounts]);

  useEffect(() => {
    if (!notificationDetail) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setNotificationDetail(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [notificationDetail]);

  useEffect(() => {
    if (!isNotificationsOpen) return undefined;

    const admin = (localStorage.getItem('userRole') || '').toLowerCase() === 'admin';
    if (!admin) {
      setUserNotifications([]);
      setPersonnelNotifications([]);
      setB2bMailNotifications([]);
      setTicketsNotifications([]);
      setInterruptionsNotifications([]);
      setMemoNotifications([]);
      setUserNotificationsLoading(false);
      setPersonnelNotificationsLoading(false);
      setB2bMailNotificationsLoading(false);
      setTicketsNotificationsLoading(false);
      setInterruptionsNotificationsLoading(false);
      setMemoNotificationsLoading(false);
      return undefined;
    }

    let setLoading;
    let setData;
    switch (notificationTab) {
      case 'user':
        setLoading = setUserNotificationsLoading;
        setData = setUserNotifications;
        break;
      case 'personnel':
        setLoading = setPersonnelNotificationsLoading;
        setData = setPersonnelNotifications;
        break;
      case 'b2b-mail':
        setLoading = setB2bMailNotificationsLoading;
        setData = setB2bMailNotifications;
        break;
      case 'tickets':
        setLoading = setTicketsNotificationsLoading;
        setData = setTicketsNotifications;
        break;
      case 'interruptions':
        setLoading = setInterruptionsNotificationsLoading;
        setData = setInterruptionsNotifications;
        break;
      case 'memo':
        setLoading = setMemoNotificationsLoading;
        setData = setMemoNotifications;
        break;
      default:
        return undefined;
    }

    let cancelled = false;
    const tabParam = notificationTab;

    setLoading(true);
    authFetch(apiUrl(`/api/notifications?tab=${encodeURIComponent(tabParam)}`))
      .then((r) => r.json())
      .then((j) => {
        if (cancelled || !j.success) return;
        setData(Array.isArray(j.data) ? j.data : []);
      })
      .catch(() => {
        if (!cancelled) setData([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
        if (!cancelled && role === 'admin') fetchNotificationCounts();
      });

    return () => {
      cancelled = true;
    };
  }, [isNotificationsOpen, notificationTab, notificationListVersion, role, fetchNotificationCounts]);

  const displayProfilePic = getSafeResourceUrl(profilePic) || defaultAvatar;

  // Async handleLogout to support the server-side global flush
  const handleLogout = async () => {
    try {
      if (logoutAllDevices) {
        // We retrieve the email to tell the server which account to flush
        const userEmail = localStorage.getItem('userEmail'); 
        
        if (userEmail) {
          await authFetch(apiUrl('/api/logout-all'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail })
          });
          console.log("--- [SECURITY] Global session flush completed ---");
        }
      }
    } catch (error) {
      console.error("Global Logout Failed:", error);
      // We continue with local logout anyway to ensure the user is logged out of this session
    } finally {
      clearLocalStoragePreservingPreferences();
      setIsDropdownOpen(false); 
      setShowLogoutConfirm(false);
      setLogoutAllDevices(false); // Reset state for next user
      navigate('/'); 
    }
  };

  const detailN = notificationDetail?.n;
  const detailTabId = notificationDetail?.tabId;
  const detailKind = detailN ? detailN.eventType || detailN.event_type || '' : '';
  const detailLabel = detailTabId ? eventLabelForTab(detailTabId, detailKind) : '';

  return (
    <>
    <header className="admin-top-nav">
      
      {/* 2. THE NEW HAMBURGER BUTTON */}
      <button type="button" className="mobile-menu-btn" onClick={toggleSidebar} title="Open Menu" aria-label="Open menu">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      </button>

      <div className="search-container admin-nav-search">
        <svg className="search-icon admin-nav-search__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          id="aleco-admin-header-search"
          type="text"
          className="admin-nav-search__input"
          placeholder="Search..."
          autoComplete="off"
        />
      </div>
      
      <div className="action-icons">
        <div className="notification-menu-wrapper" ref={notificationsRef}>
          <button
            type="button"
            className={`icon-btn${role === 'admin' && notificationTotal > 0 ? ' icon-btn--notification-badge' : ''}`}
            title={
              role === 'admin' && notificationTotal > 0
                ? `Notifications (${notificationTotal})`
                : 'Notifications'
            }
            aria-label={
              role === 'admin' && notificationTotal > 0
                ? `Notifications, ${notificationTotal} total`
                : 'Notifications'
            }
            aria-expanded={isNotificationsOpen}
            aria-haspopup="true"
            onClick={() => {
              setIsNotificationsOpen((open) => !open);
              setIsDropdownOpen(false);
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            {role === 'admin' && notificationTotal > 0 ? (
              <span className="notification-bell-count" aria-hidden="true">
                {notificationTotal > 99 ? '99+' : notificationTotal}
              </span>
            ) : null}
          </button>
          {isNotificationsOpen && (
            <div className="notifications-popover" role="region" aria-label="Notifications">
              <div
                className="notifications-tabs"
                role="tablist"
                aria-label="Notification categories"
              >
                {NOTIFICATION_TABS.map((t) => {
                  const tabCount = Number(notificationCounts[t.id]) || 0;
                  const tabAria =
                    role === 'admin' && tabCount > 0
                      ? `${t.label}, ${tabCount} notification${tabCount === 1 ? '' : 's'}`
                      : t.label;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      id={`notif-tab-${t.id}`}
                      aria-selected={notificationTab === t.id}
                      tabIndex={notificationTab === t.id ? 0 : -1}
                      className={`notifications-tab ${notificationTab === t.id ? 'is-active' : ''}`}
                      onClick={() => setNotificationTab(t.id)}
                      aria-label={tabAria}
                      title={role === 'admin' ? `${t.label}${tabCount > 0 ? ` (${tabCount})` : ''}` : undefined}
                    >
                      <span className="notifications-tab__label">{t.label}</span>
                      {role === 'admin' && tabCount > 0 ? (
                        <span className="notifications-tab__count" aria-hidden="true">
                          {tabCount > 99 ? '99+' : tabCount}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              <div className="notifications-popover-body">
                <div
                  className="notifications-tab-panel"
                  role="tabpanel"
                  id={`notif-panel-${notificationTab}`}
                  aria-labelledby={`notif-tab-${notificationTab}`}
                >
                {notificationTab === 'user' && (
                  <div className="notifications-tab-user">
                    {role !== 'admin' ? (
                      <p className="notifications-empty">Only administrators see user account alerts.</p>
                    ) : userNotificationsLoading ? (
                      <p className="notifications-muted">Loading…</p>
                    ) : userNotifications.length === 0 ? (
                      <p className="notifications-empty">No user notifications yet.</p>
                    ) : (
                      <ul className="notifications-user-list">
                        {userNotifications.map((n) => {
                          const kind = n.eventType || n.event_type || '';
                          const label = USER_EVENT_LABELS[kind] || kind;
                          const timeStr = formatNotificationTime(n.createdAt || n.created_at);
                          const email = n.subjectEmail || n.subject_email;
                          const actor = n.actorEmail || n.actor_email;
                          const parts = [n.detail, actor ? `By ${actor}` : null].filter(Boolean);
                          return (
                            <li
                              key={n.id}
                              role={role === 'admin' ? 'button' : undefined}
                              tabIndex={role === 'admin' ? 0 : undefined}
                              className={`notifications-user-item notifications-user-item--${kind.replace(/[^a-z0-9_-]/gi, '')}${
                                role === 'admin' ? ' notifications-user-item--clickable' : ''
                              }`}
                              onClick={role === 'admin' ? () => handleNotificationRowActivate(n, 'user') : undefined}
                              onKeyDown={role === 'admin' ? (e) => handleNotificationRowKeyDown(e, n, 'user') : undefined}
                            >
                              <div className="notifications-user-item__row">
                                <span className="notifications-user-item__badge">{label}</span>
                                <span className="notifications-user-item__email">{email || '—'}</span>
                              </div>
                              {(n.subjectName || n.subject_name) && String(n.subjectName || n.subject_name).trim() ? (
                                <div className="notifications-user-item__name">{n.subjectName || n.subject_name}</div>
                              ) : null}
                              <div className="notifications-user-item__meta">
                                {[parts.join(' · '), timeStr].filter(Boolean).join(' · ')}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
                {notificationTab === 'personnel' && (
                  <div className="notifications-tab-personnel">
                    {role !== 'admin' ? (
                      <p className="notifications-empty">Only administrators see personnel alerts.</p>
                    ) : personnelNotificationsLoading ? (
                      <p className="notifications-muted">Loading…</p>
                    ) : personnelNotifications.length === 0 ? (
                      <p className="notifications-empty">No personnel notifications yet.</p>
                    ) : (
                      <ul className="notifications-user-list">
                        {personnelNotifications.map((n) => {
                          const kind = n.eventType || n.event_type || '';
                          const label = PERSONNEL_EVENT_LABELS[kind] || kind;
                          const timeStr = formatNotificationTime(n.createdAt || n.created_at);
                          const name = n.subjectName || n.subject_name;
                          const actor = n.actorEmail || n.actor_email;
                          const parts = [n.detail, actor ? `By ${actor}` : null].filter(Boolean);
                          return (
                            <li
                              key={n.id}
                              role={role === 'admin' ? 'button' : undefined}
                              tabIndex={role === 'admin' ? 0 : undefined}
                              className={`notifications-user-item notifications-user-item--${kind.replace(/[^a-z0-9_-]/gi, '')}${
                                role === 'admin' ? ' notifications-user-item--clickable' : ''
                              }`}
                              onClick={role === 'admin' ? () => handleNotificationRowActivate(n, 'personnel') : undefined}
                              onKeyDown={role === 'admin' ? (e) => handleNotificationRowKeyDown(e, n, 'personnel') : undefined}
                            >
                              <div className="notifications-user-item__row">
                                <span className="notifications-user-item__badge">{label}</span>
                                <span className="notifications-user-item__email">{name || '—'}</span>
                              </div>
                              <div className="notifications-user-item__meta">
                                {[parts.join(' · '), timeStr].filter(Boolean).join(' · ')}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
                {notificationTab === 'b2b-mail' && (
                  <div className="notifications-tab-b2b-mail">
                    {role !== 'admin' ? (
                      <p className="notifications-empty">Only administrators see B2B mail alerts.</p>
                    ) : b2bMailNotificationsLoading ? (
                      <p className="notifications-muted">Loading…</p>
                    ) : b2bMailNotifications.length === 0 ? (
                      <p className="notifications-empty">No B2B mail notifications yet.</p>
                    ) : (
                      <ul className="notifications-user-list">
                        {b2bMailNotifications.map((n) => {
                          const kind = n.eventType || n.event_type || '';
                          const label = B2B_MAIL_EVENT_LABELS[kind] || kind;
                          const timeStr = formatNotificationTime(n.createdAt || n.created_at);
                          const subjName = n.subjectName || n.subject_name;
                          const subjEmail = n.subjectEmail || n.subject_email;
                          const headline = subjName || subjEmail || '—';
                          const actor = n.actorEmail || n.actor_email;
                          const parts = [n.detail, actor ? `By ${actor}` : null].filter(Boolean);
                          return (
                            <li
                              key={n.id}
                              role={role === 'admin' ? 'button' : undefined}
                              tabIndex={role === 'admin' ? 0 : undefined}
                              className={`notifications-user-item notifications-user-item--${kind.replace(/[^a-z0-9_-]/gi, '')}${
                                role === 'admin' ? ' notifications-user-item--clickable' : ''
                              }`}
                              onClick={role === 'admin' ? () => handleNotificationRowActivate(n, 'b2b-mail') : undefined}
                              onKeyDown={role === 'admin' ? (e) => handleNotificationRowKeyDown(e, n, 'b2b-mail') : undefined}
                            >
                              <div className="notifications-user-item__row">
                                <span className="notifications-user-item__badge">{label}</span>
                                <span className="notifications-user-item__email">{headline}</span>
                              </div>
                              {subjName && subjEmail && String(subjName).trim() !== String(subjEmail).trim() ? (
                                <div className="notifications-user-item__name">{subjEmail}</div>
                              ) : null}
                              <div className="notifications-user-item__meta">
                                {[parts.join(' · '), timeStr].filter(Boolean).join(' · ')}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
                {notificationTab === 'tickets' && (
                  <div className="notifications-tab-tickets">
                    {role !== 'admin' ? (
                      <p className="notifications-empty">Only administrators see ticket alerts.</p>
                    ) : ticketsNotificationsLoading ? (
                      <p className="notifications-muted">Loading…</p>
                    ) : ticketsNotifications.length === 0 ? (
                      <p className="notifications-empty">No ticket notifications yet.</p>
                    ) : (
                      <ul className="notifications-user-list">
                        {ticketsNotifications.map((n) => {
                          const kind = n.eventType || n.event_type || '';
                          const label = TICKETS_EVENT_LABELS[kind] || kind;
                          const timeStr = formatNotificationTime(n.createdAt || n.created_at);
                          const ticketId = n.subjectName || n.subject_name;
                          const actor = n.actorEmail || n.actor_email;
                          const parts = [n.detail, actor ? `By ${actor}` : null].filter(Boolean);
                          return (
                            <li
                              key={n.id}
                              role={role === 'admin' ? 'button' : undefined}
                              tabIndex={role === 'admin' ? 0 : undefined}
                              className={`notifications-user-item notifications-user-item--${kind.replace(/[^a-z0-9_-]/gi, '')}${
                                role === 'admin' ? ' notifications-user-item--clickable' : ''
                              }`}
                              onClick={role === 'admin' ? () => handleNotificationRowActivate(n, 'tickets') : undefined}
                              onKeyDown={role === 'admin' ? (e) => handleNotificationRowKeyDown(e, n, 'tickets') : undefined}
                            >
                              <div className="notifications-user-item__row">
                                <span className="notifications-user-item__badge">{label}</span>
                                <span className="notifications-user-item__email">{ticketId || '—'}</span>
                              </div>
                              <div className="notifications-user-item__meta">
                                {[parts.join(' · '), timeStr].filter(Boolean).join(' · ')}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
                {notificationTab === 'interruptions' && (
                  <div className="notifications-tab-interruptions">
                    {role !== 'admin' ? (
                      <p className="notifications-empty">Only administrators see interruption alerts.</p>
                    ) : interruptionsNotificationsLoading ? (
                      <p className="notifications-muted">Loading…</p>
                    ) : interruptionsNotifications.length === 0 ? (
                      <p className="notifications-empty">No interruption notifications yet.</p>
                    ) : (
                      <ul className="notifications-user-list">
                        {interruptionsNotifications.map((n) => {
                          const kind = n.eventType || n.event_type || '';
                          const label = INTERRUPTIONS_EVENT_LABELS[kind] || kind;
                          const timeStr = formatNotificationTime(n.createdAt || n.created_at);
                          const advisoryId = n.subjectName || n.subject_name;
                          const actor = n.actorEmail || n.actor_email;
                          const parts = [n.detail, actor ? `By ${actor}` : null].filter(Boolean);
                          return (
                            <li
                              key={n.id}
                              role={role === 'admin' ? 'button' : undefined}
                              tabIndex={role === 'admin' ? 0 : undefined}
                              className={`notifications-user-item notifications-user-item--${kind.replace(/[^a-z0-9_-]/gi, '')}${
                                role === 'admin' ? ' notifications-user-item--clickable' : ''
                              }`}
                              onClick={role === 'admin' ? () => handleNotificationRowActivate(n, 'interruptions') : undefined}
                              onKeyDown={role === 'admin' ? (e) => handleNotificationRowKeyDown(e, n, 'interruptions') : undefined}
                            >
                              <div className="notifications-user-item__row">
                                <span className="notifications-user-item__badge">{label}</span>
                                <span className="notifications-user-item__email">
                                  {advisoryId != null && advisoryId !== '' ? `#${advisoryId}` : '—'}
                                </span>
                              </div>
                              <div className="notifications-user-item__meta">
                                {[parts.join(' · '), timeStr].filter(Boolean).join(' · ')}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
                {notificationTab === 'memo' && (
                  <div className="notifications-tab-memo">
                    {role !== 'admin' ? (
                      <p className="notifications-empty">Only administrators see memo alerts.</p>
                    ) : memoNotificationsLoading ? (
                      <p className="notifications-muted">Loading…</p>
                    ) : memoNotifications.length === 0 ? (
                      <p className="notifications-empty">No memo notifications yet.</p>
                    ) : (
                      <ul className="notifications-user-list">
                        {memoNotifications.map((n) => {
                          const kind = n.eventType || n.event_type || '';
                          const label = MEMO_EVENT_LABELS[kind] || kind;
                          const timeStr = formatNotificationTime(n.createdAt || n.created_at);
                          const controlNo = n.subjectName || n.subject_name;
                          const actor = n.actorEmail || n.actor_email;
                          const parts = [n.detail, actor ? `By ${actor}` : null].filter(Boolean);
                          return (
                            <li
                              key={n.id}
                              role={role === 'admin' ? 'button' : undefined}
                              tabIndex={role === 'admin' ? 0 : undefined}
                              className={`notifications-user-item notifications-user-item--${kind.replace(/[^a-z0-9_-]/gi, '')}${
                                role === 'admin' ? ' notifications-user-item--clickable' : ''
                              }`}
                              onClick={role === 'admin' ? () => handleNotificationRowActivate(n, 'memo') : undefined}
                              onKeyDown={role === 'admin' ? (e) => handleNotificationRowKeyDown(e, n, 'memo') : undefined}
                            >
                              <div className="notifications-user-item__row">
                                <span className="notifications-user-item__badge">{label}</span>
                                <span className="notifications-user-item__email">{controlNo || '—'}</span>
                              </div>
                              <div className="notifications-user-item__meta">
                                {[parts.join(' · '), timeStr].filter(Boolean).join(' · ')}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
                {notificationTab === 'system' && (
                  <div className="notifications-tab-system" aria-label="System notifications">
                    {role !== 'admin' ? (
                      <p className="notifications-empty">Only administrators see system alerts.</p>
                    ) : null}
                  </div>
                )}
                </div>
              </div>
              {role === 'admin' ? (
                <div className="notifications-popover-footer">
                  <button
                    type="button"
                    className="notifications-mark-all-read"
                    disabled={markAllReadLoading || notificationTotal === 0}
                    onClick={handleMarkAllNotificationsRead}
                  >
                    {markAllReadLoading ? 'Marking…' : 'Mark all as read'}
                  </button>
                  <button
                    type="button"
                    className="notifications-close"
                    aria-label="Close notifications"
                    onClick={() => setIsNotificationsOpen(false)}
                  >
                    Close
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
        
        <button className="icon-btn" title="Inbox">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
        </button>
        
        <ThemeIconButton theme={theme} toggleTheme={toggleTheme} />
        
        <div className="profile-menu-wrapper">
          <button 
            type="button"
            className="profile-btn" 
            onClick={() => {
              setIsDropdownOpen((open) => !open);
              setIsNotificationsOpen(false);
            }}
            title="Account Menu"
          >
            <div className={`profile-image-border role-${role}`}>
              <img src={displayProfilePic} alt="User" className="profile-image" referrerPolicy="no-referrer" />
            </div>
          </button>

          {isDropdownOpen && (
            <div className="profile-dropdown">
              <div className="dropdown-info">
                <span className="user-name">{localStorage.getItem('userName') || 'User'}</span>
                <span className="user-role">{role.toUpperCase()}</span>
              </div>
              <div className="dropdown-divider"></div>
              <button className="dropdown-link" onClick={() => navigate('/admin-profile')}>View Profile</button>
              
              <button 
                className="dropdown-link logout-red" 
                onClick={() => {
                  setShowLogoutConfirm(true);
                  setIsDropdownOpen(false);
                }}
              >
                Logout
              </button>
            </div>
          )}

          {showLogoutConfirm && (
            <div className="logout-modal-overlay">
              <div className="logout-modal">
                <h3>Confirm Logout</h3>
                <p>Are you sure you want to sign out of the ALECO PIS?</p>
                
                {/* Security Checkbox UI */}
                <div className="security-option">
                  <label className="checkbox-container">
                    <input 
                      type="checkbox" 
                      checked={logoutAllDevices} 
                      onChange={(e) => setLogoutAllDevices(e.target.checked)} 
                    />
                    <span className="checkbox-label">Logout from all devices</span>
                  </label>
                </div>

                <div className="modal-actions">
                  <button className="cancel-btn" onClick={() => {
                    setShowLogoutConfirm(false);
                    setLogoutAllDevices(false);
                  }}>Cancel</button>
                  <button className="confirm-btn" onClick={handleLogout}>Logout</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>

    {notificationDetail && role === 'admin' && detailN ? (
      <div className="notification-detail-root">
        <div
          className="notification-detail-overlay"
          role="presentation"
          onClick={() => setNotificationDetail(null)}
        >
          <div
            className="notification-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notification-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="notification-detail-modal__accent" aria-hidden="true" />
            <div className="notification-detail-modal__header">
              <div className="notification-detail-modal__header-text">
                <p className="notification-detail-modal__eyebrow">Alert details</p>
                <h2 id="notification-detail-title" className="notification-detail-modal__title">
                  {detailLabel || 'Notification'}
                </h2>
                <p className="notification-detail-modal__meta-line">
                  <span className="notification-detail-modal__tab-pill">
                    {TAB_LABEL_BY_ID[detailTabId] || detailTabId}
                  </span>
                  <span className="notification-detail-modal__time">
                    {formatNotificationTime(detailN.createdAt || detailN.created_at) || '—'}
                  </span>
                </p>
              </div>
              <button
                type="button"
                className="notification-detail-modal__close"
                aria-label="Close"
                onClick={() => setNotificationDetail(null)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="notification-detail-modal__body">
              <dl className="notification-detail-dl">
                {(detailN.subjectEmail || detailN.subject_email) ? (
                  <div className="notification-detail-dl__row">
                    <dt>Subject email</dt>
                    <dd>{detailN.subjectEmail || detailN.subject_email}</dd>
                  </div>
                ) : null}
                {(detailN.subjectName || detailN.subject_name) ? (
                  <div className="notification-detail-dl__row">
                    <dt>Subject / reference</dt>
                    <dd>{detailN.subjectName || detailN.subject_name}</dd>
                  </div>
                ) : null}
                {detailN.detail ? (
                  <div className="notification-detail-dl__row notification-detail-dl__row--block">
                    <dt>Detail</dt>
                    <dd>{detailN.detail}</dd>
                  </div>
                ) : null}
                {(detailN.actorEmail || detailN.actor_email) ? (
                  <div className="notification-detail-dl__row">
                    <dt>Actor</dt>
                    <dd>{detailN.actorEmail || detailN.actor_email}</dd>
                  </div>
                ) : null}
                <div className="notification-detail-dl__row notification-detail-dl__row--muted">
                  <dt>Notification ID</dt>
                  <dd>
                    <code className="notification-detail-modal__id-code">{detailN.id}</code>
                  </dd>
                </div>
              </dl>
            </div>
            <div className="notification-detail-modal__footer">
              <button
                type="button"
                className="notification-detail-modal__btn notification-detail-modal__btn--secondary"
                onClick={() => setNotificationDetail(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="notification-detail-modal__btn notification-detail-modal__btn--primary"
                disabled={markOneReadLoadingId === detailN.id}
                onClick={handleMarkSingleNotificationRead}
              >
                {markOneReadLoadingId === detailN.id ? 'Marking…' : 'Mark as read'}
              </button>
            </div>
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
};

export default SearchBarGlobal;
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { apiUrl } from '../../utils/api';
import { authMutation } from '../../utils/authMutation';
import { REALTIME_MODULES } from '../../constants/realtimeModules';
import alecoLogo from '../../assets/Aleco-logo-modified.png';
import '../../CSS/ManageSiteModal.css';

/**
 * ManageSiteModal
 *
 * Props:
 *   isOpen          {bool}     — controls render
 *   onClose         {fn}       — called when modal should close
 *   onFlushComplete {fn}       — called after a successful notification flush
 *                                so SearchBarGlobal can reset bell + lists
 */
const ManageSiteModal = ({ isOpen, onClose, onFlushComplete }) => {
  // ── Tab state ──
  const [manageSiteTab, setManageSiteTab] = useState('settings');

  // ── Site Settings — logo (UI only, no backend yet) ──
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);

  // ── Site Settings — nav labels (UI only, no backend yet) ──
  const [navItems, setNavItems] = useState([
    { id: 'home', label: 'Home' },
    { id: 'users', label: 'Users' },
    { id: 'personnel', label: 'Personnel' },
    { id: 'b2b-mail', label: 'B2B Mail' },
    { id: 'tickets', label: 'Tickets' },
    { id: 'interruptions', label: 'Interruptions' },
    { id: 'history', label: 'History' },
    { id: 'backup', label: 'Data Management' },
  ]);

  // ── Flush state ──
  const [flushType, setFlushType] = useState(null); // 'notifications' or 'history'
  const [isFlushing, setIsFlushing] = useState(false);
  const [showFlushConfirmModal, setShowFlushConfirmModal] = useState(false);
  const [flushResponsibilityChecked, setFlushResponsibilityChecked] = useState(false);
  const [flushConfirmEmail, setFlushConfirmEmail] = useState('');

  // ── Body scroll-lock while any layer of this modal is open ──
  useEffect(() => {
    if (isOpen || showFlushConfirmModal) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [isOpen, showFlushConfirmModal]);

  // ── Reset flush sub-modal state when main modal closes ──
  useEffect(() => {
    if (!isOpen) {
      setShowFlushConfirmModal(false);
      setFlushResponsibilityChecked(false);
      setFlushConfirmEmail('');
      setFlushType(null);
    }
  }, [isOpen]);

  // ── Notification Flush handler ──
  const handleExecuteFlush = useCallback(async () => {
    const userEmail = localStorage.getItem('userEmail');
    const entered = flushConfirmEmail.trim().toLowerCase();
    const current = (userEmail || '').trim().toLowerCase();

    if (!entered) {
      toast.error('Email verification is required to proceed.');
      return;
    }

    if (entered !== current) {
      toast.error('Security mismatch. Please enter your correct administrator email address.');
      return;
    }

    setIsFlushing(true);
    try {
      const endpoint = flushType === 'history' 
        ? apiUrl('/api/history/flush') 
        : apiUrl('/api/notifications/flush');

      const result = await authMutation(endpoint, {
        method: 'DELETE',
        body: {},
        emitRealtime: { module: REALTIME_MODULES.SYSTEM },
      });
      const j = result.data || {};
      if (!result.ok || !j.success) {
        toast.error(j.message || 'Failed to flush notifications.');
        return;
      }

      // Close & reset sub-modal
      setShowFlushConfirmModal(false);
      setFlushResponsibilityChecked(false);
      setFlushConfirmEmail('');

      // Notify parent to clear bell counts + notification lists
      if (onFlushComplete && flushType === 'notifications') onFlushComplete();

      const successMsg = flushType === 'history'
        ? 'System optimization complete: All history logs and audit trails have been permanently cleared.'
        : 'System optimization complete: All notifications have been permanently cleared.';

      toast.success(successMsg);
      window.dispatchEvent(new CustomEvent('aleco:realtime-change'));
    } catch (error) {
      console.error('[ManageSiteModal] handleFlushNotifications error:', error);
      toast.error('An unexpected error occurred during the flush operation.');
    } finally {
      setIsFlushing(false);
    }
  }, [flushConfirmEmail, flushType, onFlushComplete]);

  // ── Close flush sub-modal helper ──
  const closeFlushConfirmModal = useCallback(() => {
    setShowFlushConfirmModal(false);
    setFlushResponsibilityChecked(false);
    setFlushConfirmEmail('');
    setFlushType(null);
  }, []);

  if (!isOpen) return null;

  return (
    <>
      {/* ── Manage Site Main Modal ── */}
      <div className="manage-site-modal-overlay">
        <div className="manage-site-modal">
          <div className="manage-site-modal-header">
            <span className="manage-site-modal-title">Manage Site</span>
            <button
              type="button"
              className="manage-site-close-btn"
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="manage-site-modal-tabs">
            <button
              type="button"
              className={`manage-site-tab ${manageSiteTab === 'settings' ? 'manage-site-tab--active' : ''}`}
              onClick={() => setManageSiteTab('settings')}
            >
              Site Settings
            </button>
            <button
              type="button"
              className={`manage-site-tab ${manageSiteTab === 'flush' ? 'manage-site-tab--active' : ''}`}
              onClick={() => setManageSiteTab('flush')}
            >
              Flush
            </button>
          </div>

          <div className="manage-site-modal-body">
            {/* ── Site Settings Tab ── */}
            {manageSiteTab === 'settings' && (
              <div className="manage-site-tab-panel">
                {/* Logo Upload */}
                <div className="settings-section">
                  <h4 className="settings-section-title">Main Logo</h4>
                  <div className="logo-upload-container">
                    <div className="logo-preview">
                      <img
                        src={logoPreview || alecoLogo}
                        alt="Site Logo"
                        className="logo-image"
                      />
                    </div>
                    <div className="logo-upload-actions">
                      <label htmlFor="logo-upload" className="settings-btn settings-btn--primary">
                        <span>Change Logo</span>
                      </label>
                      <input
                        id="logo-upload"
                        type="file"
                        accept="image/*"
                        className="logo-upload-input"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            setLogoFile(file);
                            setLogoPreview(URL.createObjectURL(file));
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Navigation Labels */}
                <div className="settings-section">
                  <h4 className="settings-section-title">Navigation Labels</h4>
                  <p className="settings-section-description">
                    Customize the display names for navigation menu items.
                  </p>
                  <div className="nav-items-list">
                    {navItems.map((item) => (
                      <div key={item.id} className="nav-item-row">
                        <label className="nav-item-label" htmlFor={`nav-${item.id}`}>
                          {item.id.charAt(0).toUpperCase() + item.id.slice(1)}
                        </label>
                        <input
                          id={`nav-${item.id}`}
                          type="text"
                          className="nav-item-input"
                          value={item.label}
                          onChange={(e) => {
                            setNavItems(navItems.map((nav) =>
                              nav.id === item.id ? { ...nav, label: e.target.value } : nav
                            ));
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Flush Tab ── */}
            {manageSiteTab === 'flush' && (
              <div className="manage-site-tab-panel">
                {/* Notification Flush */}
                <div className="flush-section">
                  <h4 className="flush-section-title">Notification Flush</h4>
                  <p className="flush-section-description">
                    This feature clears notification records from the database to free up storage
                    space and optimize performance.
                  </p>
                  <button
                    type="button"
                    className="flush-btn flush-btn--notification"
                    onClick={() => {
                      setFlushType('notifications');
                      setShowFlushConfirmModal(true);
                    }}
                  >
                    Flush Notifications
                  </button>
                </div>

                {/* History & Logs Flush */}
                <div className="flush-section">
                  <h4 className="flush-section-title">History & Logs Flush</h4>
                  <p className="flush-section-description">
                    This feature permanently purges all activity logs and audit trails from the 
                    database to maximize storage space and maintain peak system performance.
                  </p>
                  <button
                    type="button"
                    className="flush-btn flush-btn--history"
                    onClick={() => {
                      setFlushType('history');
                      setShowFlushConfirmModal(true);
                    }}
                  >
                    Flush History & Logs
                  </button>
                </div>

                <div className="flush-footer">
                  <p className="flush-footer-text">
                    Use these features every 2–3 months to save space. Export your data first if
                    needed before flushing.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Hard Flush Confirmation Sub-Modal ── */}
      {showFlushConfirmModal && (
        <div className="flush-confirm-overlay">
          <div className="flush-confirm-modal">
            <div className="flush-confirm-header">
              <span className="flush-confirm-title">Critical Action Required</span>
              <button
                type="button"
                className="flush-confirm-close"
                onClick={closeFlushConfirmModal}
              >
                ×
              </button>
            </div>
            <div className="flush-confirm-body">
              <div className="flush-confirm-warning-icon">⚠️</div>
              <h3>HARD FLUSH {flushType === 'history' ? 'HISTORY & LOGS' : 'NOTIFICATIONS'}</h3>
              <p>
                {flushType === 'history'
                  ? 'You are about to permanently purge all system activity logs and audit trails from the database. This includes ticket history, B2B logs, and personnel trails.'
                  : 'You are about to permanently purge all notification data from the system database.'
                }
                {' '}This action is global and cannot be reversed.
              </p>
              {/* Responsibility acknowledgement */}
              <div className="flush-confirm-responsibility">
                <label className="responsibility-checkbox-container">
                  <input
                    type="checkbox"
                    checked={flushResponsibilityChecked}
                    onChange={(e) => setFlushResponsibilityChecked(e.target.checked)}
                  />
                  <span className="responsibility-text">
                    I hereby acknowledge that I am initiating a destructive operation and I
                    responsibly take full accountability for removing all {flushType === 'history' ? 'history and activity log' : 'notification'} records from
                    the database.
                  </span>
                </label>
              </div>

              {/* Email identity verification */}
              <div className="flush-confirm-email-step">
                <label htmlFor="flush-email-verify" className="flush-verify-label">
                  Verify Identity
                </label>
                <div className="flush-input-container">
                  <input
                    id="flush-email-verify"
                    type="email"
                    placeholder="Enter your administrator email"
                    value={flushConfirmEmail}
                    onChange={(e) => setFlushConfirmEmail(e.target.value)}
                    className="flush-confirm-input"
                    autoComplete="off"
                  />
                </div>
              </div>
            </div>
            <div className="flush-confirm-footer">
              <button className="cancel-btn" onClick={closeFlushConfirmModal}>
                Cancel
              </button>
              <button
                className="flush-final-btn"
                disabled={!flushResponsibilityChecked || !flushConfirmEmail || isFlushing}
                onClick={handleExecuteFlush}
              >
                {isFlushing ? 'Processing...' : 'Confirm Global Flush'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ManageSiteModal;

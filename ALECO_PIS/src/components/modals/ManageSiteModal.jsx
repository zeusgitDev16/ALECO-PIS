import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import { apiUrl } from '../../utils/api';
import { authMutation } from '../../utils/authMutation';
import { REALTIME_MODULES } from '../../constants/realtimeModules';
import alecoLogo from '../../assets/Aleco-logo-modified.png';
import { useSiteSettings } from '../../context/SiteSettingsContext';
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
  const { siteLogoUrl, siteFaviconUrl, refreshSettings } = useSiteSettings();
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [isUpdatingLogo, setIsUpdatingLogo] = useState(false);
  const [showLogoResetModal, setShowLogoResetModal] = useState(false);
  
  const [isUpdatingFavicon, setIsUpdatingFavicon] = useState(false);
  const [showFaviconResetModal, setShowFaviconResetModal] = useState(false);
  const widgetRef = useRef(null);

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
        : flushType === 'messages'
          ? apiUrl('/api/b2b-mail/flush')
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

      // Notify parent to clear bell counts + notification lists (applies to all flush types for consistency)
      if (onFlushComplete) onFlushComplete();

      const successMsg = flushType === 'history'
        ? 'System optimization complete: All history logs and audit trails have been permanently cleared.'
        : flushType === 'messages'
          ? 'System optimization complete: All B2B messages and interaction records have been permanently cleared.'
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
  const handleLogoUpload = async (file) => {
    if (!file) return;
    setIsUpdatingLogo(true);
    const formData = new FormData();
    formData.append('logo', file);

    try {
      const response = await fetch(apiUrl('/api/site-settings/upload-logo'), {
        method: 'POST',
        headers: {
          'X-User-Email': localStorage.getItem('userEmail'),
          'X-Token-Version': localStorage.getItem('tokenVersion'),
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: formData,
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Logo updated successfully.');
        refreshSettings();
        setLogoPreview(null);
        setLogoFile(null);
      } else {
        toast.error(result.message || 'Failed to upload logo.');
      }
    } catch (error) {
      console.error('[ManageSiteModal] logo upload error:', error);
      toast.error('An error occurred during logo upload.');
    } finally {
      setIsUpdatingLogo(false);
    }
  };

  const handleLogoResetClick = () => {
    setShowLogoResetModal(true);
  };

  // ── Favicon Upload Logic ──
  useEffect(() => {
    // Load Cloudinary Widget script
    if (!window.cloudinary) {
      const script = document.createElement('script');
      script.src = 'https://widget.cloudinary.com/v2.0/global/all.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const openFaviconWidget = async () => {
    if (!window.cloudinary) {
      toast.error('Cloudinary widget is still loading...');
      return;
    }

    setIsUpdatingFavicon(true);
    try {
      // 1. Get Signed Upload Params from backend
      const sigResponse = await fetch(apiUrl('/api/site-settings/cloudinary-signature'), {
        headers: {
          'X-User-Email': localStorage.getItem('userEmail'),
          'X-Token-Version': localStorage.getItem('tokenVersion'),
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      const sigData = await sigResponse.json();

      if (!sigData.success) {
        toast.error('Failed to authorize upload.');
        return;
      }

      // 2. Open Signed Widget
      window.cloudinary.openUploadWidget(
        {
          cloudName: sigData.cloudName,
          apiKey: sigData.apiKey,
          uploadSignatureTimestamp: sigData.timestamp,
          uploadSignature: sigData.signature,
          uploadPreset: sigData.uploadPreset,
          folder: sigData.folder,
          cropping: true,
          multiple: false,
          resourceType: 'image',
          clientAllowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'avif', 'bmp', 'tiff', 'gif', 'ico', 'svg'],
          maxFiles: 1,
          croppingAspectRatio: 1,
          showSkipCropButton: false,
          croppingDefaultSelection: 'transform',
          theme: 'minimal',
        },
        async (error, result) => {
          if (!error && result && result.event === 'success') {
            const faviconUrl = result.info.secure_url;
            await saveFaviconToDb(faviconUrl);
          }
          if (error) {
            console.error('[Cloudinary Widget Error]', error);
          }
        }
      );
    } catch (err) {
      console.error('[ManageSiteModal] openFaviconWidget error:', err);
      toast.error('Failed to initialize upload widget.');
    } finally {
      setIsUpdatingFavicon(false);
    }
  };

  const saveFaviconToDb = async (url) => {
    setIsUpdatingFavicon(true);
    try {
      const response = await fetch(apiUrl('/api/site-settings'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': localStorage.getItem('userEmail'),
          'X-Token-Version': localStorage.getItem('tokenVersion'),
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({ site_favicon_url: url }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Favicon updated successfully.');
        refreshSettings();
      } else {
        toast.error(result.message || 'Failed to save favicon.');
      }
    } catch (error) {
      console.error('[ManageSiteModal] saveFaviconToDb error:', error);
      toast.error('Failed to connect to server.');
    } finally {
      setIsUpdatingFavicon(false);
    }
  };

  const confirmFaviconReset = async () => {
    setIsUpdatingFavicon(true);
    try {
      const response = await fetch(apiUrl('/api/site-settings/favicon'), {
        method: 'DELETE',
        headers: {
          'X-User-Email': localStorage.getItem('userEmail'),
          'X-Token-Version': localStorage.getItem('tokenVersion'),
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Favicon reset to default.');
        refreshSettings();
        setShowFaviconResetModal(false);
      }
    } catch (error) {
      console.error('[ManageSiteModal] favicon reset error:', error);
      toast.error('Failed to reset favicon.');
    } finally {
      setIsUpdatingFavicon(false);
    }
  };

  const confirmLogoReset = async () => {
    setIsUpdatingLogo(true);
    try {
      const response = await fetch(apiUrl('/api/site-settings/logo'), {
        method: 'DELETE',
        headers: {
          'X-User-Email': localStorage.getItem('userEmail'),
          'X-Token-Version': localStorage.getItem('tokenVersion'),
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Logo reset to default.');
        refreshSettings();
        setLogoPreview(null);
        setLogoFile(null);
        setShowLogoResetModal(false);
      }
    } catch (error) {
      console.error('[ManageSiteModal] logo reset error:', error);
      toast.error('Failed to reset logo.');
    } finally {
      setIsUpdatingLogo(false);
    }
  };

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
                        src={logoPreview || siteLogoUrl || alecoLogo}
                        alt="Site Logo"
                        className="logo-image"
                      />
                    </div>
                    <div className="logo-upload-actions">
                      {siteLogoUrl && !logoPreview && !isUpdatingLogo && (
                        <button 
                          className="settings-icon-btn"
                          onClick={handleLogoResetClick}
                          title="Reset to default ALECO logo"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                            <path d="M3 3v5h5"/>
                          </svg>
                        </button>
                      )}
                      <label htmlFor="logo-upload" className={`settings-btn settings-btn--primary ${isUpdatingLogo ? 'disabled' : ''}`}>
                        <span>{logoPreview ? 'Change Selection' : 'Change Logo'}</span>
                      </label>
                      <input
                        id="logo-upload"
                        type="file"
                        accept="image/*"
                        className="logo-upload-input"
                        disabled={isUpdatingLogo}
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            setLogoFile(file);
                            setLogoPreview(URL.createObjectURL(file));
                          }
                        }}
                      />
                      {logoPreview && !isUpdatingLogo && (
                        <button 
                          className="settings-btn settings-btn--success"
                          onClick={() => handleLogoUpload(logoFile)}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                            <path d="M20 6 9 17l-5-5"/>
                          </svg>
                          Save New Logo
                        </button>
                      )}
                      {isUpdatingLogo && (
                        <div className="settings-upload-status">
                          <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                          </svg>
                          Processing...
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Favicon Configuration */}
                <div className="settings-section">
                  <h4 className="settings-section-title">Site Favicon</h4>
                  <p className="settings-section-description">
                    Upload a square icon (e.g. 512x512) to be used as your browser tab icon.
                  </p>
                  <div className="favicon-config-container">
                    {/* Tab Mockup Preview */}
                    <div className="browser-tab-mockup">
                      <div className="tab-mockup-inner">
                        <img 
                          src={siteFaviconUrl || '/vite.svg'} 
                          alt="Favicon" 
                          className="tab-mockup-icon" 
                        />
                        <span className="tab-mockup-title">ALECO PIS | Albay...</span>
                      </div>
                    </div>

                    <div className="favicon-actions">
                      <button 
                        className="settings-btn settings-btn--primary"
                        disabled={isUpdatingFavicon}
                        onClick={openFaviconWidget}
                      >
                        Change Favicon
                      </button>
                      
                      {siteFaviconUrl && (
                        <button 
                          className="settings-icon-btn"
                          onClick={() => setShowFaviconResetModal(true)}
                          title="Reset to default favicon"
                          disabled={isUpdatingFavicon}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                            <path d="M3 3v5h5"/>
                          </svg>
                        </button>
                      )}
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

                {/* B2B Message Flush */}
                <div className="flush-section">
                  <h4 className="flush-section-title">B2B Message Flush</h4>
                  <p className="flush-section-description">
                    This feature permanently purges all B2B mail messages, recipients, and inbound replies
                    from the database to maintain system efficiency.
                  </p>
                  <button
                    type="button"
                    className="flush-btn flush-btn--messages"
                    onClick={() => {
                      setFlushType('messages');
                      setShowFlushConfirmModal(true);
                    }}
                  >
                    Flush B2B Messages
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
              <h3>HARD FLUSH {
                flushType === 'history' ? 'HISTORY & LOGS' :
                  flushType === 'messages' ? 'B2B MESSAGES' :
                    'NOTIFICATIONS'
              }</h3>
              <p>
                {flushType === 'history'
                  ? 'You are about to permanently purge all system activity logs and audit trails from the database. This includes ticket history, B2B logs, and personnel trails.'
                  : flushType === 'messages'
                    ? 'You are about to permanently purge all B2B messages, recipient records, and inbound replies from the database. This action is destructive and irreversible.'
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
                    responsibly take full accountability for removing all {
                      flushType === 'history' ? 'history and activity log' :
                        flushType === 'messages' ? 'B2B message' :
                          'notification'
                    } records from the database.
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

      {/* ── Logo Reset Confirmation Modal ── */}
      {showLogoResetModal && (
        <div className="flush-confirm-overlay">
          <div className="flush-confirm-modal">
            <div className="flush-confirm-header" style={{ background: 'rgba(59, 130, 246, 0.1)', borderBottom: '1px solid rgba(59, 130, 246, 0.2)' }}>
              <span className="flush-confirm-title" style={{ color: 'var(--accent-primary)' }}>Reset Branding</span>
              <button
                type="button"
                className="flush-confirm-close"
                onClick={() => setShowLogoResetModal(false)}
              >
                ×
              </button>
            </div>
            <div className="flush-confirm-body">
              <div className="flush-confirm-warning-icon">🔄</div>
              <h3>Reset Site Logo?</h3>
              <p>
                This will remove your custom logo and revert the site branding to the original 
                <strong> ALECO distribution logo</strong>. This change takes effect immediately across all pages.
              </p>
            </div>
            <div className="flush-confirm-footer">
              <button className="settings-btn settings-btn--outline" onClick={() => setShowLogoResetModal(false)}>
                Cancel
              </button>
              <button
                className="settings-btn settings-btn--primary"
                disabled={isUpdatingLogo}
                onClick={confirmLogoReset}
              >
                {isUpdatingLogo ? 'Resetting...' : 'Confirm Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Favicon Reset Confirmation Modal ── */}
      {showFaviconResetModal && (
        <div className="flush-confirm-overlay">
          <div className="flush-confirm-modal">
            <div className="flush-confirm-header" style={{ background: 'rgba(59, 130, 246, 0.1)', borderBottom: '1px solid rgba(59, 130, 246, 0.2)' }}>
              <span className="flush-confirm-title" style={{ color: 'var(--accent-primary)' }}>Reset Favicon</span>
              <button
                type="button"
                className="flush-confirm-close"
                onClick={() => setShowFaviconResetModal(false)}
              >
                ×
              </button>
            </div>
            <div className="flush-confirm-body">
              <div className="flush-confirm-warning-icon">🔄</div>
              <h3>Reset Site Favicon?</h3>
              <p>
                This will remove your custom tab icon and revert the site to the original 
                <strong> Albay Electric Cooperative (ALECO)</strong> favicon.
              </p>
            </div>
            <div className="flush-confirm-footer">
              <button className="settings-btn settings-btn--outline" onClick={() => setShowFaviconResetModal(false)}>
                Cancel
              </button>
              <button
                className="settings-btn settings-btn--primary"
                disabled={isUpdatingFavicon}
                onClick={confirmFaviconReset}
              >
                {isUpdatingFavicon ? 'Resetting...' : 'Confirm Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ManageSiteModal;

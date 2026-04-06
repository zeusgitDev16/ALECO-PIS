import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import '../../CSS/DispatchTicketModal.css';
import '../../CSS/UserAccountActionModal.css';

/**
 * Confirmation modal: user must type the account email to disable or enable (replaces window.prompt).
 */
const UserAccountActionModal = ({ isOpen, user, onClose, onValidatedConfirm }) => {
  const [emailInput, setEmailInput] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isDisable = user?.status === 'Active';

  useEffect(() => {
    if (isOpen && user) {
      setEmailInput('');
      setError('');
      setSubmitting(false);
    }
  }, [isOpen, user?.id]);

  if (!isOpen || !user) return null;

  const handleConfirm = async () => {
    const typed = emailInput.trim();
    const expected = (user.email || '').trim();
    if (typed !== expected) {
      setError('The email does not match this account.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await onValidatedConfirm?.();
      onClose?.();
    } catch (e) {
      setError(e?.message || 'Request failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    }
  };

  const modal = (
    <div
      className="dispatch-modal-overlay confirm-modal-overlay user-account-action-modal-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="dispatch-modal-content confirm-modal-content user-account-action-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-account-action-title"
      >
        <button type="button" className="dispatch-modal-close-btn" onClick={onClose} aria-label="Close">
          &times;
        </button>

        <div className="dispatch-modal-header-container">
          <h2 id="user-account-action-title" className="dispatch-modal-header">
            {isDisable ? 'Disable account' : 'Enable account'}
          </h2>
          <p className="dispatch-modal-subtitle user-account-action-modal__lead">
            {isDisable ? (
              <>
                This will sign out <strong>{user.name || user.email}</strong> and block sign-in until the account is
                enabled again.
              </>
            ) : (
              <>
                This will allow <strong>{user.name || user.email}</strong> to sign in again.
              </>
            )}
          </p>
          <p className="user-account-action-modal__hint">
            Type the user&apos;s email address exactly to confirm.
          </p>
        </div>

        <div className="user-account-action-modal__field">
          <label htmlFor="user-account-confirm-email" className="user-account-action-modal__label">
            Email address
          </label>
          <input
            id="user-account-confirm-email"
            type="email"
            className="user-account-action-modal__input"
            value={emailInput}
            onChange={(e) => {
              setEmailInput(e.target.value);
              if (error) setError('');
            }}
            onKeyDown={handleKeyDown}
            placeholder={user.email || ''}
            autoComplete="off"
            autoFocus
            disabled={submitting}
          />
          {error ? <p className="user-account-action-modal__error">{error}</p> : null}
        </div>

        <div className="dispatch-modal-actions">
          <button type="button" className="btn-action btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn-action ${isDisable ? 'btn-delete' : 'btn-resolved'}`}
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? 'Please wait…' : isDisable ? 'Disable account' : 'Enable account'}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
};

export default UserAccountActionModal;

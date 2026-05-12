import React, { useState } from 'react';

/**
 * Confirmation modal for hard-deleting B2B contacts.
 * - Single contact: user must type the contact's email to confirm.
 * - Multiple contacts: user must type "DELETE" to confirm.
 *
 * @param {object[]} contacts - Full contact objects to be deleted.
 * @param {() => void} onCancel
 * @param {() => void} onConfirm
 */
export default function B2BDeleteConfirmModal({ contacts = [], onCancel, onConfirm }) {
  const [inputValue, setInputValue] = useState('');

  const isSingle = contacts.length === 1;
  const expectedValue = isSingle ? contacts[0]?.email?.trim() : 'DELETE';
  const isConfirmed = inputValue.trim() === expectedValue;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isConfirmed) return;
    onConfirm();
  };

  return (
    <div className="b2b-modal-overlay" onClick={onCancel}>
      <div
        className="b2b-modal b2b-delete-confirm-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="b2b-modal-header">
          <h3 className="b2b-modal-title">
            Permanently Delete {isSingle ? 'Contact' : `${contacts.length} Contacts`}
          </h3>
          <button className="b2b-modal-close" onClick={onCancel} type="button">✕</button>
        </div>

        <div className="b2b-delete-confirm-body">
          <div className="b2b-delete-warn-banner">
            <span className="b2b-delete-warn-icon">⚠</span>
            <p>This action is <strong>permanent and cannot be undone.</strong> The contact and all associated verification records will be hard deleted from the database.</p>
          </div>

          <div className="b2b-delete-contacts-list">
            {contacts.map((c) => (
              <div key={c.id} className="b2b-delete-contact-row">
                <span className="b2b-delete-contact-name">{c.contact_name || '—'}</span>
                <span className="b2b-delete-contact-email">{c.email}</span>
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="b2b-delete-confirm-form">
            <label className="b2b-delete-confirm-label">
              {isSingle
                ? <>Type the contact's email address <strong>{contacts[0]?.email}</strong> to confirm:</>
                : <>Type <strong>DELETE</strong> to confirm deletion of {contacts.length} contacts:</>
              }
            </label>
            <input
              className="b2b-delete-confirm-input"
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={isSingle ? contacts[0]?.email : 'DELETE'}
              autoFocus
              autoComplete="off"
              spellCheck={false}
            />
            <div className="b2b-delete-confirm-actions">
              <button
                type="button"
                className="b2b-modal-cancel-btn"
                onClick={onCancel}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="b2b-modal-delete-btn"
                disabled={!isConfirmed}
              >
                Delete Permanently
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

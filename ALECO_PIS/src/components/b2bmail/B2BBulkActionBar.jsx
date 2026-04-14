import React from 'react';

/**
 * Bulk action bar for selected contacts
 * @param {object} props
 * @param {number} props.selectedCount
 * @param {() => void} props.onClearSelection
 * @param {() => void} props.onSendVerification
 * @param {() => void} props.onDelete
 * @param {() => void} props.onToggleActive
 * @param {boolean} props.saving
 */
export default function B2BBulkActionBar({
  selectedCount,
  onClearSelection,
  onSendVerification,
  onDelete,
  onToggleActive,
  saving,
}) {
  if (selectedCount === 0) return null;

  return (
    <div className="b2b-bulk-action-bar">
      <span className="b2b-bulk-count">
        Selected ({selectedCount})
      </span>
      
      <div className="b2b-bulk-actions">
        <button
          type="button"
          className="b2b-bulk-btn b2b-bulk-verify"
          onClick={onSendVerification}
          disabled={saving}
          title="Send verification email to selected contacts"
        >
          Send Verification
        </button>
        
        <button
          type="button"
          className="b2b-bulk-btn b2b-bulk-toggle"
          onClick={onToggleActive}
          disabled={saving}
          title="Toggle active status for selected contacts"
        >
          Toggle Active
        </button>
        
        <button
          type="button"
          className="b2b-bulk-btn b2b-bulk-delete"
          onClick={onDelete}
          disabled={saving}
          title="Delete selected contacts"
        >
          Delete
        </button>
        
        <button
          type="button"
          className="b2b-bulk-btn b2b-bulk-clear"
          onClick={onClearSelection}
          disabled={saving}
        >
          Clear Selection
        </button>
      </div>
    </div>
  );
}

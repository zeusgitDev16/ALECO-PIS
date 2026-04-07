import React from 'react';
import { IconPencil, IconTrash, IconExpand } from '../interruptions/AdvisoryActionIcons';

/**
 * Mobile action sheet for personnel cards (mirrors InterruptionCardActionModal, without feed actions).
 */
export default function PersonnelCardActionModal({
  variant,
  crew,
  lineman,
  onClose,
  onViewFull,
  onEdit,
  onDelete,
  saving,
}) {
  const row = variant === 'crew' ? crew : lineman;
  if (!row) return null;

  const title =
    variant === 'crew'
      ? String(crew.crew_name || '').trim() || '—'
      : String(lineman.full_name || '').trim() || '—';

  return (
    <div className="interruption-card-action-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="interruption-card-action-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Personnel actions"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="interruption-card-action-modal-header">
          <h3 className="interruption-card-action-modal-title">{title}</h3>
          <span className="interruption-card-action-modal-ref">#{row.id}</span>
          <button type="button" className="interruption-card-action-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="interruption-card-action-modal-body interruption-card-action-modal-body--icons">
          {onViewFull && (
            <button
              type="button"
              className="interruption-card-action-btn interruption-card-action-btn--icon"
              onClick={() => {
                onClose();
                onViewFull();
              }}
              disabled={saving}
              title="View details"
              aria-label="View details"
            >
              <IconExpand />
              <span>View details</span>
            </button>
          )}
          <button
            type="button"
            className="interruption-card-action-btn interruption-card-action-btn--icon"
            onClick={() => {
              onClose();
              onEdit(row);
            }}
            disabled={saving}
            title="Edit"
            aria-label="Edit"
          >
            <IconPencil />
            <span>Edit</span>
          </button>
          <button
            type="button"
            className="interruption-card-action-btn interruption-card-action-btn--icon interruption-card-action-btn--danger"
            onClick={() => {
              onClose();
              onDelete(row);
            }}
            disabled={saving}
            title="Delete"
            aria-label="Delete"
          >
            <IconTrash />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}

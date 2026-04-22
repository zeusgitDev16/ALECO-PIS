import React from 'react';
import { isCurrentlyOnPublicFeed } from '../../utils/dateUtils';
import { IconArrowUp, IconArrowDown, IconPencil, IconArchive, IconTrash, IconExpand, IconRefreshCw } from './AdvisoryActionIcons';

/**
 * InterruptionCardActionModal - Action menu for mobile (320px).
 * Shown when user taps a card; contains View Full, Edit, Archive/Delete, Pull/Push.
 */
export default function InterruptionCardActionModal({
  item,
  onClose,
  onViewFull,
  onEdit,
  onUpdate,
  onArchive,
  onPermanentDelete,
  onPullFromFeed,
  onPushToFeed,
  saving,
}) {
  if (!item) return null;

  const archived = Boolean(item.deletedAt);
  const feederDisplay = String(item.feeder || '').trim() || '—';

  return (
    <div
      className="interruption-card-action-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="interruption-card-action-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Advisory actions"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="interruption-card-action-modal-header">
          <h3 className="interruption-card-action-modal-title">{feederDisplay}</h3>
          <span className="interruption-card-action-modal-ref">#{item.id}</span>
          <button
            type="button"
            className="interruption-card-action-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
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
              title="View full advisory"
              aria-label="View full advisory"
            >
              <IconExpand />
              <span>View Full</span>
            </button>
          )}
          {!archived && isCurrentlyOnPublicFeed(item) && onPullFromFeed && (
            <button
              type="button"
              className="interruption-card-action-btn interruption-card-action-btn--icon interruption-card-action-btn--pull"
              onClick={() => {
                onClose();
                onPullFromFeed(item.id);
              }}
              disabled={saving}
              title="Pull from feed"
              aria-label="Pull from feed"
            >
              <IconArrowDown />
              <span>Pull</span>
            </button>
          )}
          {!archived && item.pulledFromFeedAt && onPushToFeed && (
            <button
              type="button"
              className="interruption-card-action-btn interruption-card-action-btn--icon interruption-card-action-btn--push"
              onClick={() => {
                onClose();
                onPushToFeed(item.id);
              }}
              disabled={saving}
              title="Push to feed"
              aria-label="Push to feed"
            >
              <IconArrowUp />
              <span>Push</span>
            </button>
          )}
          <button
            type="button"
            className="interruption-card-action-btn interruption-card-action-btn--icon"
            onClick={() => {
              onClose();
              onEdit(item);
            }}
            disabled={saving}
            title={archived ? 'View' : 'Edit content'}
            aria-label={archived ? 'View' : 'Edit content'}
          >
            <IconPencil />
            <span>{archived ? 'View' : 'Edit'}</span>
          </button>
          {!archived && onUpdate && (
            <button
              type="button"
              className="interruption-card-action-btn interruption-card-action-btn--icon interruption-card-action-btn--update"
              onClick={() => {
                onClose();
                onUpdate(item);
              }}
              disabled={saving}
              title="Update status & remarks"
              aria-label="Update status & remarks"
            >
              <IconRefreshCw />
              <span>Update</span>
            </button>
          )}
          {archived && onPermanentDelete ? (
            <button
              type="button"
              className="interruption-card-action-btn interruption-card-action-btn--icon interruption-card-action-btn--danger"
              onClick={() => {
                onClose();
                onPermanentDelete(item.id);
              }}
              disabled={saving}
              title="Delete permanently"
              aria-label="Delete permanently"
            >
              <IconTrash />
              <span>Delete</span>
            </button>
          ) : (
            <button
              type="button"
              className="interruption-card-action-btn interruption-card-action-btn--icon interruption-card-action-btn--archive"
              onClick={() => {
                onClose();
                onArchive(item.id);
              }}
              disabled={saving}
              title="Archive"
              aria-label="Archive"
            >
              <IconArchive />
              <span>Archive</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

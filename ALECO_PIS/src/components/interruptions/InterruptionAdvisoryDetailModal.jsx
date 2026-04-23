import React from 'react';
import { getStatusDisplayLabel, getCauseCategoryLabel, getTypeDisplayLabel, interruptionStatusForCssClass } from '../../utils/interruptionLabels';
import { formatToPhilippineTime, isPublicVisibilityPending, isCurrentlyOnPublicFeed } from '../../utils/dateUtils';
import { IconArrowUp, IconArrowDown, IconPencil, IconArchive, IconRefreshCw } from './AdvisoryActionIcons';
import { getSafeResourceUrl } from '../../utils/safeUrl';

/**
 * InterruptionAdvisoryDetailModal - Full advisory view in a modal (read-only).
 * Displays the advisory exactly as a full card - same structure as the card content,
 * but in a modal for detailed viewing. Not edit mode, not the plain-text view with audit logs.
 */
export default function InterruptionAdvisoryDetailModal({
  item,
  onClose,
  onEdit,
  onUpdate,
  onPullFromFeed,
  onPushToFeed,
  onRestore,
  listArchiveFilter = 'active',
  saving,
}) {
  if (!item) return null;

  const archived = Boolean(item.deletedAt);
  const statusLabel = getStatusDisplayLabel(item.status);
  const statusClass = interruptionStatusForCssClass(item.status);
  const feederDisplay = String(item.feeder || '').trim() || '—';
  const areasFull = (item.affectedAreas || []).join(', ') || '—';
  const hasBody = item.body && String(item.body).trim();
  const bodyDisplay = hasBody ? String(item.body).trim() : '';
  const safeAdvisoryImageUrl = item.imageUrl ? getSafeResourceUrl(item.imageUrl) : null;

  return (
    <div
      className="interruption-detail-modal-backdrop"
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="interruption-detail-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="interruption-detail-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        <div className="interruption-detail-modal-inner">
          <article className={`interruptions-admin-card interruptions-admin-card--detail-modal${archived ? ' interruptions-admin-card--archived' : ''}`}>
            <div className="interruptions-admin-card-head">
              <span className={`interruptions-admin-status-chip status-${statusClass}`}>{statusLabel}</span>
              <span className="interruptions-admin-type-pill">{getTypeDisplayLabel(item.type)}</span>
              {archived && (
                <span className="interruptions-admin-archived-chip" title="Not shown on the public home page">
                  Archived
                </span>
              )}
              {isPublicVisibilityPending(item.publicVisibleAt) && (
                <span className="interruptions-admin-bull-scheduled-chip" title="Not yet shown on the public home page">
                  Bulletin scheduled
                </span>
              )}
            </div>

            <div className="interruptions-admin-card-identity">
              <div className="interruptions-admin-card-identity-main">
                <span className="interruptions-admin-card-feeder-label">Feeder</span>
                <h3 className="interruptions-admin-card-feeder-value">{feederDisplay}</h3>
              </div>
              <span className="interruptions-admin-card-ref-id" title="Advisory reference number">
                #{item.id}
              </span>
              {item.controlNo && (
                <span className="interruptions-admin-card-control-no" title="Control number">
                  {item.controlNo}
                </span>
              )}
            </div>

            {hasBody ? (
              <div className="interruptions-admin-card-body">
                <p className="interruptions-admin-card-body-text interruptions-admin-card-body-text--full">
                  {bodyDisplay}
                </p>
              </div>
            ) : (
              <>
                <p className="interruptions-admin-card-cause">{item.cause || '—'}</p>
                {item.causeCategory && (
                  <span className="interruptions-admin-cause-category-pill" title="Cause category">
                    {getCauseCategoryLabel(item.causeCategory)}
                  </span>
                )}
                <p className="interruptions-admin-card-areas">
                  <span className="interruptions-admin-card-areas-label">Affected areas</span>
                  <span className="interruptions-admin-card-areas-value">{areasFull}</span>
                </p>
              </>
            )}

            {safeAdvisoryImageUrl && (
              <div className="interruptions-admin-card-image">
                <img src={safeAdvisoryImageUrl} alt="Advisory" />
              </div>
            )}

            <div className="interruptions-admin-card-date-section">
              <h4 className="interruptions-admin-card-section-label">Schedule</h4>
              <dl className="interruptions-admin-card-dates interruptions-admin-card-dates--schedule">
                <div>
                  <dt>Start</dt>
                  <dd>
                    {item.dateTimeStart ? formatToPhilippineTime(item.dateTimeStart) : '—'}
                  </dd>
                </div>
                <div>
                  <dt>ERT (forecast)</dt>
                  <dd>
                    {item.dateTimeEndEstimated ? formatToPhilippineTime(item.dateTimeEndEstimated) : '—'}
                  </dd>
                </div>
                <div>
                  <dt>Energized at</dt>
                  <dd>
                    {item.dateTimeRestored ? formatToPhilippineTime(item.dateTimeRestored) : '—'}
                  </dd>
                </div>
              </dl>
            </div>

            {item.publicVisibleAt && (
              <div className="interruptions-admin-card-date-section">
                <h4 className="interruptions-admin-card-section-label">Public bulletin</h4>
                <p className="interruptions-admin-card-pubvis">
                  {isPublicVisibilityPending(item.publicVisibleAt) ? (
                    <>
                      <strong>Goes live</strong>{' '}
                      <span>{formatToPhilippineTime(item.publicVisibleAt)}</span>
                    </>
                  ) : (
                    <>
                      <strong>Visible since</strong>{' '}
                      <span>{formatToPhilippineTime(item.publicVisibleAt)}</span>
                    </>
                  )}
                </p>
              </div>
            )}

            {(item.createdAt || item.updatedAt) && (
              <div className="interruptions-admin-card-date-section">
                <h4 className="interruptions-admin-card-section-label">Record</h4>
                <dl className="interruptions-admin-card-dates interruptions-admin-card-dates--record">
                  {item.createdAt && (
                    <div>
                      <dt>Posted</dt>
                      <dd>{formatToPhilippineTime(item.createdAt)}</dd>
                    </div>
                  )}
                  {item.updatedAt && (
                    <div>
                      <dt>Updated</dt>
                      <dd>{formatToPhilippineTime(item.updatedAt)}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            <div className="interruptions-admin-card-actions">
              {!archived && isCurrentlyOnPublicFeed(item) && onPullFromFeed && (
                <button
                  type="button"
                  className="interruptions-admin-btn interruptions-admin-btn--icon interruptions-admin-btn--pull"
                  onClick={() => onPullFromFeed(item.id)}
                  disabled={saving}
                  title="Pull from public feed"
                  aria-label="Pull from public feed"
                >
                  <IconArrowDown />
                </button>
              )}
              {!archived && item.pulledFromFeedAt && onPushToFeed && (
                <button
                  type="button"
                  className="interruptions-admin-btn interruptions-admin-btn--icon interruptions-admin-btn--push"
                  onClick={() => onPushToFeed(item.id)}
                  disabled={saving}
                  title="Push back to public feed"
                  aria-label="Push back to public feed"
                >
                  <IconArrowUp />
                </button>
              )}
              {onEdit && (
                <button type="button" className="interruptions-admin-btn interruptions-admin-btn--icon" onClick={() => onEdit(item)} disabled={saving} title="Edit content" aria-label="Edit content">
                  <IconPencil />
                </button>
              )}
              {!archived && onUpdate && (
                <button
                  type="button"
                  className="interruptions-admin-btn interruptions-admin-btn--icon interruptions-admin-btn--update"
                  onClick={() => onUpdate(item)}
                  disabled={saving}
                  title="Update status & remarks"
                  aria-label="Update status & remarks"
                >
                  <IconRefreshCw />
                </button>
              )}
              {archived && listArchiveFilter === 'archived' && typeof onRestore === 'function' && (
                <button
                  type="button"
                  className="interruptions-admin-btn interruptions-admin-btn--secondary"
                  onClick={() => onRestore(item.id)}
                  disabled={saving}
                  title="Unarchive and return this advisory to the active list"
                >
                  Restore
                </button>
              )}
              <button type="button" className="interruptions-admin-btn" onClick={onClose}>
                Close
              </button>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}

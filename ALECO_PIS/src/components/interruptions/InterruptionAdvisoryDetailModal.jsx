import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { getStatusDisplayLabel, getCauseCategoryLabel, getTypeDisplayLabel, interruptionStatusForCssClass } from '../../utils/interruptionLabels';
import { formatToPhilippineTime, isPublicVisibilityPending, isCurrentlyOnPublicFeed } from '../../utils/dateUtils';
import { IconArrowUp, IconArrowDown, IconPencil, IconArchive, IconRefreshCw } from './AdvisoryActionIcons';
import { getSafeResourceUrl } from '../../utils/safeUrl';
import InterruptionAlecoPrintPoster from './InterruptionAlecoPrintPoster';
import InterruptionNgcpPrintPoster from './InterruptionNgcpPrintPoster';

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
  const [showPosterFullImage, setShowPosterFullImage] = useState(false);

  const archived = Boolean(item.deletedAt);
  const statusLabel = getStatusDisplayLabel(item.status);
  const statusClass = interruptionStatusForCssClass(item.status);
  const feederDisplay = String(item.feeder || '').trim() || '—';
  const areasFull = (item.affectedAreas || []).join(', ') || '—';
  const groupedAreas =
    Array.isArray(item.affectedAreasGrouped) && item.affectedAreasGrouped.length > 0
      ? item.affectedAreasGrouped
      : null;
  const hasBody = item.body && String(item.body).trim();
  const bodyDisplay = hasBody ? String(item.body).trim() : '';
  const safeAdvisoryImageUrl = item.imageUrl ? getSafeResourceUrl(item.imageUrl) : null;
  const isBlankStub =
    typeof item.posterImageUrl === 'string' && item.posterImageUrl.includes('_stub');
  const safePosterUrl =
    !isBlankStub && item.posterImageUrl
      ? getSafeResourceUrl(item.posterImageUrl)
      : null;

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

        <div className="interruption-detail-modal-inner interruption-detail-modal-inner--dashboard">
          <article className={`interruptions-admin-card interruptions-admin-card--detail-modal interruption-detail-dashboard${archived ? ' interruptions-admin-card--archived' : ''}`}>
            <div className="interruption-detail-dashboard-head">
              <div className="interruption-detail-dashboard-head-left">
                <span className={`interruptions-admin-status-chip status-${statusClass}`}>{statusLabel}</span>
                <span className="interruptions-admin-type-pill">{getTypeDisplayLabel(item.type)}</span>
                <span className="interruption-detail-dashboard-ref">#{item.id}</span>
                {item.controlNo && (
                  <span className="interruptions-admin-card-control-no" title="Control number">
                    {item.controlNo}
                  </span>
                )}
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
              <h3 className="interruption-detail-dashboard-feeder">{feederDisplay}</h3>
            </div>

            <div className="interruption-detail-dashboard-poster">
              {safePosterUrl ? (
                <img
                  src={safePosterUrl}
                  alt="Advisory poster"
                  className="interruption-detail-dashboard-poster-img interruption-detail-dashboard-poster-img--clickable"
                  loading="lazy"
                  onClick={() => setShowPosterFullImage(true)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setShowPosterFullImage(true)}
                />
              ) : (
                <div className="interruption-detail-dashboard-poster-fallback">
                  {item.type === 'NgcScheduled' ? (
                    <InterruptionNgcpPrintPoster item={item} />
                  ) : (
                    <InterruptionAlecoPrintPoster item={item} />
                  )}
                </div>
              )}
            </div>

            <div className="interruption-detail-dashboard-sections">
              <section className="interruption-detail-dashboard-section">
                <h4 className="interruptions-admin-card-section-label">Schedule</h4>
                <dl className="interruptions-admin-card-dates interruptions-admin-card-dates--schedule">
                  <div>
                    <dt>Start</dt>
                    <dd>{item.dateTimeStart ? formatToPhilippineTime(item.dateTimeStart) : '—'}</dd>
                  </div>
                  <div>
                    <dt>ERT (forecast)</dt>
                    <dd>{item.dateTimeEndEstimated ? formatToPhilippineTime(item.dateTimeEndEstimated) : '—'}</dd>
                  </div>
                  <div>
                    <dt>Scheduled auto-restore</dt>
                    <dd>{item.scheduledRestoreAt ? formatToPhilippineTime(item.scheduledRestoreAt) : '—'}</dd>
                  </div>
                  <div>
                    <dt>Energized at</dt>
                    <dd>{item.dateTimeRestored ? formatToPhilippineTime(item.dateTimeRestored) : '—'}</dd>
                  </div>
                </dl>
                <p className="interruption-detail-dashboard-inline-note">
                  <strong>Auto-restore remark:</strong> {item.scheduledRestoreRemark || '—'}
                </p>
              </section>

              <section className="interruption-detail-dashboard-section">
                <h4 className="interruptions-admin-card-section-label">Cause</h4>
                <p className="interruptions-admin-card-cause">{item.cause || '—'}</p>
                <p className="interruption-detail-dashboard-inline-note">
                  <strong>Category:</strong> {item.causeCategory ? getCauseCategoryLabel(item.causeCategory) : '—'}
                </p>
              </section>

              <section className="interruption-detail-dashboard-section">
                <h4 className="interruptions-admin-card-section-label">Affected areas</h4>
                {groupedAreas ? (
                  <div className="interruption-detail-dashboard-grouped-areas">
                    {groupedAreas.map((g, i) => (
                      <div key={i} className="interruption-detail-dashboard-group">
                        {g.heading ? <p className="interruption-detail-dashboard-group-heading">{g.heading}</p> : null}
                        <ul className="interruption-detail-dashboard-area-list">
                          {(g.items || []).map((a, ai) => (
                            <li key={ai}>{a}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="interruptions-admin-card-areas-value">{areasFull}</p>
                )}
              </section>

              {hasBody && (
                <section className="interruption-detail-dashboard-section">
                  <h4 className="interruptions-admin-card-section-label">What you want to say</h4>
                  <p className="interruptions-admin-card-body-text interruptions-admin-card-body-text--full">{bodyDisplay}</p>
                </section>
              )}

              {safeAdvisoryImageUrl && (
                <section className="interruption-detail-dashboard-section">
                  <h4 className="interruptions-admin-card-section-label">Attached image</h4>
                  <div className="interruptions-admin-card-image">
                    <img src={safeAdvisoryImageUrl} alt="Advisory" />
                  </div>
                </section>
              )}

              <section className="interruption-detail-dashboard-section">
                <h4 className="interruptions-admin-card-section-label">Public bulletin</h4>
                {item.publicVisibleAt ? (
                  <p className="interruptions-admin-card-pubvis">
                    {isPublicVisibilityPending(item.publicVisibleAt) ? (
                      <>
                        <strong>Goes live</strong> <span>{formatToPhilippineTime(item.publicVisibleAt)}</span>
                      </>
                    ) : (
                      <>
                        <strong>Visible since</strong> <span>{formatToPhilippineTime(item.publicVisibleAt)}</span>
                      </>
                    )}
                  </p>
                ) : (
                  <p className="interruptions-admin-card-pubvis">
                    <strong>Visibility</strong> <span>Immediate (no schedule)</span>
                  </p>
                )}
              </section>

              {(item.createdAt || item.updatedAt) && (
                <section className="interruption-detail-dashboard-section">
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
                </section>
              )}
            </div>

            <div className="interruptions-admin-card-actions interruption-detail-dashboard-actions">
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
      {safePosterUrl && showPosterFullImage && createPortal(
        <div
          className="full-screen-image-overlay"
          onClick={() => setShowPosterFullImage(false)}
        >
          <img src={safePosterUrl} alt="Poster full view" />
        </div>,
        document.body
      )}
    </div>
  );
}

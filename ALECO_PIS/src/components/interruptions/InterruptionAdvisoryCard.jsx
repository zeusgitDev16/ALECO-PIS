import React from 'react';
import { getStatusDisplayLabel } from '../../utils/interruptionLabels';
import { formatToPhilippineTime, isPublicVisibilityPending } from '../../utils/dateUtils';
import { IconArrowUp, IconArrowDown, IconPencil, IconArchive, IconTrash, IconExpand } from './AdvisoryActionIcons';

const CARD_PREVIEW_LEN = 80;

function truncate(s, max) {
  if (!s) return '';
  const t = String(s).trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/**
 * InterruptionAdvisoryCard - Compact card for grid view (like ticket cards).
 * Full details available via expand modal.
 * On mobile (<=320px): card is clickable, opens action modal (buttons hidden on card).
 * @param {object} props
 * @param {object} props.item - API DTO
 * @param {() => void} props.onEdit
 * @param {() => void} props.onDelete
 * @param {() => void} [props.onPermanentDelete]
 * @param {() => void} [props.onExpand] - Open full advisory view in modal
 * @param {(item: object) => void} [props.onCardClick] - When set (mobile), whole card opens action modal
 * @param {'on-feed'|'not-on-feed'|'archived'} [props.feedIndicator] - Green=on feed, purple=not on feed, red=archived
 * @param {(id: number) => void} [props.onPullFromFeed]
 * @param {(id: number) => void} [props.onPushToFeed]
 * @param {boolean} props.saving
 */
export default function InterruptionAdvisoryCard({ item, onEdit, onDelete, onPermanentDelete, onExpand, onCardClick, feedIndicator, onPullFromFeed, onPushToFeed, saving }) {
  const archived = Boolean(item.deletedAt);
  const statusLabel = getStatusDisplayLabel(item.status);
  const statusClass = String(item.status || '').toLowerCase();
  const feederDisplay = String(item.feeder || '').trim() || '—';
  const areasFull = (item.affectedAreas || []).join(', ') || '—';
  const areasShort = truncate(areasFull, 50);
  const hasBody = item.body && String(item.body).trim();
  const previewText = hasBody ? truncate(String(item.body).trim(), CARD_PREVIEW_LEN) : truncate(item.cause, CARD_PREVIEW_LEN);

  const handleCardClick = () => {
    if (onCardClick) onCardClick(item);
  };

  return (
    <article
      className={`interruptions-admin-card interruptions-admin-card--compact${archived ? ' interruptions-admin-card--archived' : ''}${onCardClick ? ' interruptions-admin-card--mobile-clickable' : ''}${feedIndicator ? ` interruptions-admin-card--feed-${feedIndicator}` : ''}`}
      onClick={onCardClick ? handleCardClick : undefined}
      role={onCardClick ? 'button' : undefined}
      tabIndex={onCardClick ? 0 : undefined}
      onKeyDown={onCardClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick(); } } : undefined}
    >
      <div className="interruptions-admin-card-head">
        <span className={`interruptions-admin-status-chip status-${statusClass}`}>{statusLabel}</span>
        {archived && (
          <span className="interruptions-admin-archived-chip" title="Archived">Archived</span>
        )}
        {isPublicVisibilityPending(item.publicVisibleAt) && (
          <span className="interruptions-admin-bull-scheduled-chip" title="Scheduled">Scheduled</span>
        )}
      </div>

      <div className="interruptions-admin-card-identity interruptions-admin-card-identity--compact">
        <div className="interruptions-admin-card-identity-main">
          <span className="interruptions-admin-card-feeder-label">Feeder</span>
          <h3 className="interruptions-admin-card-feeder-value interruptions-admin-card-feeder-value--compact">{feederDisplay}</h3>
        </div>
      </div>

      {(previewText || areasShort) && (
        <div className="interruptions-admin-card-preview">
          {previewText && (
            <p className="interruptions-admin-card-preview-text" title={hasBody ? item.body : item.cause}>
              {previewText}
            </p>
          )}
          {areasShort !== '—' && areasShort && (
            <p className="interruptions-admin-card-preview-areas" title={areasFull}>
              {areasShort}
            </p>
          )}
        </div>
      )}

      <div className="interruptions-admin-card-meta">
        <span className="interruptions-admin-card-meta-label">Start</span>
        <span className="interruptions-admin-card-meta-value">
          {item.dateTimeStart ? formatToPhilippineTime(item.dateTimeStart) : '—'}
        </span>
      </div>

      <div className="interruptions-admin-card-actions interruptions-admin-card-actions--compact">
        {onExpand && (
          <button
            type="button"
            className="interruptions-admin-btn interruptions-admin-btn--icon interruptions-admin-btn--expand"
            onClick={onExpand}
            title="View full advisory"
            aria-label="View full advisory"
          >
            <IconExpand />
          </button>
        )}
        {archived ? (
          <>
            <button type="button" className="interruptions-admin-btn interruptions-admin-btn--icon" onClick={onEdit} disabled={saving} title="View" aria-label="View">
              <IconPencil />
            </button>
            {onPermanentDelete && (
              <button
                type="button"
                className="interruptions-admin-btn interruptions-admin-btn--icon interruptions-admin-btn--danger"
                onClick={onPermanentDelete}
                disabled={saving}
                title="Delete permanently"
                aria-label="Delete permanently"
              >
                <IconTrash />
              </button>
            )}
          </>
        ) : (
          <>
            {feedIndicator === 'on-feed' && onPullFromFeed && (
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
            {item.pulledFromFeedAt && onPushToFeed && (
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
            <button type="button" className="interruptions-admin-btn interruptions-admin-btn--icon" onClick={onEdit} disabled={saving} title="Edit" aria-label="Edit">
              <IconPencil />
            </button>
            <button
              type="button"
              className="interruptions-admin-btn interruptions-admin-btn--icon interruptions-admin-btn--archive"
              onClick={onDelete}
              disabled={saving}
              title={isPublicVisibilityPending(item.publicVisibleAt) ? 'Cancel' : 'Archive'}
              aria-label={isPublicVisibilityPending(item.publicVisibleAt) ? 'Cancel' : 'Archive'}
            >
              <IconArchive />
            </button>
          </>
        )}
      </div>
    </article>
  );
}

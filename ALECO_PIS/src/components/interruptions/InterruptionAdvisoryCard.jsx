import React, { useState } from 'react';
import { getStatusDisplayLabel, getCauseCategoryLabel } from '../../utils/interruptionLabels';
import {
  formatToPhilippineTime,
  isPublicVisibilityPending,
} from '../../utils/dateUtils';

const BODY_TRUNCATE_LEN = 200;

function truncate(s, max) {
  if (!s) return '';
  const t = String(s).trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/**
 * @param {object} props
 * @param {object} props.item - API DTO
 * @param {() => void} props.onEdit
 * @param {() => void} props.onDelete
 * @param {() => void} [props.onRestore]
 * @param {() => void} [props.onPermanentDelete]
 * @param {boolean} props.saving
 */
export default function InterruptionAdvisoryCard({ item, onEdit, onDelete, onRestore, onPermanentDelete, saving }) {
  const [bodyExpanded, setBodyExpanded] = useState(false);
  const archived = Boolean(item.deletedAt);
  const statusLabel = getStatusDisplayLabel(item.status);
  const statusClass = String(item.status || '').toLowerCase();
  const feederDisplay = String(item.feeder || '').trim() || '—';
  const areasFull = (item.affectedAreas || []).join(', ') || '—';
  const areasShort = truncate(areasFull, 140);
  const hasBody = item.body && String(item.body).trim();
  const bodyDisplay = hasBody ? String(item.body).trim() : '';
  const bodyTruncated = bodyDisplay.length > BODY_TRUNCATE_LEN;

  return (
    <article className={`interruptions-admin-card${archived ? ' interruptions-admin-card--archived' : ''}`}>
      <div className="interruptions-admin-card-head">
        <span className={`interruptions-admin-status-chip status-${statusClass}`}>{statusLabel}</span>
        <span className="interruptions-admin-type-pill">{item.type}</span>
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
          <p className="interruptions-admin-card-body-text">
            {bodyExpanded || !bodyTruncated
              ? bodyDisplay
              : truncate(bodyDisplay, BODY_TRUNCATE_LEN)}
          </p>
          {bodyTruncated && (
            <button
              type="button"
              className="interruptions-admin-card-read-more"
              onClick={() => setBodyExpanded((e) => !e)}
            >
              {bodyExpanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="interruptions-admin-card-cause">
            {truncate(item.cause, 220)}
            {item.causeCategory && (
              <span className="interruptions-admin-cause-category-pill" title="Cause category">
                {getCauseCategoryLabel(item.causeCategory)}
              </span>
            )}
          </p>
          <p className="interruptions-admin-card-areas" title={areasFull !== areasShort ? areasFull : undefined}>
            <span className="interruptions-admin-card-areas-label">Affected areas</span>
            <span className="interruptions-admin-card-areas-value">{areasShort}</span>
          </p>
        </>
      )}

      {item.imageUrl && (
        <div className="interruptions-admin-card-image">
          <img src={item.imageUrl} alt="Advisory" />
        </div>
      )}

      <div className="interruptions-admin-card-date-section">
        <h4 className="interruptions-admin-card-section-label">Schedule</h4>
        <dl className="interruptions-admin-card-dates interruptions-admin-card-dates--schedule">
          <div>
            <dt>Start</dt>
            <dd title={item.dateTimeStart || undefined}>
              {item.dateTimeStart ? formatToPhilippineTime(item.dateTimeStart) : '—'}
            </dd>
          </div>
          <div>
            <dt>ERT (forecast)</dt>
            <dd title={item.dateTimeEndEstimated || undefined}>
              {item.dateTimeEndEstimated ? formatToPhilippineTime(item.dateTimeEndEstimated) : '—'}
            </dd>
          </div>
          <div>
            <dt>Actual restore</dt>
            <dd title={item.dateTimeRestored || undefined}>
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
                <span title={item.publicVisibleAt}>{formatToPhilippineTime(item.publicVisibleAt)}</span>
              </>
            ) : (
              <>
                <strong>Visible since</strong>{' '}
                <span title={item.publicVisibleAt}>{formatToPhilippineTime(item.publicVisibleAt)}</span>
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
                <dd title={item.createdAt}>{formatToPhilippineTime(item.createdAt)}</dd>
              </div>
            )}
            {item.updatedAt && (
              <div>
                <dt>Updated</dt>
                <dd title={item.updatedAt}>{formatToPhilippineTime(item.updatedAt)}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      <div className="interruptions-admin-card-actions">
        {archived ? (
          <>
            <button type="button" className="interruptions-admin-btn" onClick={onEdit} disabled={saving}>
              View
            </button>
            <button
              type="button"
              className="interruptions-admin-btn interruptions-admin-btn--submit"
              onClick={onRestore}
              disabled={saving || typeof onRestore !== 'function'}
            >
              Restore
            </button>
            <button
              type="button"
              className="interruptions-admin-btn interruptions-admin-btn--danger"
              onClick={onPermanentDelete}
              disabled={saving || typeof onPermanentDelete !== 'function'}
              title="Permanently remove from database. This cannot be undone."
            >
              Delete permanently
            </button>
          </>
        ) : (
          <>
            <button type="button" className="interruptions-admin-btn" onClick={onEdit} disabled={saving}>
              Edit
            </button>
            <button
              type="button"
              className="interruptions-admin-btn interruptions-admin-btn--danger"
              onClick={onDelete}
              disabled={saving}
            >
              {isPublicVisibilityPending(item.publicVisibleAt) ? 'Cancel scheduled' : 'Archive'}
            </button>
          </>
        )}
      </div>
    </article>
  );
}

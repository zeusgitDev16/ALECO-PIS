import React from 'react';
import { formatToPhilippineTime } from '../../utils/dateUtils';
import { getStatusDisplayLabel } from '../../utils/interruptionLabels';

/**
 * Facebook-style post header: ALECO branding, status, Record (Posted/Updated), visibility.
 * @param {{ item: object }} props - item has status, createdAt, updatedAt (ISO from API)
 */
export default function InterruptionFeedPostHeader({ item }) {
  const createdAt = item.createdAt ?? item.created_at;
  const updatedAt = item.updatedAt ?? item.updated_at;
  const postedFormatted = createdAt ? formatToPhilippineTime(createdAt) : '';
  const updatedFormatted = updatedAt ? formatToPhilippineTime(updatedAt) : '';
  const showUpdated = updatedAt && createdAt && String(updatedAt).trim() !== String(createdAt).trim();
  const status = item.status || 'Ongoing';
  const statusLabel = getStatusDisplayLabel(status);
  const statusClass = String(status).toLowerCase();

  return (
    <div className="feed-post-header">
      <div className="feed-post-header-avatar" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M7 2v11h3v9l7-12h-4l4-8z" />
        </svg>
      </div>
      <div className="feed-post-header-meta">
        <div className="feed-post-header-top">
          <span className="feed-post-header-name">ALECO</span>
          <span className={`feed-post-status-chip feed-post-status-chip--${statusClass}`} aria-label={`Status: ${statusLabel}`}>
            {statusLabel}
          </span>
        </div>
        <div className="feed-post-header-record">
          {postedFormatted && (
            <span className="feed-post-header-timestamp" title={createdAt}>
              <strong>Posted:</strong> {postedFormatted}
            </span>
          )}
          {showUpdated && updatedFormatted && (
            <span className="feed-post-header-timestamp feed-post-header-timestamp--updated" title={updatedAt}>
              <strong>Updated:</strong> {updatedFormatted}
            </span>
          )}
          <span className="feed-post-header-globe" aria-label="Public" title="Public">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}

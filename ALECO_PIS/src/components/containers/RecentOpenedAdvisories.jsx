import React, { useState, useEffect } from 'react';
import { getStatusDisplayLabel } from '../../utils/interruptionLabels';
import { formatToPhilippineTime, isCurrentlyOnPublicFeed, isPublicVisibilityPending } from '../../utils/dateUtils';
import { useNow } from '../../hooks/useNow';
import { IconArrowUp, IconArrowDown, IconPencil, IconArchive, IconTrash, IconExpand } from '../interruptions/AdvisoryActionIcons';
import InterruptionCardActionModal from '../interruptions/InterruptionCardActionModal';
import InterruptionAdvisoryDetailModal from '../interruptions/InterruptionAdvisoryDetailModal';
import '../../CSS/RecentOpenedAdvisories.css';
import '../../CSS/InterruptionsAdmin.css';

function useMatchMedia(query) {
  const [matches, setMatches] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false));
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(query);
    const handler = () => setMatches(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

function truncate(s, max) {
  if (!s) return '';
  const t = String(s).trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/**
 * RecentOpenedAdvisories - Compact horizontal strip of recently opened advisories.
 * Always rendered as a single scrollable row to minimize vertical space.
 */
const RecentOpenedAdvisories = ({
  advisories,
  recentIds,
  timeRange,
  onTimeRangeChange,
  onSelectAdvisory,
  onPullFromFeed,
  onPushToFeed,
  onDelete,
  onPermanentDelete,
  saving,
  isCollapsed,
  onToggleCollapse,
}) => {
  const now = useNow([]);
  const isMobile = useMatchMedia('(max-width: 767px)');
  const [actionModalItem, setActionModalItem] = useState(null);
  const [detailItem, setDetailItem] = useState(null);

  const openViewFull = (item) => {
    setActionModalItem(null);
    setDetailItem(item);
  };
  const recentAdvisories = recentIds.length > 0
    ? recentIds
        .map(id => advisories.find(a => a.id === id))
        .filter(Boolean)
    : [];

  if (recentAdvisories.length === 0) return null;

  const renderCardActions = (item, stopPropagation = true) => {
    const archived = Boolean(item.deletedAt);
    const feedIndicator = archived ? 'archived' : isCurrentlyOnPublicFeed(item, now) ? 'on-feed' : 'not-on-feed';
    const handleClick = (e) => { if (stopPropagation) e.stopPropagation(); };

    return (
      <div className="interruptions-admin-card-actions interruptions-admin-card-actions--compact" onClick={handleClick}>
        <button type="button" className="interruptions-admin-btn interruptions-admin-btn--icon interruptions-admin-btn--expand" onClick={() => openViewFull(item)} disabled={saving} title="View full advisory" aria-label="View full advisory">
          <IconExpand />
        </button>
        {archived ? (
          <>
            <button type="button" className="interruptions-admin-btn interruptions-admin-btn--icon" onClick={() => onSelectAdvisory(item)} disabled={saving} title="View" aria-label="View">
              <IconPencil />
            </button>
            {onPermanentDelete && (
              <button type="button" className="interruptions-admin-btn interruptions-admin-btn--icon interruptions-admin-btn--danger" onClick={() => onPermanentDelete(item.id)} disabled={saving} title="Delete permanently" aria-label="Delete permanently">
                <IconTrash />
              </button>
            )}
          </>
        ) : (
          <>
            {feedIndicator === 'on-feed' && onPullFromFeed && (
              <button type="button" className="interruptions-admin-btn interruptions-admin-btn--icon interruptions-admin-btn--pull" onClick={() => onPullFromFeed(item.id)} disabled={saving} title="Pull from public feed" aria-label="Pull from public feed">
                <IconArrowDown />
              </button>
            )}
            {item.pulledFromFeedAt && onPushToFeed && (
              <button type="button" className="interruptions-admin-btn interruptions-admin-btn--icon interruptions-admin-btn--push" onClick={() => onPushToFeed(item.id)} disabled={saving} title="Push back to public feed" aria-label="Push back to public feed">
                <IconArrowUp />
              </button>
            )}
            <button type="button" className="interruptions-admin-btn interruptions-admin-btn--icon" onClick={() => onSelectAdvisory(item)} disabled={saving} title="Edit" aria-label="Edit">
              <IconPencil />
            </button>
            <button type="button" className="interruptions-admin-btn interruptions-admin-btn--icon interruptions-admin-btn--archive" onClick={() => onDelete(item.id)} disabled={saving} title={isPublicVisibilityPending(item.publicVisibleAt) ? 'Cancel' : 'Archive'} aria-label={isPublicVisibilityPending(item.publicVisibleAt) ? 'Cancel' : 'Archive'}>
              <IconArchive />
            </button>
          </>
        )}
      </div>
    );
  };

  const renderStrip = () => (
    <div className="recent-opened-advisories-kanban-strip">
      {recentAdvisories.map(item => (
        <article
          key={item.id}
          className={`recent-opened-advisory-kanban-card interruptions-admin-card interruptions-admin-card--compact${isMobile ? ' interruptions-admin-card--mobile-clickable' : ''}`}
          {...(isMobile ? {
            onClick: () => setActionModalItem(item),
            role: 'button',
            tabIndex: 0,
            onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActionModalItem(item); } },
          } : {})}
        >
          <div className="interruptions-admin-card-head">
            <span className={`interruptions-admin-status-chip status-${String(item.status || '').toLowerCase()}`}>
              {getStatusDisplayLabel(item.status)}
            </span>
          </div>
          <div className="interruptions-admin-card-identity interruptions-admin-card-identity--compact">
            <h3 className="interruptions-admin-card-feeder-value interruptions-admin-card-feeder-value--compact">
              {String(item.feeder || '').trim() || '—'}
            </h3>
          </div>
          <p className="recent-opened-advisory-preview">{truncate(item.body || item.cause, 50)}</p>
          <div className="interruptions-admin-card-meta">
            <span className="interruptions-admin-card-meta-value">
              {item.dateTimeStart ? formatToPhilippineTime(item.dateTimeStart) : '—'}
            </span>
          </div>
          {renderCardActions(item)}
        </article>
      ))}
    </div>
  );

  return (
    <div className={`recent-opened-advisories-wrapper ${isCollapsed ? 'recent-opened-advisories-collapsed' : ''}`}>
      <div className="recent-opened-advisories-header" onClick={onToggleCollapse}>
        <span className="recent-opened-advisories-icon">🕐</span>
        <h3 className="recent-opened-advisories-title">Recent Opened Advisories ({recentAdvisories.length})</h3>
        <div className="recent-opened-advisories-time-range" onClick={e => e.stopPropagation()}>
          <label>Time range:</label>
          <select value={timeRange} onChange={e => onTimeRangeChange(e.target.value)}>
            <option value="0.25">Past 15 mins</option>
            <option value="1">Past 1 hour</option>
            <option value="7">Past 7 hours</option>
            <option value="24">Past 1 day</option>
          </select>
        </div>
        <button
          type="button"
          className="recent-opened-advisories-collapse-btn"
          onClick={(e) => { e.stopPropagation(); onToggleCollapse(); }}
          aria-label={isCollapsed ? 'Expand' : 'Collapse'}
        >
          {isCollapsed ? '▶' : '▼'}
        </button>
      </div>
      {!isCollapsed && renderStrip()}

      {detailItem && (
        <InterruptionAdvisoryDetailModal
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onEdit={(it) => {
            setDetailItem(null);
            onSelectAdvisory(it);
          }}
          onPullFromFeed={onPullFromFeed}
          onPushToFeed={onPushToFeed}
          saving={saving}
        />
      )}

      {actionModalItem && (
        <InterruptionCardActionModal
          item={actionModalItem}
          onClose={() => setActionModalItem(null)}
          onViewFull={() => openViewFull(actionModalItem)}
          onEdit={(it) => {
            setActionModalItem(null);
            onSelectAdvisory(it);
          }}
          onArchive={(id) => {
            setActionModalItem(null);
            onDelete(id);
          }}
          onPermanentDelete={onPermanentDelete || undefined}
          onPullFromFeed={onPullFromFeed}
          onPushToFeed={onPushToFeed}
          saving={saving}
        />
      )}
    </div>
  );
};

export default RecentOpenedAdvisories;

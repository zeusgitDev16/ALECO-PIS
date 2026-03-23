import React, { useState, useEffect } from 'react';
import { useNow } from '../../hooks/useNow';
import { isCurrentlyOnPublicFeed } from '../../utils/dateUtils';
import InterruptionAdvisoryCard from './InterruptionAdvisoryCard';
import InterruptionAdvisoryDetailModal from './InterruptionAdvisoryDetailModal';
import InterruptionCardActionModal from './InterruptionCardActionModal';

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

/**
 * @param {object} props
 * @param {boolean} props.loading
 * @param {object[]} props.items
 * @param {number} props.totalCount - unfiltered list length (for empty-vs-filtered copy)
 * @param {(row: object) => void} props.onEdit
 * @param {(id: number) => void} props.onDelete
 * @param {(id: number) => void} [props.onPermanentDelete]
 * @param {(id: number) => void} [props.onPullFromFeed]
 * @param {(id: number) => void} [props.onPushToFeed]
 * @param {'active'|'all'|'archived'} [props.listArchiveFilter]
 * @param {boolean} props.saving
 */
export default function InterruptionAdvisoryBoard({
  loading,
  items,
  totalCount = 0,
  onEdit,
  onDelete,
  onPermanentDelete,
  onPullFromFeed,
  onPushToFeed,
  listArchiveFilter = 'active',
  saving,
}) {
  const [detailItem, setDetailItem] = useState(null);
  const [actionModalItem, setActionModalItem] = useState(null);
  const isMobile = useMatchMedia('(max-width: 320px)');
  const now = useNow([]);

  if (loading) {
    return (
      <div className="interruptions-admin-board interruptions-admin-board--in-card">
        <p className="widget-text interruptions-admin-board-loading">Loading advisories…</p>
      </div>
    );
  }

  if (!items.length) {
    const noData = totalCount === 0;
    const archivedEmpty = noData && listArchiveFilter === 'archived';
    const allEmpty = noData && listArchiveFilter === 'all';
    return (
      <div className="interruptions-admin-board interruptions-admin-board-empty interruptions-admin-board--in-card">
        <div className="placeholder-content interruptions-admin-board-placeholder">
          <h3>
            {archivedEmpty
              ? 'No archived advisories'
              : allEmpty
                ? 'No advisories in the system'
                : noData
                  ? 'No advisories yet'
                  : 'No advisories match'}
          </h3>
          <p className="widget-text">
            {archivedEmpty
              ? 'Archived advisories appear here after you archive them from the active list, or when Resolved advisories are auto-archived after 1 day 12 hours.'
              : allEmpty
                ? 'Create a new advisory or switch back to Active to see published items.'
                : noData
                  ? 'Create one with “New advisory” to show it on the public Power Outages section.'
                  : 'Try another filter, clear search, or change the list scope (Active / All / Archived).'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="interruptions-admin-board interruptions-admin-board--in-card">
        <div className="interruptions-admin-card-grid">
          {items.map((item) => (
            <InterruptionAdvisoryCard
              key={item.id}
              item={item}
              onEdit={() => onEdit(item)}
              onDelete={() => onDelete(item.id)}
              onPermanentDelete={onPermanentDelete ? () => onPermanentDelete(item.id) : undefined}
              onExpand={() => setDetailItem(item)}
              onCardClick={isMobile ? (it) => setActionModalItem(it) : undefined}
              feedIndicator={item.deletedAt ? 'archived' : isCurrentlyOnPublicFeed(item, now) ? 'on-feed' : 'not-on-feed'}
              onPullFromFeed={onPullFromFeed}
              onPushToFeed={onPushToFeed}
              saving={saving}
            />
          ))}
        </div>
      </div>

      {detailItem && (
        <InterruptionAdvisoryDetailModal
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onEdit={(it) => {
            setDetailItem(null);
            onEdit(it);
          }}
        />
      )}

      {actionModalItem && (
        <InterruptionCardActionModal
          item={actionModalItem}
          onClose={() => setActionModalItem(null)}
          onViewFull={() => {
            setActionModalItem(null);
            setDetailItem(actionModalItem);
          }}
          onEdit={(it) => {
            setActionModalItem(null);
            onEdit(it);
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
    </>
  );
}

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
 * @param {(id: number) => void} [props.onOpenAdvisory] - Called when opening detail modal (for recent-opened tracking)
 * @param {'active'|'all'|'archived'} [props.listArchiveFilter]
 * @param {(row: object) => void} [props.onUpdate] - Open Update Advisory modal
 * @param {(id: number) => Promise<boolean>} [props.onRestoreAdvisory]
 * @param {boolean} props.saving
 */
export default function InterruptionAdvisoryBoard({
  loading,
  items,
  totalCount = 0,
  onEdit,
  onUpdate,
  onDelete,
  onPermanentDelete,
  onPullFromFeed,
  onPushToFeed,
  onOpenAdvisory,
  listArchiveFilter = 'active',
  onRestoreAdvisory,
  saving,
}) {
  const [detailItemId, setDetailItemId] = useState(null);
  const [detailItemFallback, setDetailItemFallback] = useState(null);

  const openDetail = (item) => {
    if (item?.id != null && onOpenAdvisory) onOpenAdvisory(item.id);
    setDetailItemId(item?.id ?? null);
    setDetailItemFallback(item || null);
  };
  const [actionModalItemId, setActionModalItemId] = useState(null);
  const [actionModalItemFallback, setActionModalItemFallback] = useState(null);
  const detailItem = (items || []).find((it) => it.id === detailItemId) || detailItemFallback;
  const actionModalItem = (items || []).find((it) => it.id === actionModalItemId) || actionModalItemFallback;
  const isMobile = useMatchMedia('(max-width: 767px)');
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
              ? 'Archived advisories appear here after you archive them from the active list, or when Energized advisories are auto-archived after 1 day 12 hours.'
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
              onUpdate={onUpdate ? () => onUpdate(item) : undefined}
              onDelete={() => onDelete(item.id)}
              onPermanentDelete={onPermanentDelete ? () => onPermanentDelete(item.id) : undefined}
              onExpand={() => openDetail(item)}
              onCardClick={isMobile ? (it) => {
                setActionModalItemId(it?.id ?? null);
                setActionModalItemFallback(it || null);
              } : undefined}
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
          onClose={() => {
            setDetailItemId(null);
            setDetailItemFallback(null);
          }}
          onEdit={(it) => {
            setDetailItemId(null);
            setDetailItemFallback(null);
            onEdit(it);
          }}
          onUpdate={onUpdate ? (it) => {
            setDetailItemId(null);
            setDetailItemFallback(null);
            onUpdate(it);
          } : undefined}
          onPullFromFeed={onPullFromFeed}
          onPushToFeed={onPushToFeed}
          onRestore={
            onRestoreAdvisory
              ? async (id) => {
                  const ok = await onRestoreAdvisory(id);
                  if (ok) {
                    setDetailItemId(null);
                    setDetailItemFallback(null);
                  }
                }
              : undefined
          }
          listArchiveFilter={listArchiveFilter}
          saving={saving}
        />
      )}

      {actionModalItem && (
        <InterruptionCardActionModal
          item={actionModalItem}
          onClose={() => {
            setActionModalItemId(null);
            setActionModalItemFallback(null);
          }}
          onViewFull={() => {
            const it = actionModalItem;
            setActionModalItemId(null);
            setActionModalItemFallback(null);
            openDetail(it);
          }}
          onEdit={(it) => {
            setActionModalItemId(null);
            setActionModalItemFallback(null);
            onEdit(it);
          }}
          onUpdate={onUpdate ? (it) => {
            setActionModalItemId(null);
            setActionModalItemFallback(null);
            onUpdate(it);
          } : undefined}
          onArchive={(id) => {
            setActionModalItemId(null);
            setActionModalItemFallback(null);
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

import React, { useMemo, useState, useEffect } from 'react';
import { useNow } from '../../hooks/useNow';
import { groupInterruptionsByStatus, getInterruptionColumnConfig } from '../../utils/interruptionWorkflowHelpers';
import { formatToPhilippineTime, isCurrentlyOnPublicFeed } from '../../utils/dateUtils';
import { getTypeDisplayLabel } from '../../utils/interruptionLabels';
import { IconArrowUp, IconArrowDown, IconPencil, IconArchive, IconTrash, IconExpand, IconRefreshCw } from './AdvisoryActionIcons';
import InterruptionAdvisoryDetailModal from './InterruptionAdvisoryDetailModal';
import InterruptionCardActionModal from './InterruptionCardActionModal';
import '../../CSS/InterruptionWorkflowView.css';

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
 * InterruptionWorkflowView - Workflow columns by status (Scheduled, Ongoing, Energized)
 * View-only (no drag) - Edit via button
 * @param {object} props
 * @param {boolean} props.loading
 * @param {object[]} props.items
 * @param {number} props.totalCount
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
export default function InterruptionWorkflowView({
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
  const grouped = useMemo(() => groupInterruptionsByStatus(items), [items]);
  const columnConfig = getInterruptionColumnConfig();
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
  const isMobile = useMatchMedia('(max-width: 320px)');
  const isClickableLayout = useMatchMedia('(max-width: 767px)');
  const now = useNow([]);

  if (loading) {
    return (
      <div className="interruption-workflow-wrapper">
        <p className="interruption-workflow-loading">Loading advisories…</p>
      </div>
    );
  }

  if (!items.length) {
    const noData = totalCount === 0;
    const archivedEmpty = noData && listArchiveFilter === 'archived';
    const allEmpty = noData && listArchiveFilter === 'all';
    return (
      <div className="interruption-workflow-wrapper interruption-workflow-empty">
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
              ? 'Archived advisories appear here after you archive them from the active list.'
              : allEmpty
                ? 'Create a new advisory or switch back to Active to see published items.'
                : noData
                  ? 'Create one with "New advisory" to show it on the public Power Outages section.'
                  : 'Try another filter, clear search, or change the list scope (Active / All / Archived).'}
          </p>
        </div>
      </div>
    );
  }

  const columns = ['Pending', 'Ongoing', 'Energized'];

  return (
    <div className="interruption-workflow-wrapper">
      <div className="interruption-workflow-board">
        {columns.map((colId) => {
          const config = columnConfig[colId];
          const colItems = grouped[colId] || [];
          return (
            <div
              key={colId}
              className="interruption-workflow-column"
              style={{ borderTopColor: config.color }}
            >
              <div className="interruption-workflow-column-header">
                <span className="interruption-workflow-column-icon">{config.icon}</span>
                <h3 className="interruption-workflow-column-title">{config.title}</h3>
                <span
                  className="interruption-workflow-count"
                  style={{ backgroundColor: config.color }}
                >
                  {colItems.length}
                </span>
              </div>
              <div className="interruption-workflow-column-body">
                {colItems.length === 0 ? (
                  <div className="interruption-workflow-empty-col">No advisories</div>
                ) : (
                  colItems.map((item) => {
                    const archived = Boolean(item.deletedAt);
                    const feedIndicator = archived ? 'archived' : isCurrentlyOnPublicFeed(item, now) ? 'on-feed' : 'not-on-feed';
                    const hasBody = item.body && String(item.body).trim();
                    const bodyOrCause = hasBody ? item.body : item.cause || '—';
                    const bodyShort = truncate(bodyOrCause, 80);
                    const handleCardClick = isClickableLayout
                      ? (isMobile
                        ? () => {
                            setActionModalItemId(item?.id ?? null);
                            setActionModalItemFallback(item || null);
                          }
                        : () => openDetail(item))
                      : undefined;
                    return (
                      <div
                        key={item.id}
                        className={`interruption-workflow-card${archived ? ' interruption-workflow-card--archived' : ''} interruption-workflow-card--feed-${feedIndicator}${isClickableLayout ? ' interruption-workflow-card--mobile-clickable' : ''}`}
                        onClick={handleCardClick}
                        role={isClickableLayout ? 'button' : undefined}
                        tabIndex={isClickableLayout ? 0 : undefined}
                        onKeyDown={
                          isClickableLayout
                            ? (e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  handleCardClick?.();
                                }
                              }
                            : undefined
                        }
                      >
                        <div className="interruption-workflow-card-feeder">
                          {String(item.feeder || '').trim() || '—'}
                        </div>
                        <div className="interruption-workflow-card-type">{getTypeDisplayLabel(item.type)}</div>
                        <div className="interruption-workflow-card-body" title={bodyOrCause}>
                          {bodyShort}
                        </div>
                        <div className="interruption-workflow-card-time">
                          {item.dateTimeStart ? formatToPhilippineTime(item.dateTimeStart) : '—'}
                        </div>
                        <div className="interruption-workflow-card-actions">
                          {!archived && feedIndicator === 'on-feed' && onPullFromFeed && (
                            <button
                              type="button"
                              className="interruptions-admin-btn interruptions-admin-btn--icon interruptions-admin-btn--pull"
                              onClick={(e) => {
                                e.stopPropagation();
                                onPullFromFeed(item.id);
                              }}
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
                              onClick={(e) => {
                                e.stopPropagation();
                                onPushToFeed(item.id);
                              }}
                              disabled={saving}
                              title="Push back to public feed"
                              aria-label="Push back to public feed"
                            >
                              <IconArrowUp />
                            </button>
                          )}
                          <button
                            type="button"
                            className="interruptions-admin-btn interruptions-admin-btn--icon interruptions-admin-btn--expand"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDetail(item);
                            }}
                            disabled={saving}
                            title="View full advisory"
                            aria-label="View full advisory"
                          >
                            <IconExpand />
                          </button>
                          <button
                            type="button"
                            className="interruptions-admin-btn interruptions-admin-btn--icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(item);
                            }}
                            disabled={saving}
                            title={archived ? 'View' : 'Edit content'}
                            aria-label={archived ? 'View' : 'Edit content'}
                          >
                            <IconPencil />
                          </button>
                          {!archived && onUpdate && (
                            <button
                              type="button"
                              className="interruptions-admin-btn interruptions-admin-btn--icon interruptions-admin-btn--update"
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdate(item);
                              }}
                              disabled={saving}
                              title="Update status & remarks"
                              aria-label="Update status & remarks"
                            >
                              <IconRefreshCw />
                            </button>
                          )}
                          {archived && onPermanentDelete && (
                            <button
                              type="button"
                              className="interruptions-admin-btn interruptions-admin-btn--icon interruptions-admin-btn--danger"
                              onClick={(e) => {
                                e.stopPropagation();
                                onPermanentDelete(item.id);
                              }}
                              disabled={saving}
                              title="Delete permanently"
                              aria-label="Delete permanently"
                            >
                              <IconTrash />
                            </button>
                          )}
                          {!archived && (
                            <button
                              type="button"
                              className="interruptions-admin-btn interruptions-admin-btn--icon interruptions-admin-btn--archive"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDelete(item.id);
                              }}
                              disabled={saving}
                              title="Archive"
                              aria-label="Archive"
                            >
                              <IconArchive />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
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
    </div>
  );
}

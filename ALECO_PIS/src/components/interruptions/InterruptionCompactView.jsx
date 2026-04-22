import React, { useState, useMemo, useEffect } from 'react';
import { useNow } from '../../hooks/useNow';
import { getStatusDisplayLabel, getTypeDisplayLabel, interruptionStatusForCssClass } from '../../utils/interruptionLabels';
import { formatToPhilippineTime, isCurrentlyOnPublicFeed } from '../../utils/dateUtils';
import { IconArrowUp, IconArrowDown, IconPencil, IconArchive, IconTrash, IconExpand, IconRefreshCw } from './AdvisoryActionIcons';
import InterruptionAdvisoryDetailModal from './InterruptionAdvisoryDetailModal';
import '../../CSS/InterruptionCompactView.css';

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
 * InterruptionCompactView - Compact table view for power advisories
 * Mirrors TicketTableView: sortable columns, sticky header, zebra striping, responsive
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
 * @param {boolean} props.saving
 */
export default function InterruptionCompactView({
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
  saving,
}) {
  const [detailItem, setDetailItem] = useState(null);

  const openDetail = (item) => {
    if (item?.id != null && onOpenAdvisory) onOpenAdvisory(item.id);
    setDetailItem(item);
  };
  const [sortConfig, setSortConfig] = useState({ key: 'dateTimeStart', direction: 'desc' });
  const now = useNow([]);
  const isClickableLayout = useMatchMedia('(max-width: 767px)');

  const sortedItems = useMemo(() => {
    const sorted = [...(items || [])];
    sorted.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      if (sortConfig.key === 'dateTimeStart' || sortConfig.key === 'dateTimeEndEstimated') {
        aVal = aVal ? new Date(aVal).getTime() : 0;
        bVal = bVal ? new Date(bVal).getTime() : 0;
      }
      if (typeof aVal === 'string') {
        aVal = (aVal || '').toLowerCase();
        bVal = (bVal || '').toLowerCase();
      }
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [items, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) return '';
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
  };

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

  return (
    <>
      <div className="interruptions-compact-table-container">
        <table className="interruptions-compact-table">
          <thead className="interruptions-compact-table-header">
            <tr>
              <th className="col-feeder sortable" onClick={() => handleSort('feeder')}>
                Feeder{getSortIndicator('feeder')}
              </th>
              <th className="col-type sortable" onClick={() => handleSort('type')}>
                Type{getSortIndicator('type')}
              </th>
              <th className="col-status sortable" onClick={() => handleSort('status')}>
                Status{getSortIndicator('status')}
              </th>
              <th className="col-start sortable" onClick={() => handleSort('dateTimeStart')}>
                Start{getSortIndicator('dateTimeStart')}
              </th>
              <th className="col-ert sortable" onClick={() => handleSort('dateTimeEndEstimated')}>
                ERT{getSortIndicator('dateTimeEndEstimated')}
              </th>
              <th className="col-affected">Affected</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody className="interruptions-compact-table-body">
            {sortedItems.map((item, index) => {
              const archived = Boolean(item.deletedAt);
              const feedIndicator = archived ? 'archived' : isCurrentlyOnPublicFeed(item, now) ? 'on-feed' : 'not-on-feed';
              const areasFull = (item.affectedAreas || []).join(', ') || '—';
              const areasShort = truncate(areasFull, 50);
              const statusClass = interruptionStatusForCssClass(item.status);
              return (
                <tr
                  key={item.id}
                  className={`interruptions-compact-row ${archived ? 'interruptions-compact-row--archived' : ''} interruptions-compact-row--feed-${feedIndicator} ${index % 2 === 0 ? 'even' : 'odd'}${isClickableLayout ? ' interruptions-compact-row--clickable' : ''}`}
                  onClick={isClickableLayout ? () => openDetail(item) : undefined}
                  role={isClickableLayout ? 'button' : undefined}
                  tabIndex={isClickableLayout ? 0 : undefined}
                  onKeyDown={isClickableLayout ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(item); } } : undefined}
                >
                  <td className="col-feeder">{String(item.feeder || '').trim() || '—'}</td>
                  <td className="col-type">{getTypeDisplayLabel(item.type)}</td>
                  <td className="col-status">
                    <span className={`interruptions-compact-status-badge status-${statusClass}`}>
                      {getStatusDisplayLabel(item.status)}
                    </span>
                  </td>
                  <td className="col-start">{item.dateTimeStart ? formatToPhilippineTime(item.dateTimeStart) : '—'}</td>
                  <td className="col-ert">{item.dateTimeEndEstimated ? formatToPhilippineTime(item.dateTimeEndEstimated) : '—'}</td>
                  <td className="col-affected" title={areasFull !== areasShort ? areasFull : undefined}>
                    {areasShort}
                  </td>
                  <td className="col-actions" onClick={(e) => e.stopPropagation()}>
                    {!archived && feedIndicator === 'on-feed' && onPullFromFeed && (
                      <button
                        type="button"
                        className="interruptions-compact-btn interruptions-compact-btn--icon interruptions-compact-btn--pull"
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
                        className="interruptions-compact-btn interruptions-compact-btn--icon interruptions-compact-btn--push"
                        onClick={() => onPushToFeed(item.id)}
                        disabled={saving}
                        title="Push back to public feed"
                        aria-label="Push back to public feed"
                      >
                        <IconArrowUp />
                      </button>
                    )}
                    <button
                      type="button"
                      className="interruptions-compact-btn interruptions-compact-btn--icon"
                      onClick={() => openDetail(item)}
                      disabled={saving}
                      title="View full advisory"
                      aria-label="View full advisory"
                    >
                      <IconExpand />
                    </button>
                    <button
                      type="button"
                      className="interruptions-compact-btn interruptions-compact-btn--icon"
                      onClick={() => onEdit(item)}
                      disabled={saving}
                      title={archived ? 'View' : 'Edit content'}
                      aria-label={archived ? 'View' : 'Edit content'}
                    >
                      <IconPencil />
                    </button>
                    {!archived && onUpdate && (
                      <button
                        type="button"
                        className="interruptions-compact-btn interruptions-compact-btn--icon interruptions-compact-btn--update"
                        onClick={() => onUpdate(item)}
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
                        className="interruptions-compact-btn interruptions-compact-btn--icon interruptions-compact-btn--danger"
                        onClick={() => onPermanentDelete(item.id)}
                        disabled={saving}
                        title="Permanently remove"
                        aria-label="Delete permanently"
                      >
                        <IconTrash />
                      </button>
                    )}
                    {!archived && (
                      <button
                        type="button"
                        className="interruptions-compact-btn interruptions-compact-btn--icon interruptions-compact-btn--archive"
                        onClick={() => onDelete(item.id)}
                        disabled={saving}
                        title="Archive"
                        aria-label="Archive"
                      >
                        <IconArchive />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {detailItem && (
        <InterruptionAdvisoryDetailModal
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onEdit={(it) => {
            setDetailItem(null);
            onEdit(it);
          }}
          onUpdate={onUpdate ? (it) => {
            setDetailItem(null);
            onUpdate(it);
          } : undefined}
          onPullFromFeed={onPullFromFeed}
          onPushToFeed={onPushToFeed}
          saving={saving}
        />
      )}
    </>
  );
}

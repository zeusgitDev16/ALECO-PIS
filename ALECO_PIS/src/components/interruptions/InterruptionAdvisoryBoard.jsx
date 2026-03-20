import React from 'react';
import InterruptionAdvisoryCard from './InterruptionAdvisoryCard';

/**
 * @param {object} props
 * @param {boolean} props.loading
 * @param {object[]} props.items
 * @param {number} props.totalCount - unfiltered list length (for empty-vs-filtered copy)
 * @param {(row: object) => void} props.onEdit
 * @param {(id: number) => void} props.onDelete
 * @param {(id: number) => void} [props.onRestore]
 * @param {'active'|'all'|'archived'} [props.listArchiveFilter]
 * @param {boolean} props.saving
 */
export default function InterruptionAdvisoryBoard({
  loading,
  items,
  totalCount = 0,
  onEdit,
  onDelete,
  onRestore,
  listArchiveFilter = 'active',
  saving,
}) {
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
                  ? 'Create one with “New advisory” to show it on the public Power Outages section.'
                  : 'Try another filter, clear search, or change the list scope (Active / All / Archived).'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="interruptions-admin-board interruptions-admin-board--in-card">
      <div className="interruptions-admin-card-grid">
        {items.map((item) => (
          <InterruptionAdvisoryCard
            key={item.id}
            item={item}
            onEdit={() => onEdit(item)}
            onDelete={() => onDelete(item.id)}
            onRestore={onRestore ? () => onRestore(item.id) : undefined}
            saving={saving}
          />
        ))}
      </div>
    </div>
  );
}

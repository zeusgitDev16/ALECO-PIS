import React from 'react';
import { FILTER_CHIPS } from '../../utils/interruptionLabels';

/**
 * @param {object} props
 * @param {string} props.activeChipKey
 * @param {(key: string) => void} props.onChipChange
 * @param {string} props.searchQuery
 * @param {(q: string) => void} props.onSearchChange
 */
export default function InterruptionAdvisoryFilters({
  activeChipKey,
  onChipChange,
  searchQuery,
  onSearchChange,
}) {
  return (
    <div className="interruptions-admin-filters">
      <div className="interruptions-admin-chips" role="tablist" aria-label="Filter by status">
        {FILTER_CHIPS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={activeChipKey === key}
            className={`interruptions-admin-chip ${activeChipKey === key ? 'is-active' : ''}`}
            onClick={() => onChipChange(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <input
        type="search"
        placeholder="Search feeder, cause, areas…"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="interruptions-admin-search-input"
        aria-label="Search advisories"
      />
    </div>
  );
}

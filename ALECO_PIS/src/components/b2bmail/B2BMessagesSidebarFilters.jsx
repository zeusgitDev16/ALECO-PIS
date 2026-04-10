import React from 'react';

const B2BMessagesSidebarFilters = ({
  filters,
  hasDraftMessages,
  onChange,
  onClearAll,
}) => {
  return (
    <div className="b2b-filter-panel">
      <h4 className="b2b-filter-panel-title">Message Filters</h4>

      <div className="b2b-filter-group">
        <label className="b2b-side-label" htmlFor="b2b-message-status">
          Status
        </label>
        <select
          id="b2b-message-status"
          className="b2b-side-select"
          value={filters.status}
          onChange={(e) => onChange({ status: e.target.value })}
        >
          <option value="all">All</option>
          <option value="sent">Sent</option>
          <option value="delivered">Delivered</option>
          <option value="failed">Failed</option>
          {hasDraftMessages && <option value="draft">Drafts</option>}
        </select>
      </div>

      <div className="b2b-filter-group">
        <label className="b2b-side-label" htmlFor="b2b-message-search">
          Search
        </label>
        <input
          id="b2b-message-search"
          type="search"
          className="b2b-side-input"
          placeholder="Subject, sender, body..."
          value={filters.searchQuery}
          onChange={(e) => onChange({ searchQuery: e.target.value })}
        />
      </div>

      <div className="b2b-filter-group">
        <label className="b2b-side-label">Date Range</label>
        <div className="b2b-side-date-grid">
          <input
            type="date"
            className="b2b-side-input"
            value={filters.from}
            onChange={(e) => onChange({ from: e.target.value })}
          />
          <input
            type="date"
            className="b2b-side-input"
            value={filters.to}
            onChange={(e) => onChange({ to: e.target.value })}
          />
        </div>
      </div>

      <div className="b2b-filter-group">
        <label className="b2b-side-label" htmlFor="b2b-message-sort">
          Sort
        </label>
        <select
          id="b2b-message-sort"
          className="b2b-side-select"
          value={filters.sortBy}
          onChange={(e) => onChange({ sortBy: e.target.value })}
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
        </select>
      </div>

      <div className="b2b-filter-group b2b-side-checkbox-row">
        <input
          id="b2b-show-logs"
          type="checkbox"
          checked={filters.showLogs}
          onChange={(e) => onChange({ showLogs: e.target.checked })}
        />
        <label htmlFor="b2b-show-logs" className="b2b-side-label-inline">
          Show Activity Logs
        </label>
      </div>

      <button type="button" className="b2b-side-reset" onClick={onClearAll}>
        Clear All
      </button>
    </div>
  );
};

export default B2BMessagesSidebarFilters;

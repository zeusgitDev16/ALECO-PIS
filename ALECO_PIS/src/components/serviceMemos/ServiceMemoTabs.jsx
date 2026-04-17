import React from 'react';

/**
 * Tabs + per-field search. Each field maps to API scoped params (AND) via useServiceMemos → listServiceMemos.
 * Typing updates filters and refetches; no separate "apply" step.
 */
const ServiceMemoTabs = ({ filters, setFilters, activeTab, setActiveTab }) => {
  return (
    <div className="service-memo-search-header">
      <div className="service-memo-search-left">
        <div className="service-memo-tab-row">
          {['all', 'saved', 'closed'].map((tab) => (
            <button
              key={tab}
              type="button"
              className={`service-memo-tab ${activeTab === tab ? 'service-memo-tab--active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
        <div className="service-memo-search-row">
          <div className="service-memo-search-field">
            <label className="service-memo-search-label">Acc#</label>
            <input
              className="service-memo-search-input"
              value={filters.searchAccount || ''}
              onChange={(e) => setFilters((p) => ({ ...p, searchAccount: e.target.value }))}
              placeholder="Account (ticket)"
            />
          </div>
          <div className="service-memo-search-field">
            <label className="service-memo-search-label">Memo#</label>
            <input
              className="service-memo-search-input"
              value={filters.searchMemo || ''}
              onChange={(e) => setFilters((p) => ({ ...p, searchMemo: e.target.value }))}
              placeholder="Control #"
            />
          </div>
        </div>
        <div className="service-memo-search-row">
          <div className="service-memo-search-field service-memo-search-field--full">
            <label className="service-memo-search-label">Name</label>
            <input
              className="service-memo-search-input"
              value={filters.searchName || ''}
              onChange={(e) => setFilters((p) => ({ ...p, searchName: e.target.value }))}
              placeholder="Customer name"
            />
          </div>
        </div>
        <div className="service-memo-search-row">
          <div className="service-memo-search-field service-memo-search-field--full">
            <label className="service-memo-search-label">Address</label>
            <input
              className="service-memo-search-input"
              value={filters.searchAddress || ''}
              onChange={(e) => setFilters((p) => ({ ...p, searchAddress: e.target.value }))}
              placeholder="Address / area"
            />
          </div>
        </div>
      </div>
      <div className="service-memo-search-right" />
    </div>
  );
};

export default ServiceMemoTabs;

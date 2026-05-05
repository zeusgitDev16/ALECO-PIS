import React from 'react';

/**
 * Tabs + per-field search. Each field maps to API scoped params (AND) via useServiceMemos → listServiceMemos.
 * Typing updates filters and refetches; no separate "apply" step.
 *
 * Desktop layout (≥769px) — 3 compact rows, all inline:
 *   Row 1: [All|Saved|Closed tabs]  [Status: select]
 *   Row 2: [Acc#]  [Memo#]  [Name]
 *   Row 3: [Address]  [From]  [To]
 *
 * Mobile layout (<769px) — 4 rows, date/status in drawer:
 *   Row 1: [All|Saved|Closed tabs]
 *   Row 2: [Acc#]  [Memo#]
 *   Row 3: [Name]
 *   Row 4: [Address]
 */
const ServiceMemoTabs = ({ filters, setFilters, activeTab, setActiveTab }) => {
  return (
    <div className="service-memo-search-header">
      <div className="service-memo-search-left">

        {/* Row 1: tabs + Status (Status hidden on mobile, shown on desktop) */}
        <div className="service-memo-search-row service-memo-tabs-filter-row">
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
          <div className="service-memo-search-field service-memo-inline-desktop-field">
            <label className="service-memo-search-label">Status</label>
            <select
              className="service-memo-search-input service-memo-search-select"
              value={filters.status || ''}
              onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
            >
              <option value="">All statuses</option>
              <option value="Restored">Restored</option>
              <option value="Unresolved">Unresolved</option>
              <option value="NoFaultFound">No Fault Found</option>
              <option value="AccessDenied">Access Denied</option>
            </select>
          </div>
          <div className="service-memo-search-field service-memo-inline-desktop-field">
            <label className="service-memo-search-label">Municipality</label>
            <select
              className="service-memo-search-input service-memo-search-select"
              value={filters.municipality || ''}
              onChange={(e) => setFilters((p) => ({ ...p, municipality: e.target.value }))}
            >
              <option value="">All municipalities</option>
              <optgroup label="1st District (North Albay)">
                <option value="Bacacay">Bacacay</option>
                <option value="Malilipot">Malilipot</option>
                <option value="Malinao">Malinao</option>
                <option value="Santo Domingo">Santo Domingo</option>
                <option value="Tabaco City">Tabaco City</option>
                <option value="Tiwi">Tiwi</option>
              </optgroup>
              <optgroup label="2nd District (Central Albay)">
                <option value="Camalig">Camalig</option>
                <option value="Daraga">Daraga</option>
                <option value="Legazpi City">Legazpi City</option>
                <option value="Manito">Manito</option>
                <option value="Rapu-Rapu">Rapu-Rapu</option>
              </optgroup>
              <optgroup label="3rd District (South Albay)">
                <option value="Guinobatan">Guinobatan</option>
                <option value="Jovellar">Jovellar</option>
                <option value="Libon">Libon</option>
                <option value="Ligao City">Ligao City</option>
                <option value="Oas">Oas</option>
                <option value="Pio Duran">Pio Duran</option>
                <option value="Polangui">Polangui</option>
              </optgroup>
            </select>
          </div>
        </div>

        {/* Row 2: Acc# + Memo# always; Name injected on desktop */}
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
          {/* Name — visible only on desktop in this row */}
          <div className="service-memo-search-field service-memo-inline-desktop-field">
            <label className="service-memo-search-label">Name</label>
            <input
              className="service-memo-search-input"
              value={filters.searchName || ''}
              onChange={(e) => setFilters((p) => ({ ...p, searchName: e.target.value }))}
              placeholder="Customer name"
            />
          </div>
        </div>

        {/* Row 3 (mobile-only): Name on its own row */}
        <div className="service-memo-search-row service-memo-mobile-only-row">
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

        {/* Row 4/3: Address always; Date From + To injected on desktop */}
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
          {/* Date range — visible only on desktop */}
          <div className="service-memo-search-field service-memo-inline-desktop-field">
            <label className="service-memo-search-label">From</label>
            <input
              className="service-memo-search-input"
              type="date"
              value={filters.startDate || ''}
              onChange={(e) => setFilters((p) => ({ ...p, startDate: e.target.value }))}
            />
          </div>
          <div className="service-memo-search-field service-memo-inline-desktop-field">
            <label className="service-memo-search-label">To</label>
            <input
              className="service-memo-search-input"
              type="date"
              value={filters.endDate || ''}
              onChange={(e) => setFilters((p) => ({ ...p, endDate: e.target.value }))}
            />
          </div>
        </div>

      </div>
      <div className="service-memo-search-right" />
    </div>
  );
};

export default ServiceMemoTabs;

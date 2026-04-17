import React from 'react';

const ServiceMemoFilters = ({ filters, onFilterChange, onClose }) => {
  const handleSearchChange = (e) => {
    onFilterChange({ ...filters, search: e.target.value });
  };

  const handleStatusChange = (e) => {
    onFilterChange({ ...filters, status: e.target.value });
  };

  const handleStartDateChange = (e) => {
    onFilterChange({ ...filters, startDate: e.target.value });
  };

  const handleEndDateChange = (e) => {
    onFilterChange({ ...filters, endDate: e.target.value });
  };

  const handleOwnerChange = (e) => {
    onFilterChange({ ...filters, owner: e.target.value });
  };

  const handleClearFilters = () => {
    onFilterChange({
      search: '',
      searchAccount: '',
      searchName: '',
      searchAddress: '',
      searchMemo: '',
      status: '',
      startDate: '',
      endDate: '',
      owner: '',
    });
  };

  const hasActiveFilters =
    filters.search ||
    filters.searchAccount ||
    filters.searchName ||
    filters.searchAddress ||
    filters.searchMemo ||
    filters.status ||
    filters.startDate ||
    filters.endDate ||
    filters.owner;

  return (
    <div className="service-memo-filter-drawer-backdrop" onClick={onClose}>
      <div className="service-memo-filter-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="service-memo-filter-drawer-header">
          <h3>Filter Service Memos</h3>
          <button className="service-memo-filter-drawer-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <div className="service-memo-filter-drawer-body">
          <div className="service-memo-filter-group">
            <label htmlFor="search">Search</label>
            <input
              id="search"
              type="text"
              value={filters.search}
              onChange={handleSearchChange}
              placeholder="Search by ticket ID or customer name..."
            />
          </div>

          <div className="service-memo-filter-group">
            <label htmlFor="status">Ticket Status</label>
            <select id="status" value={filters.status} onChange={handleStatusChange}>
              <option value="">All Statuses</option>
              <option value="Restored">Restored</option>
              <option value="Unresolved">Unresolved</option>
              <option value="NoFaultFound">No Fault Found</option>
              <option value="AccessDenied">Access Denied</option>
            </select>
          </div>

          <div className="service-memo-filter-group">
            <label htmlFor="startDate">Start Date</label>
            <input
              id="startDate"
              type="date"
              value={filters.startDate}
              onChange={handleStartDateChange}
            />
          </div>

          <div className="service-memo-filter-group">
            <label htmlFor="endDate">End Date</label>
            <input
              id="endDate"
              type="date"
              value={filters.endDate}
              onChange={handleEndDateChange}
            />
          </div>

          <div className="service-memo-filter-group">
            <label htmlFor="owner">Owner Email</label>
            <input
              id="owner"
              type="email"
              value={filters.owner}
              onChange={handleOwnerChange}
              placeholder="Filter by owner email..."
            />
          </div>
        </div>

        <div className="service-memo-filter-drawer-footer">
          {hasActiveFilters && (
            <button
              type="button"
              className="service-memo-filter-btn service-memo-filter-btn--clear"
              onClick={handleClearFilters}
            >
              Clear All
            </button>
          )}
          <button
            type="button"
            className="service-memo-filter-btn service-memo-filter-btn--apply"
            onClick={onClose}
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServiceMemoFilters;

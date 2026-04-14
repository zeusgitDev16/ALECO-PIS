import React, { useEffect, useRef, useState } from 'react';

const CONTACT_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'verified', label: 'Verified' },
  { key: 'unverified', label: 'Unverified' },
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
];

const DEBOUNCE_MS = 400;

const B2BContactsSidebarFilters = ({
  filter,
  searchQuery,
  onFilterChange,
  onSearchChange,
  onClearAll,
}) => {
  const [searchInput, setSearchInput] = useState(searchQuery || '');
  const debounceRef = useRef(null);

  useEffect(() => {
    setSearchInput(searchQuery || '');
  }, [searchQuery]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleSearchChange = (e) => {
    const next = e.target.value;
    setSearchInput(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearchChange(next);
      debounceRef.current = null;
    }, DEBOUNCE_MS);
  };

  return (
    <div className="b2b-filter-panel">
      <h4 className="b2b-filter-panel-title">Contact Filters</h4>
      <div className="b2b-filter-group">
        {CONTACT_FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`b2b-side-filter-btn ${filter === item.key ? 'is-active' : ''}`}
            onClick={() => onFilterChange(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="b2b-filter-group">
        <label className="b2b-side-label" htmlFor="b2b-contact-search">
          Search
        </label>
        <input
          id="b2b-contact-search"
          type="search"
          className="b2b-side-input"
          placeholder="Name, email, company..."
          value={searchInput}
          onChange={handleSearchChange}
        />
      </div>
      <button type="button" className="b2b-side-reset" onClick={onClearAll}>
        Clear All
      </button>
    </div>
  );
};

export default B2BContactsSidebarFilters;

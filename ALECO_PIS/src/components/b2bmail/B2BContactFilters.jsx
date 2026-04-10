import React, { useState, useRef, useEffect } from 'react';

const FILTER_CHIPS = [
  { key: 'all', label: 'All' },
  { key: 'verified', label: 'Verified' },
  { key: 'unverified', label: 'Unverified' },
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
];

const DEBOUNCE_MS = 400;

/**
 * @param {object} props
 * @param {string} props.activeFilter - 'all' | 'verified' | 'unverified' | 'active' | 'inactive'
 * @param {(key: string) => void} props.onFilterChange
 * @param {string} props.searchQuery
 * @param {(q: string) => void} props.onSearchChange
 */
export default function B2BContactFilters({
  activeFilter,
  onFilterChange,
  searchQuery,
  onSearchChange,
}) {
  const [searchInput, setSearchInput] = useState(searchQuery || '');
  const debounceRef = useRef(null);

  useEffect(() => {
    setSearchInput(searchQuery || '');
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, [searchQuery]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearchChange(value);
      debounceRef.current = null;
    }, DEBOUNCE_MS);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="b2b-contact-filters">
      <div className="b2b-filter-chips" role="tablist" aria-label="Filter contacts">
        {FILTER_CHIPS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={activeFilter === key}
            className={`b2b-filter-chip ${activeFilter === key ? 'is-active' : ''}`}
            onClick={() => onFilterChange(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <input
        type="search"
        placeholder="Search name, email, company..."
        value={searchInput}
        onChange={handleSearchChange}
        className="b2b-search-input"
        aria-label="Search contacts"
      />
    </div>
  );
}
